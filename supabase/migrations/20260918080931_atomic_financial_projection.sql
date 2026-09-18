-- Fail on ambiguous legacy invoices; never choose or delete a financial row.
do $$ begin
  if exists(select 1 from public.invoices where coalesce(refund_amount,0)>0 or status='refunded') then
    raise exception 'reembolsos_legados_requerem_reconciliacao'; end if;
end $$;
create unique index invoices_gateway_invoice_unica on public.invoices(gateway_invoice_id)
  where gateway_invoice_id is not null;
alter table public.invoices add column stripe_reembolsos jsonb not null default '[]'::jsonb
  check(jsonb_typeof(stripe_reembolsos)='array');

-- Global identity constraint even when two different invoices are synchronized.
-- The owner's export contains the refund state in invoices.stripe_reembolsos.
create table app_private.vinculos_reembolso (
  refund_id text primary key check(refund_id ~ '^re_[a-zA-Z0-9]+$'),
  invoice_id uuid not null references public.invoices(id) on delete restrict
);
alter table app_private.vinculos_reembolso enable row level security;
revoke all on app_private.vinculos_reembolso from public,anon,authenticated;
grant select,insert,update,delete on app_private.vinculos_reembolso to service_role;
create index vinculos_reembolso_fatura on app_private.vinculos_reembolso(invoice_id);

create table app_private.sincronizacoes_financeiras (
  recurso text primary key check(recurso ~ '^(in|dp|du)_[a-zA-Z0-9]+$'),
  token uuid, tentativa_ate timestamptz, ultima_aplicacao timestamptz,
  check((token is null)=(tentativa_ate is null))
);
alter table app_private.sincronizacoes_financeiras enable row level security;
revoke all on app_private.sincronizacoes_financeiras from public,anon,authenticated;
grant usage on schema app_private to service_role;
grant select,insert,update,delete on app_private.sincronizacoes_financeiras to service_role;

create function public.reservar_sincronizacao_financeira(p_recurso text)
returns uuid language plpgsql security invoker set search_path='' as $$
declare controle app_private.sincronizacoes_financeiras; novo uuid := gen_random_uuid(); agora timestamptz;
begin
  insert into app_private.sincronizacoes_financeiras(recurso) values(p_recurso) on conflict do nothing;
  select * into controle from app_private.sincronizacoes_financeiras where recurso=p_recurso for update;
  agora := clock_timestamp();
  if controle.token is not null and controle.tentativa_ate>agora then return null; end if;
  update app_private.sincronizacoes_financeiras set token=novo,tentativa_ate=agora+interval '5 minutes' where recurso=p_recurso;
  return novo;
end $$;
create function public.liberar_sincronizacao_financeira(p_recurso text,p_token uuid)
returns boolean language plpgsql security invoker set search_path='' as $$
begin
  update app_private.sincronizacoes_financeiras set token=null,tentativa_ate=null where recurso=p_recurso and token=p_token;
  return found;
end $$;

-- Lock held until the caller transaction commits. Recheck after all owner waits.
create function app_private.validar_sincronizacao_financeira(p_recurso text,p_token uuid)
returns timestamptz language plpgsql security invoker set search_path='' as $$
declare controle app_private.sincronizacoes_financeiras;
begin
  select * into controle from app_private.sincronizacoes_financeiras where recurso=p_recurso for update;
  if not found or p_token is null or controle.token is distinct from p_token or controle.tentativa_ate<=clock_timestamp() then
    raise exception 'sincronizacao_financeira_expirada'; end if;
  return controle.tentativa_ate;
end $$;

create function public.aplicar_fatura_stripe(p_recurso text,p_token uuid,p_dados jsonb)
returns uuid language plpgsql security invoker set search_path='' as $$
declare prazo timestamptz; perfil public.profiles; anterior public.invoices; linha uuid; assinatura uuid;
  total numeric := (p_dados->>'total_centavos')::numeric; pago numeric := (p_dados->>'pago_centavos')::numeric;
  estornado numeric := 0; estado text := p_dados->>'status'; estado_banco text;
  vencimento date := (p_dados->>'vencimento')::date; paga_em timestamptz := (p_dados->>'paga_em')::timestamptz;
  reembolsos jsonb := p_dados->'reembolsos'; reembolso jsonb; antigo jsonb; ids text[] := '{}'; valor numeric; criada timestamptz;
begin
  prazo := app_private.validar_sincronizacao_financeira(p_recurso,p_token);
  if p_recurso !~ '^in_[a-zA-Z0-9]+$' or p_dados->>'moeda' is distinct from 'brl'
    or total is null or pago is null or total<>trunc(total) or pago<>trunc(pago)
    or total not between 0 and 9999999999 or pago not between 0 and 9999999999
    or estado is null or estado not in('draft','open','paid','uncollectible','void')
    or vencimento is null or not isfinite(vencimento) or (paga_em is not null and not isfinite(paga_em))
    or (estado='paid' and paga_em is null) or jsonb_typeof(reembolsos) is distinct from 'array'
    or jsonb_array_length(reembolsos)>100 then raise exception 'fatura_invalida'; end if;
  select * into strict perfil from public.profiles where stripe_customer_id=p_dados->>'customer' for update;
  if exists(select 1 from public.exclusoes_de_conta where user_id=perfil.id) then raise exception 'conta_em_exclusao'; end if;
  select * into anterior from public.invoices where gateway_invoice_id=p_recurso for update;
  if found and (anterior.user_id<>perfil.id or anterior.paid_manually is true) then raise exception 'fatura_incompativel'; end if;
  if p_dados->>'subscription' is not null then
    select id into assinatura from public.subscriptions where gateway_subscription_id=p_dados->>'subscription' and user_id=perfil.id;
    if assinatura is null and exists(select 1 from public.subscriptions where gateway_subscription_id=p_dados->>'subscription') then
      raise exception 'assinatura_de_outro_titular'; end if;
  end if;
  for reembolso in select value from jsonb_array_elements(reembolsos) loop
    valor := (reembolso->>'centavos')::numeric; criada := (reembolso->>'criado_em')::timestamptz;
    if reembolso->>'id' is null or reembolso->>'id' !~ '^re_[a-zA-Z0-9]+$' or reembolso->>'id'=any(ids)
      or reembolso->>'charge' is null or reembolso->>'charge' !~ '^ch_[a-zA-Z0-9]+$'
      or reembolso->>'status' is null or reembolso->>'status' not in('pending','requires_action','succeeded','failed','canceled')
      or valor is null or valor<>trunc(valor) or valor not between 1 and 9999999999
      or criada is null or not isfinite(criada) then raise exception 'reembolso_invalido'; end if;
    ids := array_append(ids,reembolso->>'id');
    if reembolso->>'status'='succeeded' then estornado := estornado+valor; end if;
  end loop;
  -- A complete current snapshot may change status, but never erase an identity.
  for antigo in select value from jsonb_array_elements(coalesce(anterior.stripe_reembolsos,'[]')) loop
    select value into reembolso from jsonb_array_elements(reembolsos) where value->>'id'=antigo->>'id';
    if reembolso is null or reembolso->>'charge' is distinct from antigo->>'charge'
      or reembolso->>'centavos' is distinct from antigo->>'centavos' then raise exception 'reembolso_ausente_ou_incompativel'; end if;
  end loop;
  if estornado>pago then raise exception 'estorno_superior_ao_pagamento'; end if;
  if prazo<=clock_timestamp() then raise exception 'sincronizacao_financeira_expirada'; end if;
  estado_banco := case when pago>0 and estornado=pago then 'refunded' when estado='paid' then 'paid'
    when estado='void' then 'cancelled' when estado='uncollectible' then 'overdue' else 'pending' end;
  if anterior.id is null then
    insert into public.invoices(user_id,subscription_id,amount,amount_paid,status,due_date,paid_at,gateway_invoice_id,
      description,billing_cycle,refund_amount,refunded_at,stripe_reembolsos)
    values(perfil.id,assinatura,total/100,pago/100,estado_banco,vencimento,paga_em,p_recurso,
      'Fatura Stripe '||p_recurso,case when p_dados->>'subscription' is null then 'one_time' else 'recurring' end,
      estornado/100,case when estornado>0 then clock_timestamp() end,reembolsos) returning id into linha;
  else
    linha := anterior.id;
    update public.invoices set subscription_id=coalesce(assinatura,anterior.subscription_id),amount=total/100,amount_paid=pago/100,
      status=estado_banco,due_date=vencimento,paid_at=paga_em,refund_amount=estornado/100,
      refunded_at=case when estornado>0 then coalesce(anterior.refunded_at,clock_timestamp()) end,stripe_reembolsos=reembolsos where id=linha;
  end if;
  for reembolso in select value from jsonb_array_elements(reembolsos) loop
    insert into app_private.vinculos_reembolso(refund_id,invoice_id) values(reembolso->>'id',linha)
      on conflict(refund_id) do update set invoice_id=excluded.invoice_id
      where app_private.vinculos_reembolso.invoice_id=excluded.invoice_id;
    if not found then raise exception 'reembolso_de_outra_fatura'; end if;
    if reembolso->>'status'='succeeded' then
      insert into public.payment_notifications(user_id,invoice_id,type,channel,sent_at,content,referencia_evento)
        values(perfil.id,linha,'refund_processed','in_app',clock_timestamp(),
          'Reembolso confirmado pela Stripe: BRL '||to_char((reembolso->>'centavos')::numeric/100,'FM999999990.00'),reembolso->>'id')
        on conflict(user_id,type,referencia_evento) do nothing;
    end if;
  end loop;
  if prazo<=clock_timestamp() then raise exception 'sincronizacao_financeira_expirada'; end if;
  update app_private.sincronizacoes_financeiras set token=null,tentativa_ate=null,ultima_aplicacao=clock_timestamp() where recurso=p_recurso;
  return linha;
end $$;

create function public.aplicar_disputa_stripe(p_recurso text,p_token uuid,p_dados jsonb)
returns boolean language plpgsql security invoker set search_path='' as $$
declare prazo timestamptz; titular uuid; anterior public.disputas_stripe; estado text := p_dados->>'status';
  valor numeric := (p_dados->>'centavos')::numeric; aberta timestamptz := (p_dados->>'aberta_em')::timestamptz;
  responder timestamptz := (p_dados->>'responder_ate')::timestamptz; fechada boolean;
begin
  prazo := app_private.validar_sincronizacao_financeira(p_recurso,p_token);
  if p_recurso !~ '^(dp|du)_[a-zA-Z0-9]+$' or p_dados->>'moeda' is distinct from 'brl'
    or valor is null or valor<>trunc(valor) or valor not between 0 and 9999999999
    or estado is null or estado not in('needs_response','under_review','won','lost','warning_needs_response','warning_under_review','warning_closed','prevented')
    or p_dados->>'charge' is null or p_dados->>'charge' !~ '^ch_[a-zA-Z0-9]+$'
    or aberta is null or not isfinite(aberta) or (responder is not null and not isfinite(responder)) then raise exception 'disputa_invalida'; end if;
  if p_dados->>'customer' is not null then
    select id into strict titular from public.profiles where stripe_customer_id=p_dados->>'customer' for update;
    if exists(select 1 from public.exclusoes_de_conta where user_id=titular) then raise exception 'conta_em_exclusao'; end if;
  end if;
  select * into anterior from public.disputas_stripe where id=p_recurso for update;
  if found and (anterior.charge_id is distinct from p_dados->>'charge' or anterior.user_id is distinct from titular
    or anterior.customer_id is distinct from p_dados->>'customer') then raise exception 'disputa_de_outro_titular'; end if;
  if prazo<=clock_timestamp() then raise exception 'sincronizacao_financeira_expirada'; end if;
  fechada := estado in('won','lost','warning_closed','prevented');
  insert into public.disputas_stripe(id,charge_id,customer_id,user_id,valor,moeda,status,motivo,responder_ate,aberta_em,fechada_em,desfecho,event_id,atualizada_em)
    values(p_recurso,p_dados->>'charge',p_dados->>'customer',titular,valor/100,'brl',estado,p_dados->>'motivo',responder,aberta,
      case when fechada then coalesce(anterior.fechada_em,clock_timestamp()) end,case when fechada then estado end,p_dados->>'event_id',clock_timestamp())
    on conflict(id) do update set valor=excluded.valor,status=excluded.status,motivo=excluded.motivo,responder_ate=excluded.responder_ate,
      fechada_em=excluded.fechada_em,desfecho=excluded.desfecho,event_id=excluded.event_id,atualizada_em=excluded.atualizada_em;
  if titular is not null and estado='lost' then
    insert into public.payment_notifications(user_id,type,channel,sent_at,content,referencia_evento)
      values(titular,'dispute_lost','in_app',clock_timestamp(),'Uma contestação foi decidida em favor do portador do cartão.',p_recurso)
      on conflict(user_id,type,referencia_evento) do nothing;
  end if;
  if prazo<=clock_timestamp() then raise exception 'sincronizacao_financeira_expirada'; end if;
  update app_private.sincronizacoes_financeiras set token=null,tentativa_ate=null,ultima_aplicacao=clock_timestamp() where recurso=p_recurso;
  return true;
end $$;

revoke all on function public.reservar_sincronizacao_financeira(text),public.liberar_sincronizacao_financeira(text,uuid),
  app_private.validar_sincronizacao_financeira(text,uuid),public.aplicar_fatura_stripe(text,uuid,jsonb),public.aplicar_disputa_stripe(text,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.reservar_sincronizacao_financeira(text),public.liberar_sincronizacao_financeira(text,uuid),
  app_private.validar_sincronizacao_financeira(text,uuid),public.aplicar_fatura_stripe(text,uuid,jsonb),public.aplicar_disputa_stripe(text,uuid,jsonb) to service_role;
