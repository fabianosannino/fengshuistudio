/**
 * Stripe V2 Thin Events Webhook Handler
 *
 * POST /api/stripe/webhooks — Receives thin events from Stripe for V2 accounts
 *
 * This webhook handles V2 account events using the "thin" event format.
 * Thin events contain only metadata (type, account ID) — we must fetch
 * the full event data from the API to process it.
 *
 * EVENTS HANDLED:
 * - v2.core.account[requirements].updated
 *   → Account requirements changed (e.g., new verification needed)
 * - v2.core.account[configuration.merchant].capability_status_updated
 *   → Merchant capability status changed (e.g., card_payments activated)
 * - v2.core.account[configuration.customer].capability_status_updated
 *   → Customer capability status changed
 *
 * SETUP INSTRUCTIONS:
 * 1. In Stripe Dashboard > Developers > Webhooks > + Add destination
 * 2. Events from: "Connected accounts"
 * 3. Show advanced options > Payload style: "Thin"
 * 4. Select the v2 events listed above
 * 5. Set endpoint URL to: https://yourdomain.com/api/stripe/webhooks
 * 6. Copy the signing secret (whsec_...) to .env.local as STRIPE_WEBHOOK_SECRET
 *
 * LOCAL TESTING with Stripe CLI:
 *   stripe listen \
 *     --thin-events 'v2.core.account[requirements].updated,v2.core.account[configuration.merchant].capability_status_updated,v2.core.account[configuration.customer].capability_status_updated' \
 *     --forward-thin-to http://localhost:3000/api/stripe/webhooks
 */

import { NextResponse } from 'next/server'
import stripeClient from '../../../../src/lib/stripe'
import { logger } from '../../../../src/lib/logger'

// ── Webhook secret for verifying event signatures ────────────────────────────
// PLACEHOLDER: Add your webhook signing secret to .env.local
// Get it from: Stripe Dashboard > Developers > Webhooks > your endpoint > Signing secret
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
if (!webhookSecret) {
  console.warn(
    '⚠️  STRIPE_WEBHOOK_SECRET is not set.\n' +
    'Webhook signature verification will fail.\n' +
    'Add it to .env.local: STRIPE_WEBHOOK_SECRET=whsec_...'
  )
}

export async function POST(request: Request) {
  // ── Get the raw body and signature header ──────────────────────────────
  // Stripe signs the raw request body. We must verify this signature
  // to ensure the webhook came from Stripe and wasn't tampered with.
  const body = await request.text()
  const sig = request.headers.get('stripe-signature')

  if (!sig || !webhookSecret) {
    return NextResponse.json({ error: 'Missing signature or webhook secret' }, { status: 400 })
  }

  try {
    // ── Parse the thin event ─────────────────────────────────────────────
    // parseThinEvent verifies the signature and extracts the event metadata.
    // Thin events only contain: id, type, related_object, created, context.
    // We need to fetch the full event data separately.
    // parseEventNotification is the SDK method for verifying thin/V2 events
    const thinEvent = stripeClient.parseEventNotification(body, sig, webhookSecret)

    logger.info('Stripe thin event received', { route: '/api/stripe/webhooks', type: thinEvent.type, eventId: thinEvent.id })

    // ── Fetch the full event data ────────────────────────────────────────
    // The thin event only has metadata. To get the actual event payload
    // (e.g., the account object with its current requirements), we retrieve it.
    const event = await stripeClient.v2.core.events.retrieve(thinEvent.id)

    // ── Handle each event type ───────────────────────────────────────────
    switch (thinEvent.type) {
      case 'v2.core.account[requirements].updated': {
        // Account requirements have changed.
        // This happens when:
        // - New verification documents are needed
        // - Regulatory requirements change
        // - Financial institution requirements update
        //
        // Action: Check if there are new 'currently_due' requirements
        // and notify the account owner to complete them.
        logger.info('Account requirements updated', {
          route: '/api/stripe/webhooks',
          eventType: thinEvent.type,
        })

        // TODO: Notify the account owner about new requirements
        // You could send an in-app notification, email, or update a status flag
        break
      }

      case 'v2.core.account[configuration.merchant].capability_status_updated': {
        // A merchant capability status has changed.
        // This happens when:
        // - card_payments becomes 'active' (onboarding complete!)
        // - A capability is suspended or restricted
        //
        // Action: Update the account's status in your database
        logger.info('Merchant capability status updated', {
          route: '/api/stripe/webhooks',
          eventType: thinEvent.type,
        })

        // TODO: Update the account status in your database
        // For example, mark the user as "ready to accept payments"
        break
      }

      case 'v2.core.account[configuration.customer].capability_status_updated': {
        // A customer capability status has changed.
        // This is relevant when accounts can also be customers (e.g., subscriptions).
        logger.info('Customer capability status updated', {
          route: '/api/stripe/webhooks',
          eventType: thinEvent.type,
        })
        break
      }

      default:
        logger.warn('Unhandled thin event type', { route: '/api/stripe/webhooks', type: thinEvent.type })
    }

    // ── Always return 200 to acknowledge receipt ─────────────────────────
    // If you return a non-2xx status, Stripe will retry the webhook.
    return NextResponse.json({ received: true })
  } catch (err) {
    logger.error('Stripe webhook error', { route: '/api/stripe/webhooks', error: String(err) })
    return NextResponse.json({ error: `Webhook error: ${String(err)}` }, { status: 400 })
  }
}
