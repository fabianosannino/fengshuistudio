-- Durable intent prevents a concurrent first checkout from binding a customer
-- after deletion has started. Existing commercial accounts need reconciliation.
create table public.exclusoes_de_conta (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  iniciada_em timestamptz not null default clock_timestamp()
);
alter table public.exclusoes_de_conta enable row level security;
revoke all on public.exclusoes_de_conta from public,anon,authenticated;
grant select,insert,delete on public.exclusoes_de_conta to service_role;

create function public.iniciar_exclusao_do_titular(p_user_id uuid)
returns text language plpgsql security invoker set search_path = '' as $$
declare perfil public.profiles;
begin
  select * into perfil from public.profiles where id=p_user_id for update;
  if not found then raise exception 'perfil_indisponivel'; end if;
  if perfil.stripe_customer_id is not null or perfil.stripe_account_id is not null then return 'cobranca'; end if;
  if exists(select 1 from public.produtos where vendedor_perfil_id=p_user_id) then return 'produtos'; end if;
  if exists(select 1 from public.clientes where titular_id=p_user_id and consultor_id is distinct from p_user_id) then return 'vinculos'; end if;
  insert into public.exclusoes_de_conta(user_id) values(p_user_id) on conflict do nothing;
  return 'pronto';
end;
$$;
revoke all on function public.iniciar_exclusao_do_titular(uuid) from public,anon,authenticated;
grant execute on function public.iniciar_exclusao_do_titular(uuid) to service_role;

create function app_private.impedir_cobranca_durante_exclusao()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if ((new.stripe_customer_id is not null and new.stripe_customer_id is distinct from old.stripe_customer_id)
    or (new.stripe_account_id is not null and new.stripe_account_id is distinct from old.stripe_account_id))
    and exists(select 1 from public.exclusoes_de_conta where user_id=new.id) then
    raise exception using errcode='P0001',message='conta_em_exclusao';
  end if;
  return new;
end;
$$;
revoke all on function app_private.impedir_cobranca_durante_exclusao() from public,anon,authenticated;
create trigger impedir_cobranca_durante_exclusao before update on public.profiles
  for each row execute function app_private.impedir_cobranca_durante_exclusao();

-- Restrictive policy: retain the existing ownership policies and additionally
-- keep the parent row alive until an authenticated Storage write commits.
create function app_private.reservar_titular_do_arquivo(p_bucket text,p_path text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare ator uuid := auth.uid(); raiz uuid;
begin
  if p_bucket not in ('clientes-fotos','imoveis-fotos','relatorios') then return true; end if;
  if ator is null or p_path is null or position('/' in p_path)=0 then return false; end if;
  begin raiz := split_part(p_path,'/',1)::uuid;
  exception when invalid_text_representation then return false; end;
  if p_bucket='clientes-fotos' then
    if raiz<>ator then return false; end if;
    perform 1 from public.profiles where id=ator for key share;
  else
    perform 1 from public.consultas where id=raiz and consultor_id=ator for key share;
  end if;
  return found;
end;
$$;
revoke all on function app_private.reservar_titular_do_arquivo(text,text) from public,anon;
grant execute on function app_private.reservar_titular_do_arquivo(text,text) to authenticated;
create policy reservar_titular_antes_de_gravar_arquivo on storage.objects
  as restrictive for all to authenticated using (true)
  with check (app_private.reservar_titular_do_arquivo(bucket_id,name));

-- Never drop the last owner reference while files still exist. A failed
-- attempt keeps the rows, so the application can inventory and retry.
create function app_private.exigir_arquivos_removidos_da_consulta()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists(select 1 from storage.objects where bucket_id in ('imoveis-fotos','relatorios')
    and name like old.id::text||'/%') then
    raise exception using errcode='P0001',message='arquivos_da_consulta_pendentes';
  end if;
  return old;
end;
$$;
revoke all on function app_private.exigir_arquivos_removidos_da_consulta() from public,anon,authenticated;
create trigger exigir_arquivos_removidos before delete on public.consultas
  for each row execute function app_private.exigir_arquivos_removidos_da_consulta();

create function app_private.exigir_limpeza_antes_de_excluir_perfil()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.stripe_customer_id is not null or old.stripe_account_id is not null then
    raise exception using errcode='P0001',message='vinculo_comercial_pendente';
  end if;
  if exists(select 1 from public.clientes where consultor_id=old.id or titular_id=old.id)
    or exists(select 1 from public.consultas where consultor_id=old.id)
    or exists(select 1 from storage.objects where bucket_id='clientes-fotos' and name like old.id::text||'/%') then
    raise exception using errcode='P0001',message='dados_do_titular_pendentes';
  end if;
  return old;
end;
$$;
revoke all on function app_private.exigir_limpeza_antes_de_excluir_perfil() from public,anon,authenticated;
create trigger exigir_limpeza_do_titular before delete on public.profiles
  for each row execute function app_private.exigir_limpeza_antes_de_excluir_perfil();
