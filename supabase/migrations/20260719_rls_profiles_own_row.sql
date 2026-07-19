-- ============================================================
-- RLS: profiles — leitura/edição do próprio perfil
-- ============================================================
--
-- Continuação do 20260719_rls_restore_consultor_dados.sql. `profiles` também
-- estava com RLS ligado e sem policy (deny-all) — e TODA página carrega o
-- perfil do usuário logado (para saber plano/role). Sem policy, essa leitura
-- voltava vazia e a app não conseguia determinar o plano.
--
-- Esta policy dá ao usuário acesso APENAS à própria linha (id = auth.uid()),
-- e ao admin, a todas. As colunas privilegiadas (role/plano/stripe_*)
-- continuam protegidas no UPDATE pelo trigger protect_profile_privileged_columns
-- (migration 20260718) — então liberar o próprio perfil é seguro.
--
-- FORA DE ESCOPO (PR próprio, precisa de decisão de produto):
--   • Leitura PÚBLICA (anon) do diretório de parceiros e da loja por slug,
--     que hoje leem `profiles` direto. Exige policy restrita a colunas
--     não-PII (nome, empresa, cidade, store_slug…) ou uma view pública,
--     para não expor cpf/telefone/stripe_*.

drop policy if exists "usuario_gerencia_proprio_profile" on public.profiles;
create policy "usuario_gerencia_proprio_profile" on public.profiles
  for all to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());
