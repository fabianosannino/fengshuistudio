-- Each grant reference belongs to exactly one owner. NULL references remain
-- independent legacy/manual grants. Existing rows are neither deleted nor merged.
create unique index concessoes_origem_referencia_unica on public.concessoes_de_plano(origem, referencia);

create function public.recalcular_plano_do_perfil(p_usuario uuid)
returns text language plpgsql security invoker set search_path = '' as $$
declare efetivo text;
begin
  perform 1 from public.profiles where id=p_usuario for update;
  if not found then raise exception 'perfil_indisponivel'; end if;
  select c.plano into efetivo from public.concessoes_de_plano c
    where c.user_id=p_usuario and c.encerrada_em is null and c.valido_de<=now()
      and (c.valido_ate is null or c.valido_ate>now())
    order by case c.plano when 'profissional' then 2 when 'simples' then 1 else 0 end desc limit 1;
  efetivo := coalesce(efetivo,'free');
  update public.profiles set plano=(case efetivo when 'profissional' then 'pro'
    when 'simples' then 'starter' else 'freemium' end)::public.plano_tipo where id=p_usuario;
  return efetivo;
end;
$$;
revoke all on function public.recalcular_plano_do_perfil(uuid) from public, anon, authenticated;
grant execute on function public.recalcular_plano_do_perfil(uuid) to service_role;

create function public.alterar_concessao_de_plano(
  p_usuario uuid, p_operacao text, p_origem text, p_referencia text,
  p_plano text default null, p_valido_ate timestamptz default null,
  p_motivo text default null, p_criada_por uuid default null
) returns text language plpgsql security invoker set search_path = '' as $$
begin
  perform 1 from public.profiles where id=p_usuario for update;
  if not found then raise exception 'perfil_indisponivel'; end if;
  if p_operacao='conceder' then
    insert into public.concessoes_de_plano(user_id,plano,origem,referencia,valido_ate,motivo,criada_por)
      values(p_usuario,p_plano,p_origem,p_referencia,p_valido_ate,p_motivo,p_criada_por)
      on conflict(origem,referencia) do update set plano=excluded.plano,
        valido_ate=excluded.valido_ate, motivo=excluded.motivo, encerrada_em=null
      where concessoes_de_plano.user_id=excluded.user_id;
    if not found then raise exception using errcode='42501',message='referencia_de_outro_titular'; end if;
  elsif p_operacao='encerrar' and p_referencia is not null then
    update public.concessoes_de_plano set encerrada_em=now(),motivo=p_motivo
      where user_id=p_usuario and origem=p_origem and referencia=p_referencia and encerrada_em is null;
  else
    raise exception 'operacao_invalida';
  end if;
  return public.recalcular_plano_do_perfil(p_usuario);
end;
$$;
revoke all on function public.alterar_concessao_de_plano(uuid,text,text,text,text,timestamptz,text,uuid) from public, anon, authenticated;
grant execute on function public.alterar_concessao_de_plano(uuid,text,text,text,text,timestamptz,text,uuid) to service_role;

create function public.ativar_chave_de_plano(p_usuario uuid,p_chave text,p_plano text)
returns text language plpgsql security invoker set search_path = '' as $$
declare chave public.activation_keys; plano_chave text; fim timestamptz;
begin
  -- Always lock owner before key/grant so every grant path uses the same order.
  perform 1 from public.profiles where id=p_usuario for update;
  if not found then raise exception 'perfil_indisponivel'; end if;
  select * into chave from public.activation_keys where key=upper(trim(p_chave)) for update;
  if not found then raise exception using errcode='P0001',message='chave_invalida'; end if;
  plano_chave := case chave.plan_type when 'pro' then 'profissional' when 'profissional' then 'profissional'
    when 'starter' then 'simples' when 'simples' then 'simples' else null end;
  if plano_chave is null or plano_chave is distinct from p_plano then
    raise exception using errcode='P0001',message='chave_invalida';
  end if;
  if chave.status='used' and chave.used_by=p_usuario and exists(
    select 1 from public.concessoes_de_plano where user_id=p_usuario and origem='chave' and referencia=chave.id::text
  ) then return public.recalcular_plano_do_perfil(p_usuario); end if;
  if chave.status<>'available' or (chave.expires_at is not null and chave.expires_at<=now())
    or (chave.discount_percent is not null and chave.discount_percent<>100)
    or (chave.duration_months is not null and chave.duration_months<=0) then
    raise exception using errcode='P0001',message='chave_invalida';
  end if;
  if chave.duration_months is not null then fim := now()+make_interval(months=>chave.duration_months); end if;
  update public.activation_keys set status='used',used_by=p_usuario,used_at=now() where id=chave.id;
  perform public.alterar_concessao_de_plano(p_usuario,'conceder','chave',chave.id::text,plano_chave,fim,'Ativação por chave',null);
  insert into public.admin_audit_log(action,target_type,target_id,details,performed_by)
    values('use_key','activation_key',chave.id::text,jsonb_build_object('plano',plano_chave),p_usuario);
  return public.recalcular_plano_do_perfil(p_usuario);
end;
$$;
revoke all on function public.ativar_chave_de_plano(uuid,text,text) from public, anon, authenticated;
grant execute on function public.ativar_chave_de_plano(uuid,text,text) to service_role;

-- Explicit own-account waiver: paid grants are never ended by this operation.
create function public.renunciar_concessoes_nao_pagas(p_usuario uuid)
returns text language plpgsql security invoker set search_path = '' as $$
begin
  perform 1 from public.profiles where id=p_usuario for update;
  if not found then raise exception 'perfil_indisponivel'; end if;
  update public.concessoes_de_plano set encerrada_em=now(),motivo='Renúncia solicitada pelo titular'
    where user_id=p_usuario and origem in ('chave','cortesia','migracao') and encerrada_em is null;
  return public.recalcular_plano_do_perfil(p_usuario);
end;
$$;
revoke all on function public.renunciar_concessoes_nao_pagas(uuid) from public, anon, authenticated;
grant execute on function public.renunciar_concessoes_nao_pagas(uuid) to service_role;
