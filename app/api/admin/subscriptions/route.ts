import { NextResponse } from 'next/server'
import { createRouteHandlerClient } from '../../../../src/lib/supabase-route'
import { rateLimit } from '../../../../src/lib/rate-limit'
import { logger } from '../../../../src/lib/logger'
import stripeClient from '../../../../src/lib/stripe'

async function verifyAdmin(supabase: Awaited<ReturnType<typeof createRouteHandlerClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (!profile || profile.role !== 'admin') return null
  return { user, profile }
}

// GET — dashboard metrics + user list with subscriptions
export async function GET(request: Request) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const { success } = rateLimit(ip, { limit: 30, windowMs: 60_000 })
  if (!success) return Response.json({ error: 'Rate limit' }, { status: 429 })

  const supabase = await createRouteHandlerClient()
  const admin = await verifyAdmin(supabase)
  if (!admin) return NextResponse.json({ error: 'Acesso restrito' }, { status: 403 })

  const url = new URL(request.url)
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'))
  const pageSize = 20
  const statusFilter = url.searchParams.get('status') || 'all'
  const planFilter = url.searchParams.get('plan') || 'all'
  const search = url.searchParams.get('search')?.slice(0, 100).replace(/[%_\\]/g, '') || ''
  const sortBy = url.searchParams.get('sort') || 'created_at'
  const sortDir = url.searchParams.get('dir') === 'asc'

  try {
    // Get metrics
    const [
      { data: allSubs },
      { data: allInvoices },
      { count: totalProfiles },
    ] = await Promise.all([
      supabase.from('subscriptions').select('*, plans(slug, price_monthly, price_yearly)'),
      supabase.from('invoices').select('*').in('status', ['pending', 'overdue', 'paid']),
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
    ])

    const activeSubs = (allSubs || []).filter(s => s.status === 'active' || s.status === 'gratuidade')
    const pastDueSubs = (allSubs || []).filter(s => s.status === 'past_due')
    const cancelledThisMonth = (allSubs || []).filter(s => {
      if (s.status !== 'cancelled' || !s.cancelled_at) return false
      const now = new Date()
      const cancelled = new Date(s.cancelled_at)
      return cancelled.getMonth() === now.getMonth() && cancelled.getFullYear() === now.getFullYear()
    })
    const gratuidadeSubs = (allSubs || []).filter(s => s.status === 'gratuidade')

    // Calculate MRR
    let mrr = 0
    for (const sub of activeSubs) {
      if (sub.status === 'gratuidade') continue
      const plan = sub.plans
      if (!plan) continue
      if (sub.billing_cycle === 'yearly') {
        mrr += (plan.price_yearly || 0) / 12
      } else {
        mrr += plan.price_monthly || 0
      }
    }

    const pastDueAmount = (allInvoices || [])
      .filter(inv => inv.status === 'overdue')
      .reduce((sum: number, inv: { amount: number; amount_paid: number }) => sum + (inv.amount - inv.amount_paid), 0)

    const metrics = {
      mrr: Math.round(mrr * 100) / 100,
      arr: Math.round(mrr * 12 * 100) / 100,
      totalActive: activeSubs.length,
      pastDue: pastDueSubs.length,
      pastDueAmount: Math.round(pastDueAmount * 100) / 100,
      cancelledThisMonth: cancelledThisMonth.length,
      gratuidades: gratuidadeSubs.length,
      totalUsers: totalProfiles || 0,
    }

    // User list query
    let query = supabase
      .from('profiles')
      .select(`
        id, nome_completo, plano, tipo_usuario, role, criado_em,
        subscriptions(id, plan_id, billing_cycle, status, price_paid, started_at, current_period_end, next_billing_date, cancelled_at, cancel_at_period_end, gratuidade_motivo, gateway_subscription_id, plans(name, slug, price_monthly, price_yearly))
      `, { count: 'exact' })
      .order(sortBy === 'nome_completo' ? 'nome_completo' : 'criado_em', { ascending: sortDir })

    if (search) {
      query = query.or(`nome_completo.ilike.%${search}%,id.eq.${search.length === 36 ? search : '00000000-0000-0000-0000-000000000000'}`)
    }

    if (planFilter !== 'all') {
      query = query.eq('plano', planFilter)
    }

    query = query.range((page - 1) * pageSize, page * pageSize - 1)

    const { data: users, count, error } = await query
    if (error) {
      logger.error('Admin subscriptions list error', { route: '/api/admin/subscriptions', error: error.message })
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    // If status filter active, filter client-side (since subscription status is in joined table)
    let filteredUsers = users || []
    if (statusFilter !== 'all') {
      filteredUsers = filteredUsers.filter(u => {
        const subs = (u.subscriptions || []) as Array<{ status: string }>
        if (statusFilter === 'free') return subs.length === 0 || subs.every(s => s.status === 'cancelled')
        return subs.some(s => s.status === statusFilter)
      })
    }

    return NextResponse.json({ metrics, users: filteredUsers, total: count, page, pageSize })
  } catch (err) {
    logger.error('Admin subscriptions error', { route: '/api/admin/subscriptions', error: String(err) })
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// POST — admin actions: gratuidade, change_plan, cancel, mark_paid, refund
export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const { success } = rateLimit(ip, { limit: 20, windowMs: 60_000 })
  if (!success) return Response.json({ error: 'Rate limit' }, { status: 429 })

  const supabase = await createRouteHandlerClient()
  const admin = await verifyAdmin(supabase)
  if (!admin) return NextResponse.json({ error: 'Acesso restrito' }, { status: 403 })

  let body: Record<string, unknown>
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Body inválido' }, { status: 400 }) }

  const action = body.action as string
  const targetUserId = body.user_id as string

  if (!action || !targetUserId) {
    return NextResponse.json({ error: 'action e user_id são obrigatórios' }, { status: 400 })
  }

  // Get target user profile
  const { data: targetProfile } = await supabase.from('profiles').select('*').eq('id', targetUserId).single()
  if (!targetProfile) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })

  try {
    switch (action) {
      case 'gratuidade': {
        const planSlug = (body.plan_slug as string) || 'profissional'
        const durationMonths = body.duration_months as number | null
        const motivo = body.motivo as string
        if (!motivo) return NextResponse.json({ error: 'Motivo é obrigatório' }, { status: 400 })

        // Find plan
        const { data: plan } = await supabase.from('plans').select('*').eq('slug', planSlug).single()
        if (!plan) return NextResponse.json({ error: 'Plano não encontrado' }, { status: 404 })

        const now = new Date()
        const periodEnd = durationMonths
          ? new Date(now.getTime() + durationMonths * 30 * 24 * 60 * 60 * 1000)
          : null

        // Cancel existing active subscriptions (both local and Stripe)
        await cancelExistingSubscriptions(supabase, targetUserId, targetProfile.stripe_customer_id)

        // Create gratuidade subscription
        const { error: subErr } = await supabase.from('subscriptions').insert({
          user_id: targetUserId,
          plan_id: plan.id,
          billing_cycle: 'monthly',
          status: 'gratuidade',
          price_paid: 0,
          current_period_start: now.toISOString(),
          current_period_end: periodEnd?.toISOString() || null,
          gratuidade_motivo: motivo,
        })
        if (subErr) throw subErr

        // Update profile plan
        await supabase.from('profiles').update({ plano: planSlug }).eq('id', targetUserId)

        // Audit log
        await supabase.from('admin_audit_log').insert({
          action: 'gratuidade',
          target_type: 'user',
          target_id: targetUserId,
          details: {
            user_nome: targetProfile.nome_completo,
            user_email: targetProfile.id,
            plan_slug: planSlug,
            duration_months: durationMonths,
            motivo,
            previous_plan: targetProfile.plano,
          },
          performed_by: admin.user.id,
        })

        return NextResponse.json({ success: true, message: `Gratuidade ${planSlug} concedida para ${targetProfile.nome_completo}` })
      }

      case 'change_plan': {
        const newPlan = body.plan_slug as string
        const motivo = body.motivo as string
        if (!newPlan || !motivo) return NextResponse.json({ error: 'plan_slug e motivo são obrigatórios' }, { status: 400 })

        const previousPlan = targetProfile.plano

        // Find plan in plans table
        const { data: plan } = await supabase.from('plans').select('*').eq('slug', newPlan).single()
        if (!plan) return NextResponse.json({ error: 'Plano não encontrado' }, { status: 404 })

        // Cancel existing subscriptions (both local and Stripe)
        await cancelExistingSubscriptions(supabase, targetUserId, targetProfile.stripe_customer_id)

        if (newPlan !== 'free') {
          const now = new Date()
          // Create new subscription
          await supabase.from('subscriptions').insert({
            user_id: targetUserId,
            plan_id: plan.id,
            billing_cycle: 'monthly',
            status: 'active',
            price_paid: 0,
            current_period_start: now.toISOString(),
          })
        }

        // Update profile
        await supabase.from('profiles').update({ plano: newPlan }).eq('id', targetUserId)

        await supabase.from('admin_audit_log').insert({
          action: 'change_plan',
          target_type: 'user',
          target_id: targetUserId,
          details: { user_nome: targetProfile.nome_completo, previous_plan: previousPlan, new_plan: newPlan, motivo },
          performed_by: admin.user.id,
        })

        return NextResponse.json({ success: true, message: `Plano alterado para ${newPlan}` })
      }

      case 'cancel_subscription': {
        const immediate = body.immediate as boolean
        const motivo = body.motivo as string
        if (!motivo) return NextResponse.json({ error: 'Motivo é obrigatório' }, { status: 400 })

        const now = new Date()

        if (immediate) {
          // Cancel in Stripe first
          await cancelExistingSubscriptions(supabase, targetUserId, targetProfile.stripe_customer_id)
          await supabase.from('profiles').update({ plano: 'free' }).eq('id', targetUserId)
        } else {
          // Cancel at period end — sync with Stripe
          const { data: activeSubs } = await supabase
            .from('subscriptions')
            .select('id, gateway_subscription_id')
            .eq('user_id', targetUserId)
            .in('status', ['active', 'gratuidade'])

          for (const sub of activeSubs || []) {
            if (sub.gateway_subscription_id) {
              try {
                await stripeClient.subscriptions.update(sub.gateway_subscription_id, {
                  cancel_at_period_end: true,
                })
              } catch (err) {
                logger.warn('Failed to set cancel_at_period_end on Stripe', {
                  subscriptionId: sub.gateway_subscription_id,
                  error: String(err),
                })
              }
            }
          }

          await supabase.from('subscriptions').update({ cancel_at_period_end: true, updated_at: now.toISOString() })
            .eq('user_id', targetUserId).in('status', ['active', 'gratuidade'])
        }

        await supabase.from('admin_audit_log').insert({
          action: 'cancel_subscription',
          target_type: 'user',
          target_id: targetUserId,
          details: { user_nome: targetProfile.nome_completo, immediate, motivo, previous_plan: targetProfile.plano },
          performed_by: admin.user.id,
        })

        // Notify user
        await supabase.from('payment_notifications').insert({
          user_id: targetUserId,
          type: immediate ? 'subscription_cancelled' : 'subscription_cancel_scheduled',
          channel: 'in_app',
          sent_at: now.toISOString(),
          content: immediate
            ? `Sua assinatura foi cancelada. Motivo: ${motivo}`
            : `Sua assinatura será cancelada ao final do período atual. Motivo: ${motivo}`,
        })

        return NextResponse.json({ success: true, message: immediate ? 'Assinatura cancelada imediatamente' : 'Assinatura será cancelada ao final do período' })
      }

      case 'mark_paid': {
        const invoiceId = body.invoice_id as string
        const paidDate = body.paid_date as string
        const paidMethod = body.paid_method as string
        const observation = body.observation as string

        if (!invoiceId) return NextResponse.json({ error: 'invoice_id é obrigatório' }, { status: 400 })

        const { data: invoice } = await supabase.from('invoices').select('*').eq('id', invoiceId).single()
        if (!invoice) return NextResponse.json({ error: 'Fatura não encontrada' }, { status: 404 })

        // Prevent double-marking
        if (invoice.status === 'paid') {
          return NextResponse.json({ error: 'Fatura já está marcada como paga' }, { status: 400 })
        }

        await supabase.from('invoices').update({
          status: 'paid',
          paid_at: paidDate || new Date().toISOString(),
          amount_paid: invoice.amount,
          paid_manually: true,
          paid_method: paidMethod || 'manual',
          paid_by_admin: admin.user.id,
          notes: observation || null,
        }).eq('id', invoiceId)

        // Reactivate subscription if it was past_due
        if (invoice.subscription_id) {
          await supabase.from('subscriptions').update({ status: 'active', updated_at: new Date().toISOString() })
            .eq('id', invoice.subscription_id).eq('status', 'past_due')
        }

        await supabase.from('admin_audit_log').insert({
          action: 'mark_paid',
          target_type: 'invoice',
          target_id: invoiceId,
          details: { user_nome: targetProfile.nome_completo, amount: invoice.amount, paid_method: paidMethod, observation },
          performed_by: admin.user.id,
        })

        return NextResponse.json({ success: true, message: 'Fatura marcada como paga' })
      }

      case 'refund': {
        const invoiceId = body.invoice_id as string
        const refundAmount = body.refund_amount as number
        const motivo = body.motivo as string
        const isCredit = body.is_credit as boolean

        if (!invoiceId || !motivo) return NextResponse.json({ error: 'invoice_id e motivo são obrigatórios' }, { status: 400 })

        const { data: invoice } = await supabase.from('invoices').select('*').eq('id', invoiceId).single()
        if (!invoice) return NextResponse.json({ error: 'Fatura não encontrada' }, { status: 404 })

        if (invoice.status === 'refunded') {
          return NextResponse.json({ error: 'Fatura já foi reembolsada' }, { status: 400 })
        }

        const amount = refundAmount || invoice.amount_paid
        let stripeRefundId: string | null = null

        // Process real Stripe refund if the invoice has a gateway_invoice_id and it's not just a credit
        if (!isCredit && invoice.gateway_invoice_id) {
          try {
            // Get the Stripe invoice to find the payment intent
            // Stripe SDK v22 returns Response<Invoice>, cast to access properties
            const stripeInvoiceResponse = await stripeClient.invoices.retrieve(invoice.gateway_invoice_id) as unknown as Record<string, unknown>
            const piField = stripeInvoiceResponse.payment_intent
            const paymentIntentId = typeof piField === 'string'
              ? piField
              : (piField as { id: string } | null)?.id

            if (paymentIntentId) {
              const refund = await stripeClient.refunds.create({
                payment_intent: paymentIntentId,
                amount: Math.round(amount * 100), // Convert BRL to centavos
                reason: 'requested_by_customer',
                metadata: {
                  admin_id: admin.user.id,
                  motivo,
                  invoice_id: invoiceId,
                },
              })
              stripeRefundId = refund.id
              logger.info('Stripe refund processed', {
                route: '/api/admin/subscriptions',
                refundId: refund.id,
                amount,
                invoiceId,
              })
            }
          } catch (err) {
            logger.error('Stripe refund failed', {
              route: '/api/admin/subscriptions',
              error: String(err),
              invoiceId,
            })
            return NextResponse.json({
              error: `Erro ao processar reembolso no Stripe: ${String(err)}. Use "crédito" para registrar sem reembolso real.`,
            }, { status: 500 })
          }
        }

        await supabase.from('invoices').update({
          status: isCredit ? 'paid' : 'refunded',
          refunded_at: new Date().toISOString(),
          refund_amount: amount,
          notes: `${isCredit ? 'Crédito' : 'Reembolso'}: ${motivo}${stripeRefundId ? ` (Stripe: ${stripeRefundId})` : ''}`,
        }).eq('id', invoiceId)

        // Notify user
        await supabase.from('payment_notifications').insert({
          user_id: targetUserId,
          invoice_id: invoiceId,
          type: isCredit ? 'credit_applied' : 'refund_processed',
          channel: 'in_app',
          sent_at: new Date().toISOString(),
          content: isCredit
            ? `Crédito de R$ ${amount.toFixed(2)} aplicado à sua conta. Motivo: ${motivo}`
            : `Reembolso de R$ ${amount.toFixed(2)} processado. O valor será devolvido ao seu meio de pagamento original.`,
        })

        await supabase.from('admin_audit_log').insert({
          action: isCredit ? 'credit' : 'refund',
          target_type: 'invoice',
          target_id: invoiceId,
          details: {
            user_nome: targetProfile.nome_completo,
            amount,
            motivo,
            is_credit: isCredit,
            stripe_refund_id: stripeRefundId,
          },
          performed_by: admin.user.id,
        })

        return NextResponse.json({
          success: true,
          message: isCredit
            ? 'Crédito registrado'
            : `Reembolso de R$ ${amount.toFixed(2)} processado${stripeRefundId ? ' via Stripe' : ''}`,
          stripe_refund_id: stripeRefundId,
        })
      }

      default:
        return NextResponse.json({ error: 'Ação inválida' }, { status: 400 })
    }
  } catch (err) {
    logger.error('Admin subscription action error', { route: '/api/admin/subscriptions', action, error: String(err) })
    return NextResponse.json({ error: 'Erro ao executar ação.' }, { status: 500 })
  }
}

// ── Helper: Cancel all active subscriptions (local DB + Stripe) ──────────────

async function cancelExistingSubscriptions(
  supabase: Awaited<ReturnType<typeof createRouteHandlerClient>>,
  userId: string,
  stripeCustomerId?: string | null
) {
  const now = new Date().toISOString()

  // Get active subscriptions with Stripe IDs
  const { data: activeSubs } = await supabase
    .from('subscriptions')
    .select('id, gateway_subscription_id')
    .eq('user_id', userId)
    .in('status', ['active', 'past_due', 'gratuidade', 'trial'])

  // Cancel each in Stripe
  for (const sub of activeSubs || []) {
    if (sub.gateway_subscription_id) {
      try {
        await stripeClient.subscriptions.cancel(sub.gateway_subscription_id)
      } catch (err) {
        // Log but don't fail — subscription may already be cancelled in Stripe
        logger.warn('Failed to cancel Stripe subscription', {
          subscriptionId: sub.gateway_subscription_id,
          error: String(err),
        })
      }
    }
  }

  // Cancel all locally
  await supabase
    .from('subscriptions')
    .update({ status: 'cancelled', cancelled_at: now, updated_at: now })
    .eq('user_id', userId)
    .in('status', ['active', 'past_due', 'gratuidade', 'trial'])
}
