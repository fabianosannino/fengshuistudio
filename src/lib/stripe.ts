/**
 * Stripe Client Configuration — FengShui Studio
 *
 * This module creates and exports a singleton Stripe client instance.
 * All Stripe API calls throughout the application should use this client.
 *
 * SETUP INSTRUCTIONS:
 * 1. Create a Stripe account at https://stripe.com
 * 2. Go to Developers > API Keys in your Stripe Dashboard
 * 3. Copy your Secret Key (starts with sk_test_ or sk_live_)
 * 4. Add it to your .env.local file as STRIPE_SECRET_KEY
 * 5. Copy your Publishable Key (starts with pk_test_ or pk_live_)
 * 6. Add it as NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
 * 7. For webhooks, add STRIPE_WEBHOOK_SECRET (whsec_...)
 * 8. For subscription pricing, add STRIPE_PRICE_ID (price_...)
 */

import Stripe from 'stripe'

// ── Validate required environment variables ──────────────────────────────────

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error(
    '❌ STRIPE_SECRET_KEY is not set.\n' +
    'Please add your Stripe secret key to .env.local:\n' +
    '  STRIPE_SECRET_KEY=sk_test_...\n' +
    'Get it from: https://dashboard.stripe.com/apikeys'
  )
}

// ── Create the Stripe client ─────────────────────────────────────────────────
// The SDK automatically uses the latest API version (2026-03-25.dahlia).
// We pass the secret key and identify our application for Stripe's logs.

const stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY, {
  // Identify this integration in Stripe's dashboard logs
  appInfo: {
    name: 'FengShui Studio',
    version: '1.0.0',
  },
})

export default stripeClient
