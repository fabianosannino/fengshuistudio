// @vitest-environment node
/**
 * Testes de /api/loja/checkout — a venda de bem próprio (fase 2).
 *
 * O que estes testes guardam:
 *  - o preço vem do **banco**, nunca do corpo da requisição;
 *  - produto inativo e produto inexistente respondem igual;
 *  - produto não-digital não é vendável nesta fase;
 *  - a cobrança é na conta da plataforma — **sem** `stripeAccount` e sem
 *    comissão;
 *  - sem pedido gravado, não há redirecionamento para pagamento.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const sessionsCreate = vi.fn()
vi.mock('../../src/lib/stripe', () => ({
  default: { checkout: { sessions: { create: (...a: unknown[]) => sessionsCreate(...a) } } },
}))

const rateLimitMock = vi.fn(async (): Promise<{ success: boolean }> => ({ success: true }))
vi.mock('../../src/lib/rate-limit', () => ({
  rateLimit: (...a: unknown[]) => rateLimitMock(...(a as [])),
  ipDaRequisicao: () => '203.0.113.7',
}))

interface RespostaFalsa { data?: unknown; error?: { message: string; code?: string } | null }
const respostas: Record<string, RespostaFalsa> = {}
const escritas: { tabela: string; op: 'insert' | 'update'; valores: Record<string, unknown> }[] = []

function consulta(tabela: string) {
  const resolver = async (): Promise<RespostaFalsa> => respostas[tabela] ?? { data: null, error: null }
  const chain: Record<string, unknown> = {}
  for (const metodo of ['select', 'eq', 'order', 'limit', 'is']) chain[metodo] = () => chain
  chain.insert = (valores: Record<string, unknown>) => {
    escritas.push({ tabela, op: 'insert', valores }); return chain
  }
  chain.update = (valores: Record<string, unknown>) => {
    escritas.push({ tabela, op: 'update', valores }); return chain
  }
  chain.single = resolver
  chain.maybeSingle = resolver
  chain.then = (aceita: (r: RespostaFalsa) => unknown) => resolver().then(aceita)
  return chain
}

vi.mock('../../src/lib/supabase-admin', () => ({
  createSupabaseAdminClient: () => ({ from: (tabela: string) => consulta(tabela) }),
}))

import { POST } from '../../app/api/loja/checkout/route'

const PRODUTO_ID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301'

function req(body: unknown): Request {
  return new Request('http://test.local/api/loja/checkout', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'http://test.local' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

function insercaoEm(tabela: string) {
  return escritas.find(e => e.tabela === tabela && e.op === 'insert')?.valores
}

beforeEach(() => {
  vi.clearAllMocks()
  escritas.length = 0
  rateLimitMock.mockResolvedValue({ success: true })
  sessionsCreate.mockResolvedValue({ url: 'https://checkout.stripe.test/s', id: 'cs_loja_1' })
  respostas.produtos = {
    data: {
      id: PRODUTO_ID, tipo: 'bem_proprio_digital', nome: 'Guia do Ba Guá',
      descricao: 'PDF', preco_centavos: 2990, ativo: true,
      arquivo_path: 'x/y.pdf', arquivo_nome: 'guia.pdf',
      arquivo_mime: 'application/pdf', arquivo_bytes: 10,
    },
    error: null,
  }
  respostas.pedidos = { data: { id: 'pedido-1', token_publico: 'tok-1' }, error: null }
  respostas.pedido_itens = { data: null, error: null }
  respostas.pedido_eventos = { data: null, error: null }
})

describe('POST /api/loja/checkout', () => {
  it('devolve 429 quando o rate limit estoura', async () => {
    rateLimitMock.mockResolvedValue({ success: false })
    const res = await POST(req({ produto_id: PRODUTO_ID }))
    expect(res.status).toBe(429)
  })

  it('recusa id que não é uuid antes de tocar no banco', async () => {
    const res = await POST(req({ produto_id: '../../etc/passwd' }))
    expect(res.status).toBe(400)
    expect(escritas).toHaveLength(0)
  })

  it('IGNORA qualquer preço vindo do cliente', async () => {
    // O corpo tenta comprar por 1 centavo. O que vale é a linha do banco.
    await POST(req({ produto_id: PRODUTO_ID, preco_centavos: 1, total_centavos: 1 }))

    const pedido = insercaoEm('pedidos')
    expect(pedido?.total_centavos).toBe(2990)

    const sessao = sessionsCreate.mock.calls[0][0]
    expect(sessao.line_items[0].price_data.unit_amount).toBe(2990)
  })

  it('cobra na conta da plataforma: sem stripeAccount e sem comissão', async () => {
    await POST(req({ produto_id: PRODUTO_ID }))

    // Um segundo argumento com `stripeAccount` faria a cobrança cair na conta
    // de outra pessoa — que é exatamente a venda que esta rota NÃO é.
    expect(sessionsCreate.mock.calls[0][1]).toBeUndefined()

    const sessao = sessionsCreate.mock.calls[0][0]
    expect(sessao.payment_intent_data?.application_fee_amount).toBeUndefined()

    const pedido = insercaoEm('pedidos')
    expect(pedido?.taxa_plataforma_centavos).toBe(0)
    expect(pedido?.vendedor_tipo).toBe('plataforma')
    expect(pedido?.vendedor_perfil_id).toBeNull()
    expect(pedido?.stripe_account_id).toBeNull()
  })

  it('grava o tipo digital — é dele que sai o prazo do art. 49', async () => {
    await POST(req({ produto_id: PRODUTO_ID }))
    expect(insercaoEm('pedidos')?.tipo).toBe('bem_proprio_digital')
  })

  it('amarra o item ao produto, para saber qual arquivo entregar', async () => {
    await POST(req({ produto_id: PRODUTO_ID }))
    const item = insercaoEm('pedido_itens')
    expect(item?.produto_id).toBe(PRODUTO_ID)
    // E continua sendo fotografia: nome e preço copiados.
    expect(item?.nome).toBe('Guia do Ba Guá')
    expect(item?.preco_unitario_centavos).toBe(2990)
  })

  it('leva o pedido_id no metadata — é por ele que o webhook acha onde escrever', async () => {
    await POST(req({ produto_id: PRODUTO_ID }))
    expect(sessionsCreate.mock.calls[0][0].metadata).toEqual({ pedido_id: 'pedido-1' })
  })

  it('manda o comprador para a página do próprio pedido', async () => {
    await POST(req({ produto_id: PRODUTO_ID }))
    expect(sessionsCreate.mock.calls[0][0].success_url).toBe('http://test.local/pedido/tok-1')
  })

  it('produto inativo responde igual a produto inexistente', async () => {
    // A consulta filtra por `ativo`, então inativo volta vazio — e a resposta
    // é a mesma de id que não existe. Distinguir contaria quais ids existem.
    respostas.produtos = { data: null, error: null }
    const res = await POST(req({ produto_id: PRODUTO_ID }))
    expect(res.status).toBe(404)
    expect(sessionsCreate).not.toHaveBeenCalled()
  })

  it('produto físico não é vendável nesta fase', async () => {
    // O banco aceita a linha (a fase 3 vai usá-la); esta rota é onde a fase
    // termina. Sem isso, um físico cadastrado cedo seria comprado sem frete,
    // sem endereço, sem estoque e sem nota.
    respostas.produtos = {
      data: { ...(respostas.produtos.data as object), tipo: 'bem_proprio_fisico' },
      error: null,
    }
    const res = await POST(req({ produto_id: PRODUTO_ID }))
    expect(res.status).toBe(404)
    expect(sessionsCreate).not.toHaveBeenCalled()
  })

  it('sem pedido gravado, NÃO manda ninguém pagar', async () => {
    // Fail-closed, como no checkout do consultor: cobrar sabendo que o
    // registro falhou seria reintroduzir a venda que não deixa rastro.
    respostas.pedidos = { data: null, error: { message: 'falhou' } }
    const res = await POST(req({ produto_id: PRODUTO_ID }))
    expect(res.status).toBe(503)
    expect(sessionsCreate).not.toHaveBeenCalled()
  })

  it('falha do Stripe não vaza detalhe ao cliente', async () => {
    sessionsCreate.mockRejectedValue(new Error('No such price: price_secret_internal'))
    const res = await POST(req({ produto_id: PRODUTO_ID }))
    const corpo = await res.json()
    expect(res.status).toBe(500)
    expect(JSON.stringify(corpo)).not.toContain('price_secret_internal')
  })
})
