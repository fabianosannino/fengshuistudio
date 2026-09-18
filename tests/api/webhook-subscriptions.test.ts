// @vitest-environment node
/**
 * Testes da rota /api/stripe/webhooks/subscriptions.
 *
 * Invariantes de segurança cobertos:
 *  - sem assinatura Stripe válida, nada é processado (400);
 *  - idempotência: evento repetido não duplica assinatura;
 *  - preço desconhecido NUNCA concede plano (fail-closed);
 *  - eventos financeiros leem o estado atual antes de gravar sob reserva.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type Stripe from 'stripe'

// ── Mock do Stripe ────────────────────────────────────────────────────────────
const constructEvent = vi.fn()
const subscriptionsRetrieve = vi.fn()
const invoicesList = vi.fn()
const invoicesRetrieve = vi.fn()
const chargesRetrieve = vi.fn()
const paymentsList = vi.fn()
const intentsRetrieve = vi.fn()
const refundsList = vi.fn()
const disputesRetrieve = vi.fn()
const feesRetrieve = vi.fn()
const feeRefundsList = vi.fn()
vi.mock('../../src/lib/stripe', () => ({
  default: {
    subscriptions: { retrieve: (...a: unknown[]) => subscriptionsRetrieve(...a) },
    webhooks: { constructEvent: (...a: unknown[]) => ({ id: 'evt_1', created: 1_786_556_000, ...constructEvent(...a) }) },
    invoices: {
      list: (...a: unknown[]) => invoicesList(...a),
      retrieve: (...a: unknown[]) => invoicesRetrieve(...a),
    },
    charges: { retrieve: (...a: unknown[]) => chargesRetrieve(...a) },
    invoicePayments: { list: (...a: unknown[]) => paymentsList(...a) },
    paymentIntents: { retrieve: (...a: unknown[]) => intentsRetrieve(...a) },
    refunds: { list: (...a: unknown[]) => refundsList(...a) },
    disputes: { retrieve: (...a: unknown[]) => disputesRetrieve(...a) },
    applicationFees: { retrieve: (...a: unknown[]) => feesRetrieve(...a), listRefunds: (...a: unknown[]) => feeRefundsList(...a) },
  },
}))

// ── Mock do Supabase admin (query builder encadeável e "thenable") ──────────
interface Q {
  table: string
  op: 'select' | 'insert' | 'update' | 'rpc'
  values?: Record<string, unknown>
  filters: Array<[string, unknown]>
  /** Colunas pedidas. Duas leituras da mesma tabela pedem coisas diferentes. */
  cols?: string
}
type QResult = { data?: unknown; error?: { message: string } | null }
type Handler = (q: Q) => QResult

function makeSupabaseMock(handler: Handler) {
  const queries: Q[] = []
  const from = (table: string) => {
    const q: Q = { table, op: 'select', filters: [] }
    const exec = (): { data: unknown; error: { message: string } | null } => {
      queries.push(q)
      return { data: null, error: null, ...handler(q) }
    }
    const b: Record<string, unknown> = {}
    Object.assign(b, {
      select: (cols?: string) => { q.cols = cols; return b },
      insert: (v: Record<string, unknown>) => { q.op = 'insert'; q.values = v; return b },
      update: (v: Record<string, unknown>) => { q.op = 'update'; q.values = v; return b },
      upsert: (v: Record<string, unknown>) => { q.op = 'insert'; q.values = v; return b },
      eq: (k: string, v: unknown) => { q.filters.push([k, v]); return b },
      in: (k: string, v: unknown) => { q.filters.push([k, v]); return b },
      // `not`, `gt` e `limit` existem para a consulta de ordenação em
      // `eventos-stripe`. Registram o filtro como os demais para que o teste
      // possa afirmar sobre eles.
      not: (k: string, _op: string, v: unknown) => { q.filters.push([k, v]); return b },
      gt: (k: string, v: unknown) => { q.filters.push([k, v]); return b },
      is: (k: string, v: unknown) => { q.filters.push([k, v]); return b },
      limit: () => Promise.resolve(exec()),
      single: () => Promise.resolve(exec()),
      // `maybeSingle` é o que `sincronizar-assinatura` usa para procurar a
      // linha existente: ausência é resposta válida, não erro.
      maybeSingle: () => Promise.resolve(exec()),
      then: (
        onFulfilled: (r: unknown) => unknown,
        onRejected?: (e: unknown) => unknown
      ) => Promise.resolve(exec()).then(onFulfilled, onRejected),
    })
    return b
  }
  const rpc = async (name: string, values: Record<string, unknown>) => {
    const q: Q = { table: `rpc:${name}`, op: 'rpc', values, filters: [] }
    queries.push(q)
    const data = name === 'reivindicar_evento_stripe' ? { situacao: 'reivindicado', token: 'attempt-1' }
      : name === 'reservar_sincronizacao_assinatura' ? 'sync-token'
      : name === 'reservar_sincronizacao_financeira' ? 'financial-token'
      : name === 'aplicar_fatura_stripe' ? 'invoice-row'
      : name === 'aplicar_sincronizacao_assinatura' ? { situacao: 'criada', linhaId: 'linha-sintetica', cancelamentoAgendado: false }
      : true
    return { data, error: null, ...handler(q) }
  }
  return { client: { from, rpc }, queries }
}

let supabaseMock = makeSupabaseMock(() => ({}))
vi.mock('../../src/lib/supabase-admin', () => ({
  createSupabaseAdminClient: () => supabaseMock.client,
}))

// O secret é lido no import do módulo — definir antes do import dinâmico.
process.env.STRIPE_SUBSCRIPTION_WEBHOOK_SECRET = 'whsec_test'
process.env.STRIPE_SECRET_KEY = 'rk_test_fixture'
process.env.STRIPE_PRICE_PRO_MONTHLY = 'price_proMensal'
const { POST } = await import('../../app/api/stripe/webhooks/subscriptions/route')

// ── Helpers ──────────────────────────────────────────────────────────────────
function req(withSignature = true): Request {
  return new Request('http://test.local/api/stripe/webhooks/subscriptions', {
    method: 'POST',
    headers: withSignature ? { 'stripe-signature': 'sig_test' } : {},
    body: '{}', // o conteúdo real vem do constructEvent mockado
  })
}

function subscriptionEvent(type: string, overrides: Record<string, unknown> = {}) {
  return {
    type,
    data: {
      object: {
        id: 'sub_123',
        livemode: false,
        customer: 'cus_123',
        status: type === 'customer.subscription.deleted' ? 'canceled' : 'active',
        cancel_at_period_end: false,
        metadata: {},
        items: { data: [{ quantity: 1, price: { id: 'price_proMensal', type: 'recurring', active: true, livemode: false, product: 'prod_pro', currency: 'brl', billing_scheme: 'per_unit', unit_amount: 4990, recurring: { interval: 'month', interval_count: 1, usage_type: 'licensed' } } }] },
        start_date: 1750000000,
        current_period_start: 1750000000,
        current_period_end: 1752600000,
        ...overrides,
      },
    },
  } as unknown as Stripe.Event
}

/** Default query results; atomic grant behavior is covered by the database runner. */
function defaultHandler(q: Q): QResult {
  if (q.table === 'profiles' && q.op === 'select') return { data: { id: 'user-1' } }
  if (q.table === 'subscriptions' && q.op === 'select') return { data: null, error: null }
  if (q.table === 'plans' && q.op === 'select') return { data: { id: 'plan-1', slug: 'pro' } }
  if (q.table === 'concessoes_de_plano' && q.op === 'select') {
    // Duas leituras diferentes: `conceder` procura a concessão existente
    // (pede `id`), e o recálculo lê todas as vivas. Devolver a mesma coisa
    // para as duas faria a rota atualizar em vez de inserir.
    if (q.cols === 'id') return { data: null }
    return { data: [{ plano: 'profissional', valido_de: null, valido_ate: null, encerrada_em: null }] }
  }
  return {}
}

beforeEach(() => {
  vi.clearAllMocks()
  supabaseMock = makeSupabaseMock(defaultHandler)
  subscriptionsRetrieve.mockImplementation(async () => constructEvent.mock.results.at(-1)?.value?.data?.object)
  invoicesRetrieve.mockImplementation(async invoiceId => ({ id: invoiceId, livemode: false, customer: 'cus_123', currency: 'brl',
    total: 2000, amount_paid: 2000, status: 'paid', created: 1_786_555_000, status_transitions: { paid_at: 1_786_556_000 } }))
  paymentsList.mockImplementation(async params => ({ has_more: false, data: [{ id: 'inpay_1', invoice: params.invoice ?? invoicesRetrieve.mock.calls.at(-1)?.[0] ?? 'in_1',
    livemode: false, currency: 'brl', amount_paid: 2000, status: 'paid', payment: { type: 'payment_intent', payment_intent: 'pi_1' } }] }))
  intentsRetrieve.mockResolvedValue({ id: 'pi_1', livemode: false, customer: 'cus_123', currency: 'brl', status: 'succeeded', amount_received: 2000,
    latest_charge: { id: 'ch_1', livemode: false, customer: 'cus_123', payment_intent: 'pi_1', currency: 'brl', status: 'succeeded', paid: true, amount_captured: 2000 } })
  refundsList.mockResolvedValue({ has_more: false, data: [] })
  chargesRetrieve.mockResolvedValue({ id: 'ch_1', customer: 'cus_123', payment_intent: 'pi_1', livemode: false })
  disputesRetrieve.mockImplementation(async () => ({ livemode: false, ...constructEvent.mock.results.at(-1)?.value?.data?.object }))
})

describe('projeção financeira atual e retryable', () => {
  it.each(['application_fee.refunded', 'application_fee.refund.updated'])('concilia comissão posterior pelo evento %s da plataforma', async type => {
    constructEvent.mockReturnValue({ type, data: { object: type === 'application_fee.refunded' ? { id: 'fee_1' } : { id: 'fr_1', fee: 'fee_1' } } })
    feesRetrieve.mockResolvedValue({ id: 'fee_1', account: 'acct_1', charge: 'ch_1', livemode: false, currency: 'brl', amount: 200, amount_refunded: 50 })
    feeRefundsList.mockResolvedValue({ has_more: false, data: [{ id: 'fr_1', fee: 'fee_1', amount: 50, currency: 'brl', created: 1_786_555_000 }] })
    const charge = { id: 'ch_1', application_fee: 'fee_1', livemode: false, payment_intent: 'pi_1', paid: true, status: 'succeeded', currency: 'brl', amount_captured: 2000 }
    chargesRetrieve.mockResolvedValue(charge)
    intentsRetrieve.mockResolvedValue({ id: 'pi_1', livemode: false, status: 'succeeded', currency: 'brl', amount_received: 2000, latest_charge: charge })
    refundsList.mockResolvedValue({ has_more: false, data: [] })
    supabaseMock = makeSupabaseMock(q => q.table === 'pedidos' ? { data: { id: 'pedido-1', stripe_payment_intent: 'pi_1', stripe_account_id: 'acct_1', vendedor_tipo: 'consultor', vendedor_perfil_id: 'seller-1', total_centavos: 2000, taxa_plataforma_centavos: 200, moeda: 'brl' } }
      : q.table === 'rpc:aplicar_reembolsos_pedido' ? { data: { versao: 2 } } : {})
    expect((await POST(req())).status).toBe(200)
    expect(chargesRetrieve).toHaveBeenCalledWith('ch_1', {}, expect.objectContaining({ stripeAccount: 'acct_1' }))
    expect(feesRetrieve.mock.calls[0][2]).not.toHaveProperty('stripeAccount')
    expect(supabaseMock.queries.find(q => q.table === 'rpc:aplicar_reembolsos_pedido')?.values?.p_dados)
      .toMatchObject({ account: 'acct_1', estornos_comissao: [{ id: 'fr_1', centavos: 50 }] })
  })

  it('falha ao ler comissão não confirma o evento', async () => {
    constructEvent.mockReturnValue({ type: 'application_fee.refunded', data: { object: { id: 'fee_1' } } })
    feesRetrieve.mockRejectedValueOnce(new Error('unavailable'))
    expect((await POST(req())).status).toBe(500)
    expect(supabaseMock.queries.some(q => q.table === 'rpc:aplicar_reembolsos_pedido')).toBe(false)
  })

  it('recusa comissão em evento de conta conectada', async () => {
    constructEvent.mockReturnValue({ type: 'application_fee.refunded', account: 'acct_unexpected', data: { object: { id: 'fee_1' } } })
    expect((await POST(req())).status).toBe(500)
    expect(feesRetrieve).not.toHaveBeenCalled()
  })

  const invoiceEvent = () => ({ type: 'invoice.paid', data: { object: { id: 'in_1', status: 'paid' } } })
  const refund = (status = 'succeeded', overrides = {}) => ({ id: 're_1', charge: 'ch_1', payment_intent: 'pi_1',
    currency: 'brl', amount: 500, status, created: 1_786_555_500, ...overrides })
  const appliedInvoice = () => supabaseMock.queries.find(q => q.table === 'rpc:aplicar_fatura_stripe')?.values

  it('reserva a fatura antes da leitura e não usa o filtro global de eventos antigos', async () => {
    constructEvent.mockReturnValue(invoiceEvent())
    const original = invoicesRetrieve.getMockImplementation()!
    invoicesRetrieve.mockImplementation(async (...args) => {
      expect(supabaseMock.queries.some(q => q.table === 'rpc:reservar_sincronizacao_financeira')).toBe(true)
      return original(...args)
    })
    expect((await POST(req())).status).toBe(200)
    expect(appliedInvoice()?.p_token).toBe('financial-token')
    expect(supabaseMock.queries.some(q => q.table === 'eventos_stripe')).toBe(false)
  })
  it('reserva financeira ocupada não permite leitura nem escrita', async () => {
    constructEvent.mockReturnValue(invoiceEvent())
    supabaseMock = makeSupabaseMock(q => q.table === 'rpc:reservar_sincronizacao_financeira' ? { data: null } : defaultHandler(q))
    expect((await POST(req())).status).toBe(500)
    expect(invoicesRetrieve).not.toHaveBeenCalled()
    expect(appliedInvoice()).toBeUndefined()
  })
  it('reembolso da loja usa o estado atual em uma transação, sem filtro global de ordem', async () => {
    constructEvent.mockReturnValue({ type: 'charge.refunded', data: { object: { id: 'ch_1', customer: 'cus_123', payment_intent: 'pi_1', livemode: false } } })
    supabaseMock = makeSupabaseMock(q => q.table === 'pedidos' ? { data: { id: 'pedido_1', stripe_payment_intent: 'pi_1', stripe_account_id: null,
      vendedor_tipo: 'plataforma', vendedor_perfil_id: null, moeda: 'brl', total_centavos: 2000, taxa_plataforma_centavos: 0 } }
      : q.table === 'rpc:aplicar_reembolsos_pedido' ? { data: { versao: 1, confirmado_centavos: 0, pendente_centavos: 0 } }
      : q.table === 'eventos_stripe' ? { data: [{ event_id: 'evt_newer' }] } : defaultHandler(q))
    expect((await POST(req())).status).toBe(200)
    expect(invoicesRetrieve).not.toHaveBeenCalled()
    expect(supabaseMock.queries.some(q => q.table === 'rpc:aplicar_reembolsos_pedido')).toBe(true)
    expect(supabaseMock.queries.some(q => q.table === 'eventos_stripe')).toBe(false)
  })
  it('falha ao identificar pedido fica retryable e não segue como fatura de assinatura', async () => {
    constructEvent.mockReturnValue({ type: 'refund.updated', data: { object: refund() } })
    chargesRetrieve.mockResolvedValue({ id: 'ch_1', customer: 'cus_123', payment_intent: 'pi_1', livemode: false })
    supabaseMock = makeSupabaseMock(q => q.table === 'pedidos' ? { data: null, error: { message: 'unavailable' } } : defaultHandler(q))
    expect((await POST(req())).status).toBe(500)
    expect(invoicesRetrieve).not.toHaveBeenCalled()
    expect(supabaseMock.queries.some(q => q.table === 'rpc:finalizar_evento_stripe' && q.values?.p_sucesso === true)).toBe(false)
  })
  it.each(['succeeded', 'pending', 'failed', 'canceled', 'requires_action'])('invoice.paid atrasado inclui o reembolso atual %s na mesma transação', async status => {
    constructEvent.mockReturnValue(invoiceEvent())
    refundsList.mockResolvedValue({ has_more: false, data: [refund(status)] })
    expect((await POST(req())).status).toBe(200)
    expect(appliedInvoice()?.p_dados).toMatchObject({ reembolsos: [{ id: 're_1', centavos: 500, status }] })
    expect(supabaseMock.queries.some(q => q.table === 'invoices' || q.table === 'payment_notifications')).toBe(false)
  })
  it.each(['pagamentos', 'reembolsos', 'vinculos'])('lista incompleta de %s nunca vira resultado parcial confirmado', async alvo => {
    constructEvent.mockReturnValue(invoiceEvent())
    if (alvo === 'reembolsos') refundsList.mockResolvedValue({ has_more: true, data: [refund()] })
    else {
      const original = paymentsList.getMockImplementation()!
      paymentsList.mockImplementation(async params => ({ ...await original(params), has_more: alvo === 'pagamentos' ? !!params.invoice : !!params.payment }))
    }
    expect((await POST(req())).status).toBe(500)
    expect(appliedInvoice()).toBeUndefined()
  })
  it('pagamento compartilhado entre duas faturas não atribui o estorno inteiro a uma delas', async () => {
    constructEvent.mockReturnValue(invoiceEvent())
    const original = paymentsList.getMockImplementation()!
    paymentsList.mockImplementation(async params => {
      const result = await original(params)
      return params.payment ? { ...result, data: [...result.data, { ...result.data[0], id: 'inpay_2', invoice: 'in_outro' }] } : result
    })
    expect((await POST(req())).status).toBe(500)
    expect(appliedInvoice()).toBeUndefined()
  })
  it.each([{ currency: 'usd' }, { amount: 3000 }, { status: 'unknown' }, { charge: 'ch_outro' }, { amount: 0.5 }])('recusa reembolso incompatível %j', async delta => {
    constructEvent.mockReturnValue(invoiceEvent())
    refundsList.mockResolvedValue({ has_more: false, data: [refund('succeeded', delta)] })
    expect((await POST(req())).status).toBe(500)
    expect(appliedInvoice()).toBeUndefined()
  })
  it('não associa pagamento de outro titular à fatura', async () => {
    constructEvent.mockReturnValue(invoiceEvent())
    const current = await intentsRetrieve()
    intentsRetrieve.mockResolvedValue({ ...current, customer: 'cus_outro' })
    expect((await POST(req())).status).toBe(500)
    expect(appliedInvoice()).toBeUndefined()
  })
  it('falha da transação não conclui evento nem perde a possibilidade de repetir', async () => {
    constructEvent.mockReturnValue(invoiceEvent())
    supabaseMock = makeSupabaseMock(q => q.table === 'rpc:aplicar_fatura_stripe' ? { data: null, error: { message: 'expired' } } : defaultHandler(q))
    expect((await POST(req())).status).toBe(500)
    expect(supabaseMock.queries.find(q => q.table === 'rpc:liberar_sincronizacao_financeira')?.values)
      .toEqual({ p_recurso: 'in_1', p_token: 'financial-token' })
    expect(supabaseMock.queries.some(q => q.table === 'rpc:finalizar_evento_stripe' && q.values?.p_sucesso === true)).toBe(false)
  })
  it('usa InvoicePayments para localizar fatura do reembolso, sem janela das dez últimas', async () => {
    constructEvent.mockReturnValue({ type: 'charge.refunded', data: { object: { id: 'ch_1', customer: 'cus_123', payment_intent: 'pi_1', livemode: false } } })
    refundsList.mockResolvedValue({ has_more: false, data: [refund()] })
    expect((await POST(req())).status).toBe(200)
    expect(paymentsList).toHaveBeenCalledWith({ payment: { type: 'payment_intent', payment_intent: 'pi_1' }, status: 'paid', limit: 100 }, expect.any(Object))
    expect(invoicesList).not.toHaveBeenCalled()
  })
  it.each(['refund.created', 'refund.updated', 'refund.failed'])('%s reconcilia a fatura sem declarar sucesso pelo snapshot do evento', async type => {
    constructEvent.mockReturnValue({ type, data: { object: refund() } })
    chargesRetrieve.mockResolvedValue({ id: 'ch_1', customer: 'cus_123', payment_intent: 'pi_1', livemode: false })
    refundsList.mockResolvedValue({ has_more: false, data: [refund('failed')] })
    expect((await POST(req())).status).toBe(200)
    expect(appliedInvoice()?.p_dados).toMatchObject({ reembolsos: [{ status: 'failed' }] })
  })
  it('disputa aberta atrasada consulta o desfecho atual', async () => {
    constructEvent.mockReturnValue({ type: 'charge.dispute.created', data: { object: { id: 'dp_1', status: 'needs_response' } } })
    disputesRetrieve.mockResolvedValue({ id: 'dp_1', livemode: false, charge: 'ch_1', amount: 2000, currency: 'brl', status: 'won', reason: 'general', created: 1_786_555_000 })
    chargesRetrieve.mockResolvedValue({ id: 'ch_1', livemode: false, currency: 'brl', customer: 'cus_123' })
    expect((await POST(req())).status).toBe(200)
    expect(supabaseMock.queries.find(q => q.table === 'rpc:aplicar_disputa_stripe')?.values?.p_dados).toMatchObject({ status: 'won' })
  })
  it('falha ao identificar o titular da disputa não é confirmação sem titular', async () => {
    constructEvent.mockReturnValue({ type: 'charge.dispute.created', data: { object: { id: 'dp_1', charge: 'ch_1', amount: 2000, currency: 'brl', status: 'needs_response' } } })
    chargesRetrieve.mockRejectedValue(new Error('provider unavailable'))
    expect((await POST(req())).status).toBe(500)
    expect(supabaseMock.queries.some(q => q.table === 'rpc:aplicar_disputa_stripe')).toBe(false)
  })
})

// ── Testes ───────────────────────────────────────────────────────────────────
describe('POST /api/stripe/webhooks/subscriptions', () => {
  it.each(['ocupado', 'sem_garantia'])('controle %s não admite processamento', async situacao => {
    supabaseMock = makeSupabaseMock(q => q.table === 'rpc:reivindicar_evento_stripe'
      ? { data: situacao === 'ocupado' ? { situacao } : null, error: situacao === 'sem_garantia' ? { message: 'falha' } : null } : defaultHandler(q))
    constructEvent.mockReturnValue(subscriptionEvent('customer.subscription.created'))
    expect((await POST(req())).status).toBe(503)
    expect(subscriptionsRetrieve).not.toHaveBeenCalled()
    expect(supabaseMock.queries.some(q => q.table === 'rpc:alterar_concessao_de_plano')).toBe(false)
  })
  it('assinatura não descarta evento por consulta genérica de ordem', async () => {
    supabaseMock = makeSupabaseMock(q => q.table === 'eventos_stripe' ? { error: { message: 'falha' } } : defaultHandler(q))
    constructEvent.mockReturnValue(subscriptionEvent('customer.subscription.created'))
    expect((await POST(req())).status).toBe(200)
    expect(supabaseMock.queries.some(q => q.table === 'eventos_stripe')).toBe(false)
  })
  it('conclusão não confirmada não responde sucesso', async () => {
    supabaseMock = makeSupabaseMock(q => q.table === 'rpc:finalizar_evento_stripe' && q.values?.p_sucesso === true
      ? { data: false } : defaultHandler(q))
    constructEvent.mockReturnValue(subscriptionEvent('customer.subscription.created'))
    expect((await POST(req())).status).toBe(500)
  })
  it('metadata de plano não concede direitos se o Price é desconhecido', async () => {
    constructEvent.mockReturnValue(subscriptionEvent('customer.subscription.created', {
      metadata: { plan_slug: 'profissional' },
      items: { data: [{ quantity: 1, price: { id: 'price_desconhecido' } }] },
    }))
    expect((await POST(req())).status).toBe(500)
    expect(supabaseMock.queries.some(q => q.table === 'rpc:alterar_concessao_de_plano' && q.values?.p_operacao === 'conceder')).toBe(false)
  })
  it.each(['incomplete', 'past_due', 'paused'])('estado %s é enviado à transação sem escrita separada de concessão', async status => {
    constructEvent.mockReturnValue(subscriptionEvent('customer.subscription.created', { status }))
    expect((await POST(req())).status).toBe(200)
    expect(supabaseMock.queries.some(q => q.table === 'rpc:alterar_concessao_de_plano' && q.values?.p_operacao === 'conceder')).toBe(false)
    expect(supabaseMock.queries.some(q => q.table === 'subscriptions' && q.op === 'update')).toBe(false)
    expect(supabaseMock.queries.find(q => q.table === 'rpc:aplicar_sincronizacao_assinatura')?.values?.p_dados).toMatchObject({ status })
  })
  it('snapshot ativo atrasado não reativa assinatura atualmente cancelada', async () => {
    constructEvent.mockReturnValue(subscriptionEvent('customer.subscription.updated'))
    subscriptionsRetrieve.mockResolvedValue(subscriptionEvent('customer.subscription.deleted').data.object)
    expect((await POST(req())).status).toBe(200)
    expect(supabaseMock.queries.find(q => q.table === 'rpc:aplicar_sincronizacao_assinatura')?.values?.p_dados).toMatchObject({ status: 'canceled' })
    expect(supabaseMock.queries.some(q => q.table === 'rpc:alterar_concessao_de_plano' && q.values?.p_operacao === 'conceder')).toBe(false)
  })
  it('falha de escrita responde erro para o Stripe repetir, sem concluir evento', async () => {
    supabaseMock = makeSupabaseMock(q => q.table === 'rpc:aplicar_sincronizacao_assinatura'
      ? { error: { message: 'falha sintética' } } : defaultHandler(q))
    constructEvent.mockReturnValue(subscriptionEvent('customer.subscription.created'))
    expect((await POST(req())).status).toBe(500)
    expect(supabaseMock.queries.some(q => q.table === 'rpc:finalizar_evento_stripe' && q.values?.p_sucesso === true)).toBe(false)
  })
  it('fatura avulsa paga não reativa assinaturas do perfil', async () => {
    constructEvent.mockReturnValue({ type: 'invoice.paid', data: { object: { id: 'in_avulsa', customer: 'cus_123', amount_paid: 2000 } } })
    expect((await POST(req())).status).toBe(200)
    expect(supabaseMock.queries.some(q => q.table === 'subscriptions' && q.op === 'update')).toBe(false)
  })
  it('devolve 400 sem header stripe-signature', async () => {
    const res = await POST(req(false))
    expect(res.status).toBe(400)
    expect(constructEvent).not.toHaveBeenCalled()
  })

  it('devolve 400 quando a assinatura é inválida (constructEvent lança)', async () => {
    constructEvent.mockImplementation(() => { throw new Error('bad signature') })
    const res = await POST(req())
    expect(res.status).toBe(400)
    expect(supabaseMock.queries).toHaveLength(0) // nada foi processado
  })

  it('subscription.created envia o estado atual inteiro em uma única transação', async () => {
    constructEvent.mockReturnValue(subscriptionEvent('customer.subscription.created'))
    expect((await POST(req())).status).toBe(200)
    const aplicacao = supabaseMock.queries.find(q => q.table === 'rpc:aplicar_sincronizacao_assinatura')
    expect(aplicacao?.values).toMatchObject({ p_subscription: 'sub_123', p_token: 'sync-token', p_dados: {
      customer: 'cus_123', plano: 'profissional', status: 'active', ciclo: 'monthly', valor_centavos: 4990,
      period_end: new Date(1752600000 * 1000).toISOString(),
    } })
    expect(supabaseMock.queries.filter(q => q.op === 'insert' || q.op === 'update')).toEqual([])
  })

  it('subscription.deleted envia cancelamento da própria assinatura à transação', async () => {
    constructEvent.mockReturnValue(subscriptionEvent('customer.subscription.deleted'))
    expect((await POST(req())).status).toBe(200)
    expect(supabaseMock.queries.find(q => q.table === 'rpc:aplicar_sincronizacao_assinatura')?.values)
      .toMatchObject({ p_subscription: 'sub_123', p_dados: { status: 'canceled' } })
    expect(supabaseMock.queries.some(q => q.table === 'profiles' && q.op === 'update')).toBe(false)
  })

  it('assinatura ocupada impede outro evento de ler e gravar estado fora de ordem', async () => {
    supabaseMock = makeSupabaseMock(q => q.table === 'rpc:reservar_sincronizacao_assinatura' ? { data: null } : defaultHandler(q))
    constructEvent.mockReturnValue(subscriptionEvent('customer.subscription.updated'))
    expect((await POST(req())).status).toBe(500)
    expect(subscriptionsRetrieve).not.toHaveBeenCalled()
    expect(supabaseMock.queries.some(q => q.table === 'rpc:aplicar_sincronizacao_assinatura')).toBe(false)
    expect(supabaseMock.queries.some(q => q.table === 'rpc:finalizar_evento_stripe' && q.values?.p_sucesso === true)).toBe(false)
  })

  it('reserva antecede a leitura atual no provedor e seu token acompanha a escrita', async () => {
    constructEvent.mockReturnValue(subscriptionEvent('customer.subscription.updated'))
    subscriptionsRetrieve.mockImplementation(async () => {
      expect(supabaseMock.queries.some(q => q.table === 'rpc:reservar_sincronizacao_assinatura')).toBe(true)
      return subscriptionEvent('customer.subscription.created').data.object
    })
    expect((await POST(req())).status).toBe(200)
    expect(supabaseMock.queries.find(q => q.table === 'rpc:aplicar_sincronizacao_assinatura')?.values?.p_token).toBe('sync-token')
  })

  it('falha no provedor libera só a reserva atual, sem gravação do estado', async () => {
    constructEvent.mockReturnValue(subscriptionEvent('customer.subscription.updated'))
    subscriptionsRetrieve.mockRejectedValue(new Error('timeout'))
    expect((await POST(req())).status).toBe(500)
    expect(supabaseMock.queries.find(q => q.table === 'rpc:liberar_sincronizacao_assinatura')?.values)
      .toEqual({ p_subscription: 'sub_123', p_token: 'sync-token' })
    expect(supabaseMock.queries.some(q => q.table === 'rpc:aplicar_sincronizacao_assinatura')).toBe(false)
  })

  it('perfil ausente na transação permanece retryable, sem confirmação de evento', async () => {
    supabaseMock = makeSupabaseMock(q => q.table === 'rpc:aplicar_sincronizacao_assinatura'
      ? { data: null, error: { message: 'perfil_de_cobranca_indisponivel' } } : defaultHandler(q))
    constructEvent.mockReturnValue(subscriptionEvent('customer.subscription.created'))
    expect((await POST(req())).status).toBe(500)
    expect(supabaseMock.queries.some(q => q.table === 'rpc:finalizar_evento_stripe' && q.values?.p_sucesso === true)).toBe(false)
  })

  it.each([{ status: 'estado_novo' }, { livemode: true }, { id: 'sub_outro' }])('estado do provedor incompatível recusa antes da escrita %j', async delta => {
    constructEvent.mockReturnValue(subscriptionEvent('customer.subscription.updated'))
    subscriptionsRetrieve.mockResolvedValue(subscriptionEvent('customer.subscription.updated', delta).data.object)
    expect((await POST(req())).status).toBe(500)
    expect(supabaseMock.queries.some(q => q.table === 'rpc:aplicar_sincronizacao_assinatura')).toBe(false)
  })
  it('evento não tratado responde 200 received (não quebra o Stripe retry)', async () => {
    constructEvent.mockReturnValue({ type: 'payment_method.attached', data: { object: {} } })
    const res = await POST(req())
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ received: true })
  })

  it('invoice_payment.paid busca a fatura e registra igual a invoice.paid', async () => {
    // A versão de API 2026-03-25 emite `invoice_payment.paid` ao lado de
    // `invoice.paid`. Escutar só o antigo deixaria a renovação passar em
    // branco se ele sair — e o objeto do evento novo traz o id da fatura,
    // não a fatura.
    constructEvent.mockReturnValue({
      type: 'invoice_payment.paid',
      id: 'evt_ip',
      created: 1_786_556_000,
      data: { object: { id: 'inpay_1', invoice: 'in_1' } },
    } as unknown as Stripe.Event)

    const res = await POST(req())
    expect(res.status).toBe(200)
    expect(invoicesRetrieve).toHaveBeenCalledWith('in_1', {}, expect.any(Object))

    const fatura = supabaseMock.queries.find(q => q.table === 'rpc:aplicar_fatura_stripe')
    expect(fatura?.values?.p_dados).toMatchObject({ status: 'paid', pago_centavos: 2000 })
  })

  it('invoice_payment.paid sem id de fatura permanece pendente para retry', async () => {
    constructEvent.mockReturnValue({
      type: 'invoice_payment.paid',
      id: 'evt_ip2',
      created: 1_786_556_000,
      data: { object: { id: 'inpay_2' } },
    } as unknown as Stripe.Event)

    const res = await POST(req())
    expect(res.status).toBe(500)
    expect(supabaseMock.queries.some(q => q.table === 'rpc:aplicar_fatura_stripe')).toBe(false)
  })

  it('contestação aberta é registrada e NÃO rebaixa o plano', async () => {
    // Disputa aberta não é venda perdida: pode ser ganha, e tirar o acesso de
    // quem contestou por engano seria punir antes do veredito.
    chargesRetrieve.mockResolvedValue({ id: 'ch_1', customer: 'cus_123', livemode: false, currency: 'brl' })
    constructEvent.mockReturnValue({
      type: 'charge.dispute.created',
      id: 'evt_dp',
      created: 1_786_556_000,
      data: {
        object: {
          id: 'dp_1', charge: 'ch_1', amount: 4990, currency: 'brl',
          status: 'needs_response', reason: 'fraudulent', created: 1_786_555_000,
          evidence_details: { due_by: 1_787_000_000 },
        },
      },
    } as unknown as Stripe.Event)

    const res = await POST(req())
    expect(res.status).toBe(200)

    const disputa = supabaseMock.queries.find(q => q.table === 'rpc:aplicar_disputa_stripe')
    expect(disputa?.values?.p_dados).toMatchObject({
      charge: 'ch_1', centavos: 4990, status: 'needs_response',
    })

    const rebaixamento = supabaseMock.queries.find(q => q.table === 'profiles' && q.op === 'update')
    expect(rebaixamento).toBeUndefined()
  })

  it('contestação perdida registra o desfecho', async () => {
    chargesRetrieve.mockResolvedValue({ id: 'ch_2', customer: 'cus_123', livemode: false, currency: 'brl' })
    constructEvent.mockReturnValue({
      type: 'charge.dispute.closed',
      id: 'evt_dp2',
      created: 1_786_557_000,
      data: {
        object: {
          id: 'dp_2', charge: 'ch_2', amount: 2000, currency: 'brl',
          status: 'lost', reason: 'product_not_received', created: 1_786_555_000,
        },
      },
    } as unknown as Stripe.Event)

    const res = await POST(req())
    expect(res.status).toBe(200)

    const disputa = supabaseMock.queries.find(q => q.table === 'rpc:aplicar_disputa_stripe')
    expect(disputa?.values).toMatchObject({ p_recurso: 'dp_2', p_dados: { status: 'lost' } })
  })
})
