// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type Stripe from 'stripe'
import { COMBINACOES_ASSINATURA } from '../../src/lib/catalogo-assinaturas'
import { PRECOS_DOS_PLANOS } from '../../src/lib/plano-utils'

const mocks = vi.hoisted(() => ({ user: { id: 'owner', email: 'fixture@example.invalid' } as { id: string; email: string } | null, customerId: 'cus_antigo' as string | null,
  preco: vi.fn(), retrieve: vi.fn(), create: vi.fn(), checkout: vi.fn(), subs: vi.fn(), update: vi.fn(), perfilErro: false }))
vi.mock('../../src/lib/stripe', () => ({ default: {
  prices: { retrieve: mocks.preco }, customers: { retrieve: mocks.retrieve, create: mocks.create },
  subscriptions: { list: mocks.subs }, checkout: { sessions: { create: mocks.checkout } },
} }))
vi.mock('../../src/lib/rate-limit', () => ({ rateLimit: async () => ({ success: true }), ipDaRequisicao: () => '127.0.0.1' }))
vi.mock('../../src/lib/supabase-route', () => ({ createRouteHandlerClient: async () => ({
  auth: { getUser: async () => ({ data: { user: mocks.user } }) },
  from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: { stripe_customer_id: mocks.customerId }, error: mocks.perfilErro ? {} : null }) }) }) }),
}) }))
vi.mock('../../src/lib/supabase-admin', () => ({ createSupabaseAdminClient: () => ({ from: () => ({ update: (v: unknown) => ({ eq: () => mocks.update(v) }) }) }) }))
import { POST } from '../../app/api/stripe/subscribe/route'

const mensal = { plan_slug: 'profissional', billing_cycle: 'monthly' }
const enviar = (body: unknown) => POST(new Request('https://example.invalid/api/stripe/subscribe', { method: 'POST', body: JSON.stringify(body) }))
function precoValido(plano: 'simples' | 'profissional' = 'profissional', anual = false): Stripe.Price {
  return { id: 'price_proMensal', active: true, type: 'recurring', currency: 'brl', livemode: false,
    billing_scheme: 'per_unit', unit_amount: PRECOS_DOS_PLANOS[plano][anual ? 'anualCentavos' : 'mensalCentavos'],
    product: { id: `prod_${plano}`, active: true }, recurring: { interval: anual ? 'year' : 'month', interval_count: 1, usage_type: 'licensed' },
  } as Stripe.Price
}
beforeEach(() => {
  vi.clearAllMocks()
  mocks.user = { id: 'owner', email: 'fixture@example.invalid' }; mocks.customerId = 'cus_antigo'; mocks.perfilErro = false
  process.env.STRIPE_SECRET_KEY = 'rk_test_fixture'
  process.env.NEXT_PUBLIC_APP_URL = 'https://example.invalid'
  for (const c of COMBINACOES_ASSINATURA) delete process.env[c.variavel]
  process.env.STRIPE_PRICE_PRO_MONTHLY = 'price_proMensal'
  process.env.STRIPE_PRICE_ID = 'price_naodeveSerUsado'
  mocks.preco.mockResolvedValue(precoValido())
  mocks.retrieve.mockResolvedValue({ id: 'cus_antigo' })
  mocks.create.mockResolvedValue({ id: 'cus_novo' })
  mocks.update.mockResolvedValue({ error: null })
  mocks.subs.mockResolvedValue({ data: [], has_more: false })
  mocks.checkout.mockResolvedValue({ id: 'cs_fixture', url: 'https://checkout.stripe.com/fixture' })
})

describe('checkout de assinatura estrito', () => {
  it.each([null, [], {}, { plan_slug: ['profissional'], billing_cycle: 'monthly' }, { plan_slug: 'free', billing_cycle: 'monthly' }, { plan_slug: 'profissional', billing_cycle: 'weekly' }, { ...mensal, price: 'forjado' }])('recusa entrada inválida %j', async body => {
    expect((await enviar(body)).status).toBe(400)
    expect(mocks.preco).not.toHaveBeenCalled()
    expect(mocks.checkout).not.toHaveBeenCalled()
  })
  it('JSON malformado não usa defaults', async () => {
    expect((await POST(new Request('https://local', { method: 'POST', body: '{' }))).status).toBe(400)
  })
  it('ausência do preço específico não usa preço legado', async () => {
    delete process.env.STRIPE_PRICE_PRO_MONTHLY
    expect((await enviar(mensal)).status).toBe(503)
    expect(mocks.checkout).not.toHaveBeenCalled()
  })
  it.each(COMBINACOES_ASSINATURA)('confere a combinação $plan_slug / $billing_cycle', async c => {
    const id = `price_${c.plan_slug}${c.billing_cycle}`
    process.env[c.variavel] = id
    mocks.preco.mockResolvedValue({ ...precoValido(c.plan_slug, c.billing_cycle === 'yearly'), id })
    expect((await enviar({ plan_slug: c.plan_slug, billing_cycle: c.billing_cycle })).status).toBe(200)
    expect(mocks.checkout.mock.calls[0][0].line_items).toEqual([{ price: id, quantity: 1 }])
  })
  it.each([{ active: false }, { currency: 'usd' }, { unit_amount: 100 }, { livemode: true }, { product: { id: 'prod_x', deleted: true } }, { recurring: { interval: 'year', interval_count: 1, usage_type: 'licensed' } }])('não cobra preço incompatível %j', async delta => {
    mocks.preco.mockResolvedValue({ ...precoValido(), ...delta })
    expect((await enviar(mensal)).status).toBe(503)
    expect(mocks.checkout).not.toHaveBeenCalled()
    expect(mocks.create).not.toHaveBeenCalled()
  })
  it('timeout ao ler Customer não cria duplicata', async () => {
    mocks.retrieve.mockRejectedValue({ code: 'api_connection_error' })
    expect((await enviar(mensal)).status).toBe(503)
    expect(mocks.create).not.toHaveBeenCalled()
  })
  it('Customer comprovadamente ausente é criado com chave estável em retries', async () => {
    mocks.retrieve.mockRejectedValue({ code: 'resource_missing', statusCode: 404 })
    expect((await enviar(mensal)).status).toBe(200)
    expect((await enviar(mensal)).status).toBe(200)
    expect(mocks.create.mock.calls[0][1]).toEqual(mocks.create.mock.calls[1][1])
    expect(mocks.create.mock.calls[0][1].idempotencyKey).toMatch(/^customer-v2-[0-9a-f]{64}$/)
  })
  it('falha ao persistir Customer não abre checkout', async () => {
    mocks.customerId = null; mocks.update.mockResolvedValue({ error: {} })
    expect((await enviar(mensal)).status).toBe(503)
    expect(mocks.checkout).not.toHaveBeenCalled()
  })
  it('assinatura existente exige gerenciamento no portal', async () => {
    mocks.subs.mockResolvedValue({ data: [{ status: 'active' }], has_more: false })
    expect((await enviar(mensal)).status).toBe(409)
    expect(mocks.checkout).not.toHaveBeenCalled()
  })
  it('sem sessão não consulta dados de cobrança', async () => {
    mocks.user = null
    expect((await enviar(mensal)).status).toBe(401)
    expect(mocks.preco).not.toHaveBeenCalled()
  })
})
