-- ============================================================
-- RBAC por capacidade no painel admin
-- ============================================================
-- `profiles.role = 'admin'` é um booleano disfarçado: quem entra no
-- painel pode tudo. Tudo inclui `promover`, que fabrica outro
-- administrador, e `chaves`, que fabrica plano pago.
--
-- Ler o relatório semanal e promover alguém a admin eram, até aqui,
-- a mesma permissão. Não são graus da mesma coisa — são eixos
-- diferentes, e colá-los num só produz autorização por acidente. É
-- a mesma separação que o ADR 0024 já faz entre papel e plano.
--
-- ── A decisão ───────────────────────────────────────────────
-- `role = 'admin'` continua sendo "abre o painel".
-- `capacidades_admin` diz o que se faz lá dentro.
--
-- ── Compatibilidade ─────────────────────────────────────────
-- Todo admin existente recebe TODAS as capacidades. Ninguém perde
-- acesso ao aplicar. Reduzir é decisão de operação, feita depois —
-- esta migration não sabe quem é quem.
--
-- ── Como testar ─────────────────────────────────────────────
--   supabase/tests/20260815_rbac_capacidade_test.sql
--
-- ── ROLLBACK (documentado — NÃO aplicar salvo emergência) ────
--   -- 1. Nas rotas, `exigirCapacidade` volta a `exigirAdmin`.
--   -- 2. DROP FUNCTION public.tem_capacidade(text);
--   -- 3. ALTER TABLE public.profiles DROP COLUMN IF EXISTS capacidades_admin;
--   -- 4. Recriar protect_profile_privileged_columns sem a coluna nova.
--   Atenção: o rollback devolve o poder total a todo admin.
-- ============================================================

-- ------------------------------------------------------------
-- 1) A lista fechada
-- ------------------------------------------------------------
-- Mora numa função para não ficar copiada entre o CHECK, as policies e
-- o app. Precisa concordar com `src/lib/capacidades-admin.ts`.
CREATE OR REPLACE FUNCTION public.capacidades_conhecidas()
RETURNS text[]
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_catalog
AS $$
  SELECT ARRAY[
    'chaves:ler',
    'chaves:gerar',              -- gera plano pago
    'chaves:cancelar',
    'catalogo:escrever',
    'usuarios:promover',         -- fabrica outro admin: a mais grave da lista
    'assinaturas:escrever',      -- cancela assinatura, concede gratuidade
    'relatorios:ler',
    'reconciliacao:executar',
    'auditoria:ler'
  ]::text[];
$$;

-- ------------------------------------------------------------
-- 2) A coluna
-- ------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS capacidades_admin text[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.profiles.capacidades_admin IS
  'O que este admin pode fazer. `role` diz se ENTRA no painel; esta coluna '
  'diz o que FAZ. Coluna privilegiada: nem o próprio admin a altera — só '
  'service_role. Ver trg_protect_profile_privileged_columns.';

-- Recusa capacidade inventada. Sem isto, um erro de digitação vira uma
-- capacidade que ninguém tem e uma tela que ninguém abre — e o sintoma
-- aparece longe da causa.
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_capacidades_admin_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_capacidades_admin_check
  CHECK (capacidades_admin <@ public.capacidades_conhecidas());

-- ------------------------------------------------------------
-- 3) Compatibilidade: admin de hoje mantém tudo
-- ------------------------------------------------------------
UPDATE public.profiles
   SET capacidades_admin = public.capacidades_conhecidas()
 WHERE role = 'admin'
   AND capacidades_admin = '{}';

-- ------------------------------------------------------------
-- 4) A coluna é privilegiada — e MAIS fechada que as outras
-- ------------------------------------------------------------
-- O trigger existente (20260718_security_hardening) deixa passar quando
-- `public.is_admin()`: um admin PODE mudar `role` e `plano` direto.
--
-- Para `capacidades_admin` isso seria um furo que anula a mudança inteira.
-- Um admin com apenas `relatorios:ler` faria um PATCH em si mesmo, se
-- concederia `usuarios:promover` e a separação viraria decoração.
--
-- Então a coluna nova NÃO tem a saída por `is_admin()`. Só service_role
-- escreve — o que significa: conceder capacidade passa pela rota de
-- servidor, com auditoria, e não pelo PostgREST.
CREATE OR REPLACE FUNCTION public.protect_profile_privileged_columns()
RETURNS trigger AS $$
BEGIN
  -- Colunas privilegiadas "clássicas": admin ou service_role passam.
  IF (
       NEW.role               IS DISTINCT FROM OLD.role
    OR NEW.plano              IS DISTINCT FROM OLD.plano
    OR NEW.stripe_customer_id IS DISTINCT FROM OLD.stripe_customer_id
    OR NEW.stripe_account_id  IS DISTINCT FROM OLD.stripe_account_id
  )
  AND COALESCE(auth.role(), 'service_role') NOT IN ('service_role')
  AND NOT public.is_admin()
  THEN
    RAISE EXCEPTION 'Alteração de coluna privilegiada de profiles não permitida'
      USING ERRCODE = '42501';
  END IF;

  -- `capacidades_admin`: SÓ service_role. Sem a saída por is_admin(),
  -- senão qualquer admin se autoconcederia o que lhe faltasse.
  IF NEW.capacidades_admin IS DISTINCT FROM OLD.capacidades_admin
     AND COALESCE(auth.role(), 'service_role') NOT IN ('service_role')
  THEN
    RAISE EXCEPTION 'capacidades_admin só pode ser alterado via service_role'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
   SET search_path = public, pg_catalog;

DROP TRIGGER IF EXISTS trg_protect_profile_privileged_columns ON public.profiles;
CREATE TRIGGER trg_protect_profile_privileged_columns
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_privileged_columns();

-- ------------------------------------------------------------
-- 5) O predicado, para policies e para consulta
-- ------------------------------------------------------------
-- SECURITY DEFINER pelo mesmo motivo de `is_admin()`: escapar do RLS de
-- profiles e evitar a recursão corrigida em 20260316_fix_admin_rls_recursion.
CREATE OR REPLACE FUNCTION public.tem_capacidade(capacidade text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT COALESCE(
    (SELECT p.role = 'admin' AND capacidade = ANY(p.capacidades_admin)
       FROM public.profiles p
      WHERE p.id = auth.uid()),
    false
  );
$$;

COMMENT ON FUNCTION public.tem_capacidade(text) IS
  'true se o chamador é admin E tem a capacidade. Exige as duas: tirar o '
  'papel de admin deve bastar para tirar todo o acesso.';

REVOKE ALL ON FUNCTION public.tem_capacidade(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tem_capacidade(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.capacidades_conhecidas() TO authenticated;

-- ------------------------------------------------------------
-- 6) Policies de dado sensível
-- ------------------------------------------------------------
-- A autorização das rotas é feita no servidor por `exigirCapacidade`. O RLS
-- aqui é a segunda barreira, para as tabelas que o cliente alcança direto.
DO $$
BEGIN
  IF to_regclass('public.admin_audit_log') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Admin lê auditoria" ON public.admin_audit_log;
    CREATE POLICY "Admin lê auditoria" ON public.admin_audit_log
      FOR SELECT TO authenticated
      USING (public.tem_capacidade('auditoria:ler'));
  END IF;

  IF to_regclass('public.activation_keys') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Admin lê chaves" ON public.activation_keys;
    CREATE POLICY "Admin lê chaves" ON public.activation_keys
      FOR SELECT TO authenticated
      USING (public.tem_capacidade('chaves:ler'));
  END IF;
END $$;
