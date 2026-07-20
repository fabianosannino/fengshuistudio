-- ============================================================
-- Endurecimento de achados do advisor de segurança
-- ============================================================
--
-- 1) Views SECURITY DEFINER não usadas e com vazamento cross-tenant
--    `vw_dashboard_consultor` e `vw_rituais_pendentes` são views
--    SECURITY DEFINER (rodam com privilégio do criador → furam o RLS) que:
--      • NÃO filtram por auth.uid() (agregam/expõem dados de TODOS os
--        consultores, inclusive nomes de clientes em rituais);
--      • têm SELECT concedido a anon e authenticated → expostas via PostgREST
--        (`/rest/v1/vw_...`);
--      • NÃO são usadas por nenhuma tela (grep no código = 0 usos) e nada
--        no banco depende delas.
--    Eram o que mascarava o incidente de RLS. Agora que o RLS foi restaurado,
--    são só superfície de ataque morta → DROP.
--
-- 2) Trigger function chamável via RPC
--    `protect_profile_privileged_columns()` é uma função de TRIGGER; não deve
--    ser executável diretamente por anon/authenticated (advisor 0028/0029). O
--    trigger continua funcionando após o REVOKE (a invocação por trigger não
--    depende do EXECUTE do chamador).
--
-- NÃO mexemos em `is_admin()`: as policies de billing (20260718) miram PUBLIC
-- e referenciam is_admin(), então anon precisa poder avaliá-la ao ler essas
-- tabelas (ex.: `plans`). Revogar de anon quebraria essas leituras. A view
-- `perfis_publicos` (ADR 0006) segue SECURITY DEFINER de propósito.

drop view if exists public.vw_dashboard_consultor;
drop view if exists public.vw_rituais_pendentes;

revoke execute on function public.protect_profile_privileged_columns()
  from public, anon, authenticated;
