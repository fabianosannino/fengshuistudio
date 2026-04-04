-- =====================================================
-- Add stripe_customer_id to profiles table
-- Rodar no Supabase SQL Editor
-- =====================================================

-- This column stores the Stripe Customer ID (cus_...)
-- for each user. Used for subscriptions and billing portal.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

-- Index for quick lookup by Stripe customer ID (used in webhooks)
CREATE INDEX IF NOT EXISTS idx_profiles_stripe_customer_id
  ON profiles (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;
