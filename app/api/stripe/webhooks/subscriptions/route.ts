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
 * - charge.refunded → Refund processed
 *
 * SETUP:
 * 1. Stripe Dashboard > Developers > Webhooks > + Add endpoint
 * 2. URL: https://yourdomain.com/api/stripe/webhooks/subscriptions
 * 3. Listen to: "Events on your account"
 * 4. Select: customer.subscription.created, customer.subscription.updated,
 *    customer.subscription.deleted, invoice.paid, invoice.payment_failed,
 *    charge.refunded
 * 5. Copy signing secret to STRIPE_SUBSCRIPTION_WEBHOOK_SECRET env var
 */

import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import type { SupabaseClient } from '@supabase/supabase-js'
import stripeClient from '../../../../../src/lib/stripe'
import { createSupabaseAdminClient } from '../../../../../src/lib/supabase-admin'
import { logger } from '../../../../../src/lib/logger'
import {
  reivindicarEvento, marcarProcessado, marcarFalha, houveEventoMaisNovo, objetoDoEvento,
} from '../../../../../src/lib/eventos-stripe'
import { enumDoPlano, planoEfetivo } from '../../../../../src/lib/plano-utils'
import {
  sincronizarAssinatura, statusDaAssinatura, planoDaAssinatura,
} from '../../../../../src/lib/sincronizar-assinatura'

const webhookSecret = process.env.STRIPE_SUBSCRIPTION_WEBHOOK_SECRET

const ROUTE = '/api/stripe/webhooks/subscriptions'

// Grace period: after how many days of past_due we downgrade to free
const GRACE_PERIOD_DAYS = 7

/**
 * Executa uma escrita no Supabase e loga falha em vez de engolir o erro.
 * Webhooks não podem falhar silenciosamente: sem isso, um RLS ou schema
 * errado deixaria assinaturas dessincronizadas sem nenhum sinal.
 */
async function logWrite(
  operation: string,
  query: PromiseLike<{ error: { message: string } | null }>
): Promise<void> {
  const { error } = await query
  if (error) {
    logger.error('Supabase write failed in webhook', { route: ROUTE, operation, error: error.message })
  }
}

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
    logger.error('Webhook signature verification failed', { route: '/api/stripe/webhooks/subscriptions', error: String(err) })
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

  // Entrega fora de ordem: aplicar um evento antigo sobre um estado mais novo
  // faria a assinatura voltar a um passado que já não é verdade.
  if (objetoId && await houveEventoMaisNovo(supabase, objetoId, event.created, event.id)) {
    logger.warn('Evento fora de ordem — descartado', {
      route: ROUTE, eventId: event.id, tipo: event.type, objetoId,
    })
    await marcarProcessado(supabase, event.id, ROUTE)
    return NextResponse.json({ received: true, foraDeOrdem: true })
  }

  try {
    switch (event.type) {
      case 'customer.subscription.created': {
        const subscription = event.data.object as Stripe.Subscription & {
          start_date?: number
          current_period_start?: number
          current_period_end?: number
        }

        // A criação da linha vive em `sincronizar-assinatura`, compartilhada
        // com a reconciliação: duas respostas para «como nasce uma assinatura»
        // divergiriam, e a segunda envelheceria calada.
        const resultado = await sincronizarAssinatura(supabase, subscription, ROUTE)
        logger.info('Subscription created', {
          route: ROUTE,
          subscriptionId: subscription.id,
          situacao: resultado.situacao,
        })

        break
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription & {
          current_period_start?: number
          current_period_end?: number
        }
        const customerId = resolveCustomerId(subscription.customer)
        const status = subscription.status
        const cancelAtPeriodEnd = subscription.cancel_at_period_end

        logger.info('Subscription updated', {
          route: '/api/stripe/webhooks/subscriptions',
          subscriptionId: subscription.id,
          customerId,
          status,
          cancelAtPeriodEnd,
        })

        const profile = await findProfileByCustomerId(supabase, customerId)
        if (!profile) break

        // Update by gateway_subscription_id for accuracy, fallback to user_id + status
        const { data: existingSub } = await supabase
          .from('subscriptions')
          .select('id')
          .eq('gateway_subscription_id', subscription.id)
          .single()

        const updateData = {
          status: mapStripeStatus(status),
          cancel_at_period_end: cancelAtPeriodEnd,
          current_period_start: subscription.current_period_start ? new Date(subscription.current_period_start * 1000).toISOString() : undefined,
          current_period_end: subscription.current_period_end ? new Date(subscription.current_period_end * 1000).toISOString() : undefined,
          next_billing_date: subscription.current_period_end ? new Date(subscription.current_period_end * 1000).toISOString() : undefined,
          updated_at: new Date().toISOString(),
        }

        if (existingSub) {
          await logWrite('update-subscription', supabase
            .from('subscriptions')
            .update(updateData)
            .eq('id', existingSub.id))
        } else {
          await logWrite('update-subscription-fallback', supabase
            .from('subscriptions')
            .update(updateData)
            .eq('user_id', profile.id)
            .in('status', ['active', 'past_due', 'trial', 'gratuidade']))
        }

        // If canceled, downgrade to free
        if (status === 'canceled') {
          await logWrite('downgrade-profile-free', supabase
            .from('profiles')
            .update({ plano: enumDoPlano('free') })
            .eq('id', profile.id))
        } else {
          // Update plan based on subscription items
          const planSlug = await resolvePlanSlug(supabase, subscription)
          if (planSlug) {
            await logWrite('update-profile-plan', supabase
              .from('profiles')
              .update({ plano: enumDoPlano(planoEfetivo(planSlug)) })
              .eq('id', profile.id))
          }
        }

        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        const customerId = resolveCustomerId(subscription.customer)

        logger.info('Subscription deleted', {
          route: '/api/stripe/webhooks/subscriptions',
          subscriptionId: subscription.id,
          customerId,
        })

        const profile = await findProfileByCustomerId(supabase, customerId)
        if (!profile) break

        const now = new Date().toISOString()

        // Update by gateway_subscription_id first
        const { data: existingSub } = await supabase
          .from('subscriptions')
          .select('id')
          .eq('gateway_subscription_id', subscription.id)
          .single()

        if (existingSub) {
          await logWrite('cancel-subscription', supabase
            .from('subscriptions')
            .update({ status: 'cancelled', cancelled_at: now, updated_at: now })
            .eq('id', existingSub.id))
        } else {
          await logWrite('cancel-subscription-fallback', supabase
            .from('subscriptions')
            .update({ status: 'cancelled', cancelled_at: now, updated_at: now })
            .eq('user_id', profile.id)
            .in('status', ['active', 'past_due']))
        }

        await logWrite('downgrade-profile-free', supabase
          .from('profiles')
          .update({ plano: enumDoPlano('free') })
          .eq('id', profile.id))

        break
      }

      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice & {
          subscription?: string | null
          due_date?: number | null
          attempt_count?: number
          number?: string | null
          amount_paid?: number
        }
        const customerId = typeof invoice.customer === 'string'
          ? invoice.customer
          : invoice.customer?.id

        logger.info('Invoice paid', {
          route: '/api/stripe/webhooks/subscriptions',
          invoiceId: invoice.id,
          customerId: customerId || 'unknown',
          amount: invoice.amount_paid,
        })

        if (!customerId) break

        const profile = await findProfileByCustomerId(supabase, customerId)
        if (!profile) break

        // Idempotency: check if invoice already recorded
        const { data: existingInvoice } = await supabase
          .from('invoices')
          .select('id')
          .eq('gateway_invoice_id', invoice.id)
          .single()

        if (existingInvoice) {
          // Update to paid if not already
          await logWrite('mark-invoice-paid', supabase
            .from('invoices')
            .update({ status: 'paid', paid_at: new Date().toISOString(), amount_paid: (invoice.amount_paid || 0) / 100 })
            .eq('id', existingInvoice.id))
        } else {
          // Calculate due_date safely
          const dueDate = invoice.due_date
            ? new Date(invoice.due_date * 1000)
            : new Date()

          await logWrite('insert-invoice', supabase.from('invoices').insert({
            user_id: profile.id,
            amount: (invoice.amount_paid || 0) / 100,
            amount_paid: (invoice.amount_paid || 0) / 100,
            status: 'paid',
            due_date: dueDate.toISOString().split('T')[0],
            paid_at: new Date().toISOString(),
            gateway_invoice_id: invoice.id,
            description: `Fatura Stripe ${invoice.number || invoice.id}`,
            billing_cycle: invoice.subscription ? 'recurring' : 'one_time',
          }))
        }

        // Reactivate subscription if it was past_due
        await logWrite('reactivate-subscription', supabase
          .from('subscriptions')
          .update({ status: 'active', updated_at: new Date().toISOString() })
          .eq('user_id', profile.id)
          .eq('status', 'past_due'))

        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice & {
          attempt_count?: number
        }
        const customerId = typeof invoice.customer === 'string'
          ? invoice.customer
          : invoice.customer?.id

        logger.warn('Invoice payment failed', {
          route: '/api/stripe/webhooks/subscriptions',
          invoiceId: invoice.id,
          customerId: customerId || 'unknown',
          attemptCount: invoice.attempt_count,
        })

        if (!customerId) break

        const profile = await findProfileByCustomerId(supabase, customerId)
        if (!profile) break

        // Mark subscription as past_due
        await logWrite('mark-subscription-past-due', supabase
          .from('subscriptions')
          .update({ status: 'past_due', updated_at: new Date().toISOString() })
          .eq('user_id', profile.id)
          .eq('status', 'active'))

        // Create a payment notification for the user
        await logWrite('insert-payment-failed-notification', supabase.from('payment_notifications').insert({
          user_id: profile.id,
          type: 'payment_failed',
          channel: 'in_app',
          sent_at: new Date().toISOString(),
          content: `Falha no pagamento da sua assinatura. Por favor, atualize seu meio de pagamento. Tentativa ${invoice.attempt_count || 1}.`,
        }))

        // Check if grace period expired — auto-downgrade to free
        const { data: pastDueSub } = await supabase
          .from('subscriptions')
          .select('id, updated_at')
          .eq('user_id', profile.id)
          .eq('status', 'past_due')
          .single()

        if (pastDueSub?.updated_at) {
          const pastDueSince = new Date(pastDueSub.updated_at)
          const daysPastDue = (Date.now() - pastDueSince.getTime()) / (1000 * 60 * 60 * 24)

          if (daysPastDue >= GRACE_PERIOD_DAYS) {
            logger.warn('Grace period expired, downgrading to free', {
              userId: profile.id,
              daysPastDue: Math.round(daysPastDue),
            })

            await logWrite('cancel-subscription-grace-expired', supabase
              .from('subscriptions')
              .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
              .eq('id', pastDueSub.id))

            await logWrite('downgrade-profile-free', supabase
              .from('profiles')
              .update({ plano: enumDoPlano('free') })
              .eq('id', profile.id))

            await logWrite('insert-cancelled-notification', supabase.from('payment_notifications').insert({
              user_id: profile.id,
              type: 'subscription_cancelled_nonpayment',
              channel: 'in_app',
              sent_at: new Date().toISOString(),
              content: `Sua assinatura foi cancelada por falta de pagamento apos ${GRACE_PERIOD_DAYS} dias. Assine novamente para recuperar o acesso.`,
            }))
          }
        }

        break
      }

      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge & {
          amount_refunded?: number
          refunded?: boolean
        }
        const customerId = typeof charge.customer === 'string'
          ? charge.customer
          : (charge.customer as Stripe.Customer)?.id

        logger.info('Charge refunded', {
          route: '/api/stripe/webhooks/subscriptions',
          chargeId: charge.id,
          customerId: customerId || 'unknown',
          amountRefunded: charge.amount_refunded,
        })

        if (!customerId) break

        const profile = await findProfileByCustomerId(supabase, customerId)
        if (!profile) break

        // Find the invoice linked to this charge's payment_intent
        const paymentIntentId = typeof charge.payment_intent === 'string'
          ? charge.payment_intent
          : (charge.payment_intent as Stripe.PaymentIntent)?.id

        if (paymentIntentId) {
          // Try to find the Stripe invoice linked to this payment intent
          try {
            const invoicesResponse = await stripeClient.invoices.list({
              customer: customerId,
              limit: 10,
            }) as unknown as { data: Array<{ id: string; payment_intent: string | null }> }
            const matchedInvoice = invoicesResponse.data.find(inv => inv.payment_intent === paymentIntentId)

            if (matchedInvoice) {
              await logWrite('mark-invoice-refunded', supabase
                .from('invoices')
                .update({
                  status: charge.refunded ? 'refunded' : 'paid',
                  refunded_at: new Date().toISOString(),
                  refund_amount: (charge.amount_refunded || 0) / 100,
                  notes: `Reembolso processado via Stripe. Charge: ${charge.id}`,
                })
                .eq('gateway_invoice_id', matchedInvoice.id))
            }
          } catch (err) {
            logger.error('Error finding invoice for refund', { error: String(err) })
          }
        }

        // Create notification
        await logWrite('insert-refund-notification', supabase.from('payment_notifications').insert({
          user_id: profile.id,
          type: 'refund_processed',
          channel: 'in_app',
          sent_at: new Date().toISOString(),
          content: `Reembolso de ${((charge.amount_refunded || 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} processado com sucesso.`,
        }))

        break
      }

      default:
        logger.info('Unhandled subscription event', { route: '/api/stripe/webhooks/subscriptions', type: event.type })
    }

    await marcarProcessado(supabase, event.id, ROUTE)
    return NextResponse.json({ received: true })
  } catch (err) {
    // A reivindicação fica sem `processado_em`, então a reentrega do Stripe
    // refaz em vez de descartar. O motivo fica na própria linha.
    await marcarFalha(supabase, event.id, ROUTE, String(err))
    logger.error('Subscription webhook handler error', { route: ROUTE, error: String(err) })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function resolveCustomerId(customer: string | Stripe.Customer | Stripe.DeletedCustomer): string {
  return typeof customer === 'string' ? customer : customer.id
}

async function findProfileByCustomerId(
  supabase: SupabaseClient,
  customerId: string
) {
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .single()

  if (!profile) {
    logger.warn('No profile found for Stripe customer', { customerId })
  }

  return profile
}

// Delegam ao módulo compartilhado. Manter cópias aqui recriaria a divergência
// que a extração acabou de fechar — o `updated` ainda tem lógica própria, mas
// a tradução de status e a descoberta do plano são as mesmas em todo lugar.
const mapStripeStatus = statusDaAssinatura

const resolvePlanSlug = planoDaAssinatura
