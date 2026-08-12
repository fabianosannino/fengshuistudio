-- ============================================================================
-- Backfill: URL pública legada → path do objeto
--
-- ## O que muda
--
-- Seis campos guardam referência de foto, e as linhas antigas guardam a **URL
-- pública completa** em vez do path do objeto no bucket. Esta migration
-- converte para path.
--
-- ## O que NÃO muda
--
-- **Nada quebra sem ela, e nada passa a funcionar com ela.** As duas formas já
-- são aceitas por `caminhoDoObjeto()` (`src/lib/storage-imagens.ts`), e foi
-- justamente essa escolha que permitiu fechar os buckets (C8) sem colocar uma
-- migração de dados no caminho crítico de uma correção de exposição de dado
-- pessoal — ver ADR 0022.
--
-- Ou seja: isto é limpeza, não correção. O ganho é que o path é mais curto e
-- não embute o domínio do projeto, então trocar de projeto Supabase deixa de
-- exigir reescrita de linha.
--
-- ## Idempotência
--
-- Cada `update` filtra por `like 'http%'`, então rodar duas vezes não faz nada
-- na segunda. Valores que já são path ficam intactos, e `data:`/`blob:` — que
-- aparecem em `bagua_imagem` — não casam com o filtro e também ficam.
-- ============================================================================

-- ── Campos de texto simples ─────────────────────────────────────────────────

update public.clientes
set foto_url = regexp_replace(foto_url, '^https?://[^/]+/storage/v1/object/(public|sign)/clientes-fotos/', '')
where foto_url like 'http%' and foto_url like '%/clientes-fotos/%';

update public.consultas
set foto_geral_url = regexp_replace(foto_geral_url, '^https?://[^/]+/storage/v1/object/(public|sign)/imoveis-fotos/', '')
where foto_geral_url like 'http%' and foto_geral_url like '%/imoveis-fotos/%';

-- ── planta_url, dentro do JSONB de entrada do Ba Guá ────────────────────────

update public.consultas
set bagua_entrada = jsonb_set(
      bagua_entrada,
      '{planta_url}',
      to_jsonb(regexp_replace(
        bagua_entrada->>'planta_url',
        '^https?://[^/]+/storage/v1/object/(public|sign)/imoveis-fotos/', ''
      ))
    )
where bagua_entrada->>'planta_url' like 'http%'
  and bagua_entrada->>'planta_url' like '%/imoveis-fotos/%';

-- ── Arrays de URL: fotos_antes e fotos_depois ───────────────────────────────
--
-- `jsonb_agg` sobre os elementos, preservando a ordem original.

update public.consultas c
set fotos_antes = (
  select jsonb_agg(
           to_jsonb(regexp_replace(
             elem #>> '{}',
             '^https?://[^/]+/storage/v1/object/(public|sign)/imoveis-fotos/', ''
           ))
           order by ord
         )
  from jsonb_array_elements(c.fotos_antes) with ordinality as t(elem, ord)
)
where jsonb_typeof(c.fotos_antes) = 'array'
  and c.fotos_antes::text like '%/imoveis-fotos/%';

update public.consultas c
set fotos_depois = (
  select jsonb_agg(
           to_jsonb(regexp_replace(
             elem #>> '{}',
             '^https?://[^/]+/storage/v1/object/(public|sign)/imoveis-fotos/', ''
           ))
           order by ord
         )
  from jsonb_array_elements(c.fotos_depois) with ordinality as t(elem, ord)
)
where jsonb_typeof(c.fotos_depois) = 'array'
  and c.fotos_depois::text like '%/imoveis-fotos/%';

-- ── fotos_comodos: array de objetos, cada um com um array `fotos` ───────────

update public.consultas c
set fotos_comodos = (
  select jsonb_agg(
           case
             when jsonb_typeof(comodo->'fotos') = 'array' then
               jsonb_set(comodo, '{fotos}', (
                 select coalesce(jsonb_agg(
                          to_jsonb(regexp_replace(
                            f #>> '{}',
                            '^https?://[^/]+/storage/v1/object/(public|sign)/imoveis-fotos/', ''
                          ))
                          order by fo
                        ), '[]'::jsonb)
                 from jsonb_array_elements(comodo->'fotos') with ordinality as g(f, fo)
               ))
             else comodo
           end
           order by ord
         )
  from jsonb_array_elements(c.fotos_comodos) with ordinality as t(comodo, ord)
)
where jsonb_typeof(c.fotos_comodos) = 'array'
  and c.fotos_comodos::text like '%/imoveis-fotos/%';

-- ── Verificação (espera-se 0 em todas as colunas) ───────────────────────────
--
--   select
--     count(*) filter (where foto_url like 'http%')        as clientes_url,
--     0 as _
--   from public.clientes
--   union all
--   select
--     count(*) filter (where foto_geral_url like 'http%')
--     + count(*) filter (where bagua_entrada->>'planta_url' like 'http%')
--     + count(*) filter (where fotos_antes::text like '%/imoveis-fotos/%')
--     + count(*) filter (where fotos_depois::text like '%/imoveis-fotos/%')
--     + count(*) filter (where fotos_comodos::text like '%/imoveis-fotos/%'),
--     0
--   from public.consultas;
