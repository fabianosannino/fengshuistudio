-- ============================================================
-- Leitura pública de profiles — view restrita a colunas não-PII
-- ============================================================
--
-- CONTEXTO
-- Após restaurar o RLS (20260719_rls_profiles_own_row), `profiles` ficou
-- deny-all para anon — o que quebrou as telas PÚBLICAS que liam profiles
-- direto: diretório de parceiros (/parceiros), lista de consultores
-- (/consultores) e a loja por slug (/loja/[slug]).
--
-- Não dá para resolver com uma policy de SELECT para anon em `profiles`,
-- porque RLS é por LINHA, não por COLUNA — uma policy exporia TODAS as
-- colunas (cpf, telefone, cnpj, stripe_customer_id, plano, role…) das linhas
-- visíveis. A forma correta de expor um SUBCONJUNTO de colunas é uma view.
--
-- DESIGN
-- `perfis_publicos` expõe apenas colunas NÃO-PII, e apenas de perfis que
-- optaram por ser públicos (`parceiro_visivel = true`) ou que têm uma loja
-- publicada (`store_slug` preenchido). A view roda com o privilégio do dono
-- (bypassa o RLS de `profiles` de forma controlada) e recebe SELECT para
-- anon/authenticated. É intencional que o advisor a liste como
-- "security definer view": é exatamente o mecanismo que limita as colunas.
--
-- NUNCA expõe: cpf, cnpj, telefone, role, plano, stripe_customer_id,
-- datas de trial/plano, ultimo_acesso, consultor_id.
-- `stripe_account_id` (acct_… do Connect) é incluído porque a loja pública
-- precisa dele para listar os produtos da conta; só aparece para perfis
-- públicos/com loja. (Melhoria futura: mover essa busca para uma rota de API.)

drop view if exists public.perfis_publicos;
create view public.perfis_publicos
with (security_invoker = false)
as
  select
    id,
    nome_completo,
    nome_empresa,
    bio,
    profissao,
    especialidade,
    area_atuacao,
    registro_profissional,
    cidade,
    estado,
    site,
    instagram,
    linkedin,
    avatar_url,
    logo_url,
    cor_primaria,
    cor_secundaria,
    tipo_usuario,
    store_slug,
    parceiro_visivel,
    stripe_account_id
  from public.profiles
  where parceiro_visivel = true
     or store_slug is not null;

revoke all on public.perfis_publicos from public;
grant select on public.perfis_publicos to anon, authenticated;
