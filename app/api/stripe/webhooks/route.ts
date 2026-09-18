/**
 * Stripe Connect Webhook Handler (V1)
 *
 * POST /api/stripe/webhooks — Receives standard events for connected accounts
 *
 * EVENTS HANDLED:
 * - account.updated                          → capacidades/pendências mudaram
 * - checkout.session.completed               → a venda da loja foi paga
 * - checkout.session.async_payment_succeeded → o Pix caiu (confirma depois)
 * - checkout.session.async_payment_failed    → o Pix expirou sem pagamento
 * - charge.refunded                          → a venda foi reembolsada
 * - charge.dispute.created                   → o comprador contestou
 *
 * SETUP:
 * 1. Stripe Dashboard > Developers > Webhooks > + Add endpoint
 * 2. URL: https://yourdomain.com/api/stripe/webhooks
 * 3. Listen to: "Events on Connected accounts"
 * 4. Select os cinco eventos acima
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
  acharPedidoDaSessao, registrarEvento,
} from '../../../../src/lib/pedidos-da-loja'
import { cobrancaDoEventoDeReembolso, processarReembolsoDaLoja, localizarPedidoDoReembolso } from '../../../../src/lib/reembolsos-da-loja'
import { confirmarVendaDaLoja } from '../../../../src/lib/venda-da-loja'
import { origemDaAplicacao } from '../../../../src/lib/auth-rotas'

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

const ROUTE = '/api/stripe/webhooks'
export const maxDuration = 60

export async function POST(request: Request) {
  const body = await request.text()
  const sig = request.headers.get('stripe-signature')

  if (!sig || !webhookSecret) {
    return NextResponse.json({ error: 'Missing signature or webhook secret' }, { status: 400 })
  }

  let event: Stripe.Event

  try {
    event = stripeClient.webhooks.constructEvent(body, sig, webhookSecret)
  } catch {
    logger.error('Webhook signature verification failed', { route: ROUTE })
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const supabase = createSupabaseAdminClient()

  // Active retries wait. Effects retain their own idempotency keys; a claim
  // does not make the full handler one transaction.
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
  if (!('token' in reivindicacao)) {
    return NextResponse.json({ error: 'Processamento indisponível. Aguarde nova tentativa.' }, { status: 503, headers: { 'Retry-After': '60' } })
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

      /*
       * Os dois eventos escrevem `pago`, e é por isso que compartilham o
       * corpo: com Pix, o comprador termina o checkout **antes** de o dinheiro
       * cair, e o `completed` chega com `payment_status: 'unpaid'`. A
       * confirmação vem depois, no `async_payment_succeeded`.
       *
       * Sem tratar o segundo, ligar o Pix faria toda venda por esse meio
       * ficar presa em «aguardando pagamento» para sempre — dinheiro na conta
       * do consultor e pedido eternamente pendente aqui.
       */
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded': {
        const sessao = event.data.object as Stripe.Checkout.Session

        // A guarda continua valendo, e agora é ela que separa os dois: o
        // `completed` de um Pix pendente sai por aqui e volta no evento certo.
        if (sessao.payment_status !== 'paid') {
          logger.info('Sessão concluída sem pagamento confirmado — aguardando confirmação', {
            route: ROUTE, sessionId: sessao.id, status: sessao.payment_status,
          })
          break
        }

        /*
         * O desfecho vive em `venda-da-loja.ts`, compartilhado com o webhook
         * da conta da plataforma: a partir da fase 2 há duas contas cobrando,
         * e o que acontece quando o dinheiro entra é o mesmo nas duas.
         */
        await confirmarVendaDaLoja(supabase, {
          sessao,
          eventoId: event.id,
          eventoEm: event.created,
          contaDoEvento: event.account ?? null,
          origemDaApp: origemDaAplicacao(request),
        }, ROUTE)
        break
      }

      case 'checkout.session.async_payment_failed': {
        /*
         * O Pix foi gerado e expirou sem pagamento.
         *
         * Vira `cancelado`, e não silêncio: o pedido ficaria em «aguardando
         * pagamento» indefinidamente, e o vendedor não teria como distinguir
         * «vai cair» de «não vem mais». Carrinho abandonado continua sendo
         * ausência de evento; isto aqui é um fim conhecido.
         */
        const sessao = event.data.object as Stripe.Checkout.Session
        const pedidoId = await acharPedidoDaSessao(supabase, sessao, ROUTE)
        if (!pedidoId) break

        await registrarEvento(supabase, {
          pedidoId,
          evento: 'cancelado',
          origem: 'webhook_stripe',
          referencia: event.id,
          ocorridoEm: new Date(event.created * 1000).toISOString(),
          motivo: 'Pagamento assíncrono não confirmado no prazo',
        }, ROUTE)
        break
      }

      case 'charge.refunded':
      case 'refund.created':
      case 'refund.updated':
      case 'refund.failed': {
        const charge = await cobrancaDoEventoDeReembolso(event)
        if (!await processarReembolsoDaLoja(supabase, charge, event.account ?? null)) throw new Error('Reembolso sem pedido conciliado')
        break
      }
      case 'charge.dispute.created': {
        const disputa = event.data.object as Stripe.Dispute
        const intent = typeof disputa.payment_intent === 'string' ? disputa.payment_intent : disputa.payment_intent?.id
        if (!intent) throw new Error('Disputa sem pagamento')
        const pedidoId = await localizarPedidoDoReembolso(supabase, intent, event.account ?? null)
        if (!pedidoId) throw new Error('Disputa sem pedido conciliado')
        const gravado = await registrarEvento(supabase, {
          pedidoId, evento: 'contestado', origem: 'webhook_stripe', referencia: event.id,
          ocorridoEm: new Date(event.created * 1000).toISOString(),
        }, ROUTE)
        if (!gravado) throw new Error('Contestação não registrada')
        break
      }

      default:
        logger.info('Unhandled event type', { route: '/api/stripe/webhooks', type: event.type })
    }

    await marcarProcessado(supabase, event.id, ROUTE, reivindicacao.token)
    return NextResponse.json({ received: true })
  } catch {
    await marcarFalha(supabase, event.id, ROUTE, reivindicacao.token)
    logger.error('Stripe webhook error', { route: ROUTE, eventId: event.id })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
