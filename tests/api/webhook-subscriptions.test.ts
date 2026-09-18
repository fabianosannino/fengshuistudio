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
    webhooks: { constructEvent: (...a: unknown[]) => constructEvent(...a) },
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
    return { data: 'profissional', error: null, ...handler(q) }
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
  it('metadata de plano não concede direitos se o Price é desconhecido', async () => {
    constructEvent.mockReturnValue(subscriptionEvent('customer.subscription.created', {
      metadata: { plan_slug: 'profissional' },
      items: { data: [{ quantity: 1, price: { id: 'price_desconhecido' } }] },
    }))
    expect((await POST(req())).status).toBe(200)
    expect(supabaseMock.queries.some(q => q.table === 'rpc:alterar_concessao_de_plano' && q.values?.p_operacao === 'conceder')).toBe(false)
  })
  it.each(['incomplete', 'past_due', 'paused', 'status_novo'])('estado %s não cria uma concessão', async status => {
    constructEvent.mockReturnValue(subscriptionEvent('customer.subscription.created', { status }))
    expect((await POST(req())).status).toBe(200)
    expect(supabaseMock.queries.some(q => q.table === 'rpc:alterar_concessao_de_plano' && q.values?.p_operacao === 'conceder')).toBe(false)
    expect(supabaseMock.queries.some(q => q.table === 'subscriptions' && q.op === 'update')).toBe(false)
  })
  it('snapshot ativo atrasado não reativa assinatura atualmente cancelada', async () => {
    constructEvent.mockReturnValue(subscriptionEvent('customer.subscription.updated'))
    subscriptionsRetrieve.mockResolvedValue(subscriptionEvent('customer.subscription.deleted').data.object)
    expect((await POST(req())).status).toBe(200)
    expect(supabaseMock.queries.find(q => q.table === 'subscriptions' && q.op === 'insert')?.values?.status).toBe('cancelled')
    expect(supabaseMock.queries.some(q => q.table === 'rpc:alterar_concessao_de_plano' && q.values?.p_operacao === 'conceder')).toBe(false)
  })
  it('falha de escrita responde erro para o Stripe repetir, sem concluir evento', async () => {
    supabaseMock = makeSupabaseMock(q => q.table === 'subscriptions' && q.op === 'insert'
      ? { error: { message: 'falha sintética' } } : defaultHandler(q))
    constructEvent.mockReturnValue(subscriptionEvent('customer.subscription.created'))
    expect((await POST(req())).status).toBe(500)
    expect(supabaseMock.queries.some(q => q.table === 'eventos_stripe' && q.op === 'update' && q.values?.processado_em)).toBe(false)
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

  it('subscription.created: cria assinatura e atualiza o plano do perfil', async () => {
    constructEvent.mockReturnValue(
      subscriptionEvent('customer.subscription.created', { metadata: { plan_slug: 'pro' } })
    )
    const res = await POST(req())
    expect(res.status).toBe(200)

    const insert = supabaseMock.queries.find(q => q.table === 'subscriptions' && q.op === 'insert')
    expect(insert?.values).toMatchObject({
      user_id: 'user-1',
      plan_id: 'plan-1',
      status: 'active',
      billing_cycle: 'monthly',
      price_paid: 49.9,
      gateway_subscription_id: 'sub_123',
    })

    // A assinatura administra a própria concessão, identificada pelo `sub_...`.
    // É o que impede o cancelamento de apagar um plano vindo de outra fonte.
    const concessao = supabaseMock.queries.find(q => q.table === 'rpc:alterar_concessao_de_plano' && q.values?.p_operacao === 'conceder')
    expect(concessao?.values).toMatchObject({
      p_usuario: 'user-1',
      p_plano: 'profissional',
      p_origem: 'assinatura',
      p_referencia: 'sub_123',
    })

    // Grant and projection are atomic in the RPC, verified on real PostgreSQL.
    expect(supabaseMock.queries.some(q => q.table === 'profiles' && q.op === 'update')).toBe(false)
  })

  it('subscription.deleted encerra a concessão daquela assinatura, não o plano inteiro', async () => {
    // O defeito de 13/08: cancelar o Simples rebaixou um perfil que tinha
    // Profissional por chave. Agora só a concessão da assinatura é encerrada,
    // e a projeção recalcula a partir do que sobrou.
    supabaseMock = makeSupabaseMock(q => {
      if (q.table === 'profiles' && q.op === 'select') return { data: { id: 'user-1' } }
      if (q.table === 'subscriptions' && q.op === 'select') return { data: { id: 'sub-row-1' } }
      if (q.table === 'concessoes_de_plano' && q.op === 'select') {
        if (q.cols === 'id') return { data: null }
        // Sobrou a da chave.
        return { data: [{ plano: 'profissional', valido_de: null, valido_ate: null, encerrada_em: null }] }
      }
      return {}
    })
    constructEvent.mockReturnValue(subscriptionEvent('customer.subscription.deleted'))
    const res = await POST(req())
    expect(res.status).toBe(200)

    const encerramento = supabaseMock.queries
      .find(q => q.table === 'rpc:alterar_concessao_de_plano' && q.values?.p_operacao === 'encerrar')
    expect(encerramento?.values).toMatchObject({ p_usuario: 'user-1', p_origem: 'assinatura', p_referencia: 'sub_123', p_operacao: 'encerrar' })
    expect(supabaseMock.queries.some(q => q.table === 'profiles' && q.op === 'update')).toBe(false)
  })

  it('subscription.created é idempotente: assinatura já registrada não duplica', async () => {
    supabaseMock = makeSupabaseMock(q => {
      if (q.table === 'profiles' && q.op === 'select') return { data: { id: 'user-1' } }
      if (q.table === 'subscriptions' && q.op === 'select') return { data: { id: 'sub-row-existente' } }
      return defaultHandler(q)
    })
    constructEvent.mockReturnValue(subscriptionEvent('customer.subscription.created'))
    const res = await POST(req())
    expect(res.status).toBe(200)
    expect(supabaseMock.queries.find(q => q.table === 'subscriptions' && q.op === 'insert')).toBeUndefined()
  })

  it('preço desconhecido NUNCA concede plano (fail-closed)', async () => {
    supabaseMock = makeSupabaseMock(q => {
      if (q.table === 'profiles' && q.op === 'select') return { data: { id: 'user-1' } }
      if (q.table === 'subscriptions' && q.op === 'select') return { data: null, error: null }
      if (q.table === 'plans' && q.op === 'select') return { data: [] } // nenhum plano bate com o preço
      return {}
    })
    constructEvent.mockReturnValue(
      subscriptionEvent('customer.subscription.created', {
        metadata: {}, // sem plan_slug
        items: { data: [{ price: { unit_amount: 123456, recurring: { interval: 'month' } } }] },
      })
    )
    const res = await POST(req())
    expect(res.status).toBe(200)
    const planoUpdate = supabaseMock.queries.find(
      q => q.table === 'profiles' && q.op === 'update' && q.values && 'plano' in q.values
    )
    expect(planoUpdate).toBeUndefined()
  })

  it('subscription.deleted: cancela a assinatura e rebaixa o perfil para free', async () => {
    supabaseMock = makeSupabaseMock(q => {
      if (q.table === 'profiles' && q.op === 'select') return { data: { id: 'user-1' } }
      if (q.table === 'subscriptions' && q.op === 'select') return { data: { id: 'sub-row-1' } }
      return {}
    })
    constructEvent.mockReturnValue(subscriptionEvent('customer.subscription.deleted'))
    const res = await POST(req())
    expect(res.status).toBe(200)

    const cancel = supabaseMock.queries.find(q => q.table === 'subscriptions' && q.op === 'update')
    expect(cancel?.values).toMatchObject({ status: 'cancelled' })
    expect(cancel?.filters).toContainEqual(['id', 'sub-row-1'])

    const encerramento = supabaseMock.queries.find(q => q.table === 'rpc:alterar_concessao_de_plano')
    expect(encerramento?.values).toMatchObject({ p_usuario: 'user-1', p_operacao: 'encerrar', p_referencia: 'sub_123' })
  })

  it('evento sem perfil correspondente não escreve nada', async () => {
    supabaseMock = makeSupabaseMock(q => {
      if (q.table === 'profiles' && q.op === 'select') return { data: null, error: null }
      return {}
    })
    constructEvent.mockReturnValue(subscriptionEvent('customer.subscription.created'))
    const res = await POST(req())
    expect(res.status).toBe(200)
    // `eventos_stripe` fica de fora: a reivindicação e a marca de processado
    // são escritas de controle, não de negócio. O que este teste afirma é que
    // nenhuma tabela de assinatura, fatura ou perfil foi tocada.
    const escritasDeNegocio = supabaseMock.queries
      .filter(q => q.op !== 'select' && q.table !== 'eventos_stripe')
    expect(escritasDeNegocio).toHaveLength(0)
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
