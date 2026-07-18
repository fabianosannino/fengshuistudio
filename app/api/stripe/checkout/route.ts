/**
 * Stripe Checkout API — Direct Charges
 *
 * POST /api/stripe/checkout — Create a checkout session for purchasing a product
 *   Body: { account_id, price_id, quantity?, success_url?, cancel_url? }
 *
 * Rota pública (compradores da loja não são usuários da plataforma).
 * O preço NUNCA vem do cliente: apenas um price_id existente na conta
 * conectada é aceito, e o valor é lido do Stripe no servidor.
 *
 * This uses Direct Charges with an application fee:
 * - The payment is created directly on the connected account
 * - The connected account is the merchant of record
 * - The platform collects an application_fee_amount on each transaction
 */

import { NextResponse } from 'next/server'
import stripeClient from '../../../../src/lib/stripe'
import { logger } from '../../../../src/lib/logger'
import { rateLimit } from '../../../../src/lib/rate-limit'

// Percentual que a plataforma retém em cada venda (direct charge).
const APPLICATION_FEE_PERCENT = 10
const MAX_QUANTITY = 100

export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const { success } = rateLimit(ip, { limit: 15, windowMs: 60_000 })
  if (!success) {
    return NextResponse.json(
      { error: 'Muitas requisições. Tente novamente em alguns instantes.' },
      { status: 429, headers: { 'Retry-After': '60' } }
    )
  }

  let body: {
    account_id?: string
    price_id?: string
    quantity?: number
    success_url?: string
    cancel_url?: string
  }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Body inválido' }, { status: 400 }) }

  const accountId = body.account_id
  if (!accountId || !accountId.startsWith('acct_')) {
    return NextResponse.json({ error: 'account_id é obrigatório' }, { status: 400 })
  }

  const priceId = body.price_id
  if (!priceId || !priceId.startsWith('price_')) {
    return NextResponse.json({ error: 'price_id é obrigatório' }, { status: 400 })
  }

  const quantity = Number.isInteger(body.quantity) && body.quantity! > 0 && body.quantity! <= MAX_QUANTITY
    ? body.quantity!
    : 1

  const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  try {
    // O preço é lido da conta conectada — buscar o price_id lá garante,
    // ao mesmo tempo, que ele pertence àquela conta e qual é o valor real.
    const price = await stripeClient.prices.retrieve(priceId, {}, { stripeAccount: accountId })

    if (!price.active || price.unit_amount == null) {
      return NextResponse.json({ error: 'Produto indisponível para compra.' }, { status: 400 })
    }

    const applicationFee = Math.round(price.unit_amount * quantity * APPLICATION_FEE_PERCENT / 100)

    const session = await stripeClient.checkout.sessions.create({
      line_items: [{ price: priceId, quantity }],
      payment_intent_data: {
        application_fee_amount: applicationFee,
      },
      mode: 'payment',
      success_url: body.success_url || `${origin}/stripe/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: body.cancel_url || `${origin}/store/${accountId}`,
    }, {
      stripeAccount: accountId, // Direct charge on the connected account
    })

    return NextResponse.json({ url: session.url, session_id: session.id })
  } catch (err) {
    logger.error('Stripe checkout error', { route: '/api/stripe/checkout', error: String(err) })
    return NextResponse.json({ error: 'Erro ao criar sessão de pagamento.' }, { status: 500 })
  }
}
