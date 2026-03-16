-- ============================================================
-- FIX: Add ALL missing columns to profiles table
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor > New query)
-- This is safe to run multiple times (uses IF NOT EXISTS)
-- ============================================================

-- 1. Core columns used by isProfessional logic
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS tipo_usuario TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS plano TEXT DEFAULT 'free';

-- 2. Professional profile columns (Perfil page)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS profissao TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS area_atuacao TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS registro_profissional TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS linkedin TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS instagram TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS site TEXT;

-- 3. Parceiros visibility
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS parceiro_visivel BOOLEAN DEFAULT FALSE;

-- 4. Refresh PostgREST schema cache so new columns are recognized immediately
NOTIFY pgrst, 'reload schema';
