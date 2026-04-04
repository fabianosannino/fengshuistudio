/**
 * Stripe Billing Portal API (V1)
 *
 * POST /api/stripe/portal — Create a billing portal session
 *
 * The Billing Portal lets users view/update subscriptions and payment methods.
 * Uses a standard Stripe Customer (not customer_account).
 */

import { NextResponse } from 'next/server'
import stripeClient from '../../../../src/lib/stripe'
import { createRouteHandlerClient } from '../../../../src/lib/supabase-route'
import { logger } from '../../../../src/lib/logger'

export async function POST() {
  const supabase = await createRouteHandlerClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', user.id)
    .single()

  const customerId = profile?.stripe_customer_id

  if (!customerId) {
    return NextResponse.json({ error: 'Nenhum cliente Stripe vinculado. Assine um plano primeiro.' }, { status: 400 })
  }

  const origin = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  try {
    const session = await stripeClient.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${origin}/stripe/onboard`,
    })

    return NextResponse.json({ url: session.url })
  } catch (err) {
    logger.error('Stripe portal error', { route: '/api/stripe/portal', error: String(err) })
    return NextResponse.json({ error: `Erro ao abrir portal de cobrança: ${String(err)}` }, { status: 500 })
  }
}
