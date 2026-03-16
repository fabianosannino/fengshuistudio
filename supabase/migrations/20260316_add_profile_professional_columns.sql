-- Migration: Add professional profile columns to profiles table
-- These columns are used by the professional profile section (Perfil page)
-- Run this in Supabase SQL Editor if the columns don't exist yet.

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS profissao TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS area_atuacao TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS registro_profissional TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS linkedin TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS instagram TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS parceiro_visivel BOOLEAN DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS site TEXT;

-- Refresh PostgREST schema cache so new columns are recognized immediately
NOTIFY pgrst, 'reload schema';
