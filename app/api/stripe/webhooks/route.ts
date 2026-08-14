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
  acharPedidoDaSessao, acharPedidoDoPagamento, confirmarPagamento, registrarEvento,
  valoresDoPedido,
} from '../../../../src/lib/pedidos-da-loja'
import {
  registrarLancamentosDaVenda, registrarLancamentosDoReembolso,
} from '../../../../src/lib/lancamentos-da-venda'
import {
  pedidoParaConfirmar, marcarConfirmacaoEnviada, prazoDeArrependimento,
} from '../../../../src/lib/pedidos-da-loja'
import { enviarEmail } from '../../../../src/lib/email'
import { emailDeConfirmacao } from '../../../../src/lib/emails-do-pedido'
import { origemDaAplicacao } from '../../../../src/lib/auth-rotas'

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

        // O razão da venda: o que o comprador pagou, o que a plataforma reteve
        // e o que o gateway ficou. Falha aqui não desfaz o `pago` — o
        // pagamento é o fato importante, e o razão é reconstituível.
        const valores = await valoresDoPedido(supabase, pedidoId, ROUTE)
        if (valores) {
          await registrarLancamentosDaVenda(supabase, {
            pedidoId,
            totalCentavos: sessao.amount_total ?? valores.total,
            freteCentavos: valores.frete,
            taxaPlataformaCentavos: valores.taxa,
            paymentIntent: typeof sessao.payment_intent === 'string' ? sessao.payment_intent : null,
            contaConectada: event.account ?? valores.contaConectada,
            referencia: event.id,
            ocorridoEm: new Date(event.created * 1000).toISOString(),
          }, ROUTE)
        }

        /*
         * A confirmação por e-mail entrega o **único** link que o comprador
         * tem para o pedido — ele não tem conta. Até agora esse link só
         * aparecia na tela pós-pagamento, e quem fechasse a aba ficava sem
         * nenhuma porta.
         *
         * Best-effort declarado: falha aqui não desfaz a venda nem devolve
         * erro. Responder 500 faria o Stripe reentregar e reprocessar o que já
         * estava certo — trocaríamos um aviso perdido por trabalho refeito.
         */
        const paraConfirmar = await pedidoParaConfirmar(supabase, pedidoId, ROUTE)
        if (paraConfirmar?.compradorEmail) {
          const prazo = prazoDeArrependimento(paraConfirmar.tipo, paraConfirmar.eventos)
          const { assunto, html, texto } = emailDeConfirmacao({
            numero: paraConfirmar.numero,
            itens: paraConfirmar.itens,
            totalCentavos: paraConfirmar.totalCentavos,
            arrependimentoAte: prazo ? prazo.toISOString() : null,
            linkDoPedido: `${origemDaAplicacao(request)}/pedido/${paraConfirmar.tokenPublico}`,
          })

          const enviado = await enviarEmail(
            { para: paraConfirmar.compradorEmail, assunto, html, texto }, ROUTE
          )
          // Só marca depois de sair. Marcar antes trocaria «pode ter chegado
          // duas vezes» por «pode não ter chegado nenhuma».
          if (enviado) await marcarConfirmacaoEnviada(supabase, pedidoId, ROUTE)
        }

        logger.info('Venda da loja registrada', {
          route: ROUTE, pedidoId, contaConectada: event.account ?? null,
        })
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

        const ocorridoEm = new Date(event.created * 1000).toISOString()

        await registrarEvento(supabase, {
          pedidoId,
          evento: event.type === 'charge.refunded' ? 'reembolsado' : 'contestado',
          origem: 'webhook_stripe',
          referencia: event.id,
          ocorridoEm,
        }, ROUTE)

        // Só o reembolso mexe no razão. A contestação ainda não moveu dinheiro
        // — o `contestado` é aviso, e o valor só se resolve na disputa.
        if (event.type === 'charge.refunded') {
          await registrarLancamentosDoReembolso(supabase, {
            pedidoId,
            cobranca: cobranca as Stripe.Charge,
            referencia: event.id,
            ocorridoEm,
          }, ROUTE)
        }
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
