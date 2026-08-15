/**
 * Stripe Connected Account API (V1)
 *
 * POST /api/stripe/account — Create a new Stripe Connected Account
 * GET  /api/stripe/account — Retrieve the current user's connected account status
 */

import { NextResponse } from 'next/server'
import stripeClient from '../../../../src/lib/stripe'
import { createRouteHandlerClient } from '../../../../src/lib/supabase-route'
import { createSupabaseAdminClient } from '../../../../src/lib/supabase-admin'
import { logger } from '../../../../src/lib/logger'

export async function POST(request: Request) {
  const supabase = await createRouteHandlerClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  let body: { display_name?: string; email?: string }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Body inválido' }, { status: 400 }) }

  const displayName = body.display_name || user.user_metadata?.nome_completo || 'FengShui Consultant'
  const email = body.email || user.email || ''

  try {
    // Create a V1 Express Connected Account
    const account = await stripeClient.accounts.create({
      type: 'express',
      country: 'BR',
      email: email,
      business_type: 'individual',
      /*
       * Capacidade não pedida é capacidade que nunca fica ativa.
       *
       * `pix_payments` faltava aqui, e a consequência era silenciosa: o
       * checkout consulta a capacidade antes de oferecer Pix
       * (`metodosDaConta`), sempre encontrava «ausente» e caía para cartão.
       * Nenhuma conta conectada podia receber por Pix — não por decisão do
       * consultor, mas porque nós nunca perguntamos.
       *
       * Pedir aqui é o passo anterior a qualquer coisa que se faça no painel:
       * é o pedido que faz o Stripe incluir as exigências do Pix no
       * onboarding do consultor.
       */
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
        pix_payments: { requested: true },
      },
      business_profile: {
        name: displayName,
        mcc: '7299', // Miscellaneous personal services
      },
    })

    // Store the Stripe account ID in the user's profile.
    // Usa service_role: stripe_account_id é coluna privilegiada protegida
    // por trigger contra escrita direta do usuário.
    const admin = createSupabaseAdminClient()
    const { error: updateError } = await admin
      .from('profiles')
      .update({ stripe_account_id: account.id })
      .eq('id', user.id)

    if (updateError) {
      logger.error('Failed to store Stripe account ID', {
        route: '/api/stripe/account',
        accountId: account.id,
        error: updateError.message,
      })
      return NextResponse.json(
        { error: 'Erro ao vincular a conta Stripe ao seu perfil. Tente novamente.' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      account_id: account.id,
      display_name: displayName,
      message: 'Conta Stripe criada com sucesso. Complete o onboarding para ativar.',
    })
  } catch (err) {
    logger.error('Stripe account creation error', { route: '/api/stripe/account', error: String(err) })
    return NextResponse.json({ error: 'Erro ao criar conta Stripe.' }, { status: 500 })
  }
}

export async function GET(request: Request) {
  const supabase = await createRouteHandlerClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('stripe_account_id').eq('id', user.id).single()
  const stripeAccountId = profile?.stripe_account_id

  const url = new URL(request.url)
  const accountIdParam = url.searchParams.get('accountId')
  const accountId = stripeAccountId || accountIdParam

  if (!accountId) {
    return NextResponse.json({ has_account: false, message: 'Nenhuma conta Stripe vinculada' })
  }

  try {
    // Retrieve the V1 account
    const account = await stripeClient.accounts.retrieve(accountId)

    const readyToProcessPayments = account.capabilities?.card_payments === 'active'

    // Check if onboarding is complete
    const currentlyDue = account.requirements?.currently_due || []
    const pastDue = account.requirements?.past_due || []
    const onboardingComplete = currentlyDue.length === 0 && pastDue.length === 0

    const requirementsStatus = pastDue.length > 0
      ? 'past_due'
      : currentlyDue.length > 0
        ? 'currently_due'
        : 'none'

    return NextResponse.json({
      has_account: true,
      account_id: accountId,
      display_name: account.business_profile?.name || account.email,
      ready_to_process_payments: readyToProcessPayments,
      onboarding_complete: onboardingComplete,
      requirements_status: requirementsStatus,
      capabilities: {
        card_payments: account.capabilities?.card_payments || 'inactive',
        // Sai daqui para a tela poder dizer **por que** o Pix não aparece no
        // checkout. Sem isto, «só cartão» era um fato sem explicação.
        pix_payments: account.capabilities?.pix_payments || 'inactive',
      },
    })
  } catch (err) {
    logger.error('Stripe account retrieval error', { route: '/api/stripe/account', error: String(err) })
    return NextResponse.json({ error: 'Erro ao consultar conta Stripe.' }, { status: 500 })
  }
}
