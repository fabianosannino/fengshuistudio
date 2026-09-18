-- Do not silently remove indefinite legacy paid access. Reconcile its origin first.
do $$ begin
  if exists(select 1 from public.concessoes_de_plano where origem='assinatura' and encerrada_em is null and (valido_ate is null or not isfinite(valido_ate))) then
    raise exception 'concessao_de_assinatura_sem_prazo_requer_reconciliacao';
  end if;
end $$;
alter table public.concessoes_de_plano add constraint concessao_assinatura_tem_prazo
  check(origem<>'assinatura' or encerrada_em is not null or (valido_ate is not null and isfinite(valido_ate)));

create table app_private.sincronizacoes_assinatura (
  subscription_id text primary key check(subscription_id ~ '^sub_[a-zA-Z0-9]+$'),
  token uuid,
  tentativa_ate timestamptz,
  ultima_aplicacao timestamptz,
  check((token is null)=(tentativa_ate is null))
);
alter table app_private.sincronizacoes_assinatura enable row level security;
revoke all on app_private.sincronizacoes_assinatura from public,anon,authenticated;
grant usage on schema app_private to service_role;
grant select,insert,update,delete on app_private.sincronizacoes_assinatura to service_role;

create function public.reservar_sincronizacao_assinatura(p_subscription text)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare controle app_private.sincronizacoes_assinatura; novo uuid := gen_random_uuid(); agora timestamptz;
begin
  insert into app_private.sincronizacoes_assinatura(subscription_id) values(p_subscription) on conflict do nothing;
  select * into controle from app_private.sincronizacoes_assinatura where subscription_id=p_subscription for update;
  agora := clock_timestamp();
  if controle.token is not null and controle.tentativa_ate>agora then return null; end if;
  update app_private.sincronizacoes_assinatura set token=novo,tentativa_ate=agora+interval '5 minutes' where subscription_id=p_subscription;
  return novo;
end;
$$;
revoke all on function public.reservar_sincronizacao_assinatura(text) from public,anon,authenticated;
grant execute on function public.reservar_sincronizacao_assinatura(text) to service_role;

create function public.liberar_sincronizacao_assinatura(p_subscription text,p_token uuid)
returns boolean language plpgsql security invoker set search_path = '' as $$
begin
  update app_private.sincronizacoes_assinatura set token=null,tentativa_ate=null where subscription_id=p_subscription and token=p_token;
  return found;
end;
$$;
revoke all on function public.liberar_sincronizacao_assinatura(text,uuid) from public,anon,authenticated;
grant execute on function public.liberar_sincronizacao_assinatura(text,uuid) to service_role;

create function public.aplicar_sincronizacao_assinatura(p_subscription text,p_token uuid,p_dados jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare controle app_private.sincronizacoes_assinatura; perfil public.profiles; anterior public.subscriptions;
  linha_id uuid; plano_id uuid; plano_slug text := p_dados->>'plano'; estado text := p_dados->>'status'; estado_banco text;
  ciclo text := p_dados->>'ciclo'; centavos bigint := (p_dados->>'valor_centavos')::bigint;
  inicio timestamptz := (p_dados->>'started_at')::timestamptz;
  periodo_inicio timestamptz := (p_dados->>'period_start')::timestamptz;
  periodo_fim timestamptz := (p_dados->>'period_end')::timestamptz;
  trial_fim timestamptz := (p_dados->>'trial_end')::timestamptz;
  beneficio_fim timestamptz; nova boolean;
begin
  -- Lock the claim through the complete commit. Expired/stolen readers cannot write.
  select * into controle from app_private.sincronizacoes_assinatura where subscription_id=p_subscription for update;
  if not found or p_token is null or controle.token is distinct from p_token or controle.tentativa_ate<=clock_timestamp() then
    raise exception 'sincronizacao_expirada'; end if;
  if estado is null or estado not in ('active','trialing','past_due','unpaid','canceled','paused','incomplete','incomplete_expired')
    or (centavos is not null and (centavos<0 or centavos>9007199254740991)) then raise exception 'assinatura_invalida'; end if;
  begin
    select * into strict perfil from public.profiles where stripe_customer_id=p_dados->>'customer' for update;
  exception when no_data_found then raise exception 'perfil_de_cobranca_indisponivel'; end;
  if controle.tentativa_ate<=clock_timestamp() then raise exception 'sincronizacao_expirada'; end if;
  if exists(select 1 from public.exclusoes_de_conta where user_id=perfil.id) then raise exception 'conta_em_exclusao'; end if;
  select * into anterior from public.subscriptions where gateway_subscription_id=p_subscription for update;
  nova := not found;
  if not nova and anterior.user_id<>perfil.id then raise exception 'assinatura_de_outro_titular'; end if;

  if plano_slug in ('simples','profissional') then
    select id into plano_id from public.plans where plans.slug=plano_slug;
    if plano_id is null or ciclo is null or ciclo not in ('monthly','yearly') or centavos is null then raise exception 'catalogo_indisponivel'; end if;
  elsif not nova and estado not in ('active','trialing') then
    plano_id := anterior.plan_id; ciclo := anterior.billing_cycle;
  else raise exception 'plano_nao_identificado'; end if;

  if inicio is null or not isfinite(inicio) or (periodo_inicio is not null and not isfinite(periodo_inicio))
    or (periodo_fim is not null and not isfinite(periodo_fim)) or (trial_fim is not null and not isfinite(trial_fim)) then
    raise exception 'periodo_invalido'; end if;
  if estado in ('active','trialing') then
    if periodo_inicio is null or periodo_fim is null or periodo_fim<=periodo_inicio then raise exception 'periodo_invalido'; end if;
    beneficio_fim := periodo_fim;
    if estado='trialing' then
      if trial_fim is null or trial_fim<=periodo_inicio then raise exception 'periodo_invalido'; end if;
      beneficio_fim := least(periodo_fim,trial_fim);
    end if;
  end if;
  estado_banco := case estado when 'trialing' then 'trial' when 'unpaid' then 'cancelled'
    when 'canceled' then 'cancelled' when 'incomplete_expired' then 'cancelled'
    when 'incomplete' then 'past_due' else estado end;
  if nova then
    insert into public.subscriptions(user_id,plan_id,billing_cycle,status,price_paid,started_at,current_period_start,current_period_end,
      next_billing_date,gateway_subscription_id,cancel_at_period_end,updated_at)
      values(perfil.id,plano_id,ciclo,estado_banco,centavos::numeric/100,inicio,periodo_inicio,periodo_fim,periodo_fim,p_subscription,
        coalesce((p_dados->>'cancel_at_period_end')::boolean,false),clock_timestamp()) returning id into linha_id;
  else
    linha_id := anterior.id;
    update public.subscriptions set plan_id=plano_id,billing_cycle=ciclo,status=estado_banco,
      price_paid=coalesce(centavos::numeric/100,anterior.price_paid),current_period_start=periodo_inicio,current_period_end=periodo_fim,
      next_billing_date=periodo_fim,cancel_at_period_end=coalesce((p_dados->>'cancel_at_period_end')::boolean,false),updated_at=clock_timestamp()
      where id=linha_id;
  end if;
  if estado in ('active','trialing') then
    perform public.alterar_concessao_de_plano(perfil.id,'conceder','assinatura',p_subscription,plano_slug,beneficio_fim,'Período vigente confirmado no Stripe',null);
  elsif estado_banco='cancelled' then
    perform public.alterar_concessao_de_plano(perfil.id,'encerrar','assinatura',p_subscription,null,null,'Assinatura encerrada no Stripe',null);
  else
    perform public.recalcular_plano_do_perfil(perfil.id);
  end if;
  -- past_due/paused/incomplete do not renew the previously confirmed period.
  update app_private.sincronizacoes_assinatura set token=null,tentativa_ate=null,ultima_aplicacao=clock_timestamp() where subscription_id=p_subscription;
  return jsonb_build_object('situacao',case when nova then 'criada' else 'atualizada' end,'linhaId',linha_id,
    'cancelamentoAgendado',coalesce((p_dados->>'cancel_at_period_end')::boolean,false));
end;
$$;
revoke all on function public.aplicar_sincronizacao_assinatura(text,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.aplicar_sincronizacao_assinatura(text,uuid,jsonb) to service_role;
