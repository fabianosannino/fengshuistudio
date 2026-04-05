-- =====================================================
-- BILLING IMPROVEMENTS — FengShui Studio
-- Fixes: unique constraint, idempotency indexes, schema gaps
-- =====================================================

-- 1. Prevent duplicate active subscriptions per user
-- A user should only have one non-cancelled subscription at a time
CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_user_active
  ON subscriptions (user_id)
  WHERE status IN ('active', 'past_due', 'trial', 'gratuidade');

-- 2. Index for idempotency checks on gateway IDs
CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_gateway_id
  ON subscriptions (gateway_subscription_id)
  WHERE gateway_subscription_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_gateway_id
  ON invoices (gateway_invoice_id)
  WHERE gateway_invoice_id IS NOT NULL;

-- 3. Add stripe_customer_id to profiles if not exists
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

CREATE INDEX IF NOT EXISTS idx_profiles_stripe_customer_id
  ON profiles (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

-- 4. Add stripe_account_id to profiles if not exists
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS stripe_account_id TEXT;

-- 5. Add missing columns to invoices for refund tracking
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS stripe_refund_id TEXT;

-- 6. Add index for payment notifications lookups
CREATE INDEX IF NOT EXISTS idx_payment_notifications_user_unread
  ON payment_notifications (user_id, read_at)
  WHERE read_at IS NULL;
