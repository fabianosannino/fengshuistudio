/**
 * Stripe Subscription Checkout API (V1)
 *
 * POST /api/stripe/subscribe — Create a subscription checkout session
 *
 * Body: { plan_slug?: string, billing_cycle?: 'monthly' | 'yearly' }
 *
 * Creates a Checkout Session in 'subscription' mode on the platform account.
 * Supports both monthly and yearly billing cycles with different Stripe prices.
 *
 * Price resolution order:
 * 1. Environment variables: STRIPE_PRICE_SIMPLES_MONTHLY, STRIPE_PRICE_SIMPLES_YEARLY,
 *    STRIPE_PRICE_PRO_MONTHLY, STRIPE_PRICE_PRO_YEARLY
 * 2. Fallback to STRIPE_PRICE_ID (legacy single price)
 */

import { NextResponse } from 'next/server'
import stripeClient from '../../../../src/lib/stripe'
import { createRouteHandlerClient } from '../../../../src/lib/supabase-route'
import { createSupabaseAdminClient } from '../../../../src/lib/supabase-admin'
import { logger } from '../../../../src/lib/logger'
import { rateLimit, ipDaRequisicao } from '../../../../src/lib/rate-limit'
import { origemDaAplicacao } from '../../../../src/lib/auth-rotas'

// Map of plan + cycle to Stripe Price IDs
function getStripePriceId(planSlug: string, cycle: string): string | null {
  const key = `${planSlug}_${cycle}`.toUpperCase()
  const priceMap: Record<string, string | undefined> = {
    'SIMPLES_MONTHLY': process.env.STRIPE_PRICE_SIMPLES_MONTHLY,
    'SIMPLES_YEARLY': process.env.STRIPE_PRICE_SIMPLES_YEARLY,
    'PROFISSIONAL_MONTHLY': process.env.STRIPE_PRICE_PRO_MONTHLY,
    'PROFISSIONAL_YEARLY': process.env.STRIPE_PRICE_PRO_YEARLY,
  }
  return priceMap[key] || process.env.STRIPE_PRICE_ID || null
}

export async function POST(request: Request) {
  const ip = ipDaRequisicao(request)
  const { success: rateLimitOk } = await rateLimit(ip, { limit: 10, windowMs: 60_000 })
  if (!rateLimitOk) {
    return NextResponse.json(
      { error: 'Muitas requisições. Tente novamente em alguns instantes.' },
      { status: 429, headers: { 'Retry-After': '60' } }
    )
  }

  const supabase = await createRouteHandlerClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  // Parse body
  let planSlug = 'profissional'
  let billingCycle = 'monthly'
  try {
    const body = await request.json()
    if (body.plan_slug && ['simples', 'profissional'].includes(body.plan_slug)) {
      planSlug = body.plan_slug
    }
    if (body.billing_cycle === 'yearly') {
      billingCycle = 'yearly'
    }
  } catch {
    // Use defaults
  }

  const priceId = getStripePriceId(planSlug, billingCycle)
  if (!priceId) {
    return NextResponse.json({
      error: 'Preço do Stripe não configurado para este plano/ciclo. Configure as variáveis STRIPE_PRICE_* no ambiente.',
    }, { status: 500 })
  }

  // Get or create a Stripe Customer for this user
  const { data: profile } = await supabase
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', user.id)
    .single()

  let customerId = profile?.stripe_customer_id

  // Um `customer` pertence ao modo em que foi criado. Trocar a chave de teste
  // para a de produção deixa o ID gravado apontando para o catálogo errado, e
  // o Stripe recusa o checkout com «No such customer: … a similar object
  // exists in test mode». O ID não diz o modo, então a única forma de saber é
  // perguntar — e a resposta vale para todo usuário que existia antes da troca.
  if (customerId) {
    try {
      const existente = await stripeClient.customers.retrieve(customerId)
      if ('deleted' in existente && existente.deleted) customerId = null
    } catch {
      logger.warn('Stripe customer não existe neste modo — será recriado', {
        route: '/api/stripe/subscribe',
        customerId,
      })
      customerId = null
    }
  }

  if (!customerId) {
    try {
      const customer = await stripeClient.customers.create({
        email: user.email,
        name: user.user_metadata?.nome_completo || undefined,
        metadata: { supabase_user_id: user.id },
      })
      customerId = customer.id

      // service_role: stripe_customer_id é coluna privilegiada (trigger).
      // Se não persistir, o webhook nunca vai casar o customer com o perfil —
      // então a falha aqui é fatal, não silenciosa.
      const { error: updateError } = await createSupabaseAdminClient()
        .from('profiles')
        .update({ stripe_customer_id: customerId })
        .eq('id', user.id)

      if (updateError) {
        logger.error('Failed to store Stripe customer ID', {
          route: '/api/stripe/subscribe',
          customerId,
          error: updateError.message,
        })
        return NextResponse.json({ error: 'Erro ao preparar assinatura. Tente novamente.' }, { status: 500 })
      }
    } catch (err) {
      logger.error('Failed to create Stripe customer', { route: '/api/stripe/subscribe', error: String(err) })
      return NextResponse.json({ error: 'Erro ao criar cliente Stripe' }, { status: 500 })
    }
  }

  const origin = origemDaAplicacao(request)

  try {
    const session = await stripeClient.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [
        { price: priceId, quantity: 1 },
      ],
      subscription_data: {
        metadata: {
          plan_slug: planSlug,
          billing_cycle: billingCycle,
          supabase_user_id: user.id,
        },
      },
      success_url: `${origin}/stripe/success?session_id={CHECKOUT_SESSION_ID}&type=subscription`,
      cancel_url: `${origin}/planos`,
      allow_promotion_codes: true,
    })

    return NextResponse.json({ url: session.url, session_id: session.id })
  } catch (err) {
    logger.error('Stripe subscription checkout error', { route: '/api/stripe/subscribe', error: String(err) })
    return NextResponse.json({ error: 'Erro ao criar checkout de assinatura.' }, { status: 500 })
  }
}
