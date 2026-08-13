// @vitest-environment node
/**
 * Testes da rota /api/stripe/checkout (Direct Charges).
 *
 * Invariantes de segurança cobertos:
 *  - o preço NUNCA vem do cliente: é lido da conta conectada via price_id;
 *  - price inativo não é vendável;
 *  - taxa da plataforma = 10% do valor real lido no servidor;
 *  - erros do Stripe não vazam detalhes ao cliente (mensagem genérica).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const pricesRetrieve = vi.fn()
const sessionsCreate = vi.fn()
vi.mock('../../src/lib/stripe', () => ({
  default: {
    prices: { retrieve: (...a: unknown[]) => pricesRetrieve(...a) },
    checkout: { sessions: { create: (...a: unknown[]) => sessionsCreate(...a) } },
  },
}))

const rateLimitMock = vi.fn(async (): Promise<{ success: boolean }> => ({ success: true }))
vi.mock('../../src/lib/rate-limit', () => ({
  rateLimit: (...a: unknown[]) => rateLimitMock(...(a as [])),
  ipDaRequisicao: () => '203.0.113.1',
}))

/*
 * Harness mínimo do Supabase. A rota passou a criar o pedido antes de
 * redirecionar, então precisa de banco — e o que se quer testar aqui é que a
 * venda nasce registrada, não o driver do Postgres.
 */
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

import { POST } from '../../app/api/stripe/checkout/route'

function req(body: unknown): Request {
  return new Request('http://test.local/api/stripe/checkout', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'http://test.local' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

const validBody = { account_id: 'acct_123', price_id: 'price_abc' }

beforeEach(() => {
  vi.clearAllMocks()
  escritas.length = 0
  rateLimitMock.mockResolvedValue({ success: true })
  pricesRetrieve.mockResolvedValue({
    active: true, unit_amount: 5000, product: { name: 'Consulta completa' },
  })
  sessionsCreate.mockResolvedValue({ url: 'https://checkout.stripe.test/s', id: 'cs_1' })
  respostas.profiles = { data: { id: 'perfil-do-vendedor', loja_ativa: true }, error: null }
  respostas.pedidos = { data: { id: 'pedido-1' }, error: null }
  respostas.pedido_itens = { data: null, error: null }
  respostas.pedido_eventos = { data: null, error: null }
})

describe('POST /api/stripe/checkout', () => {
  it('devolve 429 quando o rate limit estoura', async () => {
    rateLimitMock.mockResolvedValue({ success: false })
    const res = await POST(req(validBody))
    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).toBe('60')
  })

  it('devolve 400 para body não-JSON', async () => {
    const res = await POST(req('não é json'))
    expect(res.status).toBe(400)
  })

  it('devolve 400 sem account_id válido (prefixo acct_)', async () => {
    const res = await POST(req({ ...validBody, account_id: 'user-controlado' }))
    expect(res.status).toBe(400)
    expect(pricesRetrieve).not.toHaveBeenCalled()
  })

  it('devolve 400 sem price_id válido (prefixo price_)', async () => {
    const res = await POST(req({ ...validBody, price_id: '123' }))
    expect(res.status).toBe(400)
    expect(pricesRetrieve).not.toHaveBeenCalled()
  })

  it('lê o preço DA CONTA CONECTADA (nunca aceita valor do cliente)', async () => {
    await POST(req({ ...validBody, unit_amount: 1 }))
    expect(pricesRetrieve).toHaveBeenCalledWith(
      'price_abc', { expand: ['product'] }, { stripeAccount: 'acct_123' }
    )
  })

  it('recusa price inativo com 400', async () => {
    pricesRetrieve.mockResolvedValue({ active: false, unit_amount: 5000 })
    const res = await POST(req(validBody))
    expect(res.status).toBe(400)
    expect(sessionsCreate).not.toHaveBeenCalled()
  })

  it('cria a sessão com taxa de 10% sobre o valor real e devolve a URL', async () => {
    const res = await POST(req({ ...validBody, quantity: 2 }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.url).toBe('https://checkout.stripe.test/s')

    const [params, opts] = sessionsCreate.mock.calls[0]
    // 5000 * 2 * 10% = 1000 centavos
    expect(params.payment_intent_data.application_fee_amount).toBe(1000)
    expect(params.line_items).toEqual([{ price: 'price_abc', quantity: 2 }])
    expect(opts).toEqual({ stripeAccount: 'acct_123' }) // direct charge na conta conectada
  })

  it('normaliza quantity inválida para 1', async () => {
    await POST(req({ ...validBody, quantity: 9999 }))
    const [params] = sessionsCreate.mock.calls[0]
    expect(params.line_items[0].quantity).toBe(1)
  })

  it('O DEFEITO QUE ISTO CONSERTA: a venda nasce registrada antes do redirecionamento', async () => {
    // Antes, o checkout criava a sessão e terminava. Nada era gravado, e o
    // webhook não tinha onde escrever — a venda movia dinheiro e não existia
    // deste lado.
    await POST(req(validBody))

    const pedido = escritas.find(e => e.tabela === 'pedidos' && e.op === 'insert')
    expect(pedido?.valores.vendedor_perfil_id).toBe('perfil-do-vendedor')
    expect(pedido?.valores.total_centavos).toBe(5000)
    expect(pedido?.valores.taxa_plataforma_centavos).toBe(500)
    // Sem coluna de estado: ele sai dos eventos.
    expect(pedido?.valores).not.toHaveProperty('status')

    expect(escritas.find(e => e.tabela === 'pedido_eventos')?.valores.evento).toBe('iniciado')
  })

  it('o item guarda o nome e o preço do instante da compra, não uma referência', async () => {
    await POST(req({ ...validBody, quantity: 3 }))
    const item = escritas.find(e => e.tabela === 'pedido_itens')
    expect(item?.valores.nome).toBe('Consulta completa')
    expect(item?.valores.preco_unitario_centavos).toBe(5000)
    expect(item?.valores.quantidade).toBe(3)
  })

  it('o pedido_id vai no metadata da sessão — é como o webhook o encontra', async () => {
    await POST(req(validBody))
    const [params] = sessionsCreate.mock.calls[0]
    expect(params.metadata).toEqual({ pedido_id: 'pedido-1' })
  })

  it('A LOJA NASCE FECHADA: vendedor sem `loja_ativa` não vende', async () => {
    // A conferência é no servidor porque esta rota é pública — quem tiver o
    // link `/store/acct_...` compraria sem ver botão nenhum. Esconder da tela
    // não desabilitaria nada.
    respostas.profiles = { data: { id: 'perfil-do-vendedor', loja_ativa: false }, error: null }
    const res = await POST(req(validBody))
    expect(res.status).toBe(400)
    expect(sessionsCreate).not.toHaveBeenCalled()
  })

  it('a recusa por loja fechada é indistinguível de conta sem perfil', async () => {
    // «Esta loja não vende» é a informação inteira para quem está de fora;
    // distinguir os motivos contaria quem tem conta conectada e ainda não foi
    // aprovado.
    respostas.profiles = { data: { id: 'x', loja_ativa: false }, error: null }
    const fechada = await POST(req(validBody))
    respostas.profiles = { data: null, error: null }
    const semPerfil = await POST(req(validBody))
    expect(await fechada.json()).toEqual(await semPerfil.json())
  })

  it('conta conectada sem perfil correspondente não vende', async () => {
    // Venda que ninguém consegue ver depois é pedido órfão: não há a quem
    // mostrar em «Vendas Recentes» nem de quem cobrar a entrega.
    respostas.profiles = { data: null, error: null }
    const res = await POST(req(validBody))
    expect(res.status).toBe(400)
    expect(sessionsCreate).not.toHaveBeenCalled()
  })

  it('se o pedido não puder ser gravado, o checkout FALHA em vez de cobrar às cegas', async () => {
    // Deliberado: esta rota existe porque a venda acontecia sem registro.
    // Seguir com a cobrança sabendo que o registro falhou reintroduziria o
    // defeito exato que ela conserta.
    respostas.pedidos = { data: null, error: { message: 'banco fora' } }
    const res = await POST(req(validBody))
    expect(res.status).toBe(503)
    expect(sessionsCreate).not.toHaveBeenCalled()
  })

  it('erro do Stripe vira 500 com mensagem genérica (sem vazar detalhes)', async () => {
    pricesRetrieve.mockRejectedValue(new Error('chave sk_live_XYZ inválida'))
    const res = await POST(req(validBody))
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(JSON.stringify(json)).not.toContain('sk_live')
  })
})
