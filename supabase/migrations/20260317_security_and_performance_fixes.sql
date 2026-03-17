-- ============================================================
-- MIGRAÇÃO: Correções de segurança e performance
-- FengShui Studio
-- Data: 2026-03-17
--
-- Correções:
--   1. Atualizar policies do admin_audit_log para usar is_admin()
--   5. Adicionar indexes em colunas de FK frequentemente consultadas
--   7. Função de retenção de audit log (limpeza de registros antigos)
--  10. Verificar constraint UNIQUE em activation_keys.key (já existe)
--
-- Esta migração é IDEMPOTENTE — segura para rodar múltiplas vezes.
-- ============================================================


-- ════════════════════════════════════════════════════════════════
-- FIX 1: Atualizar policies do admin_audit_log e activation_keys
--         para usar a função is_admin() (SECURITY DEFINER)
--         evitando recursão infinita nas policies de profiles
-- ════════════════════════════════════════════════════════════════

-- Garantir que a função is_admin() existe
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Atualizar policy do admin_audit_log
DROP POLICY IF EXISTS "Somente admin acessa audit log" ON admin_audit_log;
CREATE POLICY "Somente admin acessa audit log"
ON admin_audit_log
FOR ALL
USING (public.is_admin());

-- Atualizar policy do activation_keys
DROP POLICY IF EXISTS "Somente admin acessa chaves" ON activation_keys;
CREATE POLICY "Somente admin acessa chaves"
ON activation_keys
FOR ALL
USING (public.is_admin());


-- ════════════════════════════════════════════════════════════════
-- FIX 5: Indexes em colunas de FK frequentemente consultadas
-- ════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_clientes_consultor_id
  ON clientes (consultor_id);

CREATE INDEX IF NOT EXISTS idx_consultas_consultor_id
  ON consultas (consultor_id);

CREATE INDEX IF NOT EXISTS idx_pagamentos_consultor_id
  ON pagamentos (consultor_id);

CREATE INDEX IF NOT EXISTS idx_setores_bagua_consulta_id
  ON setores_bagua (consulta_id);

CREATE INDEX IF NOT EXISTS idx_diagnostico_criterios_setor_id
  ON diagnostico_criterios (setor_id);

CREATE INDEX IF NOT EXISTS idx_rituais_consultor_id
  ON rituais (consultor_id);

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_performed_at
  ON admin_audit_log (performed_at);

CREATE INDEX IF NOT EXISTS idx_activation_keys_status
  ON activation_keys (status);


-- ════════════════════════════════════════════════════════════════
-- FIX 7: Função para limpeza de audit log antigo (retenção 12 meses)
--         Pode ser chamada via cron do Supabase ou manualmente
-- ════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.cleanup_old_audit_logs(retention_months INT DEFAULT 12)
RETURNS INT AS $$
DECLARE
  deleted_count INT;
BEGIN
  DELETE FROM admin_audit_log
  WHERE performed_at < NOW() - (retention_months || ' months')::INTERVAL;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ════════════════════════════════════════════════════════════════
-- NOTA FIX 10: activation_keys.key já possui constraint UNIQUE
--   definida na migração 20260316_admin_activation_keys.sql:
--   "key TEXT NOT NULL UNIQUE"
--   Nenhuma ação necessária.
-- ════════════════════════════════════════════════════════════════


-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
