/**
 * Stripe Connect Webhook Handler (V1)
 *
 * POST /api/stripe/webhooks — Receives standard events for connected accounts
 *
 * EVENTS HANDLED:
 * - account.updated            → capacidades/pendências da conta mudaram
 * - checkout.session.completed → a venda da loja foi paga
 * - charge.refunded            → a venda foi reembolsada
 * - charge.dispute.created     → o comprador contestou
 *
 * SETUP:
 * 1. Stripe Dashboard > Developers > Webhooks > + Add endpoint
 * 2. URL: https://yourdomain.com/api/stripe/webhooks
 * 3. Listen to: "Events on Connected accounts"
 * 4. Select os quatro eventos acima
 * 5. Copy signing secret to STRIPE_WEBHOOK_SECRET env var
 *
 * `pago` é escrito **aqui**, e só aqui. Nunca na tela de sucesso: a
 * `success_url` é onde o comprador cai, não onde o dinheiro confirma. Marcar
 * ali significaria que fechar o navegador perde a venda, e que uma URL montada
 * à mão fabrica uma.
 */

import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import stripeClient from '../../../../src/lib/stripe'
import { logger } from '../../../../src/lib/logger'
import { createSupabaseAdminClient } from '../../../../src/lib/supabase-admin'
import {
  reivindicarEvento, marcarProcessado, marcarFalha, objetoDoEvento,
} from '../../../../src/lib/eventos-stripe'
import {
  acharPedidoDaSessao, acharPedidoDoPagamento, confirmarPagamento, registrarEvento,
} from '../../../../src/lib/pedidos-da-loja'

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
  //
  // Continua sem checagem de ordem, e agora por dois motivos diferentes:
  // `account.updated` descreve o estado atual da conta, então reaplicar um
  // estado antigo é corrigido pela entrega seguinte; e os eventos de pedido
  // não sofrem com ordem por construção — o estado sai da precedência entre os
  // fatos, não de quem chegou por último (`src/lib/pedidos-da-loja.ts`).
  // Duplicata é barrada pelo índice de idempotência da própria tabela.
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

      case 'checkout.session.completed': {
        const sessao = event.data.object as Stripe.Checkout.Session

        // Sessão expirada ou ainda não paga não vira venda. `unpaid` chega em
        // fluxos assíncronos (boleto, Pix) e vira `pago` num evento posterior.
        if (sessao.payment_status !== 'paid') {
          logger.info('Sessão concluída sem pagamento confirmado', {
            route: ROUTE, sessionId: sessao.id, status: sessao.payment_status,
          })
          break
        }

        const pedidoId = await acharPedidoDaSessao(supabase, sessao, ROUTE)
        if (!pedidoId) break

        await confirmarPagamento(supabase, {
          pedidoId,
          compradorEmail: sessao.customer_details?.email ?? sessao.customer_email ?? null,
          compradorNome: sessao.customer_details?.name ?? null,
          paymentIntent: typeof sessao.payment_intent === 'string' ? sessao.payment_intent : null,
          totalCentavos: sessao.amount_total ?? null,
          referencia: event.id,
          ocorridoEm: new Date(event.created * 1000).toISOString(),
        }, ROUTE)

        logger.info('Venda da loja registrada', {
          route: ROUTE, pedidoId, contaConectada: event.account ?? null,
        })
        break
      }

      case 'charge.refunded':
      case 'charge.dispute.created': {
        const cobranca = event.data.object as Stripe.Charge | Stripe.Dispute
        const paymentIntent = typeof cobranca.payment_intent === 'string'
          ? cobranca.payment_intent
          : null

        if (!paymentIntent) {
          logger.warn('Evento de cobrança sem payment_intent', { route: ROUTE, tipo: event.type })
          break
        }

        const pedidoId = await acharPedidoDoPagamento(supabase, paymentIntent, ROUTE)
        if (!pedidoId) {
          // Pode ser cobrança de assinatura, que não é pedido da loja. Não é
          // erro — é evento que não pertence a esta tabela.
          logger.info('Cobrança sem pedido da loja correspondente', {
            route: ROUTE, tipo: event.type, paymentIntent,
          })
          break
        }

        await registrarEvento(supabase, {
          pedidoId,
          evento: event.type === 'charge.refunded' ? 'reembolsado' : 'contestado',
          origem: 'webhook_stripe',
          referencia: event.id,
          ocorridoEm: new Date(event.created * 1000).toISOString(),
        }, ROUTE)
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
