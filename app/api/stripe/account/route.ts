/**
 * Stripe Connected Account API
 *
 * POST /api/stripe/account — Create a new Stripe Connected Account (V2 API)
 *   Body: { display_name: string, email: string }
 *   Creates an account and stores the mapping in the user's profile.
 *
 * GET /api/stripe/account — Retrieve the current user's connected account status
 *   Returns account details including onboarding status and capabilities.
 */

import { NextResponse } from 'next/server'
import stripeClient from '../../../../src/lib/stripe'
import { createRouteHandlerClient } from '../../../../src/lib/supabase-route'
import { logger } from '../../../../src/lib/logger'

export async function POST(request: Request) {
  const supabase = await createRouteHandlerClient()

  // ── Authenticate the user ──────────────────────────────────────────────────
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  let body: { display_name?: string; email?: string }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Body inválido' }, { status: 400 }) }

  const displayName = body.display_name || user.user_metadata?.nome_completo || 'FengShui Consultant'
  const email = body.email || user.email || ''

  try {
    // ── Create a V2 Connected Account ──────────────────────────────────────
    // Uses the V2 API with specific properties:
    // - dashboard: 'full' gives the connected account access to their own Stripe Dashboard
    // - fees_collector & losses_collector: 'stripe' means Stripe handles fees and losses
    // - card_payments capability: allows the account to accept card payments
    // - identity.country: 'us' sets the account's country (change as needed)
    // NOTE: Do NOT pass `type` at the top level. V2 accounts don't use type: 'express' etc.
    const account = await stripeClient.v2.core.accounts.create({
      display_name: displayName,
      contact_email: email,
      identity: {
        country: 'us', // TODO: Change to 'br' for Brazil when available
      },
      dashboard: 'full',
      defaults: {
        responsibilities: {
          fees_collector: 'stripe',
          losses_collector: 'stripe',
        },
      },
      configuration: {
        customer: {},
        merchant: {
          capabilities: {
            card_payments: {
              requested: true,
            },
          },
        },
      },
    })

    // ── Store the Stripe account ID in the user's profile ────────────────
    // This creates a mapping between our user and their Stripe Connected Account
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ stripe_account_id: account.id })
      .eq('id', user.id)

    if (updateError) {
      logger.error('Failed to store Stripe account ID', { route: '/api/stripe/account', error: updateError.message })
    }

    return NextResponse.json({
      account_id: account.id,
      display_name: displayName,
      message: 'Conta Stripe criada com sucesso. Complete o onboarding para ativar.',
    })
  } catch (err) {
    logger.error('Stripe account creation error', { route: '/api/stripe/account', error: String(err) })
    return NextResponse.json({ error: `Erro ao criar conta Stripe: ${String(err)}` }, { status: 500 })
  }
}

export async function GET(request: Request) {
  const supabase = await createRouteHandlerClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  // ── Get the user's Stripe account ID from the database ─────────────────
  const { data: profile } = await supabase.from('profiles').select('stripe_account_id').eq('id', user.id).single()
  const stripeAccountId = profile?.stripe_account_id

  // Check URL param as fallback (for return URL from onboarding)
  const url = new URL(request.url)
  const accountIdParam = url.searchParams.get('accountId')
  const accountId = stripeAccountId || accountIdParam

  if (!accountId) {
    return NextResponse.json({ has_account: false, message: 'Nenhuma conta Stripe vinculada' })
  }

  try {
    // ── Retrieve the V2 account with expanded fields ─────────────────────
    // We include merchant configuration and requirements to check:
    // 1. Whether card_payments capability is active (ready to process payments)
    // 2. Whether onboarding requirements are complete
    const account = await stripeClient.v2.core.accounts.retrieve(accountId, {
      include: ['configuration.merchant', 'requirements'],
    })

    // ── Check if the account is ready to accept payments ─────────────────
    // card_payments status must be 'active' for the account to process charges
    const readyToProcessPayments = account?.configuration
      ?.merchant?.capabilities?.card_payments?.status === 'active'

    // ── Check onboarding completion status ────────────────────────────────
    // Requirements summary tells us if there are outstanding items:
    // - 'currently_due': items that must be collected now
    // - 'past_due': items that are overdue
    // - If neither, onboarding is complete
    const requirementsStatus = account.requirements?.summary?.minimum_deadline?.status
    const onboardingComplete = requirementsStatus !== 'currently_due' && requirementsStatus !== 'past_due'

    return NextResponse.json({
      has_account: true,
      account_id: accountId,
      display_name: account.display_name,
      ready_to_process_payments: readyToProcessPayments,
      onboarding_complete: onboardingComplete,
      requirements_status: requirementsStatus || 'none',
      capabilities: {
        card_payments: account?.configuration?.merchant?.capabilities?.card_payments?.status || 'inactive',
      },
    })
  } catch (err) {
    logger.error('Stripe account retrieval error', { route: '/api/stripe/account', error: String(err) })
    return NextResponse.json({ error: `Erro ao consultar conta Stripe: ${String(err)}` }, { status: 500 })
  }
}
