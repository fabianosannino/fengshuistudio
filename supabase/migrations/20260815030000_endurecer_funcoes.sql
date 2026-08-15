-- ═══════════════════════════════════════════════════════════════════════════
-- Duas funções expostas mais do que deviam
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Achados do linter do Supabase, conferidos um a um. Dos nove avisos, sete são
-- decisões declaradas deste projeto — a seção final explica por que ficam.

-- ── 1. `produtos_toca_atualizado_em` sem `search_path` fixo ─────────────────
--
-- Foi escrita ontem, na fase 2, e saiu sem o `set search_path` que todas as
-- outras funções daqui têm. Com o caminho de busca mutável, quem puder criar
-- um objeto num schema que venha antes no `search_path` do papel que dispara o
-- trigger consegue fazer a função resolver `now()` — ou qualquer outro nome —
-- para código dele.
--
-- É trigger de `before update` numa tabela que só o `service_role` escreve, o
-- que estreita muito a exploração. Mas a defesa custa uma linha, e o valor de
-- ter uma regra («toda função fixa o search_path») é justamente não precisar
-- avaliar caso a caso se **esta** dá para explorar.

create or replace function public.produtos_toca_atualizado_em()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.atualizado_em := now();
  return new;
end;
$$;

-- ── 2. `pedido_eventos_somente_insere` alcançável por RPC ───────────────────
--
-- É a função de trigger que garante o append-only de `pedido_eventos`. Como
-- toda função do schema `public`, ela nasceu com `EXECUTE` para `public` — e
-- portanto chamável por `anon` em
-- `/rest/v1/rpc/pedido_eventos_somente_insere`.
--
-- O efeito prático hoje é nulo: o corpo dela só levanta exceção, então chamar
-- direto devolve erro e nada mais. Mas «hoje é inofensiva» é uma propriedade
-- do corpo, não do desenho — e ela é `security definer`, o que significa que
-- qualquer coisa que passe a fazer, faz com privilégio do dono.
--
-- Função de trigger não precisa de `EXECUTE` para quem dispara o trigger: a
-- checagem de privilégio acontece no `create trigger`, não a cada linha.
-- Conferido em transação revertida: com o `revoke` aplicado, `UPDATE` e
-- `DELETE` em `pedido_eventos` continuam sendo recusados pela mesma mensagem.

revoke execute on function public.pedido_eventos_somente_insere() from anon, authenticated, public;

-- ── O que NÃO foi mexido, e por quê ─────────────────────────────────────────
--
-- **`is_admin()` executável por `authenticated`** — o linter avisa, e revogar
-- quebraria o app inteiro: **39 policies** de RLS chamam essa função, e uma
-- policy roda no contexto de quem consulta. Sem `EXECUTE`, todo `select` do
-- usuário autenticado passaria a falhar. Conferido antes de decidir.
--
-- **`produtos`, `cliques_de_indicacao`, `eventos_stripe` e `disputas_stripe`
-- com RLS ligado e nenhuma policy** — é o desenho, não esquecimento. Zero
-- policies significa que ninguém lê sem `service_role`; o que é público sai
-- por rota, com lista branca de colunas. É o que mantém `arquivo_path` e
-- `link_externo` fora da vitrine.
--
-- **`perfis_publicos` como `security definer`** — ADR 0028. A view existe
-- justamente para publicar um recorte de `profiles` sem abrir a tabela.
--
-- Deixar isto escrito importa: são avisos que vão reaparecer em toda execução
-- do linter, e sem a razão registrada alguém «corrige» o `is_admin` num dia de
-- faxina e derruba a leitura de todo mundo.
