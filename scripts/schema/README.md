# Snapshot do schema

`supabase/schema/00-schema-base.sql` é um **retrato** do banco de produção, não
uma migration. Existe porque as tabelas centrais deste sistema nunca foram
criadas por migration — nasceram no SQL Editor, e por isso viviam só no banco
vivo. Em julho isso custou caro: um restore reconstruiu a estrutura de uma fonte
incompleta e levou junto todos os defaults, todas as policies e todas as
constraints exceto as primary keys.

## Quando regerar

Depois de qualquer mudança estrutural aplicada fora de uma migration. Se toda
mudança passar por `supabase/migrations/`, o snapshot só precisa de conferência
periódica — e divergir dele é sinal de que alguém mexeu direto no banco.

## Como regerar

As três consultas abaixo produzem as três seções do arquivo. Rodam no SQL Editor
do Supabase ou por qualquer client com acesso ao catálogo — não precisam de
service_role, só de permissão de leitura em `pg_catalog`.

### 1. Tipos enumerados

```sql
select string_agg(ddl, E'\n' order by nome)
from (
  select t.typname as nome,
         'create type public.' || quote_ident(t.typname) || ' as enum (' ||
         string_agg(quote_literal(e.enumlabel), ', ' order by e.enumsortorder) || ');' as ddl
  from pg_type t
  join pg_namespace n on n.oid = t.typnamespace
  join pg_enum e on e.enumtypid = t.oid
  where n.nspname = 'public' and t.typtype = 'e'
  group by t.typname
) x;
```

### 2. Tabelas com colunas, tipos e defaults

```sql
select string_agg(bloco, E'\n\n' order by tabela)
from (
  select c.relname as tabela,
    'create table if not exists public.' || quote_ident(c.relname) || ' (' || E'\n  ' ||
    string_agg(
      quote_ident(a.attname) || ' ' || format_type(a.atttypid, a.atttypmod) ||
      coalesce(' default ' || pg_get_expr(d.adbin, d.adrelid), '') ||
      case when a.attnotnull then ' not null' else '' end,
      E',\n  ' order by a.attnum
    ) || E'\n);' as bloco
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
  left join pg_attrdef d on d.adrelid = c.oid and d.adnum = a.attnum
  where n.nspname = 'public' and c.relkind = 'r'
  group by c.relname
) x;
```

### 3. Constraints — conferência

As constraints **já estão versionadas** em
`supabase/migrations/20260720_restore_constraints.sql`, então não entram no
snapshot. Esta consulta serve para conferir que a migration e o banco não
divergiram:

```sql
select case c.contype when 'p' then 1 when 'u' then 2 when 'c' then 3 else 4 end as ordem,
       t.relname as tabela, c.conname as nome, pg_get_constraintdef(c.oid) as definicao
from pg_constraint c
join pg_class t on t.oid = c.conrelid
join pg_namespace n on n.oid = t.relnamespace
where n.nspname = 'public' and c.contype in ('p','u','c','f')
order by ordem, tabela, nome;
```

Em 12/08/2026 o banco tinha 25 primary keys, 3 uniques, 3 checks e 36 chaves
estrangeiras.

## Ordem de uma reconstrução do zero

1. `supabase/schema/00-schema-base.sql` — tipos e tabelas
2. `supabase/migrations/20260720_restore_constraints.sql` — PKs, FKs, uniques, checks
3. As demais migrations em ordem — policies, triggers, defaults, índices

O que **não** está coberto por nenhum dos três: os buckets de storage e suas
policies, que ficam em `20260724_hotfix_pos_incidente.sql` e
`20260811_fechar_buckets_privados.sql` (este último em `migrations-manuais/`).
