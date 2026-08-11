-- ============================================================================
-- Backfill: URL pública → path de objeto (C8, passo 3 do plano de migração)
--
-- O banco guarda a URL pública completa em seis lugares. O código já lida com
-- as duas formas (`src/lib/storage-imagens.ts`), então **este backfill não é
-- pré-requisito para fechar os buckets** — é limpeza, e é por isso que vem em
-- arquivo próprio: pode ser aplicado antes ou depois do fechamento, e um erro
-- aqui não bloqueia o passo que resolve a exposição.
--
-- Idempotente: opera só sobre valores que ainda contêm `/object/public/<bucket>/`.
-- Rodar duas vezes não muda nada na segunda.
-- ============================================================================

-- Recorta tudo que vem depois de `/object/public/<bucket>/`. Devolve o próprio
-- valor quando ele já é um path — o que torna a função segura para reexecução.
create or replace function public.path_de_storage(valor text, bucket text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when valor is null then null
    when position('/object/public/' || bucket || '/' in valor) > 0
      then substring(
        valor from position('/object/public/' || bucket || '/' in valor)
                      + length('/object/public/' || bucket || '/')
      )
    else valor
  end
$$;

-- ── clientes.foto_url ────────────────────────────────────────────────────────
update public.clientes
set foto_url = public.path_de_storage(foto_url, 'clientes-fotos')
where foto_url like '%/object/public/clientes-fotos/%';

-- ── consultas.foto_geral_url ─────────────────────────────────────────────────
update public.consultas
set foto_geral_url = public.path_de_storage(foto_geral_url, 'imoveis-fotos')
where foto_geral_url like '%/object/public/imoveis-fotos/%';

-- ── consultas.fotos_antes / fotos_depois (arrays JSONB de string) ────────────
update public.consultas
set fotos_antes = (
  select jsonb_agg(public.path_de_storage(item #>> '{}', 'imoveis-fotos'))
  from jsonb_array_elements(fotos_antes) as item
)
where jsonb_typeof(fotos_antes) = 'array'
  and fotos_antes::text like '%/object/public/imoveis-fotos/%';

update public.consultas
set fotos_depois = (
  select jsonb_agg(public.path_de_storage(item #>> '{}', 'imoveis-fotos'))
  from jsonb_array_elements(fotos_depois) as item
)
where jsonb_typeof(fotos_depois) = 'array'
  and fotos_depois::text like '%/object/public/imoveis-fotos/%';

-- ── consultas.bagua_entrada.planta_url ───────────────────────────────────────
update public.consultas
set bagua_entrada = jsonb_set(
  bagua_entrada,
  '{planta_url}',
  to_jsonb(public.path_de_storage(bagua_entrada ->> 'planta_url', 'imoveis-fotos'))
)
where bagua_entrada ? 'planta_url'
  and bagua_entrada ->> 'planta_url' like '%/object/public/imoveis-fotos/%';

-- ── consultas.fotos_comodos[].fotos[] ────────────────────────────────────────
-- Estrutura: [{ comodo: text, fotos: [text, ...] }, ...]. Reconstruída inteira
-- porque `jsonb_set` não alcança um array dentro de outro array.
update public.consultas
set fotos_comodos = (
  select jsonb_agg(
    case
      when jsonb_typeof(comodo -> 'fotos') = 'array' then
        jsonb_set(comodo, '{fotos}', (
          select coalesce(jsonb_agg(public.path_de_storage(foto #>> '{}', 'imoveis-fotos')), '[]'::jsonb)
          from jsonb_array_elements(comodo -> 'fotos') as foto
        ))
      else comodo
    end
    order by indice
  )
  from jsonb_array_elements(fotos_comodos) with ordinality as t(comodo, indice)
)
where jsonb_typeof(fotos_comodos) = 'array'
  and fotos_comodos::text like '%/object/public/imoveis-fotos/%';

-- A função só serve a este backfill; não fica exposta via PostgREST.
revoke execute on function public.path_de_storage(text, text) from public, anon, authenticated;

-- ── Verificação (espera-se 0 em todas) ───────────────────────────────────────
--
--   select count(*) from public.clientes where foto_url like '%/object/public/%';
--   select count(*) from public.consultas
--   where foto_geral_url like '%/object/public/%'
--      or fotos_antes::text like '%/object/public/%'
--      or fotos_depois::text like '%/object/public/%'
--      or fotos_comodos::text like '%/object/public/%'
--      or bagua_entrada::text like '%/object/public/%';
