// @vitest-environment node
/**
 * Testes da rota /api/stripe/checkout (Direct Charges).
 *
 * Invariantes de segurança cobertos:
 *  - o preço NUNCA vem do cliente: é lido da conta conectada via price_id;
 *  - price inativo não é vendável;
 *  - taxa da plataforma = 10% do valor real lido no servidor;
 *  - erros do Stripe não vazam detalhes ao cliente (mensagem genérica).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const pricesRetrieve = vi.fn()
const sessionsCreate = vi.fn()
vi.mock('../../src/lib/stripe', () => ({
  default: {
    prices: { retrieve: (...a: unknown[]) => pricesRetrieve(...a) },
    checkout: { sessions: { create: (...a: unknown[]) => sessionsCreate(...a) } },
  },
}))

const rateLimitMock = vi.fn((): { success: boolean } => ({ success: true }))
vi.mock('../../src/lib/rate-limit', () => ({
  rateLimit: (...a: unknown[]) => rateLimitMock(...(a as [])),
}))

import { POST } from '../../app/api/stripe/checkout/route'

function req(body: unknown): Request {
  return new Request('http://test.local/api/stripe/checkout', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'http://test.local' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

const validBody = { account_id: 'acct_123', price_id: 'price_abc' }

beforeEach(() => {
  vi.clearAllMocks()
  rateLimitMock.mockReturnValue({ success: true })
  pricesRetrieve.mockResolvedValue({ active: true, unit_amount: 5000 })
  sessionsCreate.mockResolvedValue({ url: 'https://checkout.stripe.test/s', id: 'cs_1' })
})

describe('POST /api/stripe/checkout', () => {
  it('devolve 429 quando o rate limit estoura', async () => {
    rateLimitMock.mockReturnValue({ success: false })
    const res = await POST(req(validBody))
    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).toBe('60')
  })

  it('devolve 400 para body não-JSON', async () => {
    const res = await POST(req('não é json'))
    expect(res.status).toBe(400)
  })

  it('devolve 400 sem account_id válido (prefixo acct_)', async () => {
    const res = await POST(req({ ...validBody, account_id: 'user-controlado' }))
    expect(res.status).toBe(400)
    expect(pricesRetrieve).not.toHaveBeenCalled()
  })

  it('devolve 400 sem price_id válido (prefixo price_)', async () => {
    const res = await POST(req({ ...validBody, price_id: '123' }))
    expect(res.status).toBe(400)
    expect(pricesRetrieve).not.toHaveBeenCalled()
  })

  it('lê o preço DA CONTA CONECTADA (nunca aceita valor do cliente)', async () => {
    await POST(req({ ...validBody, unit_amount: 1 }))
    expect(pricesRetrieve).toHaveBeenCalledWith('price_abc', {}, { stripeAccount: 'acct_123' })
  })

  it('recusa price inativo com 400', async () => {
    pricesRetrieve.mockResolvedValue({ active: false, unit_amount: 5000 })
    const res = await POST(req(validBody))
    expect(res.status).toBe(400)
    expect(sessionsCreate).not.toHaveBeenCalled()
  })

  it('cria a sessão com taxa de 10% sobre o valor real e devolve a URL', async () => {
    const res = await POST(req({ ...validBody, quantity: 2 }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.url).toBe('https://checkout.stripe.test/s')

    const [params, opts] = sessionsCreate.mock.calls[0]
    // 5000 * 2 * 10% = 1000 centavos
    expect(params.payment_intent_data.application_fee_amount).toBe(1000)
    expect(params.line_items).toEqual([{ price: 'price_abc', quantity: 2 }])
    expect(opts).toEqual({ stripeAccount: 'acct_123' }) // direct charge na conta conectada
  })

  it('normaliza quantity inválida para 1', async () => {
    await POST(req({ ...validBody, quantity: 9999 }))
    const [params] = sessionsCreate.mock.calls[0]
    expect(params.line_items[0].quantity).toBe(1)
  })

  it('erro do Stripe vira 500 com mensagem genérica (sem vazar detalhes)', async () => {
    pricesRetrieve.mockRejectedValue(new Error('chave sk_live_XYZ inválida'))
    const res = await POST(req(validBody))
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(JSON.stringify(json)).not.toContain('sk_live')
  })
})
