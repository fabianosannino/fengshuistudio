-- =====================================================
-- Add stripe_account_id to profiles table
-- Rodar no Supabase SQL Editor
-- =====================================================

-- This column stores the Stripe Connected Account ID (acct_...)
-- for each user. It links our user to their Stripe account.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS stripe_account_id TEXT;

-- Index for quick lookup by Stripe account ID (used in webhooks)
CREATE INDEX IF NOT EXISTS idx_profiles_stripe_account_id
  ON profiles (stripe_account_id)
  WHERE stripe_account_id IS NOT NULL;
