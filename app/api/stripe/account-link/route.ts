/**
 * Stripe Account Link API — Onboarding (V1)
 *
 * POST /api/stripe/account-link — Create an account link for onboarding
 *   Returns a URL where the user can complete their Stripe onboarding.
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

  let accountId = body.account_id
  if (!accountId) {
    const { data: profile } = await supabase.from('profiles').select('stripe_account_id').eq('id', user.id).single()
    accountId = profile?.stripe_account_id
  }

  if (!accountId) {
    return NextResponse.json({ error: 'Nenhuma conta Stripe encontrada. Crie uma conta primeiro.' }, { status: 400 })
  }

  const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  try {
    // Create a V1 Account Link for onboarding
    const accountLink = await stripeClient.accountLinks.create({
      account: accountId,
      type: 'account_onboarding',
      refresh_url: `${origin}/stripe/onboard?refresh=true`,
      return_url: `${origin}/stripe/onboard?accountId=${accountId}`,
    })

    return NextResponse.json({ url: accountLink.url })
  } catch (err) {
    logger.error('Stripe account link error', { route: '/api/stripe/account-link', error: String(err) })
    return NextResponse.json({ error: `Erro ao criar link de onboarding: ${String(err)}` }, { status: 500 })
  }
}
