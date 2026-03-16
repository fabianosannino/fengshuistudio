-- Migration: Admin area — activation_keys + admin_audit_log tables
-- Run this in Supabase SQL Editor.

-- 1. Ensure 'role' column exists on profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user';

-- 2. Activation keys table
CREATE TABLE IF NOT EXISTS activation_keys (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  key           TEXT NOT NULL UNIQUE,
  plan_type     TEXT NOT NULL DEFAULT 'pro',
  status        TEXT NOT NULL DEFAULT 'available',
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at    TIMESTAMP WITH TIME ZONE,
  used_at       TIMESTAMP WITH TIME ZONE,
  used_by       UUID REFERENCES profiles(id),
  note          TEXT,
  created_by    UUID REFERENCES profiles(id)
);

ALTER TABLE activation_keys ENABLE ROW LEVEL SECURITY;

-- Drop policy if it already exists (idempotent)
DROP POLICY IF EXISTS "Somente admin acessa chaves" ON activation_keys;

CREATE POLICY "Somente admin acessa chaves"
ON activation_keys
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- 3. Admin audit log table
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  action        TEXT NOT NULL,
  target_type   TEXT,
  target_id     TEXT,
  details       JSONB,
  performed_by  UUID REFERENCES profiles(id),
  performed_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Somente admin acessa audit log" ON admin_audit_log;

CREATE POLICY "Somente admin acessa audit log"
ON admin_audit_log
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- 4. Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
