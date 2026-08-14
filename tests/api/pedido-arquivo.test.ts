// @vitest-environment node
/**
 * Testes de /api/pedidos/arquivo — a entrega do bem digital.
 *
 * O acesso é **derivado**, não liberado por flag: posse do token + estado do
 * pedido. Estes testes existem para que continue assim — uma coluna
 * `download_liberado` faria todos eles passarem hoje e mentirem amanhã, no
 * primeiro reembolso.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const rateLimitMock = vi.fn(async (): Promise<{ success: boolean }> => ({ success: true }))
vi.mock('../../src/lib/rate-limit', () => ({
  rateLimit: (...a: unknown[]) => rateLimitMock(...(a as [])),
  ipDaRequisicao: () => '203.0.113.9',
}))

interface RespostaFalsa { data?: unknown; error?: { message: string; code?: string } | null }
const respostas: Record<string, RespostaFalsa> = {}
const eventosGravados: Record<string, unknown>[] = []
const assinar = vi.fn()

function consulta(tabela: string) {
  const resolver = async (): Promise<RespostaFalsa> => respostas[tabela] ?? { data: null, error: null }
  const chain: Record<string, unknown> = {}
  for (const metodo of ['select', 'eq', 'order', 'limit', 'is']) chain[metodo] = () => chain
  chain.insert = (valores: Record<string, unknown>) => {
    if (tabela === 'pedido_eventos') eventosGravados.push(valores)
    return chain
  }
  chain.update = () => chain
  chain.single = resolver
  chain.maybeSingle = resolver
  chain.then = (aceita: (r: RespostaFalsa) => unknown) => resolver().then(aceita)
  return chain
}

vi.mock('../../src/lib/supabase-admin', () => ({
  createSupabaseAdminClient: () => ({
    from: (tabela: string) => consulta(tabela),
    storage: { from: () => ({ createSignedUrl: (...a: unknown[]) => assinar(...a) }) },
  }),
}))

import { GET } from '../../app/api/pedidos/arquivo/route'

const DAQUI_A_UM_MES = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString()
const ONTEM = new Date(Date.now() - 24 * 3600 * 1000).toISOString()

function req(token = 'tok-valido', item = 'item-1'): Request {
  const url = new URL('http://test.local/api/pedidos/arquivo')
  if (token) url.searchParams.set('token', token)
  if (item) url.searchParams.set('item', item)
  return new Request(url, { method: 'GET' })
}

function itemPago(over: Record<string, unknown> = {}) {
  return {
    id: 'item-1', nome: 'Guia do Ba Guá', pedido_id: 'pedido-1', produto_id: 'produto-1',
    pedidos: {
      token_publico: 'tok-valido',
      token_expira_em: DAQUI_A_UM_MES,
      pedido_eventos: [{ evento: 'pago', ocorrido_em: '2026-08-14T10:00:00Z' }],
    },
    produtos: {
      tipo: 'bem_proprio_digital', arquivo_path: 'produto-1/abc.pdf',
      arquivo_nome: 'guia-bagua.pdf', arquivo_mime: 'application/pdf',
    },
    ...over,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  eventosGravados.length = 0
  rateLimitMock.mockResolvedValue({ success: true })
  assinar.mockResolvedValue({ data: { signedUrl: 'https://storage.test/assinada' }, error: null })
  respostas.pedido_itens = { data: itemPago(), error: null }
})

describe('GET /api/pedidos/arquivo', () => {
  it('entrega a URL assinada quando o pedido está pago', async () => {
    const res = await GET(req())
    expect(res.status).toBe(200)
    expect((await res.json()).url).toBe('https://storage.test/assinada')
  })

  it('a URL assinada é de curta duração', async () => {
    // Link de horas viraria endereço repassável — e o que ele entrega é o
    // produto inteiro, não a miniatura de uma foto.
    await GET(req())
    expect(assinar.mock.calls[0][1]).toBeLessThanOrEqual(600)
  })

  it('registra a entrega uma vez, amarrada ao item', async () => {
    await GET(req())
    expect(eventosGravados).toHaveLength(1)
    expect(eventosGravados[0].evento).toBe('entregue')
    // A referência é o que faz o índice de idempotência barrar o segundo
    // download de virar um segundo `entregue`.
    expect(eventosGravados[0].referencia).toBe('download:item-1')
  })

  it('sem token, 404 — e nada de assinatura', async () => {
    const res = await GET(req('', 'item-1'))
    expect(res.status).toBe(404)
    expect(assinar).not.toHaveBeenCalled()
  })

  it('token de outro pedido não abre este item', async () => {
    // A consulta filtra item **e** token juntos: token errado devolve vazio.
    respostas.pedido_itens = { data: null, error: null }
    const res = await GET(req('tok-de-outro'))
    expect(res.status).toBe(404)
    expect(assinar).not.toHaveBeenCalled()
  })

  it('token vencido responde igual a token errado', async () => {
    respostas.pedido_itens = {
      data: itemPago({
        pedidos: {
          token_publico: 'tok-valido', token_expira_em: ONTEM,
          pedido_eventos: [{ evento: 'pago', ocorrido_em: '2026-08-14T10:00:00Z' }],
        },
      }),
      error: null,
    }
    const res = await GET(req())
    expect(res.status).toBe(404)
    expect(assinar).not.toHaveBeenCalled()
  })

  it('pedido não pago não baixa', async () => {
    respostas.pedido_itens = {
      data: itemPago({
        pedidos: {
          token_publico: 'tok-valido', token_expira_em: DAQUI_A_UM_MES,
          pedido_eventos: [{ evento: 'iniciado', ocorrido_em: '2026-08-14T09:00:00Z' }],
        },
      }),
      error: null,
    }
    const res = await GET(req())
    expect(res.status).toBe(403)
    expect(assinar).not.toHaveBeenCalled()
  })

  it('reembolsado perde o acesso — sem ninguém precisar lembrar de revogar', async () => {
    respostas.pedido_itens = {
      data: itemPago({
        pedidos: {
          token_publico: 'tok-valido', token_expira_em: DAQUI_A_UM_MES,
          pedido_eventos: [
            { evento: 'pago', ocorrido_em: '2026-08-14T10:00:00Z' },
            { evento: 'reembolsado', ocorrido_em: '2026-08-15T10:00:00Z' },
          ],
        },
      }),
      error: null,
    }
    const res = await GET(req())
    expect(res.status).toBe(403)
    expect(assinar).not.toHaveBeenCalled()
  })

  it('devolução solicitada AINDA baixa', async () => {
    respostas.pedido_itens = {
      data: itemPago({
        pedidos: {
          token_publico: 'tok-valido', token_expira_em: DAQUI_A_UM_MES,
          pedido_eventos: [
            { evento: 'pago', ocorrido_em: '2026-08-14T10:00:00Z' },
            { evento: 'devolucao_solicitada', ocorrido_em: '2026-08-15T10:00:00Z' },
          ],
        },
      }),
      error: null,
    }
    const res = await GET(req())
    expect(res.status).toBe(200)
  })

  it('produto sem arquivo não promete download', async () => {
    respostas.pedido_itens = {
      data: itemPago({ produtos: { tipo: 'bem_proprio_digital', arquivo_path: null } }),
      error: null,
    }
    const res = await GET(req())
    expect(res.status).toBe(404)
  })

  it('item de serviço não tem o que baixar', async () => {
    respostas.pedido_itens = { data: itemPago({ produtos: null }), error: null }
    const res = await GET(req())
    expect(res.status).toBe(404)
  })

  it('falha ao assinar não vira link quebrado', async () => {
    assinar.mockResolvedValue({ data: null, error: { message: 'bucket sumiu' } })
    const res = await GET(req())
    expect(res.status).toBe(503)
    expect(JSON.stringify(await res.json())).not.toContain('bucket sumiu')
  })
})
