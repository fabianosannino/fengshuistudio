/**
 * Stripe Subscription Webhooks Handler (V1)
 *
 * POST /api/stripe/webhooks/subscriptions — Receives standard subscription events
 *
 * EVENTS HANDLED:
 * - customer.subscription.updated → Plan changes, cancellations
 * - customer.subscription.deleted → Subscription fully cancelled
 * - invoice.paid → Invoice successfully paid
 * - invoice.payment_failed → Payment attempt failed
 *
 * SETUP:
 * 1. Stripe Dashboard > Developers > Webhooks > + Add endpoint
 * 2. URL: https://yourdomain.com/api/stripe/webhooks/subscriptions
 * 3. Listen to: "Events on your account"
 * 4. Select: customer.subscription.updated, customer.subscription.deleted,
 *    invoice.paid, invoice.payment_failed
 * 5. Copy signing secret to STRIPE_SUBSCRIPTION_WEBHOOK_SECRET env var
 */

import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import stripeClient from '../../../../../src/lib/stripe'
import { createRouteHandlerClient } from '../../../../../src/lib/supabase-route'
import { logger } from '../../../../../src/lib/logger'

const webhookSecret = process.env.STRIPE_SUBSCRIPTION_WEBHOOK_SECRET

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
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        const customerId = typeof subscription.customer === 'string'
          ? subscription.customer
          : subscription.customer.id
        const status = subscription.status
        const cancelAtPeriodEnd = subscription.cancel_at_period_end

        logger.info('Subscription updated', {
          route: '/api/stripe/webhooks/subscriptions',
          subscriptionId: subscription.id,
          customerId,
          status,
          cancelAtPeriodEnd,
        })

        // Find user by their Stripe customer ID
        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('stripe_customer_id', customerId)
          .single()

        if (profile) {
          await supabase
            .from('subscriptions')
            .update({
              status: mapStripeStatus(status),
              cancel_at_period_end: cancelAtPeriodEnd,
              updated_at: new Date().toISOString(),
            })
            .eq('user_id', profile.id)
            .in('status', ['active', 'past_due', 'gratuidade'])

          if (status === 'canceled') {
            await supabase
              .from('profiles')
              .update({ plano: 'free' })
              .eq('id', profile.id)
          }
        }
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        const customerId = typeof subscription.customer === 'string'
          ? subscription.customer
          : subscription.customer.id

        logger.info('Subscription deleted', {
          route: '/api/stripe/webhooks/subscriptions',
          subscriptionId: subscription.id,
          customerId,
        })

        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('stripe_customer_id', customerId)
          .single()

        if (profile) {
          await supabase
            .from('subscriptions')
            .update({
              status: 'cancelled',
              cancelled_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('user_id', profile.id)
            .in('status', ['active', 'past_due'])

          await supabase
            .from('profiles')
            .update({ plano: 'free' })
            .eq('id', profile.id)
        }
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

        if (customerId) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('id')
            .eq('stripe_customer_id', customerId)
            .single()

          if (profile) {
            await supabase.from('invoices').insert({
              user_id: profile.id,
              amount: (invoice.amount_paid || 0) / 100,
              amount_paid: (invoice.amount_paid || 0) / 100,
              status: 'paid',
              due_date: new Date((invoice.due_date || Date.now() / 1000) * 1000).toISOString().split('T')[0],
              paid_at: new Date().toISOString(),
              gateway_invoice_id: invoice.id,
              description: `Fatura Stripe ${invoice.number || invoice.id}`,
              billing_cycle: (invoice as unknown as { subscription?: string }).subscription ? 'recurring' : 'one_time',
            })

            await supabase
              .from('subscriptions')
              .update({ status: 'active', updated_at: new Date().toISOString() })
              .eq('user_id', profile.id)
              .eq('status', 'past_due')
          }
        }
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
        })

        if (customerId) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('id')
            .eq('stripe_customer_id', customerId)
            .single()

          if (profile) {
            await supabase
              .from('subscriptions')
              .update({ status: 'past_due', updated_at: new Date().toISOString() })
              .eq('user_id', profile.id)
              .eq('status', 'active')
          }
        }
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

function mapStripeStatus(stripeStatus: string): string {
  switch (stripeStatus) {
    case 'active': return 'active'
    case 'past_due': return 'past_due'
    case 'canceled': return 'cancelled'
    case 'trialing': return 'trial'
    case 'paused': return 'paused'
    default: return 'active'
  }
}
