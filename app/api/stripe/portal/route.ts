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
import { origemDaAplicacao } from '../../../../src/lib/auth-rotas'
import { ipDaRequisicao, rateLimit } from '../../../../src/lib/rate-limit'

export async function POST(request: Request) {
  const limite = await rateLimit(ipDaRequisicao(request), { limit: 10, windowMs: 60_000, escopo: 'POST:/api/stripe/portal', exigirCompartilhado: true })
  if (limite.indisponivel) return NextResponse.json({ error: 'Proteção temporariamente indisponível.' }, { status: 503, headers: { 'Retry-After': '30' } })
  if (!limite.success) return NextResponse.json({ error: 'Muitas requisições.' }, { status: 429 })
  const supabase = await createRouteHandlerClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { data: profile, error: erroPerfil } = await supabase
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', user.id)
    .single()

  if (erroPerfil || !profile) return NextResponse.json({ error: 'Não foi possível verificar sua conta de cobrança.' }, { status: 503 })

  const customerId = profile?.stripe_customer_id

  if (!customerId) {
    return NextResponse.json({ error: 'Nenhum cliente Stripe vinculado. Assine um plano primeiro.' }, { status: 400 })
  }

  const origin = origemDaAplicacao(request)

  try {
    const session = await stripeClient.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${origin}/planos`,
    })

    return NextResponse.json({ url: session.url })
  } catch {
    logger.error('Stripe portal error', { route: '/api/stripe/portal' })
    return NextResponse.json({ error: 'Erro ao abrir portal de cobrança.' }, { status: 500 })
  }
}
