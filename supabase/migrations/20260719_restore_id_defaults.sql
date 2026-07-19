-- ============================================================
-- Restauração dos DEFAULTs de id (achado da auditoria)
-- ============================================================
--
-- CONTEXTO
-- Toda tabela do schema public estava com a coluna `id uuid NOT NULL` SEM
-- default (`gen_random_uuid()`). O app nunca envia `id` no insert — dependia
-- do default do banco. Sem ele, qualquer INSERT novo falha com
--   "null value in column \"id\" violates not-null constraint".
--
-- Efeito: o app não conseguia mais CRIAR registros (consultas, clientes,
-- setores, critérios, rituais, pagamentos…). As linhas existentes são
-- legado (criadas quando o default ainda existia). Junto com a ausência de
-- policies de RLS (ver 20260719_rls_restore_consultor_dados.sql), isso é
-- consistente com um restore/rebuild do banco que não reaplicou o schema.
--
-- CORREÇÃO
-- Restaura `default gen_random_uuid()` em toda coluna `id` do tipo uuid que
-- esteja sem default. Adicionar um default NÃO altera linhas existentes;
-- só passa a valer para novos inserts.
--
-- EXCLUSÕES
--   • `profiles.id` — é igual a `auth.users.id` (preenchido no signup pelo
--     trigger de auth); não deve ganhar um uuid aleatório.
--   • `audit_log.id` — é `bigint` (sequência/identity é outro assunto).

do $$
declare r record;
begin
  for r in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    join pg_attribute a on a.attrelid = c.oid and a.attname = 'id'
      and a.attnum > 0 and not a.attisdropped
    left join pg_attrdef ad on ad.adrelid = c.oid and ad.adnum = a.attnum
    where n.nspname = 'public'
      and c.relkind = 'r'
      and format_type(a.atttypid, a.atttypmod) = 'uuid'
      and ad.adbin is null              -- sem default
      and c.relname <> 'profiles'       -- id vem de auth.users
  loop
    execute format(
      'alter table public.%I alter column id set default gen_random_uuid()',
      r.relname
    );
    raise notice 'default gen_random_uuid() restaurado em public.%', r.relname;
  end loop;
end $$;
