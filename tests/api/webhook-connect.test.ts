// @vitest-environment node
/**
 * Testes da rota /api/stripe/webhooks (eventos de contas conectadas).
 *
 * O que se quer garantir aqui é o conserto da fase 0 da loja:
 *  - `pago` é escrito pelo webhook, e só por ele;
 *  - sessão concluída sem pagamento confirmado não vira venda;
 *  - reembolso e contestação viram evento no pedido certo;
 *  - cobrança que não é da loja não vira pedido órfão.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type Stripe from 'stripe'

const constructEvent = vi.fn()
vi.mock('../../src/lib/stripe', () => ({
  default: { webhooks: { constructEvent: (...a: unknown[]) => constructEvent(...a) } },
}))

interface Q {
  table: string
  op: 'select' | 'insert' | 'update'
  values?: Record<string, unknown>
  filters: Array<[string, unknown]>
  cols?: string
}
type QResult = { data?: unknown; error?: { message: string; code?: string } | null }
type Handler = (q: Q) => QResult

function makeSupabaseMock(handler: Handler) {
  const queries: Q[] = []
  const from = (table: string) => {
    const q: Q = { table, op: 'select', filters: [] }
    const exec = () => { queries.push(q); return { data: null, error: null, ...handler(q) } }
    const b: Record<string, unknown> = {}
    Object.assign(b, {
      select: (cols?: string) => { q.cols = cols; return b },
      insert: (v: Record<string, unknown>) => { q.op = 'insert'; q.values = v; return b },
      update: (v: Record<string, unknown>) => { q.op = 'update'; q.values = v; return b },
      eq: (k: string, v: unknown) => { q.filters.push([k, v]); return b },
      is: (k: string, v: unknown) => { q.filters.push([k, v]); return b },
      limit: () => Promise.resolve(exec()),
      single: () => Promise.resolve(exec()),
      maybeSingle: () => Promise.resolve(exec()),
      then: (ok: (r: unknown) => unknown, falhou?: (e: unknown) => unknown) =>
        Promise.resolve(exec()).then(ok, falhou),
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
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test'
const { POST } = await import('../../app/api/stripe/webhooks/route')

function req(withSignature = true): Request {
  return new Request('http://test.local/api/stripe/webhooks', {
    method: 'POST',
    headers: withSignature ? { 'stripe-signature': 'sig_test' } : {},
    body: '{}',
  })
}

function evento(type: string, object: Record<string, unknown>): Stripe.Event {
  return {
    id: 'evt_1', type, created: 1_770_000_000, account: 'acct_123',
    data: { object },
  } as unknown as Stripe.Event
}

/** Pedido existe; nada mais devolve linha. */
const padrao: Handler = q => (q.table === 'pedidos' ? { data: { id: 'pedido-1' } } : {})

function eventosGravados() {
  return supabaseMock.queries.filter(q => q.table === 'pedido_eventos' && q.op === 'insert')
}

beforeEach(() => {
  vi.clearAllMocks()
  supabaseMock = makeSupabaseMock(padrao)
})

describe('POST /api/stripe/webhooks', () => {
  it('sem assinatura válida nada é processado', async () => {
    const res = await POST(req(false))
    expect(res.status).toBe(400)
    expect(constructEvent).not.toHaveBeenCalled()
  })

  it('assinatura inválida vira 400 e não toca no banco', async () => {
    constructEvent.mockImplementation(() => { throw new Error('bad sig') })
    const res = await POST(req())
    expect(res.status).toBe(400)
    expect(supabaseMock.queries.filter(q => q.table === 'pedido_eventos')).toHaveLength(0)
  })

  it('O CONSERTO: sessão paga vira evento `pago` no pedido', async () => {
    // Antes desta rota tratar o evento, a venda movia dinheiro e não deixava
    // registro nenhum deste lado.
    constructEvent.mockReturnValue(evento('checkout.session.completed', {
      id: 'cs_1',
      payment_status: 'paid',
      payment_intent: 'pi_1',
      amount_total: 5000,
      metadata: { pedido_id: 'pedido-1' },
      customer_details: { email: 'comprador@exemplo.com', name: 'Comprador' },
    }))

    const res = await POST(req())
    expect(res.status).toBe(200)

    const pago = eventosGravados()[0]
    expect(pago?.values?.evento).toBe('pago')
    expect(pago?.values?.origem).toBe('webhook_stripe')
    // A referência é o id do evento — é o que torna a reentrega inofensiva.
    expect(pago?.values?.referencia).toBe('evt_1')
  })

  it('grava o comprador e o total que o Stripe confirmou, não o estimado', async () => {
    constructEvent.mockReturnValue(evento('checkout.session.completed', {
      id: 'cs_1', payment_status: 'paid', payment_intent: 'pi_1',
      amount_total: 4200,
      metadata: { pedido_id: 'pedido-1' },
      customer_details: { email: 'comprador@exemplo.com', name: 'Comprador' },
    }))

    await POST(req())

    const atualizacao = supabaseMock.queries.find(q => q.table === 'pedidos' && q.op === 'update')
    expect(atualizacao?.values?.comprador_email).toBe('comprador@exemplo.com')
    expect(atualizacao?.values?.stripe_payment_intent).toBe('pi_1')
    expect(atualizacao?.values?.total_centavos).toBe(4200)
  })

  it('sessão concluída SEM pagamento confirmado não vira venda', async () => {
    // `unpaid` chega em fluxo assíncrono (boleto, Pix). Marcar pago aqui daria
    // acesso a quem ainda não pagou.
    constructEvent.mockReturnValue(evento('checkout.session.completed', {
      id: 'cs_1', payment_status: 'unpaid', metadata: { pedido_id: 'pedido-1' },
    }))

    const res = await POST(req())
    expect(res.status).toBe(200)
    expect(eventosGravados()).toHaveLength(0)
  })

  it('sessão paga sem pedido correspondente não inventa pedido', async () => {
    supabaseMock = makeSupabaseMock(() => ({ data: null }))
    constructEvent.mockReturnValue(evento('checkout.session.completed', {
      id: 'cs_desconhecida', payment_status: 'paid', metadata: {},
    }))

    const res = await POST(req())
    expect(res.status).toBe(200)
    expect(eventosGravados()).toHaveLength(0)
  })

  it('reembolso vira evento `reembolsado` no pedido da cobrança', async () => {
    constructEvent.mockReturnValue(evento('charge.refunded', {
      id: 'ch_1', payment_intent: 'pi_1',
    }))

    await POST(req())
    expect(eventosGravados()[0]?.values?.evento).toBe('reembolsado')
  })

  it('contestação vira evento `contestado`', async () => {
    constructEvent.mockReturnValue(evento('charge.dispute.created', {
      id: 'dp_1', payment_intent: 'pi_1',
    }))

    await POST(req())
    expect(eventosGravados()[0]?.values?.evento).toBe('contestado')
  })

  it('cobrança que não é da loja não vira pedido órfão', async () => {
    // Reembolso de assinatura chega por este mesmo endpoint. Não é erro — é
    // evento que não pertence a esta tabela.
    supabaseMock = makeSupabaseMock(() => ({ data: null }))
    constructEvent.mockReturnValue(evento('charge.refunded', {
      id: 'ch_9', payment_intent: 'pi_de_assinatura',
    }))

    const res = await POST(req())
    expect(res.status).toBe(200)
    expect(eventosGravados()).toHaveLength(0)
  })

  it('account.updated continua sendo tratado e não escreve pedido', async () => {
    constructEvent.mockReturnValue(evento('account.updated', {
      id: 'acct_123', capabilities: { card_payments: 'active' }, requirements: { currently_due: [] },
    }))

    const res = await POST(req())
    expect(res.status).toBe(200)
    expect(eventosGravados()).toHaveLength(0)
  })
})
