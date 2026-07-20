-- ============================================================
-- RLS: tabelas de admin/sistema (fecha o último deny-all)
-- ============================================================
--
-- CONTEXTO
-- Últimas tabelas do incidente 2026-07-19 ainda com RLS ligado e SEM policy
-- (deny-all). Diferente do que eu supus a princípio, o painel admin lê/escreve
-- essas tabelas com o client AUTENTICADO (createRouteHandlerClient), não com
-- service_role — então o deny-all quebrava o painel admin:
--   • /api/admin/chaves     → activation_keys (listar/gerar/cancelar chaves)
--   • /api/admin/auditoria  → admin_audit_log (log de ações admin)
--   • /api/admin/relatorios → weekly_reports (relatórios semanais)
--
-- CORREÇÃO
-- Policies escopadas a admin (`public.is_admin()`), no mesmo padrão das tabelas
-- de billing (migration 20260718). Escritas por service_role (ex.: /api/planos,
-- /api/subscription/cancel) continuam funcionando — service_role ignora RLS.

-- activation_keys — admin gerencia (o resgate por usuário é via service_role)
drop policy if exists "admin_gerencia_activation_keys" on public.activation_keys;
create policy "admin_gerencia_activation_keys" on public.activation_keys
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- admin_audit_log — admin lê/insere (writes de service_role também bypassam)
drop policy if exists "admin_gerencia_admin_audit_log" on public.admin_audit_log;
create policy "admin_gerencia_admin_audit_log" on public.admin_audit_log
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- weekly_reports — admin gerencia
drop policy if exists "admin_gerencia_weekly_reports" on public.weekly_reports;
create policy "admin_gerencia_weekly_reports" on public.weekly_reports
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- conteudo_admin — admin gerencia. (Leitura por consultor conforme o plano
-- fica para quando a biblioteca de conteúdo for ligada na UI; hoje nenhuma
-- tela lê esta tabela.)
drop policy if exists "admin_gerencia_conteudo_admin" on public.conteudo_admin;
create policy "admin_gerencia_conteudo_admin" on public.conteudo_admin
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- audit_log — trilha genérica; leitura só admin. Escrita fica a cargo de
-- triggers/service_role (que bypassam o RLS).
drop policy if exists "admin_le_audit_log" on public.audit_log;
create policy "admin_le_audit_log" on public.audit_log
  for select to authenticated
  using (public.is_admin());
