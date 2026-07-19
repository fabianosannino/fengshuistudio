-- ============================================================
-- Restauração dos DEFAULTs de timestamp (achado da auditoria)
-- ============================================================
--
-- Mesma regressão de schema do 20260719_restore_id_defaults.sql: além do
-- `id`, as colunas de auditoria de tempo (`criado_em`, `atualizado_em`,
-- `created_at`, `updated_at`, `inicio`…) perderam o default `now()`. Como o
-- app não envia essas colunas no insert, qualquer INSERT novo falhava com
--   "null value in column \"criado_em\" violates not-null constraint".
--
-- CORREÇÃO
-- Restaura `default now()` em toda coluna `timestamptz NOT NULL` sem default.
-- `now()` é seguro: não altera linhas existentes e, se o app enviar o valor,
-- o valor enviado prevalece.

do $$
declare r record;
begin
  for r in
    select c.relname, a.attname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
    left join pg_attrdef ad on ad.adrelid = c.oid and ad.adnum = a.attnum
    where n.nspname = 'public'
      and c.relkind = 'r'
      and a.attnotnull
      and ad.adbin is null
      and format_type(a.atttypid, a.atttypmod) = 'timestamp with time zone'
  loop
    execute format(
      'alter table public.%I alter column %I set default now()',
      r.relname, r.attname
    );
    raise notice 'default now() restaurado em public.%.%', r.relname, r.attname;
  end loop;
end $$;
