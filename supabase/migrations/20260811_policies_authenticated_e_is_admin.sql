-- ============================================================================
-- Follow-up do advisor: policies de PUBLIC → authenticated e is_admin() fora
-- do alcance de anon.
--
-- Contexto: `20260720_hardening_advisor.sql` deixou este item declarado como
-- pendente, e a razão está escrita lá:
--
--   "NÃO mexemos em is_admin(): as policies de billing (20260718) miram PUBLIC
--    e referenciam is_admin(), então anon precisa poder avaliá-la ao ler essas
--    tabelas. Revogar de anon quebraria essas leituras."
--
-- A ordem certa é a inversa: primeiro tirar essas policies do alcance de anon,
-- e só então revogar a função. É o que esta migration faz, nessa ordem.
--
-- Por que importa: `is_admin()` é SECURITY DEFINER e lê `profiles`. Executável
-- por anon, ela é uma primitiva de leitura privilegiada exposta sem sessão —
-- avaliável via PostgREST por qualquer um, ainda que só devolva boolean.
--
-- Verificado antes de escrever: nenhuma página anônima lê uma tabela cuja
-- policy referencie `is_admin()`. As três telas públicas (`/loja/[slug]`,
-- `/parceiros`, `/consultores`) leem apenas a view `perfis_publicos`, que é
-- SECURITY DEFINER e não passa por RLS (ADR 0006). `plans` não é lida por
-- nenhum client — só por rotas de servidor.
-- ============================================================================

-- ── 1. Policies que referenciam is_admin() saem de PUBLIC ────────────────────
--
-- Recriadas dinamicamente a partir do catálogo em vez de reescritas à mão: as
-- definições estão espalhadas por 11 migrations e uma lista fixa aqui nasceria
-- desatualizada. `TO authenticated` não muda o que cada policy permite — anon
-- não tem `auth.uid()` e já não casava com nenhuma delas.

do $$
declare
  p record;
  clausula_using text;
  clausula_check text;
  comando text;
  total int := 0;
begin
  for p in
    select schemaname, tablename, policyname, cmd, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and 'public' = any(roles)
      and coalesce(qual, '') || coalesce(with_check, '') like '%is_admin%'
  loop
    -- INSERT não aceita USING; SELECT/DELETE não aceitam WITH CHECK.
    clausula_using := case when p.qual is not null then format(' using (%s)', p.qual) else '' end;
    clausula_check := case when p.with_check is not null then format(' with check (%s)', p.with_check) else '' end;

    comando := case p.cmd
      when 'ALL' then 'all'
      when 'SELECT' then 'select'
      when 'INSERT' then 'insert'
      when 'UPDATE' then 'update'
      when 'DELETE' then 'delete'
    end;

    execute format('drop policy %I on %I.%I', p.policyname, p.schemaname, p.tablename);
    execute format(
      'create policy %I on %I.%I for %s to authenticated%s%s',
      p.policyname, p.schemaname, p.tablename, comando, clausula_using, clausula_check
    );

    total := total + 1;
  end loop;

  raise notice 'Policies reescritas para authenticated: %', total;
end $$;

-- ── 2. is_admin() deixa de ser executável sem sessão ─────────────────────────
--
-- `revoke ... from anon` sozinho não resolveria: o privilégio vem de PUBLIC, e
-- não se revoga de um papel o que ele tem por PUBLIC. Tira-se de PUBLIC e
-- devolve-se a quem precisa.

revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated, service_role;

-- ── Verificação (rodar após aplicar) ─────────────────────────────────────────
--
-- Nenhuma policy sobrando em PUBLIC referenciando is_admin (espera-se 0 linhas):
--
--   select tablename, policyname from pg_policies
--   where schemaname = 'public' and 'public' = any(roles)
--     and coalesce(qual,'') || coalesce(with_check,'') like '%is_admin%';
--
-- Quem pode executar a função (espera-se authenticated e service_role, sem anon):
--
--   select grantee, privilege_type from information_schema.routine_privileges
--   where routine_name = 'is_admin' and routine_schema = 'public';
--
-- Telas públicas continuam abrindo deslogado: /loja/<slug>, /parceiros,
-- /consultores.
--
-- ── Pendência que NÃO é SQL ──────────────────────────────────────────────────
--
-- "Leaked password protection" (advisor de Auth) é um toggle do dashboard:
-- Authentication > Providers > Email > "Prevent use of leaked passwords".
-- Não há como versioná-lo aqui; fica registrado para não sumir da lista.
