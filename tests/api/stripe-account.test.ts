// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
const m = vi.hoisted(() => ({
  user: { id: 'owner', email: 'owner@example.invalid' } as { id: string; email: string } | null,
  profile: { stripe_account_id: null as string | null }, error: null as unknown,
  retrieve: vi.fn(), create: vi.fn(), update: vi.fn(),
}))
vi.mock('../../src/lib/stripe', () => ({ default: { accounts: { retrieve: m.retrieve, create: m.create } } }))
vi.mock('../../src/lib/logger', () => ({ logger: { info: vi.fn(), error: vi.fn() } }))
vi.mock('../../src/lib/supabase-route', () => ({ createRouteHandlerClient: async () => ({
  auth: { getUser: async () => ({ data: { user: m.user } }) },
  from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: m.profile, error: m.error }) }) }) }),
}) }))
vi.mock('../../src/lib/supabase-admin', () => ({ createSupabaseAdminClient: () => ({
  from: () => ({ update: () => ({ eq: () => ({ select: () => ({ single: m.update }) }) }) }),
}) }))
import { GET, POST } from '../../app/api/stripe/account/route'
beforeEach(() => {
  vi.clearAllMocks(); m.user = { id: 'owner', email: 'owner@example.invalid' }; m.profile = { stripe_account_id: null }; m.error = null
  m.retrieve.mockResolvedValue({ id: 'acct_owner', capabilities: {}, requirements: {} })
  m.create.mockResolvedValue({ id: 'acct_new' }); m.update.mockResolvedValue({ data: { id: 'owner' }, error: null })
})
describe('conta conectada sempre pertence à sessão', () => {
  it('sem vínculo não consulta conta de terceiro', async () => {
    const response = await GET()
    expect((await response.json()).has_account).toBe(false)
    expect(m.retrieve).not.toHaveBeenCalled()
  })
  it('consulta somente o vínculo persistido do proprietário', async () => {
    m.profile.stripe_account_id = 'acct_owner'
    expect((await GET()).status).toBe(200)
    expect(m.retrieve).toHaveBeenCalledExactlyOnceWith('acct_owner')
  })
  it('erro de leitura não assume ausência', async () => {
    m.error = {}
    expect((await GET()).status).toBe(503)
    expect(m.retrieve).not.toHaveBeenCalled()
  })
  it.each([{ data: null, error: null }, { data: null, error: {} }])('vínculo ausente ou recusado não confirma criação: %j', async result => {
    m.update.mockResolvedValue(result)
    const response = await POST(new Request('https://example.invalid', { method: 'POST', body: '{}' }))
    expect(response.status).toBe(500)
    expect((await response.json()).account_id).toBeUndefined()
  })
})
