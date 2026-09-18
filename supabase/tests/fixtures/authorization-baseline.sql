-- Disposable, synthetic fixture for the production authorization composition
-- inspected on 2026-09-17. This is NOT a production migration/full backup.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create role authenticator login password 'local-test-only' noinherit;
grant anon, authenticated, service_role to authenticator;
create schema auth;
grant usage on schema public, auth to anon, authenticated, service_role;
create function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb;
$$;
create function auth.uid() returns uuid language sql stable as $$ select (auth.jwt()->>'sub')::uuid $$;
create function auth.role() returns text language sql stable as $$ select auth.jwt()->>'role' $$;
create type public.user_role as enum ('cliente','consultor','admin');
create type public.account_status as enum ('ativo','inativo','suspenso');
create type public.plano_tipo as enum ('freemium','starter','pro','agencia');
create table auth.users(id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
create table public.profiles (
  id uuid primary key references auth.users(id), nome_completo text not null,
  role user_role not null, status account_status not null, plano plano_tipo not null,
  capacidades_admin text[] not null default '{}', loja_ativa boolean not null default false,
  stripe_customer_id text, stripe_account_id text, codigo_de_afiliado text,
  consultor_id uuid, trial_inicio timestamptz, trial_fim timestamptz,
  plano_inicio timestamptz, plano_fim timestamptz, criado_em timestamptz default now(),
  atualizado_em timestamptz default now(), tipo_usuario text, profissao text,
  area_atuacao text, registro_profissional text, linkedin text, instagram text,
  nome_empresa text, bio text, especialidade text, cidade text, estado text,
  site text, avatar_url text, logo_url text, cor_primaria text, cor_secundaria text,
  store_slug text, parceiro_visivel boolean not null default false
);
create function public.is_admin() returns boolean language sql stable security definer
  set search_path=pg_catalog,public as $$
  select exists(select 1 from public.profiles where id=auth.uid() and role='admin');
$$;
create function public.tem_capacidade(capacidade text) returns boolean language sql stable security definer
  set search_path=pg_catalog,public as $$
  select exists(select 1 from public.profiles where id=auth.uid() and role='admin' and capacidade=any(capacidades_admin));
$$;
create table public.activation_keys(id uuid primary key default gen_random_uuid(), code text);
create table public.admin_audit_log(id uuid primary key default gen_random_uuid(), action text);
create table public.weekly_reports(id uuid primary key default gen_random_uuid());
create table public.conteudo_admin(id uuid primary key default gen_random_uuid());
create table public.audit_log(id uuid primary key default gen_random_uuid());
create table public.subscriptions(id uuid primary key default gen_random_uuid(), user_id uuid);
create table public.invoices(id uuid primary key default gen_random_uuid(), user_id uuid);
create table public.concessoes_de_plano(id uuid primary key default gen_random_uuid(), user_id uuid);
do $$ declare tab text; begin
  foreach tab in array array['profiles','activation_keys','admin_audit_log','weekly_reports','conteudo_admin','audit_log','subscriptions','invoices','concessoes_de_plano'] loop
    execute format('alter table public.%I enable row level security',tab);
    execute format('grant all on public.%I to anon, authenticated, service_role',tab);
  end loop;
end $$;
create policy usuario_gerencia_proprio_profile on public.profiles for all to authenticated
  using(id=auth.uid() or public.is_admin()) with check(id=auth.uid() or public.is_admin());
create policy admin_gerencia_activation_keys on public.activation_keys for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy "Admin lê chaves" on public.activation_keys for select to authenticated using(public.tem_capacidade('chaves:ler'));
create policy admin_gerencia_admin_audit_log on public.admin_audit_log for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy "Admin lê auditoria" on public.admin_audit_log for select to authenticated using(public.tem_capacidade('auditoria:ler'));
create policy admin_gerencia_weekly_reports on public.weekly_reports for all to authenticated using(public.is_admin());
create policy admin_gerencia_conteudo_admin on public.conteudo_admin for all to authenticated using(public.is_admin());
create policy admin_le_audit_log on public.audit_log for select to authenticated using(public.is_admin());
do $$ declare tab text; begin
  foreach tab in array array['subscriptions','invoices'] loop
    execute format('create policy %I on public.%I for select to authenticated using(user_id=auth.uid() or public.is_admin())','Usuário lê próprias '||tab,tab);
    execute format('create policy %I on public.%I for insert to authenticated with check(public.is_admin())','Admin escreve '||tab,tab);
    execute format('create policy %I on public.%I for update to authenticated using(public.is_admin())','Admin atualiza '||tab,tab);
    execute format('create policy %I on public.%I for delete to authenticated using(public.is_admin())','Admin deleta '||tab,tab);
  end loop;
end $$;
create policy "titular le as proprias concessoes" on public.concessoes_de_plano for select to authenticated using(user_id=auth.uid() or public.is_admin());
create function public.protect_profile_privileged_columns() returns trigger language plpgsql security definer
  set search_path=pg_catalog,public as $$ begin
  if (new.role is distinct from old.role or new.plano is distinct from old.plano
      or new.stripe_customer_id is distinct from old.stripe_customer_id or new.stripe_account_id is distinct from old.stripe_account_id)
      and coalesce(auth.role(),'service_role') <> 'service_role' and not public.is_admin() then
    raise insufficient_privilege;
  end if;
  if (new.capacidades_admin is distinct from old.capacidades_admin or new.codigo_de_afiliado is distinct from old.codigo_de_afiliado)
      and coalesce(auth.role(),'service_role') <> 'service_role' then raise insufficient_privilege; end if;
  return new;
end $$;
create trigger trg_protect_profile_privileged_columns before update on public.profiles
  for each row execute function public.protect_profile_privileged_columns();
