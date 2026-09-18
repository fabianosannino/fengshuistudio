import type Stripe from 'stripe'
import type { SupabaseClient } from '@supabase/supabase-js'
import stripe from './stripe'
import { comReservaFinanceira } from './sincronizar-financeiro-stripe'

const id = (ref: string | { id: string } | null | undefined) => typeof ref === 'string' ? ref : ref?.id ?? null
const valorValido = (n: number) => Number.isSafeInteger(n) && n >= 0 && n <= 2_147_483_647
function atual(objeto: { id: string; livemode: boolean }, esperado: string) {
  if (objeto.id !== esperado || objeto.livemode !== /^(sk|rk)_live_/.test(process.env.STRIPE_SECRET_KEY ?? '')) throw new Error('Objeto financeiro incompatível')
}
function instante(segundos: number) {
  if (!Number.isSafeInteger(segundos) || segundos <= 0) throw new Error('Instante financeiro inválido')
  return new Date(segundos * 1000).toISOString()
}
function opcoesDeLeitura(conta: string | null) {
  const fim = Date.now() + 35_000
  return (naPlataforma = false): Stripe.RequestOptions => {
    const restante = fim - Date.now()
    if (restante < 500) throw new Error('Prazo de conciliação excedido')
    return { timeout: Math.min(restante, 10_000), maxNetworkRetries: 0, ...(!naPlataforma && conta ? { stripeAccount: conta } : {}) }
  }
}

/** An unavailable lookup is never evidence that an event belongs elsewhere. */
export async function localizarPedidoDoReembolso(supabase: SupabaseClient, pagamento: string, conta: string | null): Promise<string | null> {
  let query = supabase.from('pedidos').select('id').eq('stripe_payment_intent', pagamento)
  query = conta ? query.eq('stripe_account_id', conta) : query.is('stripe_account_id', null)
  const { data, error } = await query.maybeSingle()
  if (error) throw new Error('Vínculo do pedido indisponível')
  return data?.id ?? null
}

/** No Stripe writes. Complete current refunds and fee refunds, then one database commit. */
export async function sincronizarReembolsosDaLoja(supabase: SupabaseClient, pedidoId: string, contaEsperada: string | null) {
  return comReservaFinanceira(supabase, `pedido:${pedidoId}`, async token => {
    const { data: pedido, error } = await supabase.from('pedidos')
      .select('id,stripe_payment_intent,stripe_account_id,vendedor_tipo,vendedor_perfil_id,total_centavos,taxa_plataforma_centavos,moeda')
      .eq('id', pedidoId).maybeSingle()
    if (error || !pedido || pedido.stripe_account_id !== contaEsperada || !pedido.stripe_payment_intent || pedido.moeda !== 'brl') throw new Error('Pedido incompatível')
    const opcoes = opcoesDeLeitura(contaEsperada)
    const intent = await stripe.paymentIntents.retrieve(pedido.stripe_payment_intent, { expand: ['latest_charge'] }, opcoes())
    atual(intent, pedido.stripe_payment_intent)
    const charge = intent.latest_charge
    if (!charge || typeof charge === 'string') throw new Error('Cobrança não expandida')
    atual(charge, charge.id)
    if (intent.status !== 'succeeded' || !charge.paid || charge.status !== 'succeeded'
      || intent.currency !== 'brl' || charge.currency !== 'brl' || id(charge.payment_intent) !== intent.id
      || intent.amount_received !== pedido.total_centavos || charge.amount_captured !== pedido.total_centavos
      || !valorValido(intent.amount_received)) throw new Error('Pagamento não confere com o pedido')
    const lista = await stripe.refunds.list({ charge: charge.id, limit: 100 }, opcoes())
    if (lista.has_more) throw new Error('Reembolsos incompletos')
    const reembolsos = lista.data.map(refund => {
      if (id(refund.charge) !== charge.id || id(refund.payment_intent) !== intent.id || refund.currency !== 'brl'
        || !valorValido(refund.amount) || refund.amount === 0 || !refund.status
        || !['succeeded', 'pending', 'requires_action', 'failed', 'canceled'].includes(refund.status)) throw new Error('Reembolso incompatível')
      return { id: refund.id, centavos: refund.amount, status: refund.status, criado_em: instante(refund.created) }
    }).sort((a, b) => a.id.localeCompare(b.id))
    let comissao = 0
    let estornosComissao: { id: string; centavos: number; criado_em: string }[] = []
    const feeId = id(charge.application_fee)
    if (feeId) {
      const fee = await stripe.applicationFees.retrieve(feeId, {}, opcoes(true))
      atual(fee, feeId)
      if (!contaEsperada || id(fee.account) !== contaEsperada || id(fee.charge) !== charge.id || fee.currency !== 'brl'
        || !valorValido(fee.amount) || fee.amount !== pedido.taxa_plataforma_centavos) throw new Error('Comissão incompatível')
      const estornos = await stripe.applicationFees.listRefunds(feeId, { limit: 100 }, opcoes(true))
      if (estornos.has_more) throw new Error('Estornos de comissão incompletos')
      estornosComissao = estornos.data.map(refund => {
        if (id(refund.fee) !== feeId || refund.currency !== 'brl' || !valorValido(refund.amount) || refund.amount === 0) throw new Error('Estorno de comissão incompatível')
        return { id: refund.id, centavos: refund.amount, criado_em: instante(refund.created) }
      }).sort((a, b) => a.id.localeCompare(b.id))
      if (estornosComissao.reduce((sum, refund) => sum + refund.centavos, 0) !== fee.amount_refunded) throw new Error('Totais da comissão divergentes')
      comissao = fee.amount
    }
    if (comissao !== pedido.taxa_plataforma_centavos) throw new Error('Comissão não comprovada')
    const gravacao = await supabase.rpc('aplicar_reembolsos_pedido', { p_pedido: pedidoId, p_token: token, p_dados: {
      account: contaEsperada, payment_intent: intent.id, charge: charge.id, moeda: 'brl',
      vendedor_tipo: pedido.vendedor_tipo, vendedor_perfil_id: pedido.vendedor_perfil_id,
      pago_centavos: intent.amount_received, comissao_centavos: comissao, reembolsos, estornos_comissao: estornosComissao,
    } })
    if (gravacao.error || !Number.isSafeInteger(gravacao.data?.versao) || gravacao.data.versao <= 0) throw new Error('Conciliação do pedido não persistida')
    return gravacao.data as { versao: number; confirmado_centavos: number; pendente_centavos: number }
  })
}

/** Resolve only the account from the verified event, never from request parameters. */
export async function cobrancaDoEventoDeReembolso(evento: Stripe.Event): Promise<Stripe.Charge> {
  const conta = evento.account ?? null
  const chargeId = evento.type === 'charge.refunded' ? (evento.data.object as Stripe.Charge).id : id((evento.data.object as Stripe.Refund).charge)
  if (!chargeId) throw new Error('Reembolso sem cobrança')
  const charge = await stripe.charges.retrieve(chargeId, {}, opcoesDeLeitura(conta)())
  atual(charge, chargeId)
  return charge
}

export async function processarReembolsoDaLoja(supabase: SupabaseClient, charge: Stripe.Charge, conta: string | null): Promise<boolean> {
  const pagamento = id(charge.payment_intent)
  if (!pagamento) throw new Error('Reembolso sem pagamento')
  const pedidoId = await localizarPedidoDoReembolso(supabase, pagamento, conta)
  if (!pedidoId) return false
  await sincronizarReembolsosDaLoja(supabase, pedidoId, conta)
  return true
}

/** Fee refunds belong to the platform; their verified fee identifies the connected account. */
export async function processarEstornoDeComissao(supabase: SupabaseClient, evento: Stripe.Event): Promise<void> {
  if (evento.account) throw new Error('Comissão recebida fora da plataforma')
  const feeId = evento.type === 'application_fee.refunded' ? (evento.data.object as Stripe.ApplicationFee).id
    : id((evento.data.object as Stripe.FeeRefund).fee)
  if (!feeId) throw new Error('Estorno sem comissão')
  const fee = await stripe.applicationFees.retrieve(feeId, {}, opcoesDeLeitura(null)())
  atual(fee, feeId)
  const conta = id(fee.account)
  const chargeId = id(fee.charge)
  if (!conta || !chargeId) throw new Error('Comissão sem cobrança ou conta')
  const charge = await stripe.charges.retrieve(chargeId, {}, opcoesDeLeitura(conta)())
  atual(charge, chargeId)
  if (id(charge.application_fee) !== feeId || !await processarReembolsoDaLoja(supabase, charge, conta)) throw new Error('Comissão sem pedido conciliado')
}
