-- Apply after the application moves administrative operations behind
-- exigirCapacidade + service_role. No customer rows are rewritten.
begin;

-- Keep profile creation in the trusted Auth trigger. A user may read and
-- edit their own ordinary fields, never delete/recreate their identity.
drop policy if exists usuario_gerencia_proprio_profile on public.profiles;
create policy profile_select_own on public.profiles for select to authenticated
  using (id = (select auth.uid()));
create policy profile_update_own on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
revoke all on public.profiles from anon, authenticated;
grant select, update on public.profiles to authenticated;

-- SECURITY INVOKER is intentional: current_user must be the caller, not the
-- owner of a SECURITY DEFINER trigger. Missing JWT claims grant nothing.
create or replace function public.protect_profile_privileged_columns()
returns trigger language plpgsql security invoker
set search_path = pg_catalog, public
as $$
declare
  editable_fields constant text[] := array[
    'nome_completo', 'telefone', 'cpf', 'avatar_url', 'nome_empresa', 'cnpj',
    'especialidade', 'bio', 'site', 'logo_url', 'cor_primaria', 'cor_secundaria',
    'cidade', 'estado', 'profissao', 'area_atuacao', 'registro_profissional',
    'linkedin', 'instagram', 'parceiro_visivel', 'tipo_usuario', 'store_slug',
    'ultimo_acesso', 'atualizado_em'
  ];
begin
  if current_user in ('postgres', 'supabase_admin', 'supabase_auth_admin', 'service_role') then
    return new;
  end if;
  if tg_op = 'INSERT' then
    raise exception 'Criação de perfil exige operação de sistema' using errcode = '42501';
  end if;
  -- Allowlist protects identity, billing, status, relationships and future
  -- privileged columns without silently forgetting them in the next migration.
  if (to_jsonb(new) - editable_fields) is distinct from (to_jsonb(old) - editable_fields) then
    raise exception 'Alteração de campo protegido do perfil não permitida' using errcode = '42501';
  end if;
  return new;
end;
$$;
drop trigger if exists trg_protect_profile_privileged_columns on public.profiles;
create trigger trg_protect_profile_privileged_columns before insert or update
  on public.profiles for each row execute function public.protect_profile_privileged_columns();
revoke all on function public.protect_profile_privileged_columns() from public, anon, authenticated;

-- Direct Data API reads need the same verified second factor as the server.
create or replace function public.tem_capacidade(capacidade text)
returns boolean language sql stable security definer
set search_path = pg_catalog, public
as $$
  select coalesce(auth.jwt()->>'aal' = 'aal2', false) and exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin' and p.status = 'ativo'
      and capacidade = any(p.capacidades_admin)
  );
$$;
revoke all on function public.tem_capacidade(text) from public, anon;
grant execute on function public.tem_capacidade(text) to authenticated, service_role;

-- Delete the broad policies: permissive policies combine with OR, so adding
-- a capability check alone would leave the old admin bypass intact.
drop policy if exists admin_gerencia_activation_keys on public.activation_keys;
drop policy if exists admin_gerencia_admin_audit_log on public.admin_audit_log;
drop policy if exists admin_gerencia_weekly_reports on public.weekly_reports;
drop policy if exists admin_gerencia_conteudo_admin on public.conteudo_admin;
drop policy if exists admin_le_audit_log on public.audit_log;

create policy admin_read_weekly_reports on public.weekly_reports for select to authenticated
  using (public.tem_capacidade('relatorios:ler'));
create policy admin_read_content on public.conteudo_admin for select to authenticated
  using (public.tem_capacidade('catalogo:escrever'));
create policy admin_read_audit on public.audit_log for select to authenticated
  using (public.tem_capacidade('auditoria:ler'));

-- Existing capability-based SELECT policies on keys/audit are retained.
-- Administrative writes now occur only through guarded server routes.
revoke all on public.activation_keys, public.admin_audit_log,
  public.weekly_reports, public.conteudo_admin, public.audit_log from anon, authenticated;
grant select on public.activation_keys, public.admin_audit_log,
  public.weekly_reports, public.conteudo_admin, public.audit_log to authenticated;

drop policy if exists "Admin atualiza subscriptions" on public.subscriptions;
drop policy if exists "Admin deleta subscriptions" on public.subscriptions;
drop policy if exists "Admin escreve subscriptions" on public.subscriptions;
drop policy if exists "Usuário lê próprias subscriptions" on public.subscriptions;
create policy subscriptions_select_own on public.subscriptions for select to authenticated
  using (user_id = (select auth.uid()));
drop policy if exists "Admin atualiza invoices" on public.invoices;
drop policy if exists "Admin deleta invoices" on public.invoices;
drop policy if exists "Admin escreve invoices" on public.invoices;
drop policy if exists "Usuário lê próprias invoices" on public.invoices;
create policy invoices_select_own on public.invoices for select to authenticated
  using (user_id = (select auth.uid()));
drop policy if exists "titular le as proprias concessoes" on public.concessoes_de_plano;
create policy grants_select_own on public.concessoes_de_plano for select to authenticated
  using (user_id = (select auth.uid()));
revoke all on public.subscriptions, public.invoices, public.concessoes_de_plano from anon, authenticated;
grant select on public.subscriptions, public.invoices, public.concessoes_de_plano to authenticated;

commit;
