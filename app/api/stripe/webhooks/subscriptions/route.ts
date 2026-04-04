/**
 * Stripe Subscription Webhooks Handler
 *
 * POST /api/stripe/webhooks/subscriptions — Receives standard (non-thin) events
 *
 * This webhook handles subscription lifecycle events to keep our database
 * in sync with Stripe's subscription status.
 *
 * EVENTS HANDLED:
 * - customer.subscription.updated → Plan changes, cancellations, pauses
 * - customer.subscription.deleted → Subscription fully cancelled
 * - invoice.paid → Invoice was successfully paid
 * - invoice.payment_failed → Payment attempt failed
 *
 * SETUP INSTRUCTIONS:
 * 1. In Stripe Dashboard > Developers > Webhooks > + Add destination
 * 2. Events from: "Your account" (NOT Connected accounts)
 * 3. Payload style: Default (NOT thin)
 * 4. Select events: customer.subscription.updated, customer.subscription.deleted,
 *    invoice.paid, invoice.payment_failed
 * 5. Set endpoint URL to: https://yourdomain.com/api/stripe/webhooks/subscriptions
 * 6. Copy the signing secret to .env.local as STRIPE_SUBSCRIPTION_WEBHOOK_SECRET
 *
 * LOCAL TESTING:
 *   stripe listen --forward-to http://localhost:3000/api/stripe/webhooks/subscriptions
 */

import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import stripeClient from '../../../../../src/lib/stripe'
import { createRouteHandlerClient } from '../../../../../src/lib/supabase-route'
import { logger } from '../../../../../src/lib/logger'

// ── Webhook secret for subscription events ───────────────────────────────────
// PLACEHOLDER: Add your subscription webhook signing secret to .env.local
const webhookSecret = process.env.STRIPE_SUBSCRIPTION_WEBHOOK_SECRET
if (!webhookSecret) {
  console.warn(
    '⚠️  STRIPE_SUBSCRIPTION_WEBHOOK_SECRET is not set.\n' +
    'Add it to .env.local: STRIPE_SUBSCRIPTION_WEBHOOK_SECRET=whsec_...'
  )
}

export async function POST(request: Request) {
  const body = await request.text()
  const sig = request.headers.get('stripe-signature')

  if (!sig || !webhookSecret) {
    return NextResponse.json({ error: 'Missing signature or webhook secret' }, { status: 400 })
  }

  let event: Stripe.Event

  try {
    // ── Verify the webhook signature ─────────────────────────────────────
    // Standard events (non-thin) use constructEvent to verify and parse.
    event = stripeClient.webhooks.constructEvent(body, sig, webhookSecret)
  } catch (err) {
    logger.error('Webhook signature verification failed', { route: '/api/stripe/webhooks/subscriptions', error: String(err) })
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const supabase = await createRouteHandlerClient()

  try {
    switch (event.type) {
      // ── Subscription Updated ─────────────────────────────────────────
      // Fires when a subscription changes: upgrade, downgrade, cancel scheduled,
      // payment method change, pause/resume, etc.
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription

        // With V2 accounts, the account ID comes from customer_account, not customer
        // customer_account has shape acct_...
        const accountId = (subscription as unknown as { customer_account?: string }).customer_account
        const status = subscription.status // 'active', 'past_due', 'canceled', 'paused', etc.
        const cancelAtPeriodEnd = subscription.cancel_at_period_end

        logger.info('Subscription updated', {
          route: '/api/stripe/webhooks/subscriptions',
          subscriptionId: subscription.id,
          accountId: accountId || 'unknown',
          status,
          cancelAtPeriodEnd,
        })

        // ── Update the subscription status in our database ─────────────
        if (accountId) {
          // Find the user by their Stripe account ID
          const { data: profile } = await supabase
            .from('profiles')
            .select('id')
            .eq('stripe_account_id', accountId)
            .single()

          if (profile) {
            // Update the subscription record in our database
            // TODO: Add more granular status mapping based on your business logic
            await supabase
              .from('subscriptions')
              .update({
                status: mapStripeStatus(status),
                cancel_at_period_end: cancelAtPeriodEnd,
                updated_at: new Date().toISOString(),
              })
              .eq('user_id', profile.id)
              .in('status', ['active', 'past_due', 'gratuidade'])

            // If the subscription was fully canceled, downgrade to free
            if (status === 'canceled') {
              await supabase
                .from('profiles')
                .update({ plano: 'free' })
                .eq('id', profile.id)
            }
          }
        }
        break
      }

      // ── Subscription Deleted ─────────────────────────────────────────
      // Fires when a subscription is permanently deleted/canceled.
      // Revoke access to paid features.
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        const accountId = (subscription as unknown as { customer_account?: string }).customer_account

        logger.info('Subscription deleted', {
          route: '/api/stripe/webhooks/subscriptions',
          subscriptionId: subscription.id,
          accountId: accountId || 'unknown',
        })

        if (accountId) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('id')
            .eq('stripe_account_id', accountId)
            .single()

          if (profile) {
            // Mark subscription as cancelled in our database
            await supabase
              .from('subscriptions')
              .update({
                status: 'cancelled',
                cancelled_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              })
              .eq('user_id', profile.id)
              .in('status', ['active', 'past_due'])

            // Downgrade user to free plan
            await supabase
              .from('profiles')
              .update({ plano: 'free' })
              .eq('id', profile.id)
          }
        }
        break
      }

      // ── Invoice Paid ─────────────────────────────────────────────────
      // Fires when an invoice is successfully paid.
      // Confirm access and update invoice records.
      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice
        const accountId = (invoice as unknown as { customer_account?: string }).customer_account

        logger.info('Invoice paid', {
          route: '/api/stripe/webhooks/subscriptions',
          invoiceId: invoice.id,
          accountId: accountId || 'unknown',
          amount: invoice.amount_paid,
        })

        if (accountId) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('id')
            .eq('stripe_account_id', accountId)
            .single()

          if (profile) {
            // TODO: Create or update invoice record in our invoices table
            // This confirms the payment was successful
            await supabase.from('invoices').insert({
              user_id: profile.id,
              amount: (invoice.amount_paid || 0) / 100, // Convert from centavos
              amount_paid: (invoice.amount_paid || 0) / 100,
              status: 'paid',
              due_date: new Date((invoice.due_date || Date.now() / 1000) * 1000).toISOString().split('T')[0],
              paid_at: new Date().toISOString(),
              gateway_invoice_id: invoice.id,
              description: `Fatura Stripe ${invoice.number || invoice.id}`,
              billing_cycle: (invoice as unknown as { subscription?: string }).subscription ? 'recurring' : 'one_time',
            })

            // Ensure the subscription is marked as active
            await supabase
              .from('subscriptions')
              .update({ status: 'active', updated_at: new Date().toISOString() })
              .eq('user_id', profile.id)
              .eq('status', 'past_due')
          }
        }
        break
      }

      // ── Invoice Payment Failed ───────────────────────────────────────
      // Fires when a payment attempt fails.
      // Notify the user and update status.
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const accountId = (invoice as unknown as { customer_account?: string }).customer_account

        logger.warn('Invoice payment failed', {
          route: '/api/stripe/webhooks/subscriptions',
          invoiceId: invoice.id,
          accountId: accountId || 'unknown',
        })

        if (accountId) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('id')
            .eq('stripe_account_id', accountId)
            .single()

          if (profile) {
            // Mark subscription as past_due
            await supabase
              .from('subscriptions')
              .update({ status: 'past_due', updated_at: new Date().toISOString() })
              .eq('user_id', profile.id)
              .eq('status', 'active')

            // TODO: Send notification to user about failed payment
            // You could create a payment_notifications record here
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

/**
 * Map Stripe subscription status to our internal status.
 * Stripe uses: 'active', 'past_due', 'canceled', 'incomplete', 'trialing', 'paused', etc.
 * We use: 'active', 'past_due', 'cancelled', 'trial', 'paused', 'gratuidade'
 */
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
