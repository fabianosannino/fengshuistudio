/**
 * Stripe Subscription Checkout API
 *
 * POST /api/stripe/subscribe — Create a subscription checkout session
 *   Body: { account_id }
 *
 * This creates a Checkout Session in 'subscription' mode that charges
 * the connected account directly for their platform subscription.
 *
 * With V2 accounts, we use `customer_account` (the connected account ID)
 * instead of a separate customer ID. The connected account IS the customer.
 *
 * SETUP INSTRUCTIONS:
 * 1. Create a Product in your Stripe Dashboard for the platform subscription
 * 2. Create a recurring Price for that product
 * 3. Add the Price ID to .env.local as STRIPE_PRICE_ID
 *    Example: STRIPE_PRICE_ID=price_1234567890
 */

import { NextResponse } from 'next/server'
import stripeClient from '../../../../src/lib/stripe'
import { createRouteHandlerClient } from '../../../../src/lib/supabase-route'
import { logger } from '../../../../src/lib/logger'

export async function POST(request: Request) {
  const supabase = await createRouteHandlerClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  let body: { account_id?: string }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Body inválido' }, { status: 400 }) }

  // ── Get the connected account ID ───────────────────────────────────────
  let accountId = body.account_id
  if (!accountId) {
    const { data: profile } = await supabase.from('profiles').select('stripe_account_id').eq('id', user.id).single()
    accountId = profile?.stripe_account_id
  }

  if (!accountId) {
    return NextResponse.json({ error: 'Nenhuma conta Stripe vinculada' }, { status: 400 })
  }

  // ── Validate that STRIPE_PRICE_ID is configured ────────────────────────
  // This is the recurring price for the platform subscription.
  // Create it in your Stripe Dashboard under Products.
  const priceId = process.env.STRIPE_PRICE_ID
  if (!priceId) {
    return NextResponse.json({
      error: 'STRIPE_PRICE_ID não configurado. Crie um preço recorrente no Stripe Dashboard e adicione ao .env.local.',
    }, { status: 500 })
  }

  const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  try {
    // ── Create a subscription Checkout Session ───────────────────────────
    // customer_account: the connected account ID (acct_...)
    //   With V2 accounts, we use the account ID directly as the customer.
    //   This means the connected account will be charged for the subscription.
    // mode: 'subscription' creates a recurring payment
    // line_items: the subscription price and quantity
    // success_url: redirect after successful subscription
    // cancel_url: redirect if the user cancels
    const session = await stripeClient.checkout.sessions.create({
      customer_account: accountId,
      mode: 'subscription',
      line_items: [
        { price: priceId, quantity: 1 },
      ],
      success_url: `${origin}/stripe/success?session_id={CHECKOUT_SESSION_ID}&type=subscription`,
      cancel_url: `${origin}/planos`,
    })

    return NextResponse.json({ url: session.url, session_id: session.id })
  } catch (err) {
    logger.error('Stripe subscription checkout error', { route: '/api/stripe/subscribe', error: String(err) })
    return NextResponse.json({ error: `Erro ao criar checkout de assinatura: ${String(err)}` }, { status: 500 })
  }
}
