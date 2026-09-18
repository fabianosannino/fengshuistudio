// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({ user: { id: 'owner' } as { id: string } | null,
  profile: { plano: 'freemium', stripe_customer_id: null as string | null },
  profileError: null as null | { code: string }, readPlan: vi.fn(), rpc: vi.fn(), list: vi.fn(), update: vi.fn(), writes: vi.fn(),
}))
vi.mock('../../src/lib/rate-limit', () => ({ rateLimit: async () => ({ success: true }), ipDaRequisicao: () => 'test' }))
vi.mock('../../src/lib/logger', () => ({ logger: { error: vi.fn() } }))
vi.mock('../../src/lib/stripe', () => ({ default: { subscriptions: { list: m.list, update: m.update } } }))
vi.mock('../../src/lib/supabase-route', () => ({ createRouteHandlerClient: async () => ({
  auth: { getUser: async () => ({ data: { user: m.user } }) },
  rpc: m.readPlan,
  from: () => { const q = { select: () => q, eq: () => q, single: async () => ({ data: m.profile, error: m.profileError }) }; return q },
}) }))
vi.mock('../../src/lib/supabase-admin', () => ({ createSupabaseAdminClient: () => ({
  rpc: m.rpc,
  from: () => {
    const q = { select: () => q, eq: () => q, not: () => q, in: () => q, update: (v: unknown) => { m.writes(v); return q },
      limit: async () => ({ data: [], error: null }), then: (resolve: (v: unknown) => void) => Promise.resolve({ error: null }).then(resolve) }
    return q
  },
}) }))
import { POST } from '../../app/api/planos/route'
const req = (body: unknown) => new Request('https://example.invalid/api/planos', { method: 'POST', body: JSON.stringify(body) })
beforeEach(() => {
  vi.clearAllMocks()
  m.user = { id: 'owner' }; m.profile = { plano: 'freemium', stripe_customer_id: null }; m.profileError = null
  m.rpc.mockResolvedValue({ data: 'profissional', error: null })
  m.readPlan.mockImplementation(async () => ({ data: m.profile.plano === 'pro' ? 'profissional' : 'free', error: null }))
  m.list.mockResolvedValue({ data: [], has_more: false }); m.update.mockResolvedValue({})
})
describe('alterar plano mantém a origem dos direitos', () => {
  it('projeção Pro vencida não dispensa novo direito ao solicitar Pro', async () => {
    m.profile.plano = 'pro'; m.readPlan.mockResolvedValue({ data: 'free', error: null })
    expect((await POST(req({ plano: 'pro' }))).status).toBe(402)
    expect(m.rpc).not.toHaveBeenCalled()
  })
  it('indisponibilidade da concessão não é downgrade para Free', async () => {
    m.readPlan.mockResolvedValue({ data: null, error: {} })
    expect((await POST(req({ plano: 'free' }))).status).toBe(503)
    expect(m.rpc).not.toHaveBeenCalled()
  })
  it('exige autenticação', async () => { m.user = null; expect((await POST(req({ plano: 'pro' }))).status).toBe(401); expect(m.rpc).not.toHaveBeenCalled() })
  it.each([null, [], { plano: [] }, { plano: 'pro', chave_ativacao: {} }])('valida o corpo %j', async body => {
    expect((await POST(req(body))).status).toBe(400); expect(m.rpc).not.toHaveBeenCalled()
  })
  it('falha de perfil não concede nem rebaixa', async () => {
    m.profileError = { code: 'offline' }
    expect((await POST(req({ plano: 'pro', chave_ativacao: 'SYNTHETIC' }))).status).toBe(503)
    expect(m.rpc).not.toHaveBeenCalled()
  })
  it('chave e titular passam à transação única; user_id do corpo é ignorado', async () => {
    const r = await POST(req({ plano: 'pro', chave_ativacao: 'SYNTHETIC', user_id: 'other' }))
    expect(r.status).toBe(200)
    expect(m.rpc).toHaveBeenCalledWith('ativar_chave_de_plano', { p_usuario: 'owner', p_chave: 'SYNTHETIC', p_plano: 'profissional' })
    expect(m.writes).not.toHaveBeenCalled()
  })
  it('falha transacional não retorna sucesso nem escreve o plano separadamente', async () => {
    m.rpc.mockResolvedValue({ error: { code: 'XX000', message: 'synthetic' } })
    expect((await POST(req({ plano: 'pro', chave_ativacao: 'SYNTHETIC' }))).status).toBe(503)
    expect(m.writes).not.toHaveBeenCalled()
  })
  it('mudança paga sem chave exige checkout', async () => {
    expect((await POST(req({ plano: 'pro' }))).status).toBe(402)
    expect(m.rpc).not.toHaveBeenCalled()
  })
  it('Free com assinatura no Stripe agenda cancelamento e preserva outras concessões', async () => {
    m.profile = { plano: 'pro', stripe_customer_id: 'cus_fixture' }
    m.list.mockResolvedValue({ data: [{ id: 'sub_fixture', status: 'active', cancel_at_period_end: false }], has_more: false })
    const r = await POST(req({ plano: 'free' }))
    expect(r.status).toBe(200)
    expect(await r.json()).toMatchObject({ plano: 'profissional', cancelamento_agendado: true })
    expect(m.update).toHaveBeenCalledWith('sub_fixture', { cancel_at_period_end: true })
    expect(m.rpc).not.toHaveBeenCalled()
  })
  it('falha no Stripe não encerra nenhum benefício', async () => {
    m.profile = { plano: 'pro', stripe_customer_id: 'cus_fixture' }; m.list.mockRejectedValue(new Error('timeout'))
    expect((await POST(req({ plano: 'free' }))).status).toBe(503)
    expect(m.rpc).not.toHaveBeenCalled(); expect(m.writes).not.toHaveBeenCalled()
  })
  it('renúncia explícita sem assinatura chama somente a operação de benefícios não pagos', async () => {
    m.rpc.mockResolvedValue({ data: 'free', error: null })
    expect((await POST(req({ plano: 'free' }))).status).toBe(200)
    expect(m.rpc).toHaveBeenCalledWith('renunciar_concessoes_nao_pagas', { p_usuario: 'owner' })
    expect(m.writes).not.toHaveBeenCalled()
  })
})
