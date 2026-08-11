// @vitest-environment node
/**
 * Testes da rota /api/storage/assinar.
 *
 * A rota é a fronteira que substitui a leitura pública dos buckets (C8). Uma
 * URL assinada, depois de emitida, não passa mais por RLS — então a checagem de
 * posse aqui é a última que existe. Os invariantes cobertos:
 *
 *  - sem sessão não se assina nada;
 *  - a posse vem do `user.id` da sessão, nunca do corpo;
 *  - foto de consulta de outro consultor não é assinada;
 *  - foto na pasta de outro usuário (bucket de clientes) não é assinada;
 *  - travessia de pasta (`..`) não fura o vínculo;
 *  - bucket fora da lista é recusado;
 *  - o valor gravado pode ser URL pública legada ou path — os dois resolvem.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const USUARIO = 'user-dono'
const OUTRO = 'user-outro'
const PROJETO = 'https://projeto.supabase.co'

let usuarioAtual: { id: string } | null = { id: USUARIO }
/** Consultas que pertencem ao usuário da sessão. */
let consultasDoUsuario: string[] = ['consulta-1']
const createSignedUrls = vi.fn()

vi.mock('../../src/lib/supabase-route', () => ({
  createRouteHandlerClient: async () => ({
    auth: { getUser: async () => ({ data: { user: usuarioAtual } }) },
    from: (tabela: string) => {
      if (tabela !== 'consultas') throw new Error(`tabela inesperada: ${tabela}`)
      const construtor = {
        select: () => construtor,
        eq: (coluna: string, valor: string) => {
          // Espelha o filtro real: só devolve consultas do consultor logado.
          if (coluna === 'consultor_id' && valor !== usuarioAtual?.id) {
            return { in: async () => ({ data: [], error: null }) }
          }
          return construtor
        },
        in: async (_coluna: string, ids: string[]) => ({
          data: ids.filter(id => consultasDoUsuario.includes(id)).map(id => ({ id })),
          error: null,
        }),
      }
      return construtor
    },
    storage: {
      from: () => ({ createSignedUrls: (...a: unknown[]) => createSignedUrls(...a) }),
    },
  }),
}))

vi.mock('../../src/lib/rate-limit', () => ({
  rateLimit: async () => ({ success: true, remaining: 10, compartilhado: false }),
  ipDaRequisicao: () => '203.0.113.1',
}))

import { POST } from '../../app/api/storage/assinar/route'

function req(body: unknown): Request {
  return new Request('http://test.local/api/storage/assinar', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  usuarioAtual = { id: USUARIO }
  consultasDoUsuario = ['consulta-1']
  // Assina o que chegar até aqui — o teste mede o que a rota deixa passar.
  createSignedUrls.mockImplementation(async (paths: string[]) => ({
    data: paths.map(path => ({ path, signedUrl: `${PROJETO}/sign/${path}?token=t` })),
    error: null,
  }))
})

describe('POST /api/storage/assinar', () => {
  it('recusa sem sessão', async () => {
    usuarioAtual = null
    const res = await POST(req({ bucket: 'imoveis-fotos', valores: ['consulta-1/geral/a.jpg'] }))
    expect(res.status).toBe(401)
    expect(createSignedUrls).not.toHaveBeenCalled()
  })

  it('recusa bucket fora da lista', async () => {
    const res = await POST(req({ bucket: 'storage-de-backup', valores: ['x/a.jpg'] }))
    expect(res.status).toBe(400)
    expect(createSignedUrls).not.toHaveBeenCalled()
  })

  it('assina foto de consulta do próprio consultor', async () => {
    const res = await POST(req({ bucket: 'imoveis-fotos', valores: ['consulta-1/geral/a.jpg'] }))
    const { urls } = await res.json()
    expect(res.status).toBe(200)
    expect(urls['consulta-1/geral/a.jpg']).toContain('/sign/consulta-1/geral/a.jpg')
  })

  it('NÃO assina foto de consulta de outro consultor', async () => {
    const res = await POST(req({ bucket: 'imoveis-fotos', valores: ['consulta-de-outro/geral/a.jpg'] }))
    const { urls } = await res.json()
    expect(urls).toEqual({})
    expect(createSignedUrls).not.toHaveBeenCalled()
  })

  it('assina só a parte permitida de um lote misto', async () => {
    const res = await POST(req({
      bucket: 'imoveis-fotos',
      valores: ['consulta-1/geral/a.jpg', 'consulta-de-outro/geral/b.jpg'],
    }))
    const { urls } = await res.json()
    expect(Object.keys(urls)).toEqual(['consulta-1/geral/a.jpg'])
  })

  it('no bucket de clientes, a pasta raiz precisa ser o próprio usuário', async () => {
    const permitido = await POST(req({ bucket: 'clientes-fotos', valores: [`${USUARIO}/cliente-1.png`] }))
    expect(Object.keys((await permitido.json()).urls)).toHaveLength(1)

    const negado = await POST(req({ bucket: 'clientes-fotos', valores: [`${OUTRO}/cliente-1.png`] }))
    expect((await negado.json()).urls).toEqual({})
  })

  it('travessia de pasta não empresta a posse da consulta autorizada', async () => {
    const res = await POST(req({
      bucket: 'imoveis-fotos',
      valores: ['consulta-1/../consulta-de-outro/geral/a.jpg'],
    }))
    expect((await res.json()).urls).toEqual({})
  })

  it('aceita a URL pública legada e devolve indexado pelo valor enviado', async () => {
    // As linhas antigas guardam a URL completa; a tela manda o que tem em mãos.
    const legada = `${PROJETO}/storage/v1/object/public/imoveis-fotos/consulta-1/geral/a.jpg`
    const res = await POST(req({ bucket: 'imoveis-fotos', valores: [legada] }))
    const { urls } = await res.json()
    expect(urls[legada]).toContain('/sign/consulta-1/geral/a.jpg')
  })

  it('recusa lote acima do teto', async () => {
    const valores = Array.from({ length: 101 }, (_, i) => `consulta-1/geral/${i}.jpg`)
    const res = await POST(req({ bucket: 'imoveis-fotos', valores }))
    expect(res.status).toBe(400)
    expect(createSignedUrls).not.toHaveBeenCalled()
  })

  it('ignora valores que não são objeto do bucket, sem estourar', async () => {
    const res = await POST(req({
      bucket: 'imoveis-fotos',
      valores: ['data:image/png;base64,AAAA', 'https://outro.site/foto.jpg', null, 42],
    }))
    expect(res.status).toBe(200)
    expect((await res.json()).urls).toEqual({})
  })
})
