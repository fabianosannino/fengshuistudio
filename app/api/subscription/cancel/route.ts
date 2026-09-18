/** Cancel only the authenticated owner's verified subscription at period end. */
import { NextResponse } from 'next/server'
import stripeClient from '../../../../src/lib/stripe'
import { createRouteHandlerClient } from '../../../../src/lib/supabase-route'
import { createSupabaseAdminClient } from '../../../../src/lib/supabase-admin'
import { logger } from '../../../../src/lib/logger'
import { rateLimit, ipDaRequisicao } from '../../../../src/lib/rate-limit'
import { sincronizarAssinatura } from '../../../../src/lib/sincronizar-assinatura'

const ROUTE = '/api/subscription/cancel'
export const maxDuration = 60
const indisponivel = () => NextResponse.json({ error: 'Não foi possível confirmar o cancelamento. Consulte o portal de cobrança ou tente novamente.' }, { status: 503 })
export async function POST(request: Request) {
  const limite = await rateLimit(ipDaRequisicao(request), { limit: 5, windowMs: 60_000, escopo: 'POST:/api/subscription/cancel', exigirCompartilhado: true })
  if (limite.indisponivel) return indisponivel()
  if (!limite.success) return NextResponse.json({ error: 'Muitas requisições.' }, { status: 429, headers: { 'Retry-After': '60' } })
  const sessao = await createRouteHandlerClient()
  const { data: { user } } = await sessao.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const { data: perfil, error } = await sessao.from('profiles').select('stripe_customer_id').eq('id', user.id).single()
  if (error || !perfil) return indisponivel()
  if (!perfil.stripe_customer_id) return NextResponse.json({ error: 'Nenhuma assinatura vinculada.' }, { status: 404 })
  try {
    const customer = perfil.stripe_customer_id as string
    const pagina = await stripeClient.subscriptions.list({ customer, status: 'all', limit: 100 }, { timeout: 20_000, maxNetworkRetries: 1 })
    const vigentes = pagina.data.filter(s => !['canceled','incomplete_expired'].includes(s.status))
    if (pagina.has_more || vigentes.length > 1) return NextResponse.json({ error: 'Gerencie suas assinaturas pelo portal de cobrança.', portal: true }, { status: 409 })
    const subscription = vigentes[0]
    if (!subscription) return NextResponse.json({ error: 'Nenhuma assinatura em andamento.' }, { status: 404 })
    const dono = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id
    if (dono !== customer) return indisponivel()
    if (!subscription.cancel_at_period_end) {
      const atual = await stripeClient.subscriptions.update(subscription.id, { cancel_at_period_end: true }, { timeout: 20_000, maxNetworkRetries: 1 })
      if (!atual.cancel_at_period_end || (typeof atual.customer === 'string' ? atual.customer : atual.customer?.id) !== customer) return indisponivel()
    }
    const admin = createSupabaseAdminClient()
    const resultado = await sincronizarAssinatura(admin, subscription.id, ROUTE, customer)
    if (resultado.situacao === 'falhou' || !resultado.cancelamentoAgendado) return indisponivel()
    // These secondary records do not undo confirmed provider/local state.
    const registros = await Promise.allSettled([
      admin.from('payment_notifications').upsert({ user_id: user.id, type: 'subscription_cancel_by_user', channel: 'in_app',
        referencia_evento: `cancelamento:${subscription.id}:${subscription.items?.data?.[0]?.current_period_end ?? 'periodo'}`,
        sent_at: new Date().toISOString(), content: 'Renovação cancelada. Seu acesso continua até o fim do período vigente.',
      }, { onConflict: 'user_id,type,referencia_evento', ignoreDuplicates: true }),
      admin.from('admin_audit_log').insert({ action: 'cancel_subscription_by_user', target_type: 'subscription', target_id: resultado.linhaId, performed_by: user.id }),
    ])
    const aviso = registros.some(r => r.status === 'rejected' || r.value.error)
    if (aviso) logger.warn('Registro secundário do cancelamento pendente', { route: ROUTE })
    return NextResponse.json({ success: true, message: 'Assinatura será cancelada ao final do período atual', registro_secundario_pendente: aviso })
  } catch {
    logger.error('Cancelamento não confirmado', { route: ROUTE })
    return indisponivel()
  }
}
