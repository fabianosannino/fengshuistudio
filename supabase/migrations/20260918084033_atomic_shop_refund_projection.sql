-- Extend the existing claim protocol; financial identities include account scope.
alter table app_private.sincronizacoes_financeiras drop constraint sincronizacoes_financeiras_recurso_check;
alter table app_private.sincronizacoes_financeiras add constraint sincronizacoes_financeiras_recurso_check
  check(recurso ~ '^(in|dp|du)_[a-zA-Z0-9]+$' or recurso ~ '^pedido:[0-9a-f-]{36}$');
create unique index pedido_pagamento_por_conta on public.pedidos(coalesce(stripe_account_id,'plataforma'),stripe_payment_intent)
  where stripe_payment_intent is not null;

create table app_private.projecoes_reembolso_pedido (
  pedido_id uuid primary key references public.pedidos(id) on delete restrict,
  versao bigint not null check(versao>0), dados jsonb not null,
  atualizado_em timestamptz not null default clock_timestamp()
);
create table app_private.vinculos_reembolso_pedido (
  conta text not null, refund_id text not null, pedido_id uuid not null references public.pedidos(id) on delete restrict,
  primary key(conta,refund_id)
);
create index vinculos_reembolso_pedido_dono on app_private.vinculos_reembolso_pedido(pedido_id);
alter table app_private.projecoes_reembolso_pedido enable row level security;
alter table app_private.vinculos_reembolso_pedido enable row level security;
revoke all on app_private.projecoes_reembolso_pedido,app_private.vinculos_reembolso_pedido from public,anon,authenticated;
grant select,insert,update,delete on app_private.projecoes_reembolso_pedido,app_private.vinculos_reembolso_pedido to service_role;

alter table public.pedido_eventos drop constraint pedido_eventos_evento_check;
alter table public.pedido_eventos add constraint pedido_eventos_evento_check check(evento in(
  'iniciado','pago','cancelado','preparando','enviado','entregue','devolucao_solicitada','reembolsado','contestado','disputa_resolvida','reembolso_conferido'
));

create function public.aplicar_reembolsos_pedido(p_pedido uuid,p_token uuid,p_dados jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare recurso text := 'pedido:'||p_pedido; prazo timestamptz; pedido public.pedidos;
  anterior app_private.projecoes_reembolso_pedido; versao bigint; snapshot jsonb; total bigint; comissao bigint;
  estornado bigint := 0; comissao_devolvida bigint := 0; pendente bigint := 0;
  registrado bigint; comissao_registrada bigint; diferenca bigint; partes_validas boolean;
  reembolsos jsonb := p_dados->'reembolsos'; taxas jsonb := p_dados->'estornos_comissao'; refund jsonb; antigo jsonb;
  valor numeric; criada timestamptz; ids text[] := '{}'; conta text; vendedor text; referencia text;
begin
  prazo := app_private.validar_sincronizacao_financeira(recurso,p_token);
  select * into strict pedido from public.pedidos where id=p_pedido for update;
  conta := coalesce(pedido.stripe_account_id,'plataforma');
  vendedor := pedido.vendedor_tipo;
  if pedido.stripe_payment_intent is null or pedido.stripe_payment_intent is distinct from p_dados->>'payment_intent'
    or pedido.vendedor_tipo is distinct from p_dados->>'vendedor_tipo'
    or pedido.vendedor_perfil_id::text is distinct from p_dados->>'vendedor_perfil_id'
    or pedido.stripe_account_id is distinct from p_dados->>'account' or vendedor not in('consultor','plataforma')
    or (vendedor='consultor' and (pedido.stripe_account_id is null or pedido.vendedor_perfil_id is null))
    or (vendedor='plataforma' and pedido.stripe_account_id is not null)
    or pedido.moeda<>'brl' or p_dados->>'moeda' is distinct from 'brl'
    or p_dados->>'charge' is null or p_dados->>'charge' !~ '^ch_[a-zA-Z0-9]+$' then raise exception 'pedido_financeiro_incompativel'; end if;
  if pedido.vendedor_perfil_id is not null and exists(select 1 from public.exclusoes_de_conta where user_id=pedido.vendedor_perfil_id) then
    raise exception 'vendedor_em_exclusao'; end if;
  valor := (p_dados->>'pago_centavos')::numeric;
  if valor is null or valor<>trunc(valor) or valor not between 1 and 2147483647 or valor<>pedido.total_centavos then raise exception 'valor_pago_incompativel'; end if;
  total := valor;
  valor := (p_dados->>'comissao_centavos')::numeric;
  if valor is null or valor<>trunc(valor) or valor not between 0 and total or valor<>pedido.taxa_plataforma_centavos
    or (vendedor='plataforma' and valor<>0) then raise exception 'comissao_incompativel'; end if;
  comissao := valor;
  if jsonb_typeof(reembolsos) is distinct from 'array' or jsonb_typeof(taxas) is distinct from 'array'
    or jsonb_array_length(reembolsos)>100 or jsonb_array_length(taxas)>100 then raise exception 'reembolsos_incompletos'; end if;
  for refund in select value from jsonb_array_elements(reembolsos) loop
    valor := (refund->>'centavos')::numeric; criada := (refund->>'criado_em')::timestamptz;
    if refund->>'id' is null or refund->>'id' !~ '^re_[a-zA-Z0-9]+$' or refund->>'id'=any(ids)
      or refund->>'status' is null or refund->>'status' not in('pending','requires_action','succeeded','failed','canceled')
      or valor is null or valor<>trunc(valor) or valor not between 1 and total or criada is null or not isfinite(criada) then
      raise exception 'reembolso_invalido'; end if;
    ids := array_append(ids,refund->>'id');
    if refund->>'status'='succeeded' then estornado := estornado+valor;
    elsif refund->>'status' in('pending','requires_action') then pendente := pendente+valor; end if;
  end loop;
  if estornado+pendente>total then raise exception 'reembolso_superior_ao_pago'; end if;
  for refund in select value from jsonb_array_elements(taxas) loop
    valor := (refund->>'centavos')::numeric; criada := (refund->>'criado_em')::timestamptz;
    if refund->>'id' is null or refund->>'id' !~ '^fr_[a-zA-Z0-9]+$' or refund->>'id'=any(ids)
      or valor is null or valor<>trunc(valor) or valor not between 1 and comissao or criada is null or not isfinite(criada) then
      raise exception 'estorno_comissao_invalido'; end if;
    ids := array_append(ids,refund->>'id'); comissao_devolvida := comissao_devolvida+valor;
  end loop;
  if comissao_devolvida>comissao then raise exception 'estorno_superior_a_comissao'; end if;
  select * into anterior from app_private.projecoes_reembolso_pedido where pedido_id=p_pedido for update;
  if found then
    if anterior.dados->>'charge' is distinct from p_dados->>'charge'
      or anterior.dados->>'payment_intent' is distinct from p_dados->>'payment_intent'
      or anterior.dados->>'account' is distinct from p_dados->>'account' then raise exception 'identidade_financeira_alterada'; end if;
    for antigo in select value from jsonb_array_elements(anterior.dados->'reembolsos')
      union all select value from jsonb_array_elements(anterior.dados->'estornos_comissao') loop
      select value into refund from (select value from jsonb_array_elements(reembolsos) union all select value from jsonb_array_elements(taxas)) r
        where value->>'id'=antigo->>'id';
      if refund is null or refund->>'centavos' is distinct from antigo->>'centavos' then raise exception 'reembolso_omitido_ou_alterado'; end if;
    end loop;
  end if;
  -- Compare the complete current net with append-only history, including legacy entries.
  select coalesce(sum(case when recebedor='comprador' then valor_centavos else -valor_centavos end),0),
    coalesce(bool_and((pagador=vendedor and recebedor='comprador') or (pagador='comprador' and recebedor=vendedor)),true)
    into registrado,partes_validas from public.pedido_lancamentos where pedido_id=p_pedido and tipo='reembolso';
  if not partes_validas then raise exception 'partes_do_reembolso_incompativeis'; end if;
  select coalesce(sum(case when pagador='plataforma' then valor_centavos else -valor_centavos end),0),
    coalesce(bool_and((pagador='plataforma' and recebedor=vendedor) or (pagador=vendedor and recebedor='plataforma')),true)
    into comissao_registrada,partes_validas from public.pedido_lancamentos where pedido_id=p_pedido and tipo='estorno_comissao';
  if not partes_validas or (vendedor='plataforma' and comissao_registrada<>0) then raise exception 'partes_da_comissao_incompativeis'; end if;
  snapshot := p_dados;
  versao := coalesce(anterior.versao,0);
  if anterior.dados is distinct from snapshot or registrado<>estornado or comissao_registrada<>comissao_devolvida then
    versao := versao+1; referencia := 'reembolso:v2:'||p_pedido||':'||versao;
    diferenca := estornado-registrado;
    if diferenca<>0 then
      insert into public.pedido_lancamentos(pedido_id,tipo,valor_centavos,pagador,recebedor,origem,referencia,motivo)
        values(p_pedido,'reembolso',abs(diferenca),case when diferenca>0 then vendedor else 'comprador' end,
          case when diferenca>0 then 'comprador' else vendedor end,'sistema',referencia,
          'Conciliação do razão com reembolsos atuais da Stripe; não movimenta dinheiro no provedor');
    end if;
    diferenca := comissao_devolvida-comissao_registrada;
    if diferenca<>0 then
      insert into public.pedido_lancamentos(pedido_id,tipo,valor_centavos,pagador,recebedor,origem,referencia,motivo)
        values(p_pedido,'estorno_comissao',abs(diferenca),case when diferenca>0 then 'plataforma' else vendedor end,
          case when diferenca>0 then vendedor else 'plataforma' end,'sistema',referencia,
          'Conciliação do estorno de comissão confirmado na Stripe');
    end if;
    for refund in select value from jsonb_array_elements(reembolsos) union all select value from jsonb_array_elements(taxas) loop
      insert into app_private.vinculos_reembolso_pedido(conta,refund_id,pedido_id) values(conta,refund->>'id',p_pedido)
        on conflict on constraint vinculos_reembolso_pedido_pkey do update set pedido_id=excluded.pedido_id
        where app_private.vinculos_reembolso_pedido.pedido_id=excluded.pedido_id;
      if not found then raise exception 'reembolso_de_outro_pedido'; end if;
    end loop;
    insert into app_private.projecoes_reembolso_pedido(pedido_id,versao,dados) values(p_pedido,versao,snapshot)
      on conflict(pedido_id) do update set versao=excluded.versao,dados=excluded.dados,atualizado_em=clock_timestamp();
    insert into public.pedido_eventos(pedido_id,evento,origem,referencia,dados,motivo) values(p_pedido,'reembolso_conferido','sistema',referencia,
      jsonb_build_object('versao',versao,'pago_centavos',total,'confirmado_centavos',estornado,'pendente_centavos',pendente),
      'Estado financeiro atual conferido na Stripe');
  end if;
  if prazo<=clock_timestamp() then raise exception 'sincronizacao_financeira_expirada'; end if;
  update app_private.sincronizacoes_financeiras set token=null,tentativa_ate=null,ultima_aplicacao=clock_timestamp()
    where sincronizacoes_financeiras.recurso='pedido:'||p_pedido;
  return jsonb_build_object('versao',versao,'confirmado_centavos',estornado,'pendente_centavos',pendente);
end $$;
revoke all on function public.aplicar_reembolsos_pedido(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.aplicar_reembolsos_pedido(uuid,uuid,jsonb) to service_role;
