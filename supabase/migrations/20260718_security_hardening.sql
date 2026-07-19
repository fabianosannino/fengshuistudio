-- ============================================================
-- SECURITY HARDENING — correções da auditoria de 2026-07-18
-- (docs/auditoria/2026-07-18-auditoria-arquitetura-seguranca.md)
--
-- Corrige:
--  C1  — auto-promoção a admin / burla de plano via UPDATE em profiles
--  C2  — tabela plans sem RLS
--  C3  — auto-assinatura em subscriptions/invoices; fee manipulável em store_orders
--  C4  — cleanup_old_audit_logs executável por qualquer usuário
--  A1  — SECURITY DEFINER sem search_path fixado
--  C8* — listagem de storage sem verificação de dono (leitura pública
--        permanece por ora; ver nota no fim do arquivo)
-- ============================================================

-- ------------------------------------------------------------
-- A1. Funções SECURITY DEFINER com search_path fixado
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE
   SET search_path = public, pg_catalog;

-- ------------------------------------------------------------
-- C4. Audit log: só admin pode executar a limpeza (e nunca via API)
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.cleanup_old_audit_logs()
RETURNS void AS $$
BEGIN
  DELETE FROM public.admin_audit_log
  WHERE performed_at < NOW() - INTERVAL '2 years';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
   SET search_path = public, pg_catalog;

REVOKE EXECUTE ON FUNCTION public.cleanup_old_audit_logs() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cleanup_old_audit_logs() FROM anon;
REVOKE EXECUTE ON FUNCTION public.cleanup_old_audit_logs() FROM authenticated;

-- ------------------------------------------------------------
-- C1. profiles: colunas privilegiadas só mudam via admin ou service_role.
-- RLS não restringe colunas, então usamos trigger. auth.role() é NULL em
-- conexões diretas (postgres/migrations) e 'service_role' nas rotas de
-- servidor confiáveis — ambos passam. Usuário comum (authenticated/anon)
-- não consegue alterar role/plano/stripe_* do próprio perfil.
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.protect_profile_privileged_columns()
RETURNS trigger AS $$
BEGIN
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
-- C2. plans: habilitar RLS (leitura pública, escrita só admin)
-- ------------------------------------------------------------

ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Todos leem planos" ON public.plans;
CREATE POLICY "Todos leem planos"
  ON public.plans FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Admin gerencia planos" ON public.plans;
CREATE POLICY "Admin gerencia planos"
  ON public.plans FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ------------------------------------------------------------
-- C3. Billing: usuário lê o que é seu; escrita só admin (as escritas
-- legítimas de sistema — webhooks — usam service_role, que ignora RLS).
-- ------------------------------------------------------------

-- subscriptions
DROP POLICY IF EXISTS "Admin gerencia subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "Usuário lê próprias subscriptions" ON public.subscriptions;
CREATE POLICY "Usuário lê próprias subscriptions"
  ON public.subscriptions FOR SELECT
  USING (public.is_admin() OR user_id = auth.uid());
DROP POLICY IF EXISTS "Admin escreve subscriptions" ON public.subscriptions;
CREATE POLICY "Admin escreve subscriptions"
  ON public.subscriptions FOR INSERT WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "Admin atualiza subscriptions" ON public.subscriptions;
CREATE POLICY "Admin atualiza subscriptions"
  ON public.subscriptions FOR UPDATE
  USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "Admin deleta subscriptions" ON public.subscriptions;
CREATE POLICY "Admin deleta subscriptions"
  ON public.subscriptions FOR DELETE USING (public.is_admin());

-- invoices
DROP POLICY IF EXISTS "Admin gerencia invoices" ON public.invoices;
DROP POLICY IF EXISTS "Usuário lê próprias invoices" ON public.invoices;
CREATE POLICY "Usuário lê próprias invoices"
  ON public.invoices FOR SELECT
  USING (public.is_admin() OR user_id = auth.uid());
DROP POLICY IF EXISTS "Admin escreve invoices" ON public.invoices;
CREATE POLICY "Admin escreve invoices"
  ON public.invoices FOR INSERT WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "Admin atualiza invoices" ON public.invoices;
CREATE POLICY "Admin atualiza invoices"
  ON public.invoices FOR UPDATE
  USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "Admin deleta invoices" ON public.invoices;
CREATE POLICY "Admin deleta invoices"
  ON public.invoices FOR DELETE USING (public.is_admin());

-- payment_notifications: usuário lê e marca como lida as próprias;
-- criação/remoção só admin/sistema.
DROP POLICY IF EXISTS "Admin gerencia payment_notifications" ON public.payment_notifications;
DROP POLICY IF EXISTS "Usuário lê próprias notificações" ON public.payment_notifications;
CREATE POLICY "Usuário lê próprias notificações"
  ON public.payment_notifications FOR SELECT
  USING (public.is_admin() OR user_id = auth.uid());
DROP POLICY IF EXISTS "Usuário atualiza próprias notificações" ON public.payment_notifications;
CREATE POLICY "Usuário atualiza próprias notificações"
  ON public.payment_notifications FOR UPDATE
  USING (public.is_admin() OR user_id = auth.uid())
  WITH CHECK (public.is_admin() OR user_id = auth.uid());
DROP POLICY IF EXISTS "Admin cria payment_notifications" ON public.payment_notifications;
CREATE POLICY "Admin cria payment_notifications"
  ON public.payment_notifications FOR INSERT WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "Admin deleta payment_notifications" ON public.payment_notifications;
CREATE POLICY "Admin deleta payment_notifications"
  ON public.payment_notifications FOR DELETE USING (public.is_admin());

-- store_orders: vendedor lê os próprios pedidos; escrita só admin/sistema
-- (impede o vendedor de editar amount/platform_fee).
DROP POLICY IF EXISTS "Vendedor gerencia próprios pedidos" ON public.store_orders;
DROP POLICY IF EXISTS "Vendedor vê próprios pedidos" ON public.store_orders;
CREATE POLICY "Vendedor vê próprios pedidos"
  ON public.store_orders FOR SELECT
  USING (public.is_admin() OR seller_id = auth.uid());
DROP POLICY IF EXISTS "Admin escreve store_orders" ON public.store_orders;
CREATE POLICY "Admin escreve store_orders"
  ON public.store_orders FOR INSERT WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "Admin atualiza store_orders" ON public.store_orders;
CREATE POLICY "Admin atualiza store_orders"
  ON public.store_orders FOR UPDATE
  USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "Admin deleta store_orders" ON public.store_orders;
CREATE POLICY "Admin deleta store_orders"
  ON public.store_orders FOR DELETE USING (public.is_admin());

-- ------------------------------------------------------------
-- C8 (parcial). Storage: listagem restrita ao dono da consulta.
-- A policy antiga permitia a qualquer autenticado listar TODOS os
-- arquivos do bucket.
-- ------------------------------------------------------------

DROP POLICY IF EXISTS "Consultores listam arquivos nas próprias consultas" ON storage.objects;
CREATE POLICY "Consultores listam arquivos nas próprias consultas"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'imoveis-fotos'
    AND auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.consultas
      WHERE consultas.id::text = (storage.foldername(name))[1]
        AND consultas.consultor_id = auth.uid()
    )
  );

-- NOTA (follow-up planejado, não coberto por esta migration):
-- os buckets 'imoveis-fotos' e 'clientes-fotos' continuam com leitura
-- pública porque as URLs públicas estão persistidas em consultas/clientes
-- e renderizadas em ~15 pontos da UI (incl. geração de PDF). A migração
-- para buckets privados + URLs assinadas exige alteração coordenada de
-- app + dados e será feita em PR próprio.
