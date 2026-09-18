-- Five minutes exceeds the webhook's configured 60 second execution budget.
alter table public.eventos_stripe
  add column tentativa_token uuid,
  add column tentativa_ate timestamptz,
  add column tentativas integer not null default 0;

create function public.reivindicar_evento_stripe(
  p_event_id text, p_tipo text, p_endpoint text, p_objeto_id text, p_criado_em timestamptz
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare evento public.eventos_stripe; token uuid;
begin
  if p_event_id is null or length(p_event_id) not between 1 and 255
    or p_tipo is null or p_endpoint is null or p_criado_em is null or not isfinite(p_criado_em) then
    raise exception 'evento_invalido';
  end if;
  insert into public.eventos_stripe(event_id,tipo,endpoint,objeto_id,criado_em_stripe)
    values(p_event_id,p_tipo,p_endpoint,p_objeto_id,p_criado_em)
    on conflict(event_id) do nothing;
  select * into evento from public.eventos_stripe where event_id=p_event_id for update;
  if evento.tipo is distinct from p_tipo or evento.objeto_id is distinct from p_objeto_id
    or evento.criado_em_stripe is distinct from p_criado_em then raise exception 'evento_incompativel'; end if;
  if evento.processado_em is not null then return jsonb_build_object('situacao','repetido'); end if;
  if evento.tentativa_ate>clock_timestamp() then return jsonb_build_object('situacao','ocupado'); end if;
  token := gen_random_uuid();
  update public.eventos_stripe set tentativa_token=token,
    tentativa_ate=clock_timestamp()+interval '5 minutes',tentativas=tentativas+1,erro=null
    where event_id=p_event_id;
  return jsonb_build_object('situacao',case when evento.tentativas=0 then 'reivindicado' else 'retomado' end,'token',token);
end;
$$;
revoke all on function public.reivindicar_evento_stripe(text,text,text,text,timestamptz) from public,anon,authenticated;
grant execute on function public.reivindicar_evento_stripe(text,text,text,text,timestamptz) to service_role;

create function public.finalizar_evento_stripe(p_event_id text,p_token uuid,p_sucesso boolean)
returns boolean language plpgsql security invoker set search_path = '' as $$
begin
  -- Expired/stale workers cannot acknowledge or release a newer claim.
  update public.eventos_stripe set
    processado_em=case when p_sucesso then clock_timestamp() else null end,
    erro=case when p_sucesso then null else 'falha_processamento' end,
    tentativa_token=null,tentativa_ate=null
    where event_id=p_event_id and tentativa_token=p_token
      and tentativa_ate>clock_timestamp() and processado_em is null;
  return found;
end;
$$;
revoke all on function public.finalizar_evento_stripe(text,uuid,boolean) from public,anon,authenticated;
grant execute on function public.finalizar_evento_stripe(text,uuid,boolean) to service_role;

-- Business key for new notifications. Legacy rows remain untouched.
alter table public.payment_notifications add column referencia_evento text;
create unique index notificacao_evento_unica on public.payment_notifications(user_id,type,referencia_evento);
