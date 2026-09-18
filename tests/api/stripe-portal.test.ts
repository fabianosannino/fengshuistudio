// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
const m = vi.hoisted(() => ({ user: { id: 'owner' } as { id: string } | null, error: null as unknown, customer: 'cus_owner', rate: vi.fn(), create: vi.fn(), eq: vi.fn() }))
vi.mock('../../src/lib/stripe', () => ({ default: { billingPortal: { sessions: { create: m.create } } } }))
vi.mock('../../src/lib/rate-limit', () => ({ rateLimit: m.rate, ipDaRequisicao: () => 'fixture' }))
vi.mock('../../src/lib/supabase-route', () => ({ createRouteHandlerClient: async () => ({
  auth: { getUser: async () => ({ data: { user: m.user } }) },
  from: () => ({ select: () => ({ eq: m.eq }) }),
}) }))
import { POST } from '../../app/api/stripe/portal/route'
const request = () => new Request('https://example.invalid/api/stripe/portal', { method: 'POST', body: JSON.stringify({ customer_id: 'cus_victim' }) })
beforeEach(() => {
  vi.clearAllMocks(); m.user = { id: 'owner' }; m.error = null; m.customer = 'cus_owner'
  m.eq.mockImplementation(() => ({ single: async () => ({ data: { stripe_customer_id: m.customer }, error: m.error }) }))
  m.rate.mockResolvedValue({ success: true }); m.create.mockResolvedValue({ url: 'https://billing.stripe.com/p/session/fixture' })
  process.env.NEXT_PUBLIC_APP_URL = 'https://example.invalid'
})
describe('portal de cobrança', () => {
  it('usa apenas o Customer da sessão e retorna para a página de planos', async () => {
    expect((await POST(request())).status).toBe(200)
    expect(m.eq).toHaveBeenCalledExactlyOnceWith('id', 'owner')
    expect(m.create).toHaveBeenCalledExactlyOnceWith({ customer: 'cus_owner', return_url: 'https://example.invalid/planos' })
  })
  it('indisponibilidade do perfil não é ausência de Customer', async () => {
    m.error = {}; expect((await POST(request())).status).toBe(503)
    expect(m.create).not.toHaveBeenCalled()
  })
  it('sem sessão não chama provedor', async () => {
    m.user = null; expect((await POST(request())).status).toBe(401)
    expect(m.create).not.toHaveBeenCalled()
  })
  it('falha do limitador interrompe antes de ler dados', async () => {
    m.rate.mockResolvedValue({ success: false, indisponivel: true })
    expect((await POST(request())).status).toBe(503)
    expect(m.eq).not.toHaveBeenCalled(); expect(m.create).not.toHaveBeenCalled()
  })
})
