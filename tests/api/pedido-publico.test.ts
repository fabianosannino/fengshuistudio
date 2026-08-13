// @vitest-environment node
/**
 * Testes da rota /api/pedidos/publico — a página do comprador.
 *
 * O que se quer garantir:
 *  - token errado e token vencido respondem IGUAL (nada de enumeração);
 *  - a resposta não carrega nada do vendedor;
 *  - fora do prazo, o arrependimento é recusado com explicação;
 *  - o pedido de devolução é gravado com origem `comprador`.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const rateLimitMock = vi.fn(async (): Promise<{ success: boolean }> => ({ success: true }))
vi.mock('../../src/lib/rate-limit', () => ({
  rateLimit: (...a: unknown[]) => rateLimitMock(...(a as [])),
  ipDaRequisicao: () => '203.0.113.1',
}))

interface RespostaFalsa { data?: unknown; error?: { message: string } | null }
const respostas: Record<string, RespostaFalsa> = {}
const escritas: { tabela: string; valores: Record<string, unknown> }[] = []

function consulta(tabela: string) {
  const resolver = async (): Promise<RespostaFalsa> => respostas[tabela] ?? { data: null, error: null }
  const chain: Record<string, unknown> = {}
  for (const m of ['select', 'eq', 'order', 'limit', 'is', 'not']) chain[m] = () => chain
  chain.insert = (v: Record<string, unknown>) => { escritas.push({ tabela, valores: v }); return chain }
  chain.update = (v: Record<string, unknown>) => { escritas.push({ tabela, valores: v }); return chain }
  chain.single = resolver
  chain.maybeSingle = resolver
  chain.then = (ok: (r: RespostaFalsa) => unknown) => resolver().then(ok)
  return chain
}

vi.mock('../../src/lib/supabase-admin', () => ({
  createSupabaseAdminClient: () => ({ from: (t: string) => consulta(t) }),
}))

import { GET, POST } from '../../app/api/pedidos/publico/route'

const DAQUI_A_UM_MES = new Date(Date.now() + 30 * 864e5).toISOString()
const ONTEM = new Date(Date.now() - 864e5).toISOString()
const AGORA_MENOS_UM_DIA = new Date(Date.now() - 864e5).toISOString()

const PEDIDO = {
  id: 'pedido-1',
  numero: 'P260813-F0FD73',
  tipo: 'servico',
  criado_em: AGORA_MENOS_UM_DIA,
  total_centavos: 500,
  comprador_email: 'comprador@exemplo.com',
  token_expira_em: DAQUI_A_UM_MES,
  pedido_itens: [{ nome: 'Espelho Teste', quantidade: 1, preco_unitario_centavos: 500 }],
  pedido_eventos: [
    { evento: 'iniciado', ocorrido_em: AGORA_MENOS_UM_DIA },
    { evento: 'pago', ocorrido_em: AGORA_MENOS_UM_DIA },
  ],
  pedido_lancamentos: [],
}

function getReq(token: string) {
  return new Request(`http://test.local/api/pedidos/publico?token=${token}`)
}

function postReq(body: unknown) {
  return new Request('http://test.local/api/pedidos/publico', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  escritas.length = 0
  rateLimitMock.mockResolvedValue({ success: true })
  respostas.pedidos = { data: PEDIDO, error: null }
  respostas.pedido_eventos = { data: null, error: null }
})

describe('GET /api/pedidos/publico', () => {
  it('devolve o pedido para quem tem o token', async () => {
    const res = await GET(getReq('tok_valido'))
    expect(res.status).toBe(200)
    const { pedido } = await res.json()
    expect(pedido.numero).toBe('P260813-F0FD73')
    expect(pedido.situacao).toBe('pago')
  })

  it('NÃO devolve nada do vendedor nem do Stripe', async () => {
    const res = await GET(getReq('tok_valido'))
    const corpo = JSON.stringify(await res.json())
    expect(corpo).not.toContain('pedido-1')       // id interno
    expect(corpo).not.toContain('vendedor')
    expect(corpo).not.toContain('stripe')
  })

  it('mascara o e-mail em vez de reimprimi-lo', async () => {
    const res = await GET(getReq('tok_valido'))
    const { pedido } = await res.json()
    expect(pedido.comprador_email_mascarado).toBe('co•••••••@exemplo.com')
    expect(JSON.stringify(pedido)).not.toContain('comprador@exemplo.com')
  })

  it('TOKEN ERRADO E TOKEN VENCIDO RESPONDEM IGUAL', async () => {
    // Distinguir os dois contaria a quem está tentando que aquele token
    // existiu.
    respostas.pedidos = { data: null, error: null }
    const inexistente = await GET(getReq('tok_inexistente'))

    respostas.pedidos = { data: { ...PEDIDO, token_expira_em: ONTEM }, error: null }
    const vencido = await GET(getReq('tok_vencido'))

    expect(inexistente.status).toBe(404)
    expect(vencido.status).toBe(404)
    expect(await inexistente.json()).toEqual(await vencido.json())
  })

  it('sem token é 404, não 400', async () => {
    const res = await GET(new Request('http://test.local/api/pedidos/publico'))
    expect(res.status).toBe(404)
  })

  it('respeita o rate limit', async () => {
    rateLimitMock.mockResolvedValue({ success: false })
    expect((await GET(getReq('tok_valido'))).status).toBe(429)
  })
})

describe('POST /api/pedidos/publico', () => {
  it('registra a devolução com origem `comprador`', async () => {
    const res = await POST(postReq({ token: 'tok_valido' }))
    expect(res.status).toBe(200)
    const evento = escritas.find(e => e.tabela === 'pedido_eventos')
    expect(evento?.valores.evento).toBe('devolucao_solicitada')
    expect(evento?.valores.origem).toBe('comprador')
  })

  it('NÃO estorna — só registra', async () => {
    // O estorno sai da tela do vendedor: nem toda devolução pedida é devida,
    // e serviço já prestado precisa de gente olhando.
    await POST(postReq({ token: 'tok_valido' }))
    expect(escritas.every(e => e.valores.evento !== 'reembolsado')).toBe(true)
  })

  it('fora do prazo recusa com explicação, não em silêncio', async () => {
    const antigo = new Date(Date.now() - 30 * 864e5).toISOString()
    respostas.pedidos = {
      data: { ...PEDIDO, pedido_eventos: [{ evento: 'pago', ocorrido_em: antigo }] },
      error: null,
    }
    const res = await POST(postReq({ token: 'tok_valido' }))
    expect(res.status).toBe(409)
    expect((await res.json()).error).toContain('prazo')
  })

  it('token vencido não deixa pedir devolução', async () => {
    respostas.pedidos = { data: { ...PEDIDO, token_expira_em: ONTEM }, error: null }
    const res = await POST(postReq({ token: 'tok_vencido' }))
    expect(res.status).toBe(404)
    expect(escritas).toHaveLength(0)
  })
})
