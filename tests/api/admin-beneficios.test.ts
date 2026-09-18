// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
const m = vi.hoisted(() => ({ rpc: vi.fn(), list: vi.fn(), cancel: vi.fn(), update: vi.fn(), writes: [] as string[] }))
vi.mock('../../src/lib/rate-limit', () => ({ rateLimit: async () => ({ success: true }), ipDaRequisicao: () => 'test' }))
vi.mock('../../src/lib/guarda-admin', () => ({ exigirCapacidade: async () => ({ ok: true, user: { id: 'admin' } }), respostaDaGuarda: vi.fn() }))
vi.mock('../../src/lib/supabase-route', () => ({ createRouteHandlerClient: async () => ({}) }))
vi.mock('../../src/lib/stripe', () => ({ default: { subscriptions: { list: m.list, cancel: m.cancel, update: m.update } } }))
vi.mock('../../src/lib/supabase-admin', () => ({ createSupabaseAdminClient: () => ({
  rpc: m.rpc,
  from: (table: string) => {
    const q = { select: () => q, eq: () => q, in: () => q, insert: () => { m.writes.push(table); return q },
      update: () => { m.writes.push(table); return q },
      single: async () => ({ data: { id: 'owner', nome_completo: 'Fixture', plano: 'pro', stripe_customer_id: 'cus_fixture' }, error: null }),
      then: (resolve: (r: unknown) => void) => Promise.resolve({ error: null }).then(resolve) }
    return q
  },
}) }))
import { POST } from '../../app/api/admin/subscriptions/route'
const req = (body: Record<string, unknown>) => new Request('https://example.invalid/api/admin/subscriptions', { method: 'POST', body: JSON.stringify({ user_id: 'owner', motivo: 'Synthetic', ...body }) })
beforeEach(() => {
  vi.clearAllMocks(); m.writes.length = 0
  m.rpc.mockResolvedValue({ data: 'profissional', error: null })
  m.list.mockResolvedValue({ data: [{ id: 'sub_fixture', status: 'active' }], has_more: false })
})
describe('benefícios administrativos mantêm outras origens', () => {
  it('gratuidade usa concessão própria e não cancela nem fabrica assinatura', async () => {
    expect((await POST(req({ action: 'gratuidade', plan_slug: 'profissional', duration_months: 2 }))).status).toBe(200)
    expect(m.rpc).toHaveBeenCalledWith('alterar_concessao_de_plano', expect.objectContaining({ p_usuario: 'owner', p_origem: 'cortesia', p_referencia: 'admin:owner', p_operacao: 'conceder', p_criada_por: 'admin' }))
    expect(m.list).not.toHaveBeenCalled(); expect(m.cancel).not.toHaveBeenCalled()
    expect(m.writes).toEqual(['admin_audit_log'])
  })
  it('encerrar benefício manual é limitado à referência administrativa', async () => {
    expect((await POST(req({ action: 'change_plan', plan_slug: 'free' }))).status).toBe(200)
    expect(m.rpc).toHaveBeenCalledWith('alterar_concessao_de_plano', expect.objectContaining({ p_usuario: 'owner', p_origem: 'cortesia', p_referencia: 'admin:owner', p_operacao: 'encerrar' }))
    expect(m.writes).not.toContain('profiles')
  })
  it('falha na concessão não registra sucesso', async () => {
    m.rpc.mockResolvedValue({ error: { code: 'XX000' } })
    expect((await POST(req({ action: 'gratuidade', plan_slug: 'profissional' }))).status).toBe(500)
    expect(m.writes).toEqual([])
  })
  it.each([0, -1, 1.5, 121, '2'])('duração inválida %j não concede benefício', async duration_months => {
    expect((await POST(req({ action: 'gratuidade', plan_slug: 'profissional', duration_months }))).status).toBe(400)
    expect(m.rpc).not.toHaveBeenCalled()
  })
  it.each([true, false])('falha do provedor ao cancelar (imediato=%s) não marca cancelamento local nem remove benefício', async immediate => {
    m.cancel.mockRejectedValue(new Error('timeout')); m.update.mockRejectedValue(new Error('timeout'))
    expect((await POST(req({ action: 'cancel_subscription', immediate }))).status).toBe(500)
    expect(m.rpc).not.toHaveBeenCalled(); expect(m.writes).toEqual([])
  })
})
