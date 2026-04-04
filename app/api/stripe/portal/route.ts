/**
 * Stripe Billing Portal API
 *
 * POST /api/stripe/portal — Create a billing portal session
 *   Body: { account_id? }
 *
 * The Billing Portal is a Stripe-hosted page where users can:
 * - View their subscription details
 * - Update their payment method
 * - Cancel or change their subscription
 * - View invoice history
 *
 * With V2 accounts, we use `customer_account` (the connected account ID)
 * instead of a separate `customer` ID.
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
  try { body = await request.json() } catch { body = {} }

  // ── Get the connected account ID ───────────────────────────────────────
  let accountId = body.account_id
  if (!accountId) {
    const { data: profile } = await supabase.from('profiles').select('stripe_account_id').eq('id', user.id).single()
    accountId = profile?.stripe_account_id
  }

  if (!accountId) {
    return NextResponse.json({ error: 'Nenhuma conta Stripe vinculada' }, { status: 400 })
  }

  const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  try {
    // ── Create a Billing Portal session ──────────────────────────────────
    // customer_account: the connected account (V2 accounts use this instead of customer)
    // return_url: where to redirect when the user is done managing their subscription
    const session = await stripeClient.billingPortal.sessions.create({
      customer_account: accountId,
      return_url: `${origin}/stripe/onboard`,
    })

    return NextResponse.json({ url: session.url })
  } catch (err) {
    logger.error('Stripe portal error', { route: '/api/stripe/portal', error: String(err) })
    return NextResponse.json({ error: `Erro ao abrir portal de cobrança: ${String(err)}` }, { status: 500 })
  }
}
