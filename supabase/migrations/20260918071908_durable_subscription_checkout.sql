-- One durable, frozen checkout intent per owner; no provider request before it.
create table public.checkouts_assinatura (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete restrict,
  plano text not null check(plano in ('simples','profissional')),
  ciclo text not null check(ciclo in ('monthly','yearly')),
  preco_id text not null check(preco_id ~ '^price_[a-zA-Z0-9]+$'),
  live boolean not null,
  origem text not null check(length(origem) between 8 and 256),
  customer_anterior text,
  customer_id text,
  session_id text unique,
  customer_criacao_em timestamptz,
  session_criacao_em timestamptz,
  criada_em timestamptz not null default clock_timestamp(),
  finalizada_em timestamptz,
  check(customer_id is null or customer_id ~ '^cus_[a-zA-Z0-9]+$'),
  check(session_id is null or session_criacao_em is not null),
  check(session_id is null or (customer_id is not null and session_id ~ '^cs_[a-zA-Z0-9_]+$'))
);
create unique index checkout_assinatura_aberto_por_titular on public.checkouts_assinatura(user_id) where finalizada_em is null;
alter table public.checkouts_assinatura enable row level security;
revoke all on public.checkouts_assinatura from public,anon,authenticated;
grant select,insert,update,delete on public.checkouts_assinatura to service_role;

create function public.reservar_checkout_assinatura(p_usuario uuid,p_plano text,p_ciclo text,p_preco text,p_live boolean,p_origem text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare perfil public.profiles; tentativa public.checkouts_assinatura;
begin
  select * into perfil from public.profiles where id=p_usuario for update;
  if not found then raise exception 'perfil_indisponivel'; end if;
  if exists(select 1 from public.exclusoes_de_conta where user_id=p_usuario) then raise exception 'conta_em_exclusao'; end if;
  if p_plano is null or p_plano not in ('simples','profissional') or p_ciclo is null or p_ciclo not in ('monthly','yearly')
    or p_preco is null or p_preco !~ '^price_[a-zA-Z0-9]+$' or p_live is null or p_origem is null
    or p_origem !~ '^https?://[^/?#[:space:]]+$' or length(p_origem)>256 then raise exception 'checkout_invalido'; end if;
  select * into tentativa from public.checkouts_assinatura where user_id=p_usuario and finalizada_em is null;
  if not found then
    insert into public.checkouts_assinatura(user_id,plano,ciclo,preco_id,live,origem,customer_anterior)
      values(p_usuario,p_plano,p_ciclo,p_preco,p_live,p_origem,perfil.stripe_customer_id) returning * into tentativa;
  end if;
  return to_jsonb(tentativa);
end;
$$;
revoke all on function public.reservar_checkout_assinatura(uuid,text,text,text,boolean,text) from public,anon,authenticated;
grant execute on function public.reservar_checkout_assinatura(uuid,text,text,text,boolean,text) to service_role;

-- The retry window starts before the FIRST external mutation in each phase,
-- not when a read-only visit discovered an already active subscription.
create function public.autorizar_criacao_checkout(p_usuario uuid,p_tentativa uuid,p_etapa text)
returns timestamptz language plpgsql security invoker set search_path = '' as $$
declare perfil public.profiles; tentativa public.checkouts_assinatura; inicio timestamptz; agora timestamptz;
begin
  select * into perfil from public.profiles where id=p_usuario for update;
  if not found then raise exception 'perfil_indisponivel'; end if;
  if exists(select 1 from public.exclusoes_de_conta where user_id=p_usuario) then raise exception 'conta_em_exclusao'; end if;
  select * into tentativa from public.checkouts_assinatura where id=p_tentativa and user_id=p_usuario and finalizada_em is null;
  if not found then raise exception 'checkout_indisponivel'; end if;
  if perfil.stripe_customer_id is distinct from coalesce(tentativa.customer_id,tentativa.customer_anterior) then
    raise exception 'customer_alterado'; end if;
  agora := clock_timestamp();
  if p_etapa='customer' then
    if tentativa.customer_id is not null and tentativa.customer_criacao_em is null then raise exception 'customer_ja_vinculado'; end if;
    inicio := coalesce(tentativa.customer_criacao_em,agora);
    update public.checkouts_assinatura set customer_criacao_em=inicio where id=p_tentativa;
  elsif p_etapa='session' and tentativa.customer_id is not null then
    inicio := coalesce(tentativa.session_criacao_em,agora);
    update public.checkouts_assinatura set session_criacao_em=inicio where id=p_tentativa;
  else raise exception 'etapa_invalida'; end if;
  if inicio<=agora-interval '23 hours' then raise exception 'checkout_requer_reconciliacao'; end if;
  return inicio;
end;
$$;
revoke all on function public.autorizar_criacao_checkout(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.autorizar_criacao_checkout(uuid,uuid,text) to service_role;

-- Binding is monotonic. Stale workers cannot replace a newer attempt/customer.
create function public.registrar_checkout_assinatura(p_usuario uuid,p_tentativa uuid,p_customer text,p_session text default null)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare perfil public.profiles; tentativa public.checkouts_assinatura;
begin
  select * into perfil from public.profiles where id=p_usuario for update;
  if not found then return false; end if;
  if exists(select 1 from public.exclusoes_de_conta where user_id=p_usuario) then return false; end if;
  select * into tentativa from public.checkouts_assinatura where id=p_tentativa and user_id=p_usuario and finalizada_em is null;
  if not found then return false; end if;
  if p_customer is null or p_customer !~ '^cus_[a-zA-Z0-9]+$' or (p_session is not null and p_session !~ '^cs_[a-zA-Z0-9_]+$')
    then raise exception 'checkout_invalido'; end if;
  if (tentativa.customer_id is not null and tentativa.customer_id<>p_customer)
    or (tentativa.session_id is not null and tentativa.session_id is distinct from p_session)
    or (perfil.stripe_customer_id is distinct from tentativa.customer_anterior and perfil.stripe_customer_id is distinct from p_customer)
    then return false; end if;
  update public.profiles set stripe_customer_id=p_customer where id=p_usuario;
  update public.checkouts_assinatura set customer_id=p_customer,session_id=coalesce(session_id,p_session) where id=p_tentativa;
  return true;
end;
$$;
revoke all on function public.registrar_checkout_assinatura(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.registrar_checkout_assinatura(uuid,uuid,text,text) to service_role;

-- Caller must confirm expiration (or a terminal subscription) at Stripe first.
create function public.encerrar_checkout_assinatura(p_usuario uuid,p_tentativa uuid,p_session text)
returns boolean language plpgsql security invoker set search_path = '' as $$
begin
  perform 1 from public.profiles where id=p_usuario for update;
  if not found then return false; end if;
  update public.checkouts_assinatura set finalizada_em=clock_timestamp()
    where user_id=p_usuario and id=p_tentativa and finalizada_em is null
      and (session_id=p_session or (p_session is null and session_criacao_em is null and customer_id is not null));
  return found;
end;
$$;
revoke all on function public.encerrar_checkout_assinatura(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.encerrar_checkout_assinatura(uuid,uuid,text) to service_role;

-- Unknown external effects block deletion before it removes any data.
create or replace function public.iniciar_exclusao_do_titular(p_user_id uuid)
returns text language plpgsql security invoker set search_path = '' as $$
declare perfil public.profiles;
begin
  select * into perfil from public.profiles where id=p_user_id for update;
  if not found then raise exception 'perfil_indisponivel'; end if;
  if perfil.stripe_customer_id is not null or perfil.stripe_account_id is not null
    or exists(select 1 from public.checkouts_assinatura where user_id=p_user_id) then return 'cobranca'; end if;
  if exists(select 1 from public.produtos where vendedor_perfil_id=p_user_id) then return 'produtos'; end if;
  if exists(select 1 from public.clientes where titular_id=p_user_id and consultor_id is distinct from p_user_id) then return 'vinculos'; end if;
  insert into public.exclusoes_de_conta(user_id) values(p_user_id) on conflict do nothing;
  return 'pronto';
end;
$$;
revoke all on function public.iniciar_exclusao_do_titular(uuid) from public,anon,authenticated;
grant execute on function public.iniciar_exclusao_do_titular(uuid) to service_role;
