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
const invoicesList = vi.fn()
vi.mock('../../src/lib/stripe', () => ({
  default: {
    webhooks: { constructEvent: (...a: unknown[]) => constructEvent(...a) },
    invoices: { list: (...a: unknown[]) => invoicesList(...a) },
  },
}))

// ── Mock do Supabase admin (query builder encadeável e "thenable") ──────────
interface Q {
  table: string
  op: 'select' | 'insert' | 'update'
  values?: Record<string, unknown>
  filters: Array<[string, unknown]>
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
      select: () => b,
      insert: (v: Record<string, unknown>) => { q.op = 'insert'; q.values = v; return b },
      update: (v: Record<string, unknown>) => { q.op = 'update'; q.values = v; return b },
      eq: (k: string, v: unknown) => { q.filters.push([k, v]); return b },
      in: (k: string, v: unknown) => { q.filters.push([k, v]); return b },
      // `not`, `gt` e `limit` existem para a consulta de ordenação em
      // `eventos-stripe`. Registram o filtro como os demais para que o teste
      // possa afirmar sobre eles.
      not: (k: string, _op: string, v: unknown) => { q.filters.push([k, v]); return b },
      gt: (k: string, v: unknown) => { q.filters.push([k, v]); return b },
      limit: () => Promise.resolve(exec()),
      single: () => Promise.resolve(exec()),
      then: (
        onFulfilled: (r: unknown) => unknown,
        onRejected?: (e: unknown) => unknown
      ) => Promise.resolve(exec()).then(onFulfilled, onRejected),
    })
    return b
  }
  return { client: { from }, queries }
}

let supabaseMock = makeSupabaseMock(() => ({}))
vi.mock('../../src/lib/supabase-admin', () => ({
  createSupabaseAdminClient: () => supabaseMock.client,
}))

// O secret é lido no import do módulo — definir antes do import dinâmico.
process.env.STRIPE_SUBSCRIPTION_WEBHOOK_SECRET = 'whsec_test'
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
        status: 'active',
        cancel_at_period_end: false,
        metadata: {},
        items: { data: [{ price: { unit_amount: 9900, recurring: { interval: 'month' } } }] },
        start_date: 1750000000,
        current_period_start: 1750000000,
        current_period_end: 1752600000,
        ...overrides,
      },
    },
  } as unknown as Stripe.Event
}

/** Handler padrão: perfil existe, nenhuma assinatura prévia, plano 'pro' no banco. */
function defaultHandler(q: Q): QResult {
  if (q.table === 'profiles' && q.op === 'select') return { data: { id: 'user-1' } }
  if (q.table === 'subscriptions' && q.op === 'select') return { data: null, error: { message: 'no rows' } }
  if (q.table === 'plans' && q.op === 'select') return { data: { id: 'plan-1', slug: 'pro' } }
  return {}
}

beforeEach(() => {
  vi.clearAllMocks()
  supabaseMock = makeSupabaseMock(defaultHandler)
})

// ── Testes ───────────────────────────────────────────────────────────────────
describe('POST /api/stripe/webhooks/subscriptions', () => {
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
      price_paid: 99,
      gateway_subscription_id: 'sub_123',
    })

    const planoUpdate = supabaseMock.queries.find(q => q.table === 'profiles' && q.op === 'update')
    expect(planoUpdate?.values).toEqual({ plano: 'pro' })
    expect(planoUpdate?.filters).toContainEqual(['id', 'user-1'])
  })

  it('subscription.created é idempotente: assinatura já registrada não duplica', async () => {
    supabaseMock = makeSupabaseMock(q => {
      if (q.table === 'profiles' && q.op === 'select') return { data: { id: 'user-1' } }
      if (q.table === 'subscriptions' && q.op === 'select') return { data: { id: 'sub-row-existente' } }
      return {}
    })
    constructEvent.mockReturnValue(subscriptionEvent('customer.subscription.created'))
    const res = await POST(req())
    expect(res.status).toBe(200)
    expect(supabaseMock.queries.find(q => q.table === 'subscriptions' && q.op === 'insert')).toBeUndefined()
  })

  it('preço desconhecido NUNCA concede plano (fail-closed)', async () => {
    supabaseMock = makeSupabaseMock(q => {
      if (q.table === 'profiles' && q.op === 'select') return { data: { id: 'user-1' } }
      if (q.table === 'subscriptions' && q.op === 'select') return { data: null, error: { message: 'no rows' } }
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

    const downgrade = supabaseMock.queries.find(q => q.table === 'profiles' && q.op === 'update')
    // `freemium`, não `free`: a coluna é do enum `plano_tipo`, e gravar o
    // vocabulário do app derruba a escrita com `invalid input value for enum`.
    // Este teste afirmava `'free'` — ou seja, afirmava o defeito, e passava
    // porque o mock não valida enum. Em produção o rebaixamento nunca ocorria.
    expect(downgrade?.values).toEqual({ plano: 'freemium' })
  })

  it('evento sem perfil correspondente não escreve nada', async () => {
    supabaseMock = makeSupabaseMock(q => {
      if (q.table === 'profiles' && q.op === 'select') return { data: null, error: { message: 'no rows' } }
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
})
