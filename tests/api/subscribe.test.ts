// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type Stripe from 'stripe'
import { COMBINACOES_ASSINATURA } from '../../src/lib/catalogo-assinaturas'
import { PRECOS_DOS_PLANOS } from '../../src/lib/plano-utils'

const mocks = vi.hoisted(() => ({ user: { id: 'owner', email: 'fixture@example.invalid' } as { id: string; email: string } | null, customerId: 'cus_antigo' as string | null,
  preco: vi.fn(), retrieve: vi.fn(), create: vi.fn(), checkout: vi.fn(), subs: vi.fn(), update: vi.fn(), rate: vi.fn(),
  rpc: vi.fn(), sessions: vi.fn(), getSession: vi.fn(), expire: vi.fn(), getSubscription: vi.fn(),
  tentativa: {} as Record<string, unknown>,
}))
vi.mock('server-only', () => ({}))
vi.mock('../../src/lib/stripe', () => ({ default: {
  prices: { retrieve: mocks.preco }, customers: { retrieve: mocks.retrieve, create: mocks.create },
  subscriptions: { list: mocks.subs, retrieve: mocks.getSubscription }, checkout: { sessions: { create: mocks.checkout, list: mocks.sessions, retrieve: mocks.getSession, expire: mocks.expire } },
} }))
vi.mock('../../src/lib/rate-limit', () => ({ rateLimit: mocks.rate, ipDaRequisicao: () => '127.0.0.1' }))
vi.mock('../../src/lib/supabase-route', () => ({ createRouteHandlerClient: async () => ({
  auth: { getUser: async () => ({ data: { user: mocks.user } }) },
}) }))
vi.mock('../../src/lib/supabase-admin', () => ({ createSupabaseAdminClient: () => ({ rpc: mocks.rpc }) }))
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
  mocks.rate.mockResolvedValue({ success: true })
  mocks.user = { id: 'owner', email: 'fixture@example.invalid' }; mocks.customerId = 'cus_antigo'
  mocks.tentativa = { id: '11111111-1111-4111-8111-111111111111', user_id: 'owner', live: false, customer_id: null, session_id: null, criada_em: new Date().toISOString() }
  mocks.rpc.mockImplementation(async (name: string, args: Record<string, unknown>) => {
    if (name === 'reservar_checkout_assinatura') return { data: {
      plano: args.p_plano, ciclo: args.p_ciclo, preco_id: args.p_preco, origem: args.p_origem,
      customer_anterior: mocks.customerId, ...mocks.tentativa,
    }, error: null }
    if (name === 'autorizar_criacao_checkout') return { data: mocks.tentativa[`${args.p_etapa}_criacao_em`] ?? new Date().toISOString(), error: null }
    return mocks.update(args)
  })
  process.env.STRIPE_SECRET_KEY = 'rk_test_fixture'
  process.env.NEXT_PUBLIC_APP_URL = 'https://example.invalid'
  for (const c of COMBINACOES_ASSINATURA) delete process.env[c.variavel]
  process.env.STRIPE_PRICE_PRO_MONTHLY = 'price_proMensal'
  process.env.STRIPE_PRICE_ID = 'price_naodeveSerUsado'
  mocks.preco.mockResolvedValue(precoValido())
  mocks.retrieve.mockResolvedValue({ id: 'cus_antigo' })
  mocks.create.mockResolvedValue({ id: 'cus_novo', livemode: false })
  mocks.update.mockResolvedValue({ data: true, error: null })
  mocks.subs.mockResolvedValue({ data: [], has_more: false })
  mocks.sessions.mockResolvedValue({ data: [], has_more: false })
  mocks.checkout.mockImplementation(async (args: NonNullable<Parameters<Stripe['checkout']['sessions']['create']>[0]>) => ({
    id: 'cs_fixture', url: 'https://checkout.stripe.com/fixture', status: 'open', expires_at: Math.floor(Date.now() / 1000) + 3600,
    mode: args.mode, customer: args.customer, client_reference_id: args.client_reference_id, livemode: false,
  }))
})

describe('checkout de assinatura estrito', () => {
  it('indisponibilidade do limitador recusa antes de acessar Stripe ou gravar', async () => {
    mocks.rate.mockResolvedValue({ success: false, indisponivel: true })
    const response = await enviar(mensal)
    expect(response.status).toBe(503)
    expect(response.headers.get('Retry-After')).toBe('30')
    expect(mocks.preco).not.toHaveBeenCalled()
    expect(mocks.create).not.toHaveBeenCalled()
    expect(mocks.checkout).not.toHaveBeenCalled()
    expect(mocks.update).not.toHaveBeenCalled()
    expect(mocks.rate).toHaveBeenCalledWith('127.0.0.1', expect.objectContaining({ escopo: 'POST:/api/stripe/subscribe', exigirCompartilhado: true }))
  })
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
    expect(mocks.create.mock.calls[0][1].idempotencyKey).toMatch(/^fss-customer-v3-/)
  })
  it('falha ao persistir Customer não abre checkout', async () => {
    mocks.customerId = null; mocks.update.mockResolvedValue({ error: {} })
    expect((await enviar(mensal)).status).toBe(503)
    expect(mocks.checkout).not.toHaveBeenCalled()
  })
  it('perfil removido durante criação de Customer não abre checkout', async () => {
    mocks.customerId = null; mocks.update.mockResolvedValue({ data: null, error: null })
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
  it('reserva durável indisponível não acessa Customer nem cria Checkout', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: {} })
    expect((await enviar(mensal)).status).toBe(503)
    expect(mocks.retrieve).not.toHaveBeenCalled()
    expect(mocks.create).not.toHaveBeenCalled()
    expect(mocks.checkout).not.toHaveBeenCalled()
  })
  it('retry após resposta perdida envia exatamente os mesmos parâmetros e chave', async () => {
    mocks.checkout.mockRejectedValueOnce(new Error('timeout depois de criar'))
    expect((await enviar(mensal)).status).toBe(503)
    expect((await enviar(mensal)).status).toBe(200)
    expect(mocks.checkout.mock.calls[0]).toEqual(mocks.checkout.mock.calls[1])
  })
  it('falha ao registrar a sessão não devolve URL e retry mantém a chave', async () => {
    mocks.update.mockImplementation(async args => ({ data: args.p_session ? false : true, error: null }))
    expect((await enviar(mensal)).status).toBe(503)
    mocks.update.mockResolvedValue({ data: true, error: null })
    expect((await enviar(mensal)).status).toBe(200)
    expect(mocks.checkout.mock.calls[0]).toEqual(mocks.checkout.mock.calls[1])
  })
  it('duas requisições concorrentes usam a mesma tentativa e idempotência', async () => {
    expect((await Promise.all([enviar(mensal), enviar(mensal)])).map(r => r.status)).toEqual([200, 200])
    expect(mocks.checkout.mock.calls[0]).toEqual(mocks.checkout.mock.calls[1])
  })
  it('operação desconhecida com 23h não é recriada depois de expirar a garantia', async () => {
    mocks.tentativa.session_criacao_em = new Date(Date.now() - 23 * 3600_000).toISOString()
    mocks.tentativa.customer_criacao_em = mocks.tentativa.session_criacao_em
    expect((await enviar(mensal)).status).toBe(503)
    expect(mocks.checkout).not.toHaveBeenCalled()
    mocks.customerId = null
    expect((await enviar(mensal)).status).toBe(503)
    expect(mocks.create).not.toHaveBeenCalled()
  })
  it('reserva antiga sem criação externa iniciada pode prosseguir normalmente', async () => {
    mocks.tentativa.criada_em = new Date(Date.now() - 30 * 24 * 3600_000).toISOString()
    expect((await enviar(mensal)).status).toBe(200)
    expect(mocks.rpc).toHaveBeenCalledWith('autorizar_criacao_checkout', expect.objectContaining({ p_etapa: 'session' }))
  })
  it('fase não autorizada não chama criação externa', async () => {
    const original = mocks.rpc.getMockImplementation()!
    mocks.rpc.mockImplementation((name, args) => name === 'autorizar_criacao_checkout' ? { data: null, error: {} } : original(name, args))
    expect((await enviar(mensal)).status).toBe(503)
    expect(mocks.checkout).not.toHaveBeenCalled()
    mocks.customerId = null
    expect((await enviar(mensal)).status).toBe(503)
    expect(mocks.create).not.toHaveBeenCalled()
  })
  it('troca de escolha antes de autorizar sessão não cria a escolha antiga', async () => {
    mocks.tentativa.plano = 'simples'; mocks.tentativa.preco_id = 'price_simples'
    const original = mocks.rpc.getMockImplementation()!
    mocks.rpc.mockImplementation((name, args) => {
      if (name === 'encerrar_checkout_assinatura') { delete mocks.tentativa.plano; delete mocks.tentativa.preco_id }
      return original(name, args)
    })
    expect((await enviar(mensal)).status).toBe(200)
    expect(mocks.checkout).toHaveBeenCalledTimes(1)
    expect(mocks.checkout.mock.calls[0][0].line_items[0].price).toBe('price_proMensal')
    expect(mocks.expire).not.toHaveBeenCalled()
  })
  it('retoma sessão conhecida com mais de 24h sem create', async () => {
    mocks.tentativa.customer_id = 'cus_antigo'; mocks.tentativa.session_id = 'cs_fixture'
    mocks.tentativa.criada_em = new Date(Date.now() - 25 * 3600_000).toISOString()
    mocks.getSession.mockResolvedValue(await mocks.checkout({ mode: 'subscription', customer: 'cus_antigo', client_reference_id: mocks.tentativa.id }))
    mocks.checkout.mockClear()
    expect((await enviar(mensal)).status).toBe(200)
    expect(mocks.checkout).not.toHaveBeenCalled()
  })
  it.each([{ has_more: true, data: [] }, { has_more: false, data: [{ mode: 'subscription', client_reference_id: null, status: 'open' }] }, { has_more: false, data: [{ mode: 'subscription', client_reference_id: null, status: 'complete', subscription: 'sub_just_completed' }] }])('sessões legadas/paginação desconhecida impedem nova assinatura: %j', async abertas => {
    mocks.sessions.mockResolvedValue(abertas)
    const response = await enviar(mensal)
    expect(response.status).toBe(409)
    expect((await response.json()).portal).toBe(false)
    expect(mocks.checkout).not.toHaveBeenCalled()
  })
  it.each([{ customer: 'cus_outro' }, { client_reference_id: 'outra-tentativa' }, { livemode: true }, { mode: 'payment' }])('recusa sessão incompatível %j', async delta => {
    const session = await mocks.checkout({ mode: 'subscription', customer: 'cus_antigo', client_reference_id: mocks.tentativa.id })
    mocks.checkout.mockResolvedValue({ ...session, ...delta })
    expect((await enviar(mensal)).status).toBe(503)
  })
  it('troca de escolha só apos confirmação de expiração da anterior', async () => {
    mocks.tentativa.plano = 'simples'; mocks.tentativa.preco_id = 'price_simples'
    mocks.tentativa.session_criacao_em = new Date().toISOString()
    mocks.expire.mockImplementation(async () => {
      const session = await mocks.checkout({ mode: 'subscription', customer: 'cus_antigo', client_reference_id: mocks.tentativa.id })
      delete mocks.tentativa.plano; delete mocks.tentativa.preco_id
      return { ...session, status: 'expired' }
    })
    expect((await enviar(mensal)).status).toBe(200)
    expect(mocks.expire).toHaveBeenCalledExactlyOnceWith('cs_fixture', {}, expect.objectContaining({ idempotencyKey: expect.stringMatching(/^fss-expire-v1-/) }))
    expect(mocks.rpc).toHaveBeenCalledWith('encerrar_checkout_assinatura', expect.objectContaining({ p_session: 'cs_fixture' }))
  })
  it('timeout ao expirar não aposenta a tentativa nem cria sessão para a nova escolha', async () => {
    mocks.tentativa.plano = 'simples'; mocks.tentativa.preco_id = 'price_simples'
    mocks.tentativa.session_criacao_em = new Date().toISOString()
    mocks.expire.mockRejectedValue(new Error('resultado desconhecido'))
    expect((await enviar(mensal)).status).toBe(503)
    expect(mocks.rpc.mock.calls.some(c => c[0] === 'encerrar_checkout_assinatura')).toBe(false)
    expect(mocks.checkout).toHaveBeenCalledTimes(1)
    expect(mocks.checkout.mock.calls[0][0].line_items[0].price).toBe('price_simples')
  })
  it('conclusão entre a listagem e a recuperação da sessão exige portal', async () => {
    const session = await mocks.checkout({ mode: 'subscription', customer: 'cus_antigo', client_reference_id: mocks.tentativa.id })
    mocks.checkout.mockResolvedValue({ ...session, status: 'complete', subscription: 'sub_completed' })
    mocks.getSubscription.mockResolvedValue({ customer: 'cus_antigo', status: 'active', livemode: false })
    const response = await enviar(mensal)
    expect(response.status).toBe(409)
    expect((await response.json()).portal).toBe(true)
    expect(mocks.rpc.mock.calls.some(c => c[0] === 'encerrar_checkout_assinatura')).toBe(false)
  })
  it('encerramento não confirmado não inicia outra tentativa', async () => {
    const session = await mocks.checkout({ mode: 'subscription', customer: 'cus_antigo', client_reference_id: mocks.tentativa.id })
    mocks.checkout.mockResolvedValue({ ...session, status: 'expired' })
    const original = mocks.rpc.getMockImplementation()!
    mocks.rpc.mockImplementation((name, args) => name === 'encerrar_checkout_assinatura' ? { data: false, error: null } : original(name, args))
    expect((await enviar(mensal)).status).toBe(503)
    expect(mocks.rpc.mock.calls.filter(c => c[0] === 'reservar_checkout_assinatura')).toHaveLength(1)
  })
})
