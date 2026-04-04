/**
 * Stripe Account Link API — Onboarding
 *
 * POST /api/stripe/account-link — Create an account link for onboarding
 *   Body: { account_id: string }
 *   Returns a URL where the user can complete their Stripe onboarding.
 *
 * Account Links are the mechanism for Stripe Connect onboarding.
 * They redirect the user to Stripe's hosted onboarding flow where they
 * provide identity verification, bank account info, and business details.
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

  // ── Get the account ID from the request or the user's profile ──────────
  let accountId = body.account_id
  if (!accountId) {
    const { data: profile } = await supabase.from('profiles').select('stripe_account_id').eq('id', user.id).single()
    accountId = profile?.stripe_account_id
  }

  if (!accountId) {
    return NextResponse.json({ error: 'Nenhuma conta Stripe encontrada. Crie uma conta primeiro.' }, { status: 400 })
  }

  // ── Determine the base URL for redirect URLs ──────────────────────────
  // In production, this should be your actual domain.
  // In development, it will be localhost.
  const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  try {
    // ── Create a V2 Account Link for onboarding ─────────────────────────
    // use_case.type: 'account_onboarding' starts the full onboarding flow
    // configurations: ['merchant', 'customer'] enables both selling and buying
    // refresh_url: where to redirect if the link expires (user needs a new one)
    // return_url: where to redirect after completing onboarding
    //   We include the accountId so we can retrieve the status on return
    const accountLink = await stripeClient.v2.core.accountLinks.create({
      account: accountId,
      use_case: {
        type: 'account_onboarding',
        account_onboarding: {
          configurations: ['merchant', 'customer'],
          refresh_url: `${origin}/stripe/onboard?refresh=true`,
          return_url: `${origin}/stripe/onboard?accountId=${accountId}`,
        },
      },
    })

    return NextResponse.json({ url: accountLink.url })
  } catch (err) {
    logger.error('Stripe account link error', { route: '/api/stripe/account-link', error: String(err) })
    return NextResponse.json({ error: `Erro ao criar link de onboarding: ${String(err)}` }, { status: 500 })
  }
}
