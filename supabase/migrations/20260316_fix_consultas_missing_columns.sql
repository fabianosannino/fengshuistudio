-- ============================================================
-- FIX: Add ALL missing columns to consultas table
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor > New query)
-- This is safe to run multiple times (uses IF NOT EXISTS)
-- ============================================================

-- 1. Bagua analysis columns
ALTER TABLE consultas ADD COLUMN IF NOT EXISTS bagua_entrada JSONB;
ALTER TABLE consultas ADD COLUMN IF NOT EXISTS bagua_imagem TEXT;

-- 2. Roda da Vida
ALTER TABLE consultas ADD COLUMN IF NOT EXISTS roda_da_vida JSONB;

-- 3. Fluxo de Chi
ALTER TABLE consultas ADD COLUMN IF NOT EXISTS checklist_chi JSONB;
ALTER TABLE consultas ADD COLUMN IF NOT EXISTS posicao_comando TEXT;

-- 4. Fotos do imóvel
ALTER TABLE consultas ADD COLUMN IF NOT EXISTS foto_geral_url TEXT;
ALTER TABLE consultas ADD COLUMN IF NOT EXISTS fotos_comodos JSONB;

-- 5. Finalização
ALTER TABLE consultas ADD COLUMN IF NOT EXISTS finalizada_em TIMESTAMPTZ;

-- 6. Refresh PostgREST schema cache so new columns are recognized immediately
NOTIFY pgrst, 'reload schema';
