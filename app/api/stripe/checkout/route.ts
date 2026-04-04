/**
 * Stripe Checkout API — Direct Charges
 *
 * POST /api/stripe/checkout — Create a checkout session for purchasing a product
 *   Body: { account_id, price_id, product_name, quantity?, success_url?, cancel_url? }
 *
 * This uses Direct Charges with an application fee.
 * In this model:
 * - The payment is created directly on the connected account
 * - The connected account is the merchant of record
 * - The platform collects an application_fee_amount on each transaction
 * - The customer sees the connected account's name on their card statement
 *
 * We use Stripe's hosted Checkout for simplicity — no need to build
 * a custom payment form or handle PCI compliance ourselves.
 */

import { NextResponse } from 'next/server'
import stripeClient from '../../../../src/lib/stripe'
import { logger } from '../../../../src/lib/logger'

// ── Application fee percentage ───────────────────────────────────────────────
// This is the percentage the platform (FengShui Studio) takes from each sale.
// For example, 10% means if a product costs R$100, the platform gets R$10.
// Adjust this value based on your business model.
const APPLICATION_FEE_PERCENT = 10

export async function POST(request: Request) {
  let body: {
    account_id?: string
    price_id?: string
    product_name?: string
    unit_amount?: number
    currency?: string
    quantity?: number
    success_url?: string
    cancel_url?: string
  }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Body inválido' }, { status: 400 }) }

  const accountId = body.account_id
  if (!accountId) {
    return NextResponse.json({ error: 'account_id é obrigatório' }, { status: 400 })
  }

  if (!body.price_id && !body.unit_amount) {
    return NextResponse.json({ error: 'price_id ou unit_amount é obrigatório' }, { status: 400 })
  }

  const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const quantity = body.quantity || 1

  try {
    // ── Calculate the application fee ────────────────────────────────────
    // The application fee is calculated as a percentage of the total.
    // unit_amount is in centavos (smallest currency unit).
    const unitAmount = body.unit_amount || 0
    const applicationFee = Math.round(unitAmount * quantity * APPLICATION_FEE_PERCENT / 100)

    // ── Build line items ─────────────────────────────────────────────────
    // If we have a price_id (from an existing Stripe Price), use it directly.
    // Otherwise, create an inline price using price_data.
    const lineItems: Array<{ price?: string; price_data?: { currency: string; product_data: { name: string }; unit_amount: number }; quantity: number }> = []

    if (body.price_id) {
      lineItems.push({ price: body.price_id, quantity })
    } else {
      lineItems.push({
        price_data: {
          currency: body.currency || 'brl',
          product_data: { name: body.product_name || 'Produto' },
          unit_amount: unitAmount,
        },
        quantity,
      })
    }

    // ── Create a Checkout Session on the connected account ───────────────
    // mode: 'payment' is for one-time payments (not subscriptions)
    // payment_intent_data.application_fee_amount: the fee the platform collects
    // success_url: where the customer goes after successful payment
    //   {CHECKOUT_SESSION_ID} is a Stripe template variable replaced automatically
    // The stripeAccount option routes this charge through the connected account
    const session = await stripeClient.checkout.sessions.create({
      line_items: lineItems,
      payment_intent_data: {
        // The application fee is collected by the platform on each transaction
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
    return NextResponse.json({ error: `Erro ao criar checkout: ${String(err)}` }, { status: 500 })
  }
}
