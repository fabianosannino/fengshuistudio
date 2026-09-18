-- Cadastro independente da geometria: salvar a planta nunca sobrescreve móveis.
-- Herda ownership/RLS/grants de consultas; não cria acesso público nem backfill.
alter table public.consultas add column if not exists mobiliario jsonb;
alter table public.consultas add constraint consultas_mobiliario_formato check (
  mobiliario is null or coalesce((
    jsonb_typeof(mobiliario) = 'object'
    and jsonb_typeof(mobiliario->'versao') = 'number'
    and mobiliario->>'versao' = '1'
    and jsonb_typeof(mobiliario->'revisao') = 'number'
    and (mobiliario->>'revisao')::numeric >= 1
    and jsonb_typeof(mobiliario->'itens') = 'array'
    and jsonb_array_length(mobiliario->'itens') <= 150
    and octet_length(mobiliario::text) <= 200000
    and mobiliario ?& array['versao','revisao','referencia_planta','itens']
  ), false)
);
comment on column public.consultas.mobiliario is 'Cadastro versionado de ambientes/móveis por consulta; inclui dados pessoais opcionais, exportados/apagados com a consulta. Escrita otimista por revisão.';
-- JSON de planta pode ultrapassar limites de URL do PostgREST. Os parâmetros
-- ficam no corpo; UPDATE atômico, sob as mesmas policies da sessão (invoker).
create or replace function public.salvar_mobiliario_consulta(p_consulta uuid, p_revisao integer, p_entrada jsonb, p_cadastro jsonb)
returns boolean language plpgsql security invoker set search_path = '' as $$
begin
  if p_revisao is null or p_revisao < 0 or p_cadastro->>'revisao' is distinct from (p_revisao + 1)::text then
    raise exception 'Revisao invalida';
  end if;
  update public.consultas set mobiliario = p_cadastro
    where id = p_consulta and consultor_id = (select auth.uid())
      and bagua_entrada is not distinct from p_entrada
      and ((mobiliario is null and p_revisao = 0) or mobiliario->>'revisao' = p_revisao::text);
  return found;
end;
$$;
revoke all on function public.salvar_mobiliario_consulta(uuid, integer, jsonb, jsonb) from public, anon, service_role;
grant execute on function public.salvar_mobiliario_consulta(uuid, integer, jsonb, jsonb) to authenticated;
notify pgrst, 'reload schema';
