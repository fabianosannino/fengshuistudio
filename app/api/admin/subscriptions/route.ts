import { NextResponse } from 'next/server'
import { createRouteHandlerClient } from '../../../../src/lib/supabase-route'
import { createSupabaseAdminClient } from '../../../../src/lib/supabase-admin'
import { exigirCapacidade, respostaDaGuarda } from '../../../../src/lib/guarda-admin'
import { rateLimit, ipDaRequisicao } from '../../../../src/lib/rate-limit'
import { logger } from '../../../../src/lib/logger'
import { escreverBestEffort } from '../../../../src/lib/supabase-escrita'
import { conceder, encerrarConcessao, concessoesVivas } from '../../../../src/lib/concessoes-de-plano'
import { sincronizarAssinatura } from '../../../../src/lib/sincronizar-assinatura'
import stripeClient from '../../../../src/lib/stripe'
import { enumDoPlano, planoEfetivo, mensalidadeDaAssinatura } from '../../../../src/lib/plano-utils'

const ROUTE = '/api/admin/subscriptions'

type ClienteSupabase = Awaited<ReturnType<typeof createRouteHandlerClient>>

interface EntradaAuditoria {
  action: string
  target_type: string
  target_id: string
  details: Record<string, unknown>
}

/**
 * A trilha de auditoria é best-effort *declarado*: a ação administrativa já
 * aconteceu quando chegamos aqui, então lançar devolveria "erro" para algo que
 * foi aplicado. O retorno vira aviso na resposta — o admin fica sabendo que a
 * ação valeu mas não ficou registrada, em vez de nós escolhermos por ele qual
 * das duas mentiras contar (ADR 0019/0020).
 */
async function registrarAuditoria(
  supabase: ClienteSupabase,
  entrada: EntradaAuditoria,
  adminId: string
): Promise<boolean> {
  return escreverBestEffort(
    supabase.from('admin_audit_log').insert({
      ...entrada,
      performed_by: adminId,
      performed_at: new Date().toISOString(),
    }),
    { rota: ROUTE, operacao: `audit-${entrada.action}`, userId: adminId }
  )
}

/** Sucesso honesto: se a auditoria não gravou, a mensagem diz. */
function respostaDeAcao(mensagem: string, auditoriaRegistrada: boolean, extra?: Record<string, unknown>) {
  return NextResponse.json({
    success: true,
    message: auditoriaRegistrada
      ? mensagem
      : `${mensagem}. Atenção: a ação foi aplicada, mas não foi registrada na trilha de auditoria`,
    auditoria_registrada: auditoriaRegistrada,
    ...extra,
  })
}

// GET — dashboard metrics + user list with subscriptions
export async function GET(request: Request) {
  const ip = ipDaRequisicao(request)
  const { success } = await rateLimit(ip, { limit: 30, windowMs: 60_000 })
  if (!success) return Response.json({ error: 'Rate limit' }, { status: 429 })

  const sessao = await createRouteHandlerClient()
  const admin = await exigirCapacidade(sessao, 'assinaturas:escrever')
  if (!admin.ok) return respostaDaGuarda(admin, '/api/admin/subscriptions')
  const supabase = createSupabaseAdminClient()

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
      { data: allSubs, error: erroSubs },
      { data: allInvoices, error: erroInvoices },
      { count: totalProfiles, error: erroProfiles },
      { data: allGrants, error: erroGrants },
    ] = await Promise.all([
      supabase.from('subscriptions').select('*, plans(slug, price_monthly, price_yearly)'),
      supabase.from('invoices').select('*').in('status', ['pending', 'overdue', 'paid']),
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
      supabase.from('concessoes_de_plano').select('*'),
    ])

    if (erroSubs || erroInvoices || erroProfiles || erroGrants) throw new Error('Métricas indisponíveis')
    const beneficios = concessoesVivas(allGrants ?? []).filter(c => c.origem !== 'assinatura')
    const activeSubs = (allSubs || []).filter(s => s.status === 'active' && s.gateway_subscription_id)
    const pastDueSubs = (allSubs || []).filter(s => s.status === 'past_due')
    const cancelledThisMonth = (allSubs || []).filter(s => {
      if (s.status !== 'cancelled' || !s.cancelled_at) return false
      const now = new Date()
      const cancelled = new Date(s.cancelled_at)
      return cancelled.getMonth() === now.getMonth() && cancelled.getFullYear() === now.getFullYear()
    })

    // Calculate MRR
    // Do que foi cobrado, não do preço de tabela — ver `mensalidadeDaAssinatura`.
    let mrr = 0
    let assinaturasSemValor = 0
    for (const sub of activeSubs) {
      if (sub.status === 'gratuidade') continue
      const mensal = mensalidadeDaAssinatura(sub)
      if (mensal === null) { assinaturasSemValor++; continue }
      mrr += mensal
    }

    const pastDueAmount = (allInvoices || [])
      .filter(inv => inv.status === 'overdue')
      .reduce((sum: number, inv: { amount: number; amount_paid: number }) => sum + (inv.amount - inv.amount_paid), 0)

    const metrics = {
      mrr: Math.round(mrr * 100) / 100,
      arr: Math.round(mrr * 12 * 100) / 100,
      // Ativas sem `price_paid` — fora do MRR e declaradas, não escondidas.
      assinaturas_sem_valor: assinaturasSemValor,
      totalActive: activeSubs.length,
      pastDue: pastDueSubs.length,
      pastDueAmount: Math.round(pastDueAmount * 100) / 100,
      cancelledThisMonth: cancelledThisMonth.length,
      gratuidades: new Set(beneficios.map(c => c.user_id)).size,
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

    /*
     * O filtro fala o vocabulário do app; a coluna é do enum do banco.
     *
     * Sem esta tradução, `eq('plano', 'profissional')` levantava
     * `invalid input value for enum plano_tipo` e a lista voltava vazia — o
     * admin filtrava por Profissional e concluía que ninguém tinha o plano.
     * Três das quatro opções do seletor caíam nisso; a única que funcionava
     * era `pro`, o valor cru, que a tela oferecia por fora do vocabulário.
     *
     * `enumDoPlano` existe há tempo para exatamente isto, e está importado
     * neste arquivo desde então — usado na escrita, esquecido na leitura.
     */
    if (planFilter !== 'all') {
      const efetivo = planoEfetivo(planFilter)
      query = query.eq('plano', enumDoPlano(efetivo))
    }

    query = query.range((page - 1) * pageSize, page * pageSize - 1)

    const { data: users, count, error } = await query
    if (error) {
      logger.error('Admin subscriptions list error', { route: ROUTE, error: error.message })
      return NextResponse.json({ error: 'Não foi possível carregar a lista' }, { status: 400 })
    }

    // If status filter active, filter client-side (since subscription status is in joined table)
    let filteredUsers = (users || []).map(u => ({ ...u, subscriptions: [
      ...(u.subscriptions || []).filter(s => s.gateway_subscription_id || s.status !== 'gratuidade'),
      ...beneficios.filter(c => c.user_id === u.id).map(c => ({
        id: `concessao:${c.id}`, status: 'gratuidade', billing_cycle: 'beneficio', price_paid: 0,
        current_period_end: c.valido_ate ?? null, next_billing_date: null,
        gratuidade_motivo: `Origem: ${c.origem}`,
        plans: { name: c.plano, slug: c.plano, price_monthly: 0, price_yearly: 0 },
      })),
    ] }))
    if (statusFilter !== 'all') {
      filteredUsers = filteredUsers.filter(u => {
        const subs = (u.subscriptions || []) as Array<{ status: string }>
        if (statusFilter === 'free') return subs.length === 0 || subs.every(s => s.status === 'cancelled')
        return subs.some(s => s.status === statusFilter)
      })
    }

    return NextResponse.json({ metrics, users: filteredUsers, total: count, page, pageSize })
  } catch {
    logger.error('Admin subscriptions error', { route: ROUTE })
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// POST — admin actions: gratuidade, change_plan, cancel, mark_paid, refund
export async function POST(request: Request) {
  const ip = ipDaRequisicao(request)
  const { success } = await rateLimit(ip, { limit: 20, windowMs: 60_000 })
  if (!success) return Response.json({ error: 'Rate limit' }, { status: 429 })

  const sessao = await createRouteHandlerClient()
  const admin = await exigirCapacidade(sessao, 'assinaturas:escrever')
  if (!admin.ok) return respostaDaGuarda(admin, '/api/admin/subscriptions')
  const supabase = createSupabaseAdminClient()

  let body: Record<string, unknown>
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Body inválido' }, { status: 400 }) }

  if (!body || typeof body !== 'object' || Array.isArray(body)) return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  const action = body.action as string
  const targetUserId = body.user_id as string

  if (typeof action !== 'string' || typeof targetUserId !== 'string' || !action || !targetUserId) {
    return NextResponse.json({ error: 'action e user_id são obrigatórios' }, { status: 400 })
  }

  // Get target user profile
  const { data: targetProfile, error: profileError } = await supabase.from('profiles').select('*').eq('id', targetUserId).single()
  if (profileError) return NextResponse.json({ error: 'Não foi possível consultar o perfil.' }, { status: 503 })
  if (!targetProfile) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })

  try {
    switch (action) {
      case 'gratuidade':
      case 'change_plan': {
        const planSlug = body.plan_slug
        const motivo = body.motivo
        const meses = body.duration_months
        if (typeof planSlug !== 'string' || !['free', 'simples', 'profissional'].includes(planSlug)
          || typeof motivo !== 'string' || !motivo.trim()
          || (meses != null && (!Number.isInteger(meses) || Number(meses) < 1 || Number(meses) > 120))) {
          return NextResponse.json({ error: 'Plano, motivo ou duração inválidos.' }, { status: 400 })
        }
        const parametros = { userId: targetUserId, origem: 'cortesia' as const,
          referencia: `admin:${targetUserId}`, motivo }
        // Calendar months, clamped to the last day of the destination month.
        const fim = meses ? new Date() : null
        if (fim) {
          const dia = fim.getUTCDate()
          fim.setUTCDate(1)
          fim.setUTCMonth(fim.getUTCMonth() + Number(meses))
          const ultimoDia = new Date(Date.UTC(fim.getUTCFullYear(), fim.getUTCMonth() + 1, 0)).getUTCDate()
          fim.setUTCDate(Math.min(dia, ultimoDia))
        }
        const ok = planSlug === 'free'
          ? await encerrarConcessao(supabase, parametros, ROUTE)
          : await conceder(supabase, { ...parametros, plano: planoEfetivo(planSlug), validoAte: fim?.toISOString(), criadaPor: admin.user.id }, ROUTE)
        if (!ok) throw new Error('Falha ao alterar concessão')
        const auditoriaOk = await registrarAuditoria(supabase, {
          action, target_type: 'user', target_id: targetUserId,
          details: { plan_slug: planSlug, duration_months: meses ?? null, motivo },
        }, admin.user.id)
        return respostaDeAcao('Benefício manual atualizado. Assinaturas e direitos de outras origens foram preservados.', auditoriaOk)
      }

      case 'cancel_subscription': {
        if (typeof body.immediate !== 'boolean') return NextResponse.json({ error: 'Tipo de cancelamento inválido.' }, { status: 400 })
        const immediate = body.immediate
        const motivo = body.motivo as string
        if (!motivo) return NextResponse.json({ error: 'Motivo é obrigatório' }, { status: 400 })

        const now = new Date()

        await cancelarAssinaturasDoUsuario(supabase, targetProfile.stripe_customer_id, immediate)

        const auditoriaOk = await registrarAuditoria(supabase, {
          action: 'cancel_subscription',
          target_type: 'user',
          target_id: targetUserId,
          details: { user_nome: targetProfile.nome_completo, immediate, motivo, previous_plan: targetProfile.plano },
        }, admin.user.id)

        // Notify user — falhar aqui não desfaz o cancelamento, mas não pode sumir
        await escreverBestEffort(
          supabase.from('payment_notifications').insert({
            user_id: targetUserId,
            type: immediate ? 'subscription_cancelled' : 'subscription_cancel_scheduled',
            channel: 'in_app',
            sent_at: now.toISOString(),
            content: immediate
              ? `Sua assinatura foi cancelada. Motivo: ${motivo}`
              : `Sua assinatura será cancelada ao final do período atual. Motivo: ${motivo}`,
          }),
          { rota: ROUTE, operacao: 'insert-notification-cancelamento', userId: targetUserId }
        )

        return respostaDeAcao(
          immediate ? 'Assinatura cancelada imediatamente' : 'Assinatura será cancelada ao final do período',
          auditoriaOk
        )
      }

      case 'mark_paid':
      case 'refund': {
        // Provider movements need durable coordination and confirmed outcomes.
        // Do not fabricate a local settlement, credit, or refund in their absence.
        return NextResponse.json({
          error: 'Esta operação financeira está indisponível neste painel. Use o Dashboard do Stripe para conferir e tratar a cobrança. Nenhum pagamento, crédito ou reembolso foi registrado por esta solicitação.',
          code: 'operacao_financeira_indisponivel',
        }, { status: 409 })
      }
      default:
        return NextResponse.json({ error: 'Ação inválida' }, { status: 400 })
    }
  } catch {
    logger.error('Admin subscription action error', { route: ROUTE })
    return NextResponse.json({ error: 'Erro ao executar ação.' }, { status: 500 })
  }
}

/** Updates only subscriptions verified in the provider; benefits are independent. */
async function cancelarAssinaturasDoUsuario(
  supabase: ClienteSupabase, customerId: string | null, immediate: boolean
) {
  if (!customerId) throw new Error('Cliente de cobrança indisponível')
  const pagina = await stripeClient.subscriptions.list({ customer: customerId, status: 'all', limit: 100 })
  if (pagina.has_more) throw new Error('Use o portal para gerenciar este cliente')
  for (const sub of pagina.data) {
    if (['canceled', 'incomplete_expired'].includes(sub.status)) continue
    const atual = immediate
      ? await stripeClient.subscriptions.cancel(sub.id)
      : await stripeClient.subscriptions.update(sub.id, { cancel_at_period_end: true })
    const dono = typeof atual.customer === 'string' ? atual.customer : atual.customer.id
    if (dono !== customerId) throw new Error('Assinatura incompatível')
    const resultado = await sincronizarAssinatura(supabase, atual, ROUTE)
    if (resultado.situacao === 'falhou' || resultado.situacao === 'sem_perfil') throw new Error('Falha ao sincronizar cancelamento')
  }
}
