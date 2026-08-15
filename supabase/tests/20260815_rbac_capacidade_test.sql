-- ============================================================
-- Teste do RBAC por capacidade (20260815230000_rbac_por_capacidade.sql)
-- ============================================================
-- Roda num Postgres descartável, sem tocar em Supabase nenhum. Monta um
-- arremedo do ambiente (auth.uid(), auth.role(), profiles, is_admin()),
-- aplica a migration DE VERDADE via \i e exercita o que ela promete.
--
-- Como rodar (Postgres 16 local):
--
--   initdb -D /tmp/pgfs -U postgres --auth=trust
--   pg_ctl -D /tmp/pgfs -o "-p 5435 -k /tmp" start
--   psql -h /tmp -p 5435 -U postgres -v ON_ERROR_STOP=1 \
--        -f supabase/tests/20260815_rbac_capacidade_test.sql
--
-- Saída esperada: todos os blocos com `t`. Qualquer `f` é regressão.
-- ============================================================

\set ON_ERROR_STOP on

-- ------------------------------------------------------------
-- Arremedo do ambiente Supabase
-- ------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS auth;

-- No Supabase, as duas vêm do JWT. Aqui vêm de GUCs.
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('request.actor', true), '')::uuid;
$$;
CREATE OR REPLACE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('request.jwt_role', true), '');
$$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated; END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY, nome_completo text, role text DEFAULT 'user',
  plano text, stripe_customer_id text, stripe_account_id text);

-- `is_admin()` nasce em 20260316_fix_admin_rls_recursion.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $fn$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin');
$fn$;

CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id bigserial PRIMARY KEY, action text);
CREATE TABLE IF NOT EXISTS public.activation_keys (
  id bigserial PRIMARY KEY, code text);
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activation_keys ENABLE ROW LEVEL SECURITY;

GRANT USAGE ON SCHEMA public TO authenticated, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Personagens
INSERT INTO public.profiles (id, nome_completo, role) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Dona',     'admin'),
  ('22222222-2222-2222-2222-222222222222', 'Analista', 'admin'),
  ('33333333-3333-3333-3333-333333333333', 'Consultor','user')
ON CONFLICT DO NOTHING;

-- ------------------------------------------------------------
-- A migration de verdade
-- ------------------------------------------------------------
\i supabase/migrations/20260815230000_rbac_por_capacidade.sql

\echo ''
\echo '=== 1. Compatibilidade: admin existente manteve tudo ==='
SELECT
  (SELECT capacidades_admin = public.capacidades_conhecidas()
     FROM public.profiles WHERE nome_completo = 'Dona') AS dona_tem_tudo,
  (SELECT capacidades_admin = '{}'
     FROM public.profiles WHERE nome_completo = 'Consultor') AS consultor_sem_nada;

-- Reduz o Analista ao que ele precisa.
UPDATE public.profiles
   SET capacidades_admin = ARRAY['relatorios:ler','auditoria:ler']
 WHERE nome_completo = 'Analista';

\echo ''
\echo '=== 2. Ler relatório e promover admin deixaram de ser a mesma coisa ==='
SET request.actor = '22222222-2222-2222-2222-222222222222';
SELECT
  public.is_admin()                              AS eh_admin,
  public.tem_capacidade('relatorios:ler')        AS pode_relatorio,
  public.tem_capacidade('usuarios:promover')     AS pode_promover,
  public.tem_capacidade('chaves:gerar')          AS pode_gerar_chave;
-- Esperado: t | t | f | f
-- As duas últimas eram `t` antes desta migration.

\echo ''
\echo '=== 3. Nem o próprio admin se autoconcede capacidade ==='
-- Diferença deliberada em relação a `role` e `plano`: aquelas o trigger deixa
-- um admin mudar (`NOT public.is_admin()`). Se `capacidades_admin` tivesse a
-- mesma saída, o Analista se daria `usuarios:promover` num PATCH e a separação
-- inteira viraria decoração.
SET request.jwt_role = 'authenticated';
DO $$
BEGIN
  UPDATE public.profiles
     SET capacidades_admin = public.capacidades_conhecidas()
   WHERE id = '22222222-2222-2222-2222-222222222222';
  RAISE EXCEPTION 'FALHOU: admin se autoconcedeu capacidade';
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'ok: autoconcessão recusada (42501)';
END $$;

\echo ''
\echo '=== 4. service_role escreve (é por onde a rota concede) ==='
SET request.jwt_role = 'service_role';
UPDATE public.profiles
   SET capacidades_admin = ARRAY['relatorios:ler','auditoria:ler','chaves:ler']
 WHERE nome_completo = 'Analista';
SELECT array_length(capacidades_admin, 1) = 3 AS service_role_escreveu
  FROM public.profiles WHERE nome_completo = 'Analista';
RESET request.jwt_role;

\echo ''
\echo '=== 5. Quem não é admin não passa, mesmo com capacidade na coluna ==='
SET request.jwt_role = 'service_role';
UPDATE public.profiles
   SET capacidades_admin = public.capacidades_conhecidas()
 WHERE nome_completo = 'Consultor';
RESET request.jwt_role;

SET request.actor = '33333333-3333-3333-3333-333333333333';
SELECT
  public.is_admin()                          AS eh_admin,
  public.tem_capacidade('usuarios:promover') AS pode_promover,
  public.tem_capacidade('relatorios:ler')    AS pode_relatorio;
-- Esperado: f | f | f — tirar o papel basta para tirar tudo.

\echo ''
\echo '=== 6. A policy recusa a leitura da auditoria ==='
SET ROLE authenticated;
SET request.actor = '33333333-3333-3333-3333-333333333333';
SELECT count(*) = 0 AS auditoria_invisivel FROM public.admin_audit_log;
RESET ROLE;

\echo ''
\echo '=== 7. Capacidade inventada é recusada pelo CHECK ==='
SET request.jwt_role = 'service_role';
DO $$
BEGIN
  UPDATE public.profiles
     SET capacidades_admin = ARRAY['chaves:gerarr']  -- erro de digitação
   WHERE nome_completo = 'Analista';
  RAISE EXCEPTION 'FALHOU: aceitou capacidade desconhecida';
EXCEPTION
  WHEN check_violation THEN
    RAISE NOTICE 'ok: capacidade desconhecida recusada (23514)';
END $$;

\echo ''
\echo '=== 8. A migration é idempotente ==='
RESET request.jwt_role;
RESET request.actor;
\i supabase/migrations/20260815230000_rbac_por_capacidade.sql
SELECT array_length(capacidades_admin, 1) = 3 AS analista_continua_reduzido
  FROM public.profiles WHERE nome_completo = 'Analista';

\echo ''
\echo '=== FIM — nenhum `f` acima, nenhum FALHOU ==='
