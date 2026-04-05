/**
 * User Subscription Cancellation API
 *
 * POST /api/subscription/cancel — Cancel the user's own subscription
 *
 * Cancels at the end of the current billing period (not immediately).
 * The user keeps access until current_period_end.
 * Syncs with Stripe if there's a gateway subscription.
 */

import { NextResponse } from 'next/server'
import stripeClient from '../../../../src/lib/stripe'
import { createRouteHandlerClient } from '../../../../src/lib/supabase-route'
import { logger } from '../../../../src/lib/logger'
import { rateLimit } from '../../../../src/lib/rate-limit'

export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const { success: rateLimitOk } = rateLimit(ip, { limit: 5, windowMs: 60_000 })
  if (!rateLimitOk) {
    return NextResponse.json(
      { error: 'Muitas requisições. Tente novamente em alguns instantes.' },
      { status: 429, headers: { 'Retry-After': '60' } }
    )
  }

  const supabase = await createRouteHandlerClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  // Find active subscription
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('id, gateway_subscription_id, status, cancel_at_period_end')
    .eq('user_id', user.id)
    .in('status', ['active', 'past_due', 'trial'])
    .single()

  if (!subscription) {
    return NextResponse.json({ error: 'Nenhuma assinatura ativa encontrada' }, { status: 404 })
  }

  if (subscription.cancel_at_period_end) {
    return NextResponse.json({ error: 'Cancelamento já agendado' }, { status: 400 })
  }

  const now = new Date().toISOString()

  // Cancel at period end in Stripe if connected
  if (subscription.gateway_subscription_id) {
    try {
      await stripeClient.subscriptions.update(subscription.gateway_subscription_id, {
        cancel_at_period_end: true,
      })
    } catch (err) {
      logger.error('Failed to cancel Stripe subscription at period end', {
        route: '/api/subscription/cancel',
        subscriptionId: subscription.gateway_subscription_id,
        error: String(err),
      })
      return NextResponse.json({ error: 'Erro ao cancelar assinatura no provedor de pagamento' }, { status: 500 })
    }
  }

  // Update local subscription
  await supabase
    .from('subscriptions')
    .update({
      cancel_at_period_end: true,
      updated_at: now,
    })
    .eq('id', subscription.id)

  // Notification
  await supabase.from('payment_notifications').insert({
    user_id: user.id,
    type: 'subscription_cancel_by_user',
    channel: 'in_app',
    sent_at: now,
    content: 'Sua assinatura foi agendada para cancelamento ao final do período atual. Você continua com acesso até lá.',
  })

  // Audit log
  await supabase.from('admin_audit_log').insert({
    action: 'cancel_subscription_by_user',
    target_type: 'subscription',
    target_id: subscription.id,
    details: { user_id: user.id },
    performed_by: user.id,
  })

  logger.info('User cancelled subscription at period end', {
    route: '/api/subscription/cancel',
    userId: user.id,
    subscriptionId: subscription.id,
  })

  return NextResponse.json({ success: true, message: 'Assinatura será cancelada ao final do período atual' })
}
