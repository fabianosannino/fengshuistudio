-- SECURITY DEFINER remains intentional for the public, opt-in projection.
-- Revoking only from PUBLIC did not remove grants held by the API roles.
-- This automatically updatable view must never be a second write path to profiles.
begin;

revoke all privileges on table public.perfis_publicos from public, anon, authenticated;

-- Table-level REVOKE does not remove independently granted column privileges.
do $$
declare
  columns text;
begin
  select string_agg(quote_ident(attname), ', ' order by attnum) into columns
    from pg_attribute
    where attrelid = 'public.perfis_publicos'::regclass
      and attnum > 0 and not attisdropped;
  execute format(
    'revoke insert (%s), update (%s), references (%s) on table public.perfis_publicos from public, anon, authenticated',
    columns, columns, columns
  );
end;
$$;

grant select on table public.perfis_publicos to anon, authenticated;

commit;
