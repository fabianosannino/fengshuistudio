-- ═══════════════════════════════════════════════════════════════════════════
-- `disputas_stripe` — contestações de cobrança
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ## O buraco
--
-- O webhook não escutava `charge.dispute.*`. Uma contestação é dinheiro
-- saindo — o Stripe retém o valor no ato de abertura e cobra uma taxa —, e o
-- app não ficava sabendo. O consultor seguia com o plano ativo, o painel
-- seguia contando aquela receita, e a primeira notícia viria pelo extrato.
--
-- ## Por que uma tabela, e não só um log
--
-- Disputa tem **ciclo de vida**: abre, o Stripe dá prazo para responder,
-- fecha ganha ou perdida. Um log registra o instante e perde o estado; a
-- pergunta operacional é «quais disputas estão abertas agora e até quando
-- posso responder?», e log não responde isso.
--
-- É também o começo do razão de dinheiro que a loja e os afiliados vão
-- precisar: um fato de dinheiro, com origem (`event_id`) e desfecho.
--
-- ## O que não está aqui
--
-- Nenhuma ação automática sobre o plano. Disputa aberta **não** é venda
-- perdida: pode ser ganha, e rebaixar quem contestou por engano seria punir
-- antes do veredito. Disputa perdida é decisão do dono — está declarado no
-- handler e no README.

create table if not exists public.disputas_stripe (
  -- O `dp_...` do Stripe.
  id text primary key,
  charge_id text not null,
  customer_id text,
  -- Perfil correspondente, quando dá para achar pelo `stripe_customer_id`.
  user_id uuid references public.profiles(id) on delete set null,
  -- Em reais, como o resto das tabelas de dinheiro deste projeto.
  valor numeric(10,2) not null,
  moeda text not null default 'brl',
  -- `warning_needs_response`, `needs_response`, `under_review`, `won`, `lost`…
  status text not null,
  motivo text,
  -- Prazo do Stripe para responder. É a coluna que torna a tabela operacional.
  responder_ate timestamptz,
  aberta_em timestamptz not null,
  fechada_em timestamptz,
  -- Desfecho, quando fecha: `won` ou `lost`.
  desfecho text,
  -- De onde veio a última escrita. Toda linha de dinheiro guarda a origem.
  event_id text,
  atualizada_em timestamptz not null default now()
);

create index if not exists idx_disputas_stripe_abertas
  on public.disputas_stripe (aberta_em desc)
  where fechada_em is null;

create index if not exists idx_disputas_stripe_user
  on public.disputas_stripe (user_id, aberta_em desc);

alter table public.disputas_stripe enable row level security;

-- Sem policy para `authenticated`: só o `service_role` (webhooks) e o admin,
-- que já opera por rotas com service_role. Contestação é assunto entre a
-- plataforma e o adquirente; o titular vê pelo próprio banco, não aqui.
comment on table public.disputas_stripe is
  'Contestações de cobrança. Sem policy: service_role apenas.';
