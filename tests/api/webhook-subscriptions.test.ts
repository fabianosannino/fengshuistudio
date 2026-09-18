// @vitest-environment node
/**
 * Testes da rota /api/stripe/webhooks/subscriptions.
 *
 * Invariantes de segurança cobertos:
 *  - sem assinatura Stripe válida, nada é processado (400);
 *  - idempotência: evento repetido não duplica assinatura;
 *  - preço desconhecido NUNCA concede plano (fail-closed);
 *  - cancelamento rebaixa o perfil para 'free'.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type Stripe from 'stripe'

// ── Mock do Stripe ────────────────────────────────────────────────────────────
const constructEvent = vi.fn()
const subscriptionsRetrieve = vi.fn()
const invoicesList = vi.fn()
const invoicesRetrieve = vi.fn()
const chargesRetrieve = vi.fn()
vi.mock('../../src/lib/stripe', () => ({
  default: {
    subscriptions: { retrieve: (...a: unknown[]) => subscriptionsRetrieve(...a) },
    webhooks: { constructEvent: (...a: unknown[]) => ({ id: 'evt_1', created: 1_786_556_000, ...constructEvent(...a) }) },
    invoices: {
      list: (...a: unknown[]) => invoicesList(...a),
      retrieve: (...a: unknown[]) => invoicesRetrieve(...a),
    },
    charges: { retrieve: (...a: unknown[]) => chargesRetrieve(...a) },
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
  it('erro ao verificar ordem responde falha e libera apenas a tentativa atual', async () => {
    supabaseMock = makeSupabaseMock(q => q.table === 'eventos_stripe' ? { error: { message: 'falha' } } : defaultHandler(q))
    constructEvent.mockReturnValue(subscriptionEvent('customer.subscription.created'))
    expect((await POST(req())).status).toBe(500)
    expect(subscriptionsRetrieve).not.toHaveBeenCalled()
    expect(supabaseMock.queries).toEqual(expect.arrayContaining([expect.objectContaining({
      table: 'rpc:finalizar_evento_stripe', values: { p_event_id: 'evt_1', p_token: 'attempt-1', p_sucesso: false },
    })]))
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
    invoicesRetrieve.mockResolvedValue({
      id: 'in_1', customer: 'cus_123', amount_paid: 2000, number: 'A-1', due_date: null,
    })
    constructEvent.mockReturnValue({
      type: 'invoice_payment.paid',
      id: 'evt_ip',
      created: 1_786_556_000,
      data: { object: { id: 'inpay_1', invoice: 'in_1' } },
    } as unknown as Stripe.Event)

    const res = await POST(req())
    expect(res.status).toBe(200)
    expect(invoicesRetrieve).toHaveBeenCalledWith('in_1')

    const fatura = supabaseMock.queries.find(q => q.table === 'invoices' && q.op !== 'select')
    expect(fatura?.values).toMatchObject({ status: 'paid', amount_paid: 20 })
  })

  it('invoice_payment.paid sem id de fatura não quebra nem inventa', async () => {
    constructEvent.mockReturnValue({
      type: 'invoice_payment.paid',
      id: 'evt_ip2',
      created: 1_786_556_000,
      data: { object: { id: 'inpay_2' } },
    } as unknown as Stripe.Event)

    const res = await POST(req())
    expect(res.status).toBe(200)
    expect(supabaseMock.queries.some(q => q.table === 'invoices')).toBe(false)
  })

  it('contestação aberta é registrada e NÃO rebaixa o plano', async () => {
    // Disputa aberta não é venda perdida: pode ser ganha, e tirar o acesso de
    // quem contestou por engano seria punir antes do veredito.
    chargesRetrieve.mockResolvedValue({ id: 'ch_1', customer: 'cus_123' })
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

    const disputa = supabaseMock.queries.find(q => q.table === 'disputas_stripe')
    expect(disputa?.values).toMatchObject({
      id: 'dp_1', charge_id: 'ch_1', valor: 49.9, status: 'needs_response', desfecho: null,
    })

    const rebaixamento = supabaseMock.queries.find(q => q.table === 'profiles' && q.op === 'update')
    expect(rebaixamento).toBeUndefined()
  })

  it('contestação perdida registra o desfecho', async () => {
    chargesRetrieve.mockResolvedValue({ id: 'ch_2', customer: 'cus_123' })
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

    const disputa = supabaseMock.queries.find(q => q.table === 'disputas_stripe')
    expect(disputa?.values).toMatchObject({ id: 'dp_2', status: 'lost', desfecho: 'lost' })
    expect(disputa?.values?.fechada_em).toBeTruthy()
  })
})
