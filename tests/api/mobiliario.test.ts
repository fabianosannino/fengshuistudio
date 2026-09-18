// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GET, PUT } from '../../app/api/consultas/[id]/mobiliario/route'
import { novoMobiliario, cadastroVazio } from '../../src/lib/mobiliario'
const id = '00000000-0000-4000-8000-000000000001'
const mocks = vi.hoisted(() => ({ user: 'owner', leitura: null as unknown, escrita: null as unknown, erro: false, filtros: [] as unknown[][], updates: [] as unknown[] }))
vi.mock('server-only', () => ({}))
vi.mock('../../src/lib/rate-limit', () => ({ rateLimit: async () => ({ success: true }), ipDaRequisicao: () => 'fixture' }))
vi.mock('../../src/lib/supabase-route', () => ({ createRouteHandlerClient: async () => ({
  auth: { getUser: async () => ({ data: { user: mocks.user ? { id: mocks.user } : null } }) },
  rpc: async (nome: string, args: unknown) => { mocks.updates.push({nome,args}); return {data: mocks.escrita, error: mocks.erro ? {message:'test'} : null} },
  from: () => {
    let escrita = false
    const q = { select: () => q, eq: (...args: unknown[]) => { mocks.filtros.push(args); return q }, is: (...args: unknown[]) => { mocks.filtros.push(args); return q },
      update: (v: unknown) => { escrita = true; mocks.updates.push(v); return q },
      maybeSingle: async () => ({ data: escrita ? mocks.escrita : mocks.leitura, error: mocks.erro ? { message: 'test' } : null }) }
    return q
  },
}) }))
const ctx = { params: Promise.resolve({ id }) }, url = `https://example.invalid/api/consultas/${id}/mobiliario`
beforeEach(() => { mocks.user = 'owner'; mocks.leitura = { nome_imovel: 'Sintético', bagua_entrada: null, mobiliario: null }; mocks.escrita = { mobiliario: { ...cadastroVazio(), revisao: 1 } }; mocks.erro = false; mocks.filtros.length = 0; mocks.updates.length = 0 })
async function body() { const r = await GET(new Request(url), ctx); const data = await r.json(); return { revisao: 0, planta_sha256: data.planta_sha256, itens: [{ ...novoMobiliario(), ambiente: 'Cozinha' }] } }
const put = (v: unknown) => PUT(new Request(url, { method: 'PUT', body: JSON.stringify(v) }), ctx)
describe('D-MOB-02 — API, posse, concorrência e falhas', () => {
  it('recusa anônimo e não usa identificador de dono enviado no corpo', async () => {
    mocks.user = ''; expect((await GET(new Request(url), ctx)).status).toBe(401)
    mocks.user = 'owner'; expect((await put({ ...await body(), consultor_id: 'another' })).status).toBe(400)
    expect(mocks.updates).toHaveLength(0)
  })
  it('consulta sob RLS e filtro de dono autenticado; não expõe existência alheia', async () => {
    mocks.leitura = null
    expect((await GET(new Request(url), ctx)).status).toBe(404)
    expect(mocks.filtros).toContainEqual(['consultor_id', 'owner'])
  })
  it('salva somente mobiliário e condiciona a escrita à revisão e geometria lidas', async () => {
    const v = await body();expect((await put(v)).status).toBe(200)
    expect(mocks.updates[0]).toEqual({nome:'salvar_mobiliario_consulta', args:{p_consulta:id,p_revisao:0,p_entrada:null,p_cadastro:{ versao: 1, revisao: 1, referencia_planta: v.planta_sha256, itens: v.itens }}})
  })
  it('não sobrescreve uma revisão antiga nem uma planta alterada', async () => {
    const v = await body()
    expect((await put({ ...v, revisao: 2 })).status).toBe(409)
    expect((await put({ ...v, planta_sha256: 'velho' })).status).toBe(409)
    expect(mocks.updates).toHaveLength(0)
  })
  it('concorrência entre leitura e escrita retorna conflito, não sucesso vazio', async () => {
    const v = await body(); mocks.escrita = null
    expect((await put(v)).status).toBe(409)
  })
  it('erros do banco nunca viram sucesso ou lista vazia', async () => {
    const v = await body();mocks.erro = true
    expect((await put(v)).status).toBe(503)
    expect((await GET(new Request(url), ctx)).status).toBe(503)
  })
  it('recusa polígonos/campos estranhos e posições fora do quadrante escolhido', async () => {
    const v = await body()
    expect((await put({ ...v, itens: [{ ...v.itens[0], posicao: { x: 12, y: 30 } }] })).status).toBe(400)
    expect((await put({ ...v, itens: [{ ...v.itens[0], direcao: 400 }] })).status).toBe(400)
  })
  it('respostas privadas não são armazenadas em cache', async () => {
    expect((await GET(new Request(url), ctx)).headers.get('cache-control')).toBe('private, no-store')
  })
})
