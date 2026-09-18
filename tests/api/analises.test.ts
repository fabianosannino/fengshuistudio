import { calcularResultadoAnalise } from '../../src/lib/calculo-analise'
// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  fonteAnaliseTeste,
  idAnaliseTeste as id,
} from '../fixtures/fonte-analise'
import { jsonCanonico } from '../../src/lib/relatorio-emissao'
import { VERSAO_MOTOR_ANALISE } from '../../src/lib/historico-analises'
import { createHash } from 'node:crypto'
vi.mock('server-only', () => ({}))
const s = vi.hoisted(() => ({
  usuario: '',
  visivel: true,
  erro: false,
  hashErro: false,
  fonte: {} as unknown,
  rows: [] as Record<string, unknown>[],
  rpc: vi.fn(),
  admin: vi.fn(),
  limite: vi.fn(),
  plano: 'profissional' as string | null,
}))
function query(tabela: string) {
  const filtros: ((r: Record<string, unknown>) => boolean)[] = []
  let inicio = 0,
    fim = 999
  let campos = '*'
  const executar = () => ({
    error: s.erro ? { message: 'dado privado' } : null,
    data: (tabela === 'consultas'
      ? s.visivel
        ? [{ id: id(1), consultor_id: s.usuario }]
        : []
      : s.rows
    )
      .filter((r) => filtros.every((f) => f(r)))
      .slice(inicio, fim + 1)
      .map((r) =>
        campos === '*'
          ? r
          : Object.fromEntries(
              campos
                .split(',')
                .map((k) => [k, (r as Record<string, unknown>)[k]]),
            ),
      ),
  })
  const q = {
    select: (v: string) => {
      campos = v
      return q
    },
    eq: (k: string, v: unknown) => {
      filtros.push((r) => r[k] === v)
      return q
    },
    order: () => q,
    range: (a: number, b: number) => {
      inicio = a
      fim = b
      return q
    },
    maybeSingle: async () => {
      const r = executar()
      return { ...r, data: r.data[0] ?? null }
    },
    then: (ok: (r: unknown) => unknown) => Promise.resolve(executar()).then(ok),
  }
  return q
}
vi.mock('../../src/lib/supabase-route', () => ({
  createRouteHandlerClient: async () => ({
    auth: {
      getUser: async () => ({
        data: { user: s.usuario ? { id: s.usuario } : null },
      }),
    },
    from: query,
    rpc: async (nome: string) => ({
      data: nome === 'obter_meu_plano' ? s.plano : s.fonte,
      error: s.hashErro ? { message: 'falha fonte' } : null,
    }),
  }),
}))
vi.mock('../../src/lib/supabase-admin', () => ({
  createSupabaseAdminClient: () => {
    s.admin()
    return { rpc: s.rpc }
  },
}))
vi.mock('../../src/lib/rate-limit', () => ({
  rateLimit: () => s.limite(),
  ipDaRequisicao: () => 'fixture',
}))
import { GET, POST } from '../../app/api/consultas/[id]/analises/route'
import { GET as ENTRADA } from '../../app/api/consultas/relatorio/entrada/route'
const hash = (v: unknown) =>
  createHash('sha256').update(jsonCanonico(v)).digest('hex')
const ctx = { params: Promise.resolve({ id: id(1) }) }
const leitura = (p = '') =>
  new Request(`https://example.invalid/api/consultas/${id(1)}/analises${p}`)
const escrita = (extra: Record<string, unknown> = {}) =>
  new Request(leitura(), {
    method: 'POST',
    body: JSON.stringify({ id: id(30), fonte_sha256: hash(s.fonte), ...extra }),
  })
function linha(n = 30) {
  const fonte = fonteAnaliseTeste()
  return {
    id: id(n),
    consulta_id: id(1),
    consultor_id: id(1),
    criado_em: '2026-09-18T12:00:00.000Z',
    metodo: 'btb',
    variante: 'btb-porta',
    fonte_sha256: hash(fonte),
    versao_motor: VERSAO_MOTOR_ANALISE,
    fonte,
    resultado: calcularResultadoAnalise(fonte),
  }
}
beforeEach(() => {
  vi.clearAllMocks()
  s.usuario = id(1)
  s.visivel = true
  s.erro = false
  s.hashErro = false
  s.rows = []
  s.fonte = fonteAnaliseTeste()
  s.plano = 'profissional'
  s.limite.mockResolvedValue({ success: true })
  s.rpc.mockImplementation(async (_nome, p) => {
    s.rows.push({
      ...linha(),
      id: p.p_id,
      fonte: p.p_fonte,
      resultado: p.p_resultado,
      fonte_sha256: p.p_hash,
    })
    return { data: p.p_id, error: null }
  })
})
describe('D1 — API de histórico e fonte de relatório', () => {
  it('exige sessão e ownership antes de leitura privilegiada', async () => {
    s.usuario = ''
    expect((await GET(leitura(), ctx)).status).toBe(401)
    s.usuario = id(2)
    s.visivel = false
    expect((await POST(escrita(), ctx)).status).toBe(404)
    expect(s.admin).not.toHaveBeenCalled()
  })
  it('lista páginas sem carregar fontes privadas em massa; detalhe filtra dono', async () => {
    s.rows = Array.from({ length: 22 }, (_, i) => linha(i + 30))
    const r = await GET(leitura(), ctx),
      d = await r.json()
    expect(d.analises).toHaveLength(20)
    expect(d.analises[0]).not.toHaveProperty('fonte')
    expect(d.analises[0]).not.toHaveProperty('resultado')
    expect(d.mais).toBe(true)
    expect(r.headers.get('cache-control')).toMatch(/no-store/)
    expect(
      (await (await GET(leitura('?pagina=1'), ctx)).json()).analises,
    ).toHaveLength(2)
    s.rows[0].consultor_id = id(2)
    expect((await GET(leitura(`?analise=${id(30)}`), ctx)).status).toBe(404)
  })
  it('não aceita resultados, dono ou hash inventados pelo navegador', async () => {
    expect((await POST(escrita({ consultor_id: id(2) }), ctx)).status).toBe(400)
    expect(
      (await POST(escrita({ resultado: { aprovado: true } }), ctx)).status,
    ).toBe(400)
    expect(
      (await POST(escrita({ fonte_sha256: 'a'.repeat(64) }), ctx)).status,
    ).toBe(409)
    expect(s.admin).not.toHaveBeenCalled()
  })
  it('calcula no servidor e retry usa a mesma versão mesmo após edição da consulta', async () => {
    const req = escrita(),
      body = await req.clone().text(),
      r = await POST(req, ctx)
    expect(r.status).toBe(201)
    expect(s.rpc).toHaveBeenCalledWith(
      'registrar_analise',
      expect.objectContaining({
        p_consultor: id(1),
        p_resultado: expect.objectContaining({ setores: expect.any(Array) }),
      }),
    )
    s.fonte = fonteAnaliseTeste('bussola')
    expect(
      (await POST(new Request(leitura(), { method: 'POST', body }), ctx))
        .status,
    ).toBe(200)
    expect(s.rpc).toHaveBeenCalledTimes(1)
    expect(s.rows[0].metodo).toBe('btb')
    expect((await POST(escrita(), ctx)).status).toBe(409)
  })
  it('conflito atômico, falha de banco e fonte indisponível nunca viram sucesso', async () => {
    s.rpc.mockResolvedValue({ data: null, error: { code: 'PT409' } })
    expect((await POST(escrita(), ctx)).status).toBe(409)
    s.rpc.mockResolvedValue({
      data: null,
      error: { code: '42501', message: 'segredo' },
    })
    const r = await POST(escrita(), ctx)
    expect(r.status).toBe(503)
    expect(await r.text()).not.toContain('segredo')
    s.hashErro = true
    expect((await GET(leitura(), ctx)).status).toBe(503)
  })
  it('fontes corrompidas, versões antigas e plano indisponível bloqueiam nova emissão', async () => {
    s.rows = [linha()]
    const req = () =>
      new Request(
        `https://example.invalid/api/consultas/relatorio/entrada?consulta_id=${id(1)}&analise=${id(30)}`,
      )
    const r = await ENTRADA(req()),
      d = await r.json()
    expect(r.status).toBe(200)
    expect(d.analise_id).toBe(id(30))
    expect(d.plano_atual).toBe('profissional')
    s.plano = null
    expect((await ENTRADA(req())).status).toBe(503)
    s.plano = 'free'
    expect((await (await ENTRADA(req())).json()).plano_atual).toBe('free')
    s.rows[0].versao_motor = 'antigo'
    expect((await ENTRADA(req())).status).toBe(409)
    s.rows[0].fonte_sha256 = 'b'.repeat(64)
    expect((await GET(leitura(`?analise=${id(30)}`), ctx)).status).toBe(503)
  })
  it('valida identificadores, paginação, fonte finalizada e rate limit', async () => {
    expect((await GET(leitura('?pagina=-1'), ctx)).status).toBe(400)
    expect((await GET(leitura('?analise=outra'), ctx)).status).toBe(400)
    s.fonte = fonteAnaliseTeste()
    delete (s.fonte as ReturnType<typeof fonteAnaliseTeste>).consulta
      .bagua_entrada!.finalizada_em
    expect((await POST(escrita(), ctx)).status).toBe(409)
    s.limite.mockResolvedValue({ success: false })
    expect((await GET(leitura(), ctx)).status).toBe(429)
    s.limite.mockResolvedValue({ success: false, indisponivel: true })
    expect((await GET(leitura(), ctx)).status).toBe(503)
  })
})
