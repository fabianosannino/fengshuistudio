// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
const state = vi.hoisted(() => ({
  user: { id: 'owner', email: 'owner@example.invalid', email_confirmed_at: '2026-01-01', created_at: '2026-01-01' } as Record<string, unknown> | null,
  rows: {} as Record<string, Record<string, unknown>[]>, calls: [] as { table: string; op: string; values?: unknown }[],
  failTable: '', failOp: '', failPage: -1,
  remove: vi.fn(), deleteUser: vi.fn(), emissions: vi.fn(), iniciar: vi.fn(), signOut: vi.fn(),
}))
vi.mock('../../src/lib/logger', () => ({ logger: { info: vi.fn(), error: vi.fn() } }))
vi.mock('../../src/lib/rate-limit', () => ({ rateLimit: async () => ({ success: true }), ipDaRequisicao: () => 'fixture' }))
vi.mock('../../src/lib/relatorio-retencao', () => ({ excluirEmissoesDoTitular: state.emissions }))
vi.mock('../../src/lib/supabase-route', () => ({ createRouteHandlerClient: async () => ({ auth: { getUser: async () => ({ data: { user: state.user } }), signOut: state.signOut } }) }))
vi.mock('../../src/lib/supabase-admin', () => ({ createSupabaseAdminClient: () => ({
  rpc: state.iniciar,
  auth: { admin: { deleteUser: state.deleteUser } }, storage: { from: (bucket: string) => ({
    remove: (paths: string[]) => state.remove(bucket, paths), list: async () => ({ data: [], error: null }),
  }) },
  from(table: string) {
    const filters: ((r: Record<string, unknown>) => boolean)[] = []
    let op = 'select', start = 0, end = 999, values: Record<string, unknown> = {}
    const q = {
      select() { return q }, order() { return q },
      range(a: number, b: number) { start = a; end = b; return q },
      eq(key: string, value: unknown) { filters.push(r => r[key] === value); return q },
      in(key: string, list: unknown[]) { filters.push(r => list.includes(r[key])); return q },
      delete() { op = 'delete'; return q },
      update(v: Record<string, unknown>) { op = 'update'; values = v; return q },
      then(resolve: (v: unknown) => unknown) {
        state.calls.push({ table, op, values })
        if (table === state.failTable && op === state.failOp && (state.failPage < 0 || start === state.failPage)) {
          return Promise.resolve({ data: null, count: null, error: { message: 'synthetic failure' } }).then(resolve)
        }
        const all = state.rows[table] ?? []
        const matching = all.filter(r => filters.every(f => f(r)))
        if (op === 'delete') state.rows[table] = all.filter(r => !matching.includes(r))
        if (op === 'update') matching.forEach(r => Object.assign(r, values))
        return Promise.resolve({ data: matching.slice(start, end + 1), count: matching.length, error: null }).then(resolve)
      },
    }
    return q
  },
}) }))
import { GET, POST } from '../../app/api/conta/dados/route'
const request = (body: unknown = { confirmacao: 'EXCLUIR', user_id: 'other' }) => new Request('https://example.invalid/api/conta/dados', { method: 'POST', body: JSON.stringify(body) })
beforeEach(() => {
  vi.clearAllMocks(); state.calls = []; state.failTable = ''; state.failOp = ''; state.failPage = -1
  state.user = { id: 'owner', email: 'owner@example.invalid', email_confirmed_at: '2026-01-01', created_at: '2026-01-01' }
  state.rows = {
    profiles: [{ id: 'owner' }, { id: 'other' }],
    checkouts_assinatura: [{ id: 'checkout', user_id: 'owner' }, { id: 'other-checkout', user_id: 'other' }],
    clientes: [{ id: 'client', consultor_id: 'owner', foto_url: 'owner/photo.jpg' }, { id: 'other-client', consultor_id: 'other' }],
    consultas: [{ id: 'visit', consultor_id: 'owner', bagua_entrada: { planta_url: 'visit/plan.png' } }, { id: 'other-visit', consultor_id: 'other' }],
    fotos_consulta: [{ id: 'photo', consulta_id: 'visit', url: 'visit/photo.jpg' }, { id: 'other-photo', consulta_id: 'other-visit' }],
    setores_bagua: [{ id: 'sector', consulta_id: 'visit' }, { id: 'other-sector', consulta_id: 'other-visit' }],
    diagnostico_criterios: [{ id: 'criterion', setor_id: 'sector' }, { id: 'other-criterion', setor_id: 'other-sector' }],
    pedidos: [{ id: 'purchase', comprador_email: 'owner@example.invalid' }, { id: 'other-purchase', comprador_email: 'other@example.invalid' }],
  }
  state.remove.mockResolvedValue({ error: null }); state.deleteUser.mockResolvedValue({ error: null }); state.emissions.mockResolvedValue(0)
  state.iniciar.mockResolvedValue({ data: 'pronto', error: null }); state.signOut.mockResolvedValue({ error: null })
})
describe('portabilidade do titular', () => {
  it('inventário usa a mesma sessão e não confunde erro de contagem com zero', async () => {
    const req = new Request('https://example.invalid/api/conta/dados?resumo=1&user_id=other')
    expect(await (await GET(req)).json()).toEqual({ clientes: 1, consultas: 1, pedidosComoComprador: 1, pedidosComoVendedor: 0 })
    state.failTable = 'clientes'; state.failOp = 'select'
    expect((await GET(req)).status).toBe(503)
  })
  it('deriva posse da sessão e inclui filhos somente das consultas próprias', async () => {
    const response = await GET(new Request('https://example.invalid/api/conta/dados?user_id=other'))
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toContain('no-store')
    const data = await response.json()
    expect(data.perfil.id).toBe('owner')
    expect(data.checkouts_assinatura.map((c: { id: string }) => c.id)).toEqual(['checkout'])
    expect(data.clientes.map((c: { id: string }) => c.id)).toEqual(['client'])
    expect(data.fotos_consulta.map((c: { id: string }) => c.id)).toEqual(['photo'])
    expect(data.diagnostico_criterios.map((c: { id: string }) => c.id)).toEqual(['criterion'])
    expect(data.compras.map((c: { id: string }) => c.id)).toEqual(['purchase'])
  })
  it('não usa e-mail ainda não verificado para exportar compras', async () => {
    state.user!.email_confirmed_at = null
    expect((await (await GET(new Request('https://example.invalid'))).json()).compras).toEqual([])
  })
  it('exporta mais de mil registros', async () => {
    state.rows.clientes = Array.from({ length: 1001 }, (_, id) => ({ id: String(id), consultor_id: 'owner' }))
    const response = await GET(new Request('https://example.invalid'))
    expect((await response.json()).clientes).toHaveLength(1001)
  })
  it('falha numa página não vira exportação truncada de sucesso', async () => {
    state.rows.clientes = Array.from({ length: 1001 }, (_, id) => ({ id: String(id), consultor_id: 'owner' }))
    state.failTable = 'clientes'; state.failOp = 'select'; state.failPage = 500
    expect((await GET(new Request('https://example.invalid'))).status).toBe(503)
  })
})
describe('exclusão com falha explícita', () => {
  it.each(['cobranca', 'produtos', 'vinculos'])('não remove dados com vínculo pendente: %s', async motivo => {
    state.iniciar.mockResolvedValue({ data: motivo, error: null })
    expect((await POST(request())).status).toBe(409)
    expect(state.iniciar).toHaveBeenCalledExactlyOnceWith('iniciar_exclusao_do_titular', { p_user_id: 'owner' })
    expect(state.calls).toHaveLength(0); expect(state.remove).not.toHaveBeenCalled(); expect(state.deleteUser).not.toHaveBeenCalled()
  })
  it('falha ou resposta desconhecida na admissão impede exclusão', async () => {
    state.iniciar.mockResolvedValue({ data: null, error: {} })
    expect((await POST(request())).status).toBe(503)
    state.iniciar.mockResolvedValue({ data: 'desconhecido', error: null })
    expect((await POST(request())).status).toBe(503)
    expect(state.calls).toHaveLength(0)
  })
  it('falha na revogação das sessões impede remoção do Auth', async () => {
    state.signOut.mockResolvedValue({ error: {} })
    expect((await POST(request())).status).toBe(503)
    expect(state.signOut).toHaveBeenCalledExactlyOnceWith({ scope: 'global' })
    expect(state.deleteUser).not.toHaveBeenCalled()
  })
  it('não aceita ID do corpo e preserva terceiros', async () => {
    expect((await POST(request())).status).toBe(200)
    expect(state.deleteUser).toHaveBeenCalledExactlyOnceWith('owner')
    expect(state.rows.clientes).toEqual([expect.objectContaining({ id: 'other-client' })])
    expect(state.rows.consultas).toEqual([expect.objectContaining({ id: 'other-visit' })])
    expect(state.remove.mock.calls.flatMap(c => c[1])).toEqual(['owner/photo.jpg', 'visit/plan.png', 'visit/photo.jpg'])
    expect(state.calls.some(c => c.table === 'perfis_publicos')).toBe(false)
  })
  it('arquivo de outro titular referenciado na própria linha nunca é apagado', async () => {
    state.rows.clientes[0].foto_url = 'other/photo.jpg'
    expect((await POST(request())).status).toBe(503)
    expect(state.remove).not.toHaveBeenCalled(); expect(state.emissions).not.toHaveBeenCalled(); expect(state.deleteUser).not.toHaveBeenCalled()
  })
  it('falha de inventário interrompe antes dos arquivos', async () => {
    state.failTable = 'consultas'; state.failOp = 'select'
    expect((await POST(request())).status).toBe(503)
    expect(state.remove).not.toHaveBeenCalled(); expect(state.emissions).not.toHaveBeenCalled()
  })
  it('falha de Storage preserva registros e conta para nova tentativa', async () => {
    state.remove.mockResolvedValue({ error: {} })
    expect((await POST(request())).status).toBe(503)
    expect(state.calls.some(c => c.op === 'delete')).toBe(false)
    expect(state.deleteUser).not.toHaveBeenCalled()
    state.remove.mockResolvedValue({ error: null })
    expect((await POST(request())).status).toBe(200)
  })
  it('falha ao remover registros não remove a conta', async () => {
    state.failTable = 'consultas'; state.failOp = 'delete'
    expect((await POST(request())).status).toBe(503)
    expect(state.deleteUser).not.toHaveBeenCalled()
  })
  it('falha de anonimização não confirma exclusão', async () => {
    state.failTable = 'pedidos'; state.failOp = 'update'
    expect((await POST(request())).status).toBe(503)
    expect(state.deleteUser).not.toHaveBeenCalled()
  })
  it('falha do Auth continua explícita', async () => {
    state.deleteUser.mockResolvedValue({ error: {} })
    expect((await POST(request())).status).toBe(503)
  })
  it.each([null, [], { confirmacao: 123 }, { confirmacao: 'sim' }])('recusa confirmação inválida %j', async body => {
    expect((await POST(request(body))).status).toBe(400)
    expect(state.calls).toHaveLength(0)
  })
  it('sem autenticação não inicia nada', async () => {
    state.user = null
    expect((await POST(request())).status).toBe(401)
    expect((await GET(new Request('https://example.invalid'))).status).toBe(401)
    expect(state.calls).toHaveLength(0)
  })
})
