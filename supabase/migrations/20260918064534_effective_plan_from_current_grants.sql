-- Preserve only a documented legacy courtesy, never invent paid entitlements
-- from the cached profile alone. No subscription/customer is created or changed.
begin;
insert into public.concessoes_de_plano(user_id,plano,origem,referencia,valido_de,valido_ate,motivo)
select s.user_id,p.slug,'migracao','gratuidade-legada:'||s.id::text,
  coalesce(s.current_period_start,s.started_at,s.created_at),s.current_period_end,
  'Gratuidade legada preservada; origem em subscriptions e justificativa administrativa existente.'
from public.subscriptions s join public.plans p on p.id=s.plan_id
where s.status='gratuidade' and s.price_paid=0 and s.gateway_subscription_id is null
  and s.activated_by_key is null and nullif(btrim(s.gratuidade_motivo),'') is not null
  and s.cancelled_at is null and not coalesce(s.cancel_at_period_end,false)
  and p.slug in ('simples','profissional')
  and (s.current_period_end is null or s.current_period_end>clock_timestamp())
  and not exists(select 1 from public.concessoes_de_plano c where c.user_id=s.user_id)
on conflict(origem,referencia) do nothing;

-- Unknown paid profiles are an investigation, not an automatic downgrade.
do $$ begin
  if exists(select 1 from public.profiles p where p.plano::text<>'freemium'
    and not exists(select 1 from public.concessoes_de_plano c where c.user_id=p.id)) then
    raise exception 'perfil_pago_sem_origem_verificavel';
  end if;
end $$;

create function app_private.plano_vigente(proprietario uuid, instante timestamptz)
returns text language sql stable security invoker set search_path='' as $$
  select coalesce((select c.plano from public.concessoes_de_plano c
    where c.user_id=proprietario and c.encerrada_em is null and c.valido_de<=instante
      and (c.valido_ate is null or c.valido_ate>instante)
    order by case c.plano when 'profissional' then 2 when 'simples' then 1 else 0 end desc limit 1),'free');
$$;
revoke all on function app_private.plano_vigente(uuid,timestamptz) from public,anon,authenticated;
grant usage on schema app_private to service_role;
grant execute on function app_private.plano_vigente(uuid,timestamptz) to service_role;

-- No owner/time parameter can be supplied by the caller. Private definer;
-- public wrapper is invoker. This reads entitlements, it cannot grant them.
create function app_private.obter_meu_plano()
returns text language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null then raise exception using errcode='42501',message='nao_autenticado'; end if;
  return app_private.plano_vigente(auth.uid(),clock_timestamp());
end;
$$;
revoke all on function app_private.obter_meu_plano() from public,anon;
grant execute on function app_private.obter_meu_plano() to authenticated;
create function public.obter_meu_plano()
returns text language sql security invoker set search_path='' as $$ select app_private.obter_meu_plano(); $$;
revoke all on function public.obter_meu_plano() from public,anon;
grant execute on function public.obter_meu_plano() to authenticated;

create or replace function public.recalcular_plano_do_perfil(p_usuario uuid)
returns text language plpgsql security invoker set search_path='' as $$
declare efetivo text;
begin
  perform 1 from public.profiles where id=p_usuario for update;
  if not found then raise exception 'perfil_indisponivel'; end if;
  efetivo := app_private.plano_vigente(p_usuario,clock_timestamp());
  update public.profiles set plano=(case efetivo when 'profissional' then 'pro'
    when 'simples' then 'starter' else 'freemium' end)::public.plano_tipo where id=p_usuario;
  return efetivo;
end;
$$;
revoke all on function public.recalcular_plano_do_perfil(uuid) from public,anon,authenticated;
grant execute on function public.recalcular_plano_do_perfil(uuid) to service_role;

create or replace function app_private.direitos_com_cota_serializada(proprietario uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare direitos jsonb;
begin
  -- Same first lock as grant mutations; clock/read happen after waiting.
  -- Under repeatable read a concurrently updated profile causes serialization
  -- failure rather than authorizing from the old snapshot of its grants.
  perform 1 from public.profiles where id=proprietario for update;
  if not found then raise exception 'perfil_indisponivel'; end if;
  insert into app_private.cotas_serializacao(titular_id,revisao) values(proprietario,1)
    on conflict(titular_id) do update set revisao=cotas_serializacao.revisao+1;
  select p.features into direitos from public.plans p
    where p.slug=app_private.plano_vigente(proprietario,clock_timestamp());
  if direitos is null or direitos->>'versao' is distinct from '2026-09-18.1'
    or not (direitos ?& array['imoveis','clientes']) then
    raise exception using errcode='P0001',message='direitos_indisponiveis';
  end if;
  return direitos;
end;
$$;
revoke all on function app_private.direitos_com_cota_serializada(uuid) from public,anon,authenticated;
commit;
