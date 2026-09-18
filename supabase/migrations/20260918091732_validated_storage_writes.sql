-- Service-role uploads bypass RLS. Keep their owner alive and serialize with
-- deletion admission in the same transaction that inserts Storage metadata.
create function app_private.reservar_raiz_de_arquivo_privado()
returns trigger language plpgsql security definer set search_path='' as $$
declare raiz uuid; titular uuid;
begin
  if new.bucket_id not in ('clientes-fotos','imoveis-fotos','relatorios') then return new; end if;
  if new.name is null or position('/' in new.name)=0 then raise exception 'raiz_de_arquivo_invalida'; end if;
  begin raiz := split_part(new.name,'/',1)::uuid;
  exception when invalid_text_representation then raise exception 'raiz_de_arquivo_invalida'; end;
  if new.bucket_id='clientes-fotos' then titular := raiz;
  else
    select consultor_id into titular from public.consultas where id=raiz;
    if not found then raise exception 'raiz_de_arquivo_indisponivel'; end if;
  end if;
  -- Same lock order as account deletion: profile first, then consultation.
  perform 1 from public.profiles where id=titular for key share;
  if not found then raise exception 'raiz_de_arquivo_indisponivel'; end if;
  if exists(select 1 from public.exclusoes_de_conta where user_id=titular) then raise exception 'conta_em_exclusao'; end if;
  if new.bucket_id<>'clientes-fotos' then
    perform 1 from public.consultas where id=raiz and consultor_id=titular for share;
    if not found then raise exception 'raiz_de_arquivo_indisponivel'; end if;
  end if;
  return new;
end $$;
revoke all on function app_private.reservar_raiz_de_arquivo_privado() from public,anon,authenticated;
create trigger reservar_raiz_de_arquivo_privado before insert or update of bucket_id,name on storage.objects
  for each row execute function app_private.reservar_raiz_de_arquivo_privado();
