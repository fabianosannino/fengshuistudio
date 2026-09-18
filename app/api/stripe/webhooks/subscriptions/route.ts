/**
 * Stripe Subscription Webhooks Handler (V1)
 *
 * POST /api/stripe/webhooks/subscriptions — Receives standard subscription events
 *
 * EVENTS HANDLED:
 * - customer.subscription.created → Initial subscription sync after checkout
 * - customer.subscription.updated → Plan changes, cancellations
 * - customer.subscription.deleted → Subscription fully cancelled
 * - invoice.paid → Invoice successfully paid
 * - invoice.payment_failed → Payment attempt failed
 * - charge.refunded → Refund processed (assinatura **ou** pedido da loja)
 * - checkout.session.completed / .async_payment_succeeded → venda de bem próprio
 * - checkout.session.async_payment_failed → o Pix da venda própria expirou
 *
 * SETUP:
 * 1. Stripe Dashboard > Developers > Webhooks > + Add endpoint
 * 2. URL: https://yourdomain.com/api/stripe/webhooks/subscriptions
 * 3. Listen to: "Events on your account"
 * 4. Select: customer.subscription.created, customer.subscription.updated,
 *    customer.subscription.deleted, invoice.paid, invoice.payment_failed,
 *    charge.refunded, checkout.session.completed,
 *    checkout.session.async_payment_succeeded,
 *    checkout.session.async_payment_failed, invoice_payment.paid,
 *    refund.created, refund.updated, refund.failed,
 *    charge.dispute.created, charge.dispute.updated, charge.dispute.closed
 * 5. Copy signing secret to STRIPE_SUBSCRIPTION_WEBHOOK_SECRET env var
 *
 * ## Por que a venda de bem próprio entra num endpoint chamado «subscriptions»
 *
 * Porque o escopo de um destino do Stripe — «Sua conta» ou «Contas conectadas»
 * — **não é editável depois de criado**, e este é o destino da nossa conta. A
 * venda de bem próprio cobra na nossa conta, então o evento dela chega aqui,
 * queira o nome do arquivo ou não.
 *
 * A alternativa seria um terceiro endpoint, com um terceiro segredo para
 * configurar e manter em sincronia. O nome ficou desatualizado; a URL está
 * registrada em produção e renomeá-la custaria mais do que o desconforto.
 */

import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import stripeClient from '../../../../../src/lib/stripe'
import { createSupabaseAdminClient } from '../../../../../src/lib/supabase-admin'
import { logger } from '../../../../../src/lib/logger'
import {
  reivindicarEvento, marcarProcessado, marcarFalha, houveEventoMaisNovo, objetoDoEvento,
} from '../../../../../src/lib/eventos-stripe'
import { sincronizarAssinatura } from '../../../../../src/lib/sincronizar-assinatura'
import { sincronizarFaturaStripe, sincronizarReembolsoDaAssinatura, sincronizarDisputaStripe } from '../../../../../src/lib/sincronizar-financeiro-stripe'
import {
  acharPedidoDaSessao, acharPedidoDoPagamento, registrarEvento, valoresDoPedido,
} from '../../../../../src/lib/pedidos-da-loja'
import { registrarLancamentosDoReembolso } from '../../../../../src/lib/lancamentos-da-venda'
import { confirmarVendaDaLoja } from '../../../../../src/lib/venda-da-loja'
import { origemDaAplicacao } from '../../../../../src/lib/auth-rotas'

const webhookSecret = process.env.STRIPE_SUBSCRIPTION_WEBHOOK_SECRET

const ROUTE = '/api/stripe/webhooks/subscriptions'
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

  // service_role: webhooks não têm sessão de usuário; as tabelas de billing
  // são admin-only no RLS e este handler é o único caminho legítimo de escrita.
  // A assinatura do evento já foi verificada acima.
  const supabase = createSupabaseAdminClient()

  // O Stripe reentrega eventos e não garante ordem. Reivindicar antes de
  // processar fecha a janela entre o trabalho e a marca — ver `eventos-stripe`.
  const objetoId = objetoDoEvento(event)
  const reivindicacao = await reivindicarEvento(supabase, {
    id: event.id, type: event.type, created: event.created, endpoint: ROUTE, objetoId,
  })

  if (reivindicacao.situacao === 'repetido') {
    logger.info('Evento repetido — descartado', { route: ROUTE, eventId: event.id, tipo: event.type })
    return NextResponse.json({ received: true, repetido: true })
  }
  if (!('token' in reivindicacao)) {
    return NextResponse.json({ error: 'Processamento indisponível. Aguarde nova tentativa.' }, { status: 503, headers: { 'Retry-After': '60' } })
  }

  try {
    // Only the legacy shop flow retains its order guard. Financial resources
    // are freshly read under their own claim; older events remain retryable facts.
    if (event.type.startsWith('checkout.session.') && objetoId && await houveEventoMaisNovo(supabase, objetoId, event.created, event.id)) {
      logger.warn('Evento fora de ordem — descartado', {
        route: ROUTE, eventId: event.id, tipo: event.type, objetoId,
      })
      await marcarProcessado(supabase, event.id, ROUTE, reivindicacao.token)
      return NextResponse.json({ received: true, foraDeOrdem: true })
    }

    switch (event.type) {
      case 'customer.subscription.created': {
        const subscription = event.data.object as Stripe.Subscription

        // A criação da linha vive em `sincronizar-assinatura`, compartilhada
        // com a reconciliação: duas respostas para «como nasce uma assinatura»
        // divergiriam, e a segunda envelheceria calada.
        const resultado = await sincronizarAssinatura(supabase, subscription.id, ROUTE)
        if (resultado.situacao === 'falhou') throw new Error('Falha ao sincronizar assinatura')
        logger.info('Subscription created', {
          route: ROUTE,
          subscriptionId: subscription.id,
          situacao: resultado.situacao,
        })

        break
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription

        // Mesmo caminho da criação. O que este trecho fazia à mão —  atualizar
        // a linha, aplicar o plano, rebaixar quando cancelada — agora vive em
        // `sincronizar-assinatura`, junto da criação e da reconciliação.
        //
        // Uma diferença de comportamento, deliberada: quando não existe linha
        // com este `gateway_subscription_id`, antes o código atualizava
        // *qualquer* assinatura ativa do usuário, no escuro. Agora cria a
        // linha certa. Assinatura que o app não conhece é falha de entrega, e
        // a resposta é registrá-la, não sobrescrever a vizinha.
        const resultado = await sincronizarAssinatura(supabase, subscription.id, ROUTE)
        if (resultado.situacao === 'falhou') throw new Error('Falha ao sincronizar assinatura')
        logger.info('Subscription updated', {
          route: ROUTE,
          subscriptionId: subscription.id,
          situacao: resultado.situacao,
        })

        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        const resultado = await sincronizarAssinatura(supabase, subscription.id, ROUTE)
        if (resultado.situacao === 'falhou') throw new Error('Falha ao sincronizar cancelamento')
        break
      }

      case 'invoice_payment.paid': {
        const pagamento = event.data.object as Stripe.InvoicePayment
        const ref = pagamento.invoice
        const faturaId = typeof ref === 'string' ? ref : ref?.id
        if (!faturaId) throw new Error('Pagamento sem fatura')
        await sincronizarFaturaStripe(supabase, faturaId, ROUTE)
        break
      }
      case 'invoice.paid':
      case 'invoice.payment_failed': {
        await sincronizarFaturaStripe(supabase, (event.data.object as Stripe.Invoice).id, ROUTE)
        break
      }

      /*
       * A venda de bem próprio (fase 2) cobra na **nossa** conta, então o
       * evento dela chega aqui, e não no endpoint das contas conectadas.
       *
       * O desfecho é o mesmo dos dois lados — por isso vive em
       * `venda-da-loja.ts`. `confirmarVendaDaLoja` devolve `null` quando a
       * sessão não é de um pedido da loja, que é o caso de todo checkout de
       * assinatura passando por aqui.
       */
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded': {
        const sessao = event.data.object as Stripe.Checkout.Session

        // Pix confirma depois: o `completed` chega `unpaid` e a confirmação
        // vem no `async_payment_succeeded`. É esta guarda que separa os dois.
        if (sessao.payment_status !== 'paid') {
          logger.info('Sessão concluída sem pagamento confirmado — aguardando confirmação', {
            route: ROUTE, sessionId: sessao.id, status: sessao.payment_status,
          })
          break
        }

        await confirmarVendaDaLoja(supabase, {
          sessao,
          eventoId: event.id,
          eventoEm: event.created,
          // Cobrança na própria plataforma: não há conta conectada.
          contaDoEvento: null,
          origemDaApp: origemDaAplicacao(request),
        }, ROUTE)
        break
      }

      case 'checkout.session.async_payment_failed': {
        const sessao = event.data.object as Stripe.Checkout.Session
        const pedidoId = await acharPedidoDaSessao(supabase, sessao, ROUTE)
        if (!pedidoId) break

        // O Pix expirou. Vira `cancelado` em vez de silêncio: «vai cair» e
        // «não vem mais» precisam ser distinguíveis para quem olha o pedido.
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

      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge & {
          amount_refunded?: number
          refunded?: boolean
        }

        /*
         * Pedido da loja vem primeiro, e o `break` é o ponto.
         *
         * O tratamento abaixo é de assinatura: procura o perfil pelo
         * `customer`. Numa venda da loja o comprador é convidado — não tem
         * `customer` nem perfil —, então o reembolso morreria no `if
         * (!customerId) break` e o pedido ficaria pago para sempre, com o
         * dinheiro já devolvido.
         */
        const paymentIntentDaLoja = typeof charge.payment_intent === 'string'
          ? charge.payment_intent
          : null

        if (paymentIntentDaLoja) {
          const pedidoId = await acharPedidoDoPagamento(supabase, paymentIntentDaLoja, ROUTE)
          if (pedidoId) {
            if (objetoId && await houveEventoMaisNovo(supabase, objetoId, event.created, event.id)) break
            const ocorridoEm = new Date(event.created * 1000).toISOString()
            await registrarEvento(supabase, {
              pedidoId, evento: 'reembolsado', origem: 'webhook_stripe',
              referencia: event.id, ocorridoEm,
            }, ROUTE)

            const valores = await valoresDoPedido(supabase, pedidoId, ROUTE)
            await registrarLancamentosDoReembolso(supabase, {
              pedidoId,
              cobranca: charge,
              vendedor: valores?.vendedor ?? 'plataforma',
              referencia: event.id,
              ocorridoEm,
            }, ROUTE)

            logger.info('Reembolso de pedido da loja registrado', { route: ROUTE, pedidoId })
            break
          }
        }

        await sincronizarReembolsoDaAssinatura(supabase, charge, ROUTE)
        break
      }

      case 'refund.created':
      case 'refund.updated':
      case 'refund.failed': {
        const refund = event.data.object as Stripe.Refund
        const chargeId = typeof refund.charge === 'string' ? refund.charge : refund.charge?.id
        if (!chargeId) throw new Error('Reembolso sem cobrança')
        const charge = await stripeClient.charges.retrieve(chargeId, {}, { timeout: 10_000, maxNetworkRetries: 0 })
        if (charge.id !== chargeId) throw new Error('Cobrança do reembolso incompatível')
        const intent = typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent?.id
        // Shop ledger is a separate contract. Do not acknowledge a refund we
        // have not reconciled, and do not run its cumulative legacy writer here.
        if (intent && await acharPedidoDoPagamento(supabase, intent, ROUTE)) throw new Error('Reembolso da loja requer conciliação específica')
        await sincronizarReembolsoDaAssinatura(supabase, charge, ROUTE)
        break
      }

      // Contestação de cobrança. O Stripe retém o valor na abertura e cobra
      // uma taxa; sem escutar isto, a primeira notícia viria pelo extrato.
      case 'charge.dispute.created':
      case 'charge.dispute.updated':
      case 'charge.dispute.closed': {
        await sincronizarDisputaStripe(supabase, (event.data.object as Stripe.Dispute).id, event.id)
        break
      }

      default:
        logger.info('Unhandled subscription event', { route: ROUTE, type: event.type })
    }

    await marcarProcessado(supabase, event.id, ROUTE, reivindicacao.token)
    return NextResponse.json({ received: true })
  } catch {
    // A reivindicação fica sem `processado_em`, então a reentrega do Stripe
    // refaz em vez de descartar. O motivo fica na própria linha.
    await marcarFalha(supabase, event.id, ROUTE, reivindicacao.token)
    logger.error('Subscription webhook handler error', { route: ROUTE, eventId: event.id })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

