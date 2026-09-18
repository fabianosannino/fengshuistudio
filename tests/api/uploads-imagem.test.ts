// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import sharp from 'sharp'

const m = vi.hoisted(() => ({
  user: '11111111-1111-4111-8111-111111111111' as string | null,
  id: '22222222-2222-4222-8222-222222222222',
  query: vi.fn(), upload: vi.fn(), remove: vi.fn(), filters: [] as unknown[][],
  updates: [] as unknown[], capability: true,
}))
vi.mock('server-only', () => ({}))
vi.mock('../../src/lib/logger', () => ({ logger: { error: vi.fn(), info: vi.fn() } }))
vi.mock('../../src/lib/rate-limit', () => ({ rateLimit: async () => ({ success: true }), ipDaRequisicao: () => 'fixture' }))
vi.mock('../../src/lib/guarda-admin', () => ({ exigirCapacidade: async () => ({ ok: m.capability }), respostaDaGuarda: () => Response.json({}, { status: 403 }) }))
function cliente() {
  return {
    auth: { getUser: async () => ({ data: { user: m.user ? { id: m.user } : null } }) },
    from: (table: string) => {
      const q = { select: () => q, eq: (...args: unknown[]) => { m.filters.push([table, ...args]); return q },
        is: (...args: unknown[]) => { m.filters.push([table, ...args]); return q },
        update: (data: unknown) => { m.updates.push(data); return q }, maybeSingle: () => m.query() }
      return q
    },
    storage: { from: () => ({ upload: m.upload, remove: m.remove }) },
  }
}
vi.mock('../../src/lib/supabase-route', () => ({ createRouteHandlerClient: async () => cliente() }))
vi.mock('../../src/lib/supabase-admin', () => ({ createSupabaseAdminClient: () => cliente() }))
import { POST as planta } from '../../app/api/consultas/bagua-planta/route'
import { POST as fotos, DELETE as removerFoto } from '../../app/api/consultas/fotos/route'
import { POST as fotoCliente } from '../../app/api/clientes/foto/route'
import { POST as fotoProduto } from '../../app/api/admin/produtos/imagem/route'

async function request(campo: string, extras: Record<string, string> = {}, invalid = false, count = 1) {
  const form = new FormData()
  const bytes = invalid ? Buffer.from('<svg>falso</svg>') : await sharp({ create: { width: 2, height: 2, channels: 3, background: 'blue' } }).png().toBuffer()
  for (let i = 0; i < count; i++) form.append(campo, new File([Uint8Array.from(bytes)], 'fixture.png', { type: 'image/png' }))
  for (const [key, value] of Object.entries(extras)) form.set(key, value)
  return new Request('https://example.invalid', { method: 'POST', body: form })
}
beforeEach(() => {
  vi.clearAllMocks(); m.filters.length = 0; m.updates.length = 0; m.capability = true
  m.user = '11111111-1111-4111-8111-111111111111'
  m.query.mockResolvedValue({ data: { id: m.id, foto_url: `${m.user}/${m.id}.jpg` }, error: null })
  m.upload.mockResolvedValue({ error: null }); m.remove.mockResolvedValue({ error: null })
})

describe('fronteiras de upload com decoder real', () => {
  const rotas = [
    { nome: 'planta', rota: planta, campo: 'planta', parametros: () => ({ consulta_id: m.id }) },
    { nome: 'fotos', rota: fotos, campo: 'fotos', parametros: () => ({ consulta_id: m.id, tipo: 'geral' }) },
    { nome: 'cliente', rota: fotoCliente, campo: 'foto', parametros: () => ({ cliente_id: m.id }) },
    { nome: 'produto', rota: fotoProduto, campo: 'imagem', parametros: () => ({ produto_id: m.id }) },
  ]
  it.each(rotas)('$nome recusa bytes falsos sem armazenar', async ({ rota, campo, parametros }) => {
    expect((await rota(await request(campo, parametros(), true))).status).toBe(400)
    expect(m.upload).not.toHaveBeenCalled(); expect(m.updates).toEqual([])
  })
  it.each(rotas)('$nome confirma objeto com bytes e upsert false', async ({ rota, campo, parametros }) => {
    expect((await rota(await request(campo, parametros()))).status).toBe(200)
    expect(m.upload).toHaveBeenCalledWith(expect.stringMatching(/\.png$/), expect.any(Buffer), { contentType: 'image/png', upsert: false })
  })
  it.each(rotas)('$nome não confunde falha de consulta com ausência', async ({ rota, campo, parametros }) => {
    m.query.mockResolvedValue({ data: null, error: { code: 'XX000' } })
    expect((await rota(await request(campo, parametros()))).status).toBe(503)
    expect(m.upload).not.toHaveBeenCalled()
  })
  it.each(rotas)('$nome não grava quando a linha não existe ou não é acessível', async ({ rota, campo, parametros }) => {
    m.query.mockResolvedValue({ data: null, error: null })
    expect((await rota(await request(campo, parametros()))).status).toBe(404)
    expect(m.upload).not.toHaveBeenCalled()
  })
  it('sem sessão ou capacidade não processa arquivo', async () => {
    m.user = null
    for (const rota of [planta, fotos, fotoCliente]) expect((await rota(await request('foto'))).status).toBe(401)
    m.capability = false
    expect((await fotoProduto(await request('imagem'))).status).toBe(403)
    expect(m.upload).not.toHaveBeenCalled()
  })
  it('planta cria versões distintas sem apagar a anterior, inclusive em falha', async () => {
    await planta(await request('planta', { consulta_id: m.id })); await planta(await request('planta', { consulta_id: m.id }))
    expect(m.upload.mock.calls[0][0]).not.toBe(m.upload.mock.calls[1][0])
    m.upload.mockResolvedValue({ error: { message: 'private' } })
    expect((await planta(await request('planta', { consulta_id: m.id }))).status).toBe(503)
    expect(m.remove).not.toHaveBeenCalled()
    expect(m.filters).toContainEqual(['consultas', 'consultor_id', m.user])
  })
  it('foto do cliente preserva a anterior se upload, vínculo ou concorrência falham', async () => {
    m.upload.mockResolvedValueOnce({ error: {} })
    expect((await fotoCliente(await request('foto', { cliente_id: m.id }))).status).toBe(503)
    expect(m.updates).toEqual([])
    m.query.mockResolvedValueOnce({ data: { id: m.id, foto_url: 'old' }, error: null }).mockResolvedValueOnce({ data: null, error: {} })
    expect((await fotoCliente(await request('foto', { cliente_id: m.id }))).status).toBe(503)
    m.query.mockResolvedValueOnce({ data: { id: m.id, foto_url: 'old' }, error: null }).mockResolvedValueOnce({ data: null, error: null })
    expect((await fotoCliente(await request('foto', { cliente_id: m.id }))).status).toBe(409)
    expect(m.filters).toContainEqual(['clientes', 'foto_url', 'old'])
    expect(m.remove).not.toHaveBeenCalled()
  })
  it('o lote é validado por inteiro antes do primeiro upload', async () => {
    const req = await request('fotos', { consulta_id: m.id, tipo: 'geral' })
    const form = await req.formData(); form.append('fotos', 'não é arquivo')
    expect((await fotos(new Request('https://example.invalid', { method: 'POST', body: form }))).status).toBe(400)
    expect(m.upload).not.toHaveBeenCalled()
  })
  it('falha no segundo objeto remove somente o primeiro objeto desta tentativa', async () => {
    m.upload.mockResolvedValueOnce({ error: null }).mockResolvedValueOnce({ error: {} })
    expect((await fotos(await request('fotos', { consulta_id: m.id, tipo: 'geral' }, false, 2))).status).toBe(503)
    expect(m.remove).toHaveBeenCalledWith([m.upload.mock.calls[0][0]])
  })
  it.each(['invalido', 'comodo'])('tipo/cômodo incompletos são recusados: %s', async tipo => {
    expect((await fotos(await request('fotos', { consulta_id: m.id, tipo }))).status).toBe(400)
    expect(m.upload).not.toHaveBeenCalled()
  })
  it('mais de dez imagens não iniciam escrita', async () => {
    expect((await fotos(await request('fotos', { consulta_id: m.id, tipo: 'geral' }, false, 11))).status).toBe(400)
    expect(m.upload).not.toHaveBeenCalled()
  })
  it.each(['33333333-3333-4333-8333-333333333333/geral/a.png', 'data:image/png;base64,x', `${m.id}/../a.png`])('DELETE recusa path alheio/inválido: %s', async url => {
    const response = await removerFoto(new Request('https://example.invalid', { method: 'DELETE', body: JSON.stringify({ consulta_id: m.id, url }) }))
    expect(response.status).toBe(400); expect(m.remove).not.toHaveBeenCalled()
  })
  it('DELETE não transforma planta histórica em foto removível', async () => {
    const response = await removerFoto(new Request('https://example.invalid', { method: 'DELETE', body: JSON.stringify({ consulta_id: m.id, url: `${m.id}/bagua-planta/old.png` }) }))
    expect(response.status).toBe(409); expect(m.remove).not.toHaveBeenCalled()
  })
})
