// @vitest-environment node
/**
 * Testes da rota /api/pedidos/estorno.
 *
 * O que se quer garantir:
 *  - a comissão volta SEMPRE — não é parâmetro que alguém possa desligar;
 *  - a autorização é a policy: pedido de outro vendedor não aparece;
 *  - pedido já reembolsado não estorna de novo;
 *  - `reembolsado` NÃO é escrito aqui — vem do webhook, quando o dinheiro volta.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const refundsCreate = vi.fn()
vi.mock('../../src/lib/stripe', () => ({
  default: { refunds: { create: (...a: unknown[]) => refundsCreate(...a) } },
}))

const rateLimitMock = vi.fn(async (): Promise<{ success: boolean }> => ({ success: true }))
vi.mock('../../src/lib/rate-limit', () => ({
  rateLimit: (...a: unknown[]) => rateLimitMock(...(a as [])),
  ipDaRequisicao: () => '203.0.113.1',
}))

interface RespostaFalsa { data?: unknown; error?: { message: string; code?: string } | null }
const respostas: Record<string, RespostaFalsa> = {}
const escritas: { tabela: string; valores: Record<string, unknown> }[] = []
let usuario: { id: string } | null = { id: 'consultor-1' }

function consulta(tabela: string) {
  const resolver = async (): Promise<RespostaFalsa> => respostas[tabela] ?? { data: null, error: null }
  const chain: Record<string, unknown> = {}
  for (const m of ['select', 'eq', 'order', 'limit', 'is']) chain[m] = () => chain
  chain.insert = (valores: Record<string, unknown>) => { escritas.push({ tabela, valores }); return chain }
  chain.update = (valores: Record<string, unknown>) => { escritas.push({ tabela, valores }); return chain }
  chain.single = resolver
  chain.maybeSingle = resolver
  chain.then = (ok: (r: RespostaFalsa) => unknown) => resolver().then(ok)
  return chain
}

const cliente = {
  from: (t: string) => consulta(t),
  auth: { getUser: async () => ({ data: { user: usuario } }) },
}

vi.mock('../../src/lib/supabase-route', () => ({
  createRouteHandlerClient: async () => cliente,
}))
vi.mock('../../src/lib/supabase-admin', () => ({
  createSupabaseAdminClient: () => cliente,
}))

import { POST } from '../../app/api/pedidos/estorno/route'

function req(body: unknown): Request {
  return new Request('http://test.local/api/pedidos/estorno', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const PEDIDO_PAGO = {
  id: 'pedido-1',
  stripe_payment_intent: 'pi_1',
  stripe_account_id: 'acct_1',
  pedido_eventos: [{ evento: 'iniciado' }, { evento: 'pago' }],
}

beforeEach(() => {
  vi.clearAllMocks()
  escritas.length = 0
  usuario = { id: 'consultor-1' }
  rateLimitMock.mockResolvedValue({ success: true })
  refundsCreate.mockResolvedValue({ id: 're_1', status: 'succeeded' })
  respostas.pedidos = { data: PEDIDO_PAGO, error: null }
  respostas.pedido_eventos = { data: null, error: null }
})

describe('POST /api/pedidos/estorno', () => {
  it('exige autenticação', async () => {
    usuario = null
    const res = await POST(req({ pedido_id: 'pedido-1' }))
    expect(res.status).toBe(401)
    expect(refundsCreate).not.toHaveBeenCalled()
  })

  it('A COMISSÃO VOLTA SEMPRE — não é parâmetro que se possa desligar', async () => {
    // Enquanto o estorno era feito no painel do Stripe, devolver a comissão
    // dependia de alguém marcar uma caixa. Regra que depende de lembrar não é
    // regra.
    await POST(req({ pedido_id: 'pedido-1' }))
    const [params, opts] = refundsCreate.mock.calls[0]
    expect(params.refund_application_fee).toBe(true)
    expect(params.payment_intent).toBe('pi_1')
    expect(opts.stripeAccount).toBe('acct_1')
  })

  it('mesmo que o cliente peça o contrário no body', async () => {
    await POST(req({ pedido_id: 'pedido-1', refund_application_fee: false }))
    expect(refundsCreate.mock.calls[0][0].refund_application_fee).toBe(true)
  })

  it('dois cliques não devolvem duas vezes', async () => {
    await POST(req({ pedido_id: 'pedido-1' }))
    expect(refundsCreate.mock.calls[0][1].idempotencyKey).toBe('estorno-pedido-1')
  })

  it('grava `devolucao_solicitada`, e NÃO grava `reembolsado`', async () => {
    // O reembolso é fato do webhook, quando o dinheiro volta. Escrevê-lo aqui
    // seria afirmar um fato a partir da intenção — a mesma classe de erro de
    // marcar «pago» na tela de sucesso.
    await POST(req({ pedido_id: 'pedido-1' }))
    const eventos = escritas.filter(e => e.tabela === 'pedido_eventos')
    expect(eventos.map(e => e.valores.evento)).toEqual(['devolucao_solicitada'])
    expect(eventos[0].valores.origem).toBe('vendedor')
  })

  it('pedido de outro vendedor não existe para quem pergunta', async () => {
    // A policy não devolve a linha; a rota não distingue «não é seu» de «não
    // existe», senão vira oráculo que confirma pedidos alheios.
    respostas.pedidos = { data: null, error: null }
    const res = await POST(req({ pedido_id: 'pedido-de-outro' }))
    expect(res.status).toBe(404)
    expect(refundsCreate).not.toHaveBeenCalled()
  })

  it('pedido já reembolsado não estorna de novo', async () => {
    respostas.pedidos = {
      data: { ...PEDIDO_PAGO, pedido_eventos: [{ evento: 'pago' }, { evento: 'reembolsado' }] },
      error: null,
    }
    const res = await POST(req({ pedido_id: 'pedido-1' }))
    expect(res.status).toBe(409)
    expect(refundsCreate).not.toHaveBeenCalled()
  })

  it('pedido não pago não estorna', async () => {
    respostas.pedidos = {
      data: { ...PEDIDO_PAGO, pedido_eventos: [{ evento: 'iniciado' }] },
      error: null,
    }
    const res = await POST(req({ pedido_id: 'pedido-1' }))
    expect(res.status).toBe(409)
    expect(refundsCreate).not.toHaveBeenCalled()
  })

  it('falha do Stripe vira 502 sem vazar detalhe', async () => {
    refundsCreate.mockRejectedValue(new Error('chave sk_live_XYZ inválida'))
    const res = await POST(req({ pedido_id: 'pedido-1' }))
    expect(res.status).toBe(502)
    expect(JSON.stringify(await res.json())).not.toContain('sk_live')
  })

  it('mesmo falhando no Stripe, o pedido de devolução fica registrado', async () => {
    // É o que conta o prazo do «de imediato» e o que o suporte precisa ver.
    refundsCreate.mockRejectedValue(new Error('fora do ar'))
    await POST(req({ pedido_id: 'pedido-1' }))
    expect(escritas.some(e => e.valores.evento === 'devolucao_solicitada')).toBe(true)
  })

  it('respeita o rate limit', async () => {
    rateLimitMock.mockResolvedValue({ success: false })
    const res = await POST(req({ pedido_id: 'pedido-1' }))
    expect(res.status).toBe(429)
  })
})
