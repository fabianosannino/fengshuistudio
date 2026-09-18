import type Stripe from 'stripe'
import type { SupabaseClient } from '@supabase/supabase-js'
import stripe from './stripe'
import { logger } from './logger'
import { sincronizarAssinatura } from './sincronizar-assinatura'

const ESTADOS_REEMBOLSO = new Set(['pending', 'requires_action', 'succeeded', 'failed', 'canceled'])
const ESTADOS_DISPUTA = new Set(['needs_response', 'under_review', 'won', 'lost', 'warning_needs_response', 'warning_under_review', 'warning_closed', 'prevented'])
const id = (ref: string | { id: string } | null | undefined) => typeof ref === 'string' ? ref : ref?.id ?? null
const centavos = (valor: number) => Number.isSafeInteger(valor) && valor >= 0 && valor <= 9_999_999_999
function instante(segundos: number): string {
  if (!Number.isSafeInteger(segundos) || segundos <= 0) throw new Error('Instante financeiro inválido')
  return new Date(segundos * 1000).toISOString()
}
function conferirObjeto(objeto: { id: string; livemode: boolean }, esperado: string) {
  const live = /^(sk|rk)_live_/.test(process.env.STRIPE_SECRET_KEY ?? '')
  if (objeto.id !== esperado || objeto.livemode !== live) throw new Error('Objeto financeiro incompatível')
}
/** Bound the whole read phase, not just each of its potentially many calls. */
function orcamentoDeLeitura() {
  const ate = Date.now() + 35_000
  return (): Stripe.RequestOptions => {
    const restante = ate - Date.now()
    if (restante < 500) throw new Error('Leitura financeira excedeu o prazo')
    return { timeout: Math.min(restante, 10_000), maxNetworkRetries: 0 }
  }
}
export async function comReservaFinanceira<T>(supabase: SupabaseClient, recurso: string, lerEAplicar: (token: string) => Promise<T>): Promise<T> {
  const reserva = await supabase.rpc('reservar_sincronizacao_financeira', { p_recurso: recurso })
  if (reserva.error || typeof reserva.data !== 'string' || !reserva.data) throw new Error('Sincronização financeira indisponível')
  let aplicado = false
  try {
    const resultado = await lerEAplicar(reserva.data)
    aplicado = true
    return resultado
  } finally {
    if (!aplicado) {
      try {
        const liberacao = await supabase.rpc('liberar_sincronizacao_financeira', { p_recurso: recurso, p_token: reserva.data })
        if (liberacao.error || liberacao.data !== true) throw new Error('Liberação não confirmada')
      } catch { logger.error('Reserva financeira não liberada; aguarda expiração', { recurso }) }
    }
  }
}

type Reembolso = { id: string; charge: string; centavos: number; status: string; criado_em: string }

/** Complete, bounded snapshot. Shared/partial allocations need explicit reconciliation. */
async function reembolsosDaFatura(invoice: Stripe.Invoice, opcoes: () => Stripe.RequestOptions): Promise<Reembolso[]> {
  const pagamentos = await stripe.invoicePayments.list({ invoice: invoice.id, status: 'paid', limit: 100 }, opcoes())
  if (pagamentos.has_more || pagamentos.data.length > 10) throw new Error('Pagamentos requerem conciliação ampliada')
  const reembolsos: Reembolso[] = []
  const cobrancas = new Set<string>()
  let pago = 0
  for (const pagamento of pagamentos.data) {
    conferirObjeto(pagamento, pagamento.id)
    if (id(pagamento.invoice) !== invoice.id || pagamento.currency !== 'brl' || pagamento.status !== 'paid'
      || pagamento.amount_paid === null || !centavos(pagamento.amount_paid)) throw new Error('Pagamento incompatível')
    pago += pagamento.amount_paid
    if (pagamento.payment.type !== 'payment_intent') throw new Error('Forma de pagamento requer conciliação específica')
    const intentId = id(pagamento.payment.payment_intent)
    if (!intentId) throw new Error('Pagamento sem referência')
    const [intent, vinculos] = await Promise.all([
      stripe.paymentIntents.retrieve(intentId, { expand: ['latest_charge'] }, opcoes()),
      stripe.invoicePayments.list({ payment: { type: 'payment_intent', payment_intent: intentId }, status: 'paid', limit: 100 }, opcoes()),
    ])
    conferirObjeto(intent, intentId)
    if (vinculos.has_more || vinculos.data.length !== 1 || vinculos.data[0].id !== pagamento.id
      || id(vinculos.data[0].invoice) !== invoice.id) throw new Error('Pagamento compartilhado ou ambíguo')
    const charge = intent.latest_charge
    if (!charge || typeof charge === 'string') throw new Error('Cobrança não expandida')
    conferirObjeto(charge, charge.id)
    if (id(intent.customer) !== id(invoice.customer) || id(charge.customer) !== id(invoice.customer)
      || id(charge.payment_intent) !== intent.id || intent.currency !== 'brl' || charge.currency !== 'brl'
      || intent.status !== 'succeeded' || charge.status !== 'succeeded' || !charge.paid
      || intent.amount_received !== pagamento.amount_paid || charge.amount_captured !== pagamento.amount_paid
      || cobrancas.has(charge.id)) throw new Error('Valor ou titular do pagamento incompatível')
    cobrancas.add(charge.id)
    const lista = await stripe.refunds.list({ charge: charge.id, limit: 100 }, opcoes())
    if (lista.has_more || reembolsos.length + lista.data.length > 100) throw new Error('Reembolsos incompletos')
    let comprometido = 0
    for (const refund of lista.data) {
      if (id(refund.charge) !== charge.id || id(refund.payment_intent) !== intent.id || refund.currency !== 'brl'
        || !centavos(refund.amount) || refund.amount === 0 || !refund.status || !ESTADOS_REEMBOLSO.has(refund.status)) {
        throw new Error('Reembolso incompatível')
      }
      if (!['failed', 'canceled'].includes(refund.status)) comprometido += refund.amount
      reembolsos.push({ id: refund.id, charge: charge.id, centavos: refund.amount, status: refund.status, criado_em: instante(refund.created) })
    }
    if (comprometido > pagamento.amount_paid) throw new Error('Estorno superior ao pagamento')
  }
  if (pago !== invoice.amount_paid) throw new Error('Valor pago exige conciliação específica')
  return reembolsos
}

export async function sincronizarFaturaStripe(supabase: SupabaseClient, faturaId: string, origem: string, customerEsperado?: string) {
  const invoice = await comReservaFinanceira(supabase, faturaId, async token => {
    const opcoes = orcamentoDeLeitura()
    const atual = await stripe.invoices.retrieve(faturaId, {}, opcoes())
    conferirObjeto(atual, faturaId)
    const customer = id(atual.customer)
    if (!customer || (customerEsperado && customer !== customerEsperado) || atual.currency !== 'brl'
      || !centavos(atual.total) || !centavos(atual.amount_paid) || !atual.status
      || !['draft', 'open', 'paid', 'uncollectible', 'void'].includes(atual.status)) throw new Error('Fatura incompatível')
    const reembolsos = await reembolsosDaFatura(atual, opcoes)
    const subscription = id(atual.parent?.subscription_details?.subscription)
    const gravacao = await supabase.rpc('aplicar_fatura_stripe', {
      p_recurso: faturaId, p_token: token,
      p_dados: { customer, subscription, moeda: atual.currency, total_centavos: atual.total, pago_centavos: atual.amount_paid,
        status: atual.status, vencimento: instante(atual.due_date ?? atual.created).slice(0, 10),
        paga_em: atual.status_transitions.paid_at ? instante(atual.status_transitions.paid_at) : null, reembolsos },
    })
    if (gravacao.error || typeof gravacao.data !== 'string' || !gravacao.data) throw new Error('Fatura não persistida')
    return { customer, subscription }
  })
  if (invoice.subscription) {
    const resultado = await sincronizarAssinatura(supabase, invoice.subscription, origem, invoice.customer)
    if (resultado.situacao === 'falhou') throw new Error('Assinatura da fatura não sincronizada')
  }
}

/** Resolve by the modern InvoicePayments relation; never scan the last ten invoices. */
export async function sincronizarReembolsoDaAssinatura(supabase: SupabaseClient, charge: Stripe.Charge, origem: string) {
  conferirObjeto(charge, charge.id)
  const intent = id(charge.payment_intent)
  const customer = id(charge.customer)
  if (!intent || !customer) throw new Error('Reembolso sem vínculo de cobrança')
  const pagamentos = await stripe.invoicePayments.list({ payment: { type: 'payment_intent', payment_intent: intent }, status: 'paid', limit: 100 }, orcamentoDeLeitura()())
  if (pagamentos.has_more || pagamentos.data.length !== 1) throw new Error('Reembolso sem fatura inequívoca')
  const fatura = id(pagamentos.data[0].invoice)
  if (!fatura) throw new Error('Pagamento sem fatura')
  await sincronizarFaturaStripe(supabase, fatura, origem, customer)
}

export async function sincronizarDisputaStripe(supabase: SupabaseClient, disputaId: string, eventId: string) {
  await comReservaFinanceira(supabase, disputaId, async token => {
    const opcoes = orcamentoDeLeitura()
    const disputa = await stripe.disputes.retrieve(disputaId, {}, opcoes())
    conferirObjeto(disputa, disputaId)
    const chargeId = id(disputa.charge)
    if (!chargeId || disputa.currency !== 'brl' || !centavos(disputa.amount) || !ESTADOS_DISPUTA.has(disputa.status)) throw new Error('Disputa incompatível')
    const charge = await stripe.charges.retrieve(chargeId, {}, opcoes())
    conferirObjeto(charge, chargeId)
    if (charge.currency !== disputa.currency || (id(disputa.payment_intent) && id(disputa.payment_intent) !== id(charge.payment_intent))) throw new Error('Cobrança da disputa incompatível')
    const gravacao = await supabase.rpc('aplicar_disputa_stripe', { p_recurso: disputaId, p_token: token, p_dados: {
      charge: charge.id, customer: id(charge.customer), centavos: disputa.amount, moeda: disputa.currency,
      status: disputa.status, motivo: disputa.reason, aberta_em: instante(disputa.created),
      responder_ate: disputa.evidence_details?.due_by ? instante(disputa.evidence_details.due_by) : null, event_id: eventId,
    } })
    if (gravacao.error || gravacao.data !== true) throw new Error('Disputa não persistida')
  })
}
