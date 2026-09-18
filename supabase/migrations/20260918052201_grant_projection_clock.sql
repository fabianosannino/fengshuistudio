-- now() is the transaction's start time, not the instant after waiting for
-- the owner's lock. A transaction that began earlier but acquired the lock
-- later must still see a grant committed by the intervening transaction.
create or replace function public.recalcular_plano_do_perfil(p_usuario uuid)
returns text language plpgsql security invoker set search_path = '' as $$
declare efetivo text; instante timestamptz;
begin
  perform 1 from public.profiles where id=p_usuario for update;
  if not found then raise exception 'perfil_indisponivel'; end if;
  instante := clock_timestamp();
  select c.plano into efetivo from public.concessoes_de_plano c
    where c.user_id=p_usuario and c.encerrada_em is null and c.valido_de<=instante
      and (c.valido_ate is null or c.valido_ate>instante)
    order by case c.plano when 'profissional' then 2 when 'simples' then 1 else 0 end desc limit 1;
  efetivo := coalesce(efetivo,'free');
  update public.profiles set plano=(case efetivo when 'profissional' then 'pro'
    when 'simples' then 'starter' else 'freemium' end)::public.plano_tipo where id=p_usuario;
  return efetivo;
end;
$$;
revoke all on function public.recalcular_plano_do_perfil(uuid) from public,anon,authenticated;
grant execute on function public.recalcular_plano_do_perfil(uuid) to service_role;
