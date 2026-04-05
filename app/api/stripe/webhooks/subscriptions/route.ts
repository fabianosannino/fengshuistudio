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
import stripeClient from '../../../../../src/lib/stripe'
import { createRouteHandlerClient } from '../../../../../src/lib/supabase-route'
import { logger } from '../../../../../src/lib/logger'

const webhookSecret = process.env.STRIPE_SUBSCRIPTION_WEBHOOK_SECRET

// Grace period: after how many days of past_due we downgrade to free
const GRACE_PERIOD_DAYS = 7

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

  const supabase = await createRouteHandlerClient()

  try {
    switch (event.type) {
      case 'customer.subscription.created': {
        const subscription = event.data.object as Stripe.Subscription
        const customerId = resolveCustomerId(subscription.customer)
        const status = subscription.status

        logger.info('Subscription created', {
          route: '/api/stripe/webhooks/subscriptions',
          subscriptionId: subscription.id,
          customerId,
          status,
        })

        const profile = await findProfileByCustomerId(supabase, customerId)
        if (!profile) break

        // Determine plan from subscription items
        const planSlug = await resolvePlanSlug(supabase, subscription)

        // Check idempotency — avoid duplicate subscriptions
        const { data: existingSub } = await supabase
          .from('subscriptions')
          .select('id')
          .eq('gateway_subscription_id', subscription.id)
          .single()

        if (existingSub) {
          logger.info('Subscription already exists, skipping', { subscriptionId: subscription.id })
          break
        }

        // Cancel any existing active subscriptions for this user
        await supabase
          .from('subscriptions')
          .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
          .eq('user_id', profile.id)
          .in('status', ['active', 'past_due', 'gratuidade'])

        // Find the plan in DB
        const { data: plan } = await supabase
          .from('plans')
          .select('id, slug')
          .eq('slug', planSlug)
          .single()

        const billingCycle = resolveBillingCycle(subscription)

        // Create new subscription record
        await supabase.from('subscriptions').insert({
          user_id: profile.id,
          plan_id: plan?.id || null,
          billing_cycle: billingCycle,
          status: mapStripeStatus(status),
          price_paid: subscription.items?.data?.[0]?.price?.unit_amount
            ? subscription.items.data[0].price.unit_amount / 100
            : 0,
          started_at: new Date(subscription.start_date * 1000).toISOString(),
          current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
          current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
          next_billing_date: new Date(subscription.current_period_end * 1000).toISOString(),
          gateway_subscription_id: subscription.id,
        })

        // Update profile plan
        if (planSlug && plan) {
          await supabase
            .from('profiles')
            .update({ plano: planSlug })
            .eq('id', profile.id)
        }

        break
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
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
          current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
          current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
          next_billing_date: new Date(subscription.current_period_end * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        }

        if (existingSub) {
          await supabase
            .from('subscriptions')
            .update(updateData)
            .eq('id', existingSub.id)
        } else {
          await supabase
            .from('subscriptions')
            .update(updateData)
            .eq('user_id', profile.id)
            .in('status', ['active', 'past_due', 'trial', 'gratuidade'])
        }

        // If canceled, downgrade to free
        if (status === 'canceled') {
          await supabase
            .from('profiles')
            .update({ plano: 'free' })
            .eq('id', profile.id)
        } else {
          // Update plan based on subscription items
          const planSlug = await resolvePlanSlug(supabase, subscription)
          if (planSlug) {
            await supabase
              .from('profiles')
              .update({ plano: planSlug })
              .eq('id', profile.id)
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
          await supabase
            .from('subscriptions')
            .update({ status: 'cancelled', cancelled_at: now, updated_at: now })
            .eq('id', existingSub.id)
        } else {
          await supabase
            .from('subscriptions')
            .update({ status: 'cancelled', cancelled_at: now, updated_at: now })
            .eq('user_id', profile.id)
            .in('status', ['active', 'past_due'])
        }

        await supabase
          .from('profiles')
          .update({ plano: 'free' })
          .eq('id', profile.id)

        break
      }

      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice
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
          await supabase
            .from('invoices')
            .update({ status: 'paid', paid_at: new Date().toISOString(), amount_paid: (invoice.amount_paid || 0) / 100 })
            .eq('id', existingInvoice.id)
        } else {
          // Calculate due_date safely
          const dueDate = invoice.due_date
            ? new Date(invoice.due_date * 1000)
            : new Date()

          await supabase.from('invoices').insert({
            user_id: profile.id,
            amount: (invoice.amount_paid || 0) / 100,
            amount_paid: (invoice.amount_paid || 0) / 100,
            status: 'paid',
            due_date: dueDate.toISOString().split('T')[0],
            paid_at: new Date().toISOString(),
            gateway_invoice_id: invoice.id,
            description: `Fatura Stripe ${invoice.number || invoice.id}`,
            billing_cycle: invoice.subscription ? 'recurring' : 'one_time',
          })
        }

        // Reactivate subscription if it was past_due
        await supabase
          .from('subscriptions')
          .update({ status: 'active', updated_at: new Date().toISOString() })
          .eq('user_id', profile.id)
          .eq('status', 'past_due')

        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
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
        await supabase
          .from('subscriptions')
          .update({ status: 'past_due', updated_at: new Date().toISOString() })
          .eq('user_id', profile.id)
          .eq('status', 'active')

        // Create a payment notification for the user
        await supabase.from('payment_notifications').insert({
          user_id: profile.id,
          type: 'payment_failed',
          channel: 'in_app',
          sent_at: new Date().toISOString(),
          content: `Falha no pagamento da sua assinatura. Por favor, atualize seu meio de pagamento. Tentativa ${invoice.attempt_count || 1}.`,
        })

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

            await supabase
              .from('subscriptions')
              .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
              .eq('id', pastDueSub.id)

            await supabase
              .from('profiles')
              .update({ plano: 'free' })
              .eq('id', profile.id)

            await supabase.from('payment_notifications').insert({
              user_id: profile.id,
              type: 'subscription_cancelled_nonpayment',
              channel: 'in_app',
              sent_at: new Date().toISOString(),
              content: `Sua assinatura foi cancelada por falta de pagamento apos ${GRACE_PERIOD_DAYS} dias. Assine novamente para recuperar o acesso.`,
            })
          }
        }

        break
      }

      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge
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
              await supabase
                .from('invoices')
                .update({
                  status: charge.refunded ? 'refunded' : 'paid',
                  refunded_at: new Date().toISOString(),
                  refund_amount: (charge.amount_refunded || 0) / 100,
                  notes: `Reembolso processado via Stripe. Charge: ${charge.id}`,
                })
                .eq('gateway_invoice_id', matchedInvoice.id)
            }
          } catch (err) {
            logger.error('Error finding invoice for refund', { error: String(err) })
          }
        }

        // Create notification
        await supabase.from('payment_notifications').insert({
          user_id: profile.id,
          type: 'refund_processed',
          channel: 'in_app',
          sent_at: new Date().toISOString(),
          content: `Reembolso de ${((charge.amount_refunded || 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} processado com sucesso.`,
        })

        break
      }

      default:
        logger.info('Unhandled subscription event', { route: '/api/stripe/webhooks/subscriptions', type: event.type })
    }

    return NextResponse.json({ received: true })
  } catch (err) {
    logger.error('Subscription webhook handler error', { route: '/api/stripe/webhooks/subscriptions', error: String(err) })
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function resolveCustomerId(customer: string | Stripe.Customer | Stripe.DeletedCustomer): string {
  return typeof customer === 'string' ? customer : customer.id
}

async function findProfileByCustomerId(
  supabase: Awaited<ReturnType<typeof createRouteHandlerClient>>,
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

function mapStripeStatus(stripeStatus: string): string {
  switch (stripeStatus) {
    case 'active': return 'active'
    case 'past_due': return 'past_due'
    case 'canceled': return 'cancelled'
    case 'trialing': return 'trial'
    case 'paused': return 'paused'
    case 'incomplete': return 'past_due'
    case 'incomplete_expired': return 'cancelled'
    default: return 'active'
  }
}

function resolveBillingCycle(subscription: Stripe.Subscription): string {
  const interval = subscription.items?.data?.[0]?.price?.recurring?.interval
  if (interval === 'year') return 'yearly'
  return 'monthly'
}

async function resolvePlanSlug(
  supabase: Awaited<ReturnType<typeof createRouteHandlerClient>>,
  subscription: Stripe.Subscription
): Promise<string> {
  // Try to get plan slug from subscription metadata
  const metadata = subscription.metadata
  if (metadata?.plan_slug) return metadata.plan_slug

  // Try to match by price amount
  const priceAmount = subscription.items?.data?.[0]?.price?.unit_amount
  const interval = subscription.items?.data?.[0]?.price?.recurring?.interval

  if (priceAmount) {
    const amountBRL = priceAmount / 100
    const { data: plans } = await supabase.from('plans').select('slug, price_monthly, price_yearly')

    if (plans) {
      for (const plan of plans) {
        if (interval === 'year' && plan.price_yearly === amountBRL) return plan.slug
        if (interval === 'month' && plan.price_monthly === amountBRL) return plan.slug
      }
    }
  }

  return 'profissional' // default fallback
}
