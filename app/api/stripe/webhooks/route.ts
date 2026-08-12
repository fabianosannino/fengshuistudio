/**
 * Stripe Connect Webhook Handler (V1)
 *
 * POST /api/stripe/webhooks — Receives standard events for connected accounts
 *
 * EVENTS HANDLED:
 * - account.updated → Account requirements or capabilities changed
 *
 * SETUP:
 * 1. Stripe Dashboard > Developers > Webhooks > + Add endpoint
 * 2. URL: https://yourdomain.com/api/stripe/webhooks
 * 3. Listen to: "Events on Connected accounts"
 * 4. Select: account.updated
 * 5. Copy signing secret to STRIPE_WEBHOOK_SECRET env var
 */

import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import stripeClient from '../../../../src/lib/stripe'
import { logger } from '../../../../src/lib/logger'
import { createSupabaseAdminClient } from '../../../../src/lib/supabase-admin'
import {
  reivindicarEvento, marcarProcessado, marcarFalha, objetoDoEvento,
} from '../../../../src/lib/eventos-stripe'

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

const ROUTE = '/api/stripe/webhooks'

export async function POST(request: Request) {
  const body = await request.text()
  const sig = request.headers.get('stripe-signature')

  if (!sig || !webhookSecret) {
    return NextResponse.json({ error: 'Missing signature or webhook secret' }, { status: 400 })
  }

  let event: Stripe.Event

  try {
    event = stripeClient.webhooks.constructEvent(body, sig, webhookSecret)
  } catch (err) {
    logger.error('Webhook signature verification failed', { route: '/api/stripe/webhooks', error: String(err) })
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const supabase = createSupabaseAdminClient()

  // Mesma garantia do webhook de assinaturas: um evento processado uma vez só.
  // Aqui não há checagem de ordem — `account.updated` descreve o estado atual
  // da conta, e reaplicar um estado antigo seria corrigido pela próxima
  // entrega. Quando este endpoint passar a tratar pedidos da loja, a ordem
  // volta a importar.
  const reivindicacao = await reivindicarEvento(supabase, {
    id: event.id,
    type: event.type,
    created: event.created,
    endpoint: ROUTE,
    objetoId: objetoDoEvento(event),
  })

  if (reivindicacao.situacao === 'repetido') {
    logger.info('Evento repetido — descartado', { route: ROUTE, eventId: event.id, tipo: event.type })
    return NextResponse.json({ received: true, repetido: true })
  }

  try {
    switch (event.type) {
      case 'account.updated': {
        const account = event.data.object as Stripe.Account
        const cardPayments = account.capabilities?.card_payments
        const currentlyDue = account.requirements?.currently_due || []

        logger.info('Connected account updated', {
          route: '/api/stripe/webhooks',
          accountId: account.id,
          cardPayments,
          currentlyDueCount: currentlyDue.length,
        })
        break
      }

      default:
        logger.info('Unhandled event type', { route: '/api/stripe/webhooks', type: event.type })
    }

    await marcarProcessado(supabase, event.id, ROUTE)
    return NextResponse.json({ received: true })
  } catch (err) {
    await marcarFalha(supabase, event.id, ROUTE, String(err))
    logger.error('Stripe webhook error', { route: ROUTE, error: String(err) })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
