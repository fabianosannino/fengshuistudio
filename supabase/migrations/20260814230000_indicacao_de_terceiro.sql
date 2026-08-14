-- ═══════════════════════════════════════════════════════════════════════════
-- Fase 4 (indicação) — o terceiro vende na loja dele, e nós medimos o que
-- mandamos para lá
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ## As duas modalidades, e por que a diferença precisa ser estrutural
--
-- Um produto de terceiro pode ser vendido de dois jeitos:
--
-- - **indicação** — o terceiro vende na loja dele, o dinheiro **não** passa
--   por aqui, e nós ganhamos comissão sobre o que encaminhamos;
-- - **marketplace** — a cobrança passa por nós.
--
-- A diferença não é de arrumação de tela. No marketplace deixamos de ser
-- vitrine e viramos intermediário, e o CDC trata a cadeia de fornecimento como
-- **solidária**: o comprador escolhe de quem cobrar quando o terceiro não
-- entrega. Descobrir de qual tipo era o produto no meio de uma reclamação é
-- tarde — daí a constraint, em vez de convenção.
--
-- ## O que estava aqui antes
--
-- `produtos_afiliados` existe com RLS e duas policies, e tem **zero linhas**:
-- nada escreve nela. O que a tela `/produtos` mostra é um catálogo escrito à
-- mão dentro do componente, sem link nenhum — todo item cai no rótulo «Em
-- breve», sob um aviso que promete redirecionar para «a loja parceira».
--
-- É a mesma forma de `store_orders` antes da fase 0: tabela pronta, promessa na
-- tela e nada ligando as duas. A indicação passa a viver em `produtos`, junto
-- do resto do catálogo, com o link e a medição que tornam a comissão cobrável.

-- ── produtos: o link e o parceiro ───────────────────────────────────────────

alter table public.produtos
  add column if not exists link_externo text,
  -- Quem vende do outro lado. Texto, e não FK para `profiles`, porque no
  -- começo o parceiro **não tem conta aqui** — exigir cadastro dele para
  -- cadastrar o produto inverteria a ordem do combinado comercial.
  add column if not exists parceiro text;

comment on column public.produtos.link_externo is
  'Destino da indicação. Obrigatório em indicacao, proibido em marketplace.';

-- A bicondicional é o ponto: link sem indicação é tão errado quanto indicação
-- sem link. Um produto de marketplace com link externo teria dois caminhos de
-- compra, e o comprador escolheria o que não passa pelo nosso pedido.
alter table public.produtos drop constraint if exists produtos_indicacao_tem_link;
alter table public.produtos add constraint produtos_indicacao_tem_link check (
  (modo_de_venda = 'indicacao') = (link_externo is not null)
);

-- ── cliques_de_indicacao ────────────────────────────────────────────────────
--
-- O que torna a comissão cobrável: sem medida do que mandamos, «quanto você
-- nos deve» vira negociação sobre memória.
--
-- **Não guarda quem clicou.** Nem IP, nem hash de visitante, nem sessão. Para
-- cobrar o parceiro basta volume, e guardar identidade seria coletar dado
-- pessoal para uma pergunta que ninguém faz — o oposto do que a LGPD pede.
--
-- Atribuição de afiliado (fase 5) é outra coisa e vai precisar de
-- `indicacoes`, com prazo e visitante: lá a pergunta é «quem trouxe este
-- comprador», e ela não tem resposta sem identificar a visita.
create table if not exists public.cliques_de_indicacao (
  id uuid primary key default gen_random_uuid(),
  produto_id uuid not null references public.produtos(id) on delete cascade,
  ocorrido_em timestamptz not null default now()
);

comment on table public.cliques_de_indicacao is
  'Volume encaminhado ao parceiro. Não identifica o visitante — de propósito.';

create index if not exists idx_cliques_de_indicacao_produto
  on public.cliques_de_indicacao (produto_id, ocorrido_em desc);

-- Mesma decisão de `produtos`: RLS ligado, nenhuma policy. Quem escreve é a
-- rota de redirecionamento, com `service_role`; quem lê é o admin.
alter table public.cliques_de_indicacao enable row level security;

-- ── produtos_afiliados: declarada morta ─────────────────────────────────────
--
-- Não é apagada agora — apagar tabela é irreversível e ela não custa nada
-- vazia. Fica o comentário, para a próxima pessoa não escrever nela achando
-- que é o caminho vivo.
comment on table public.produtos_afiliados is
  'MORTA desde 14/08/2026: zero linhas, nada escreve. A indicação vive em produtos (modo_de_venda = indicacao).';
