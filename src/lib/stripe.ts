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

// ── Create the Stripe client lazily ──────────────────────────────────────────
// We use a lazy getter so the build doesn't fail when STRIPE_SECRET_KEY
// is not yet configured. The error is thrown at runtime when an API route
// actually tries to use the client, not at build/import time.

let _stripeClient: Stripe | null = null

function getStripeClient(): Stripe {
  if (_stripeClient) return _stripeClient

  const secretKey = process.env.STRIPE_SECRET_KEY
  if (!secretKey) {
    throw new Error(
      '❌ STRIPE_SECRET_KEY is not set.\n' +
      'Please add your Stripe secret key to your environment variables:\n' +
      '  STRIPE_SECRET_KEY=sk_test_...\n' +
      'Get it from: https://dashboard.stripe.com/apikeys'
    )
  }

  _stripeClient = new Stripe(secretKey, {
    appInfo: {
      name: 'FengShui Studio',
      version: '1.0.0',
    },
  })

  return _stripeClient
}

// Export a proxy that lazily initializes the client on first use
const stripeClient = new Proxy({} as Stripe, {
  get(_target, prop) {
    return (getStripeClient() as unknown as Record<string | symbol, unknown>)[prop]
  },
})

export default stripeClient
