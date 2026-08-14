// @vitest-environment node
/**
 * Testes de /api/loja/indicacao — o clique que mede e encaminha.
 *
 * O que estes testes guardam:
 *  - o destino **nunca** vem da query: o parâmetro é o id do produto;
 *  - link inseguro não é encaminhado, mesmo vindo do nosso cadastro;
 *  - produto que vendemos não vira redirecionamento para fora;
 *  - o clique é contado, e a falha da contagem não trava o visitante.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const rateLimitMock = vi.fn(async (): Promise<{ success: boolean }> => ({ success: true }))
vi.mock('../../src/lib/rate-limit', () => ({
  rateLimit: (...a: unknown[]) => rateLimitMock(...(a as [])),
  ipDaRequisicao: () => '203.0.113.4',
}))

interface RespostaFalsa { data?: unknown; error?: { message: string } | null }
const respostas: Record<string, RespostaFalsa> = {}
const cliques: Record<string, unknown>[] = []

function consulta(tabela: string) {
  const resolver = async (): Promise<RespostaFalsa> => respostas[tabela] ?? { data: null, error: null }
  const chain: Record<string, unknown> = {}
  for (const metodo of ['select', 'eq', 'order', 'limit']) chain[metodo] = () => chain
  chain.insert = (valores: Record<string, unknown>) => {
    if (tabela === 'cliques_de_indicacao') cliques.push(valores)
    return chain
  }
  chain.single = resolver
  chain.maybeSingle = resolver
  chain.then = (aceita: (r: RespostaFalsa) => unknown) => resolver().then(aceita)
  return chain
}

vi.mock('../../src/lib/supabase-admin', () => ({
  createSupabaseAdminClient: () => ({ from: (tabela: string) => consulta(tabela) }),
}))

import { GET } from '../../app/api/loja/indicacao/route'

const PRODUTO_ID = '3f2504e0-4f89-41d3-9a0c-0305e82c3399'
const DESTINO = 'https://loja.exemplo.com.br/produto/1'

function req(query: string): Request {
  return new Request(`http://test.local/api/loja/indicacao${query}`, { method: 'GET' })
}

function indicacao(over: Record<string, unknown> = {}) {
  return {
    id: PRODUTO_ID, tipo: 'bem_de_terceiro', modo_de_venda: 'indicacao',
    nome: 'Espelho Ba Guá', descricao: null, preco_centavos: 2990, ativo: true,
    arquivo_path: null, arquivo_nome: null, arquivo_mime: null, arquivo_bytes: null,
    link_externo: DESTINO, parceiro: 'Loja Exemplo',
    ...over,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  cliques.length = 0
  rateLimitMock.mockResolvedValue({ success: true })
  respostas.produtos = { data: indicacao(), error: null }
  respostas.cliques_de_indicacao = { data: null, error: null }
})

describe('GET /api/loja/indicacao', () => {
  it('encaminha para a loja do parceiro', async () => {
    const res = await GET(req(`?produto=${PRODUTO_ID}`))
    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe(DESTINO)
  })

  it('conta o clique — é o que torna a comissão cobrável', async () => {
    await GET(req(`?produto=${PRODUTO_ID}`))
    expect(cliques).toHaveLength(1)
    expect(cliques[0]).toEqual({ produto_id: PRODUTO_ID })
  })

  it('NÃO guarda quem clicou', async () => {
    // Para cobrar o parceiro basta volume. Guardar IP ou hash de visitante
    // seria coletar dado pessoal para uma pergunta que ninguém faz.
    await GET(req(`?produto=${PRODUTO_ID}`))
    const gravado = JSON.stringify(cliques[0])
    expect(gravado).not.toContain('203.0.113')
    expect(Object.keys(cliques[0])).toEqual(['produto_id'])
  })

  it('NÃO é redirecionador aberto: URL na query é ignorada', async () => {
    // O presente que um phisher pede — link que começa no nosso domínio, com o
    // nosso HTTPS, e termina onde ele escolher.
    const res = await GET(req('?produto=https://evil.example&url=https://evil.example'))
    expect(res.headers.get('location')).toContain('/produtos')
    expect(res.headers.get('location')).not.toContain('evil.example')
  })

  it('link inseguro no cadastro não é encaminhado', async () => {
    respostas.produtos = { data: indicacao({ link_externo: 'javascript:alert(1)' }), error: null }
    const res = await GET(req(`?produto=${PRODUTO_ID}`))
    expect(res.headers.get('location')).toContain('/produtos')
    expect(cliques).toHaveLength(0)
  })

  it('produto que NÓS vendemos não vira link para fora', async () => {
    respostas.produtos = {
      data: indicacao({ modo_de_venda: 'marketplace', tipo: 'bem_proprio_digital' }),
      error: null,
    }
    const res = await GET(req(`?produto=${PRODUTO_ID}`))
    expect(res.headers.get('location')).toContain('/produtos')
  })

  it('produto inativo ou inexistente volta para a loja', async () => {
    respostas.produtos = { data: null, error: null }
    const res = await GET(req(`?produto=${PRODUTO_ID}`))
    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toContain('/produtos')
  })

  it('falha ao contar não trava o visitante', async () => {
    // O clique perdido custa uma linha de apuração; travar a ida dele à loja
    // do parceiro custa a venda que gera a comissão.
    respostas.cliques_de_indicacao = { data: null, error: { message: 'indisponível' } }
    const res = await GET(req(`?produto=${PRODUTO_ID}`))
    expect(res.headers.get('location')).toBe(DESTINO)
  })

  it('respeita o rate limit', async () => {
    rateLimitMock.mockResolvedValue({ success: false })
    const res = await GET(req(`?produto=${PRODUTO_ID}`))
    expect(res.status).toBe(429)
  })
})
