/**
 * Stripe Subscription Checkout API (V1)
 *
 * POST /api/stripe/subscribe — Create a subscription checkout session
 *
 * Creates a Checkout Session in 'subscription' mode on the platform account.
 * The user is charged as a Stripe Customer (not a connected account).
 */

import { NextResponse } from 'next/server'
import stripeClient from '../../../../src/lib/stripe'
import { createRouteHandlerClient } from '../../../../src/lib/supabase-route'
import { logger } from '../../../../src/lib/logger'

export async function POST() {
  const supabase = await createRouteHandlerClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const priceId = process.env.STRIPE_PRICE_ID
  if (!priceId) {
    return NextResponse.json({
      error: 'STRIPE_PRICE_ID não configurado. Crie um preço recorrente no Stripe Dashboard e adicione ao .env.local.',
    }, { status: 500 })
  }

  // Get or create a Stripe Customer for this user
  const { data: profile } = await supabase
    .from('profiles')
    .select('stripe_customer_id, stripe_account_id')
    .eq('id', user.id)
    .single()

  let customerId = profile?.stripe_customer_id

  if (!customerId) {
    try {
      const customer = await stripeClient.customers.create({
        email: user.email,
        name: user.user_metadata?.nome_completo || undefined,
        metadata: { supabase_user_id: user.id },
      })
      customerId = customer.id

      // Store the customer ID for future use
      await supabase
        .from('profiles')
        .update({ stripe_customer_id: customerId })
        .eq('id', user.id)
    } catch (err) {
      logger.error('Failed to create Stripe customer', { route: '/api/stripe/subscribe', error: String(err) })
      return NextResponse.json({ error: 'Erro ao criar cliente Stripe' }, { status: 500 })
    }
  }

  const origin = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  try {
    const session = await stripeClient.checkout.sessions.create({
      customer: customerId,
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
