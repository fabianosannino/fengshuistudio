-- ═══════════════════════════════════════════════════════════════════════════
-- `eventos_stripe` — cada evento do Stripe processado uma vez só
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ## O problema
--
-- O Stripe **reentrega** eventos: quando o endpoint demora, responde erro, ou
-- por decisão dele. E **não garante ordem**: um `subscription.updated` antigo
-- pode chegar depois de um mais novo.
--
-- O webhook deduplicava por `gateway_subscription_id` — «já existe assinatura
-- com este id, pulo». Isso protege contra criar duas linhas, e só. Uma
-- reentrega de `updated` reprocessa; uma entrega fora de ordem sobrescreve o
-- estado novo com o velho, e a assinatura volta a um passado que já não é
-- verdade.
--
-- Com loja e afiliados o risco cresce: um `charge.refunded` reprocessado
-- estornaria a comissão duas vezes.
--
-- ## O desenho
--
-- Uma linha por evento, com o `event_id` como chave primária — é o Postgres
-- que garante a unicidade, não uma consulta antes da escrita, que sempre tem
-- corrida entre o `select` e o `insert`.
--
-- `processado_em` separa dois estados que parecem um só:
--
-- - linha existe **com** `processado_em` → já foi feito, descartar;
-- - linha existe **sem** `processado_em` → uma tentativa anterior morreu no
--   meio. Reprocessar é o certo, e é por isso que a coluna não é `boolean`
--   com default.
--
-- `objeto_id` e `criado_em_stripe` respondem a ordenação: antes de aplicar um
-- evento a um objeto, dá para perguntar se já houve outro mais novo sobre o
-- mesmo objeto.
--
-- ## Retenção
--
-- A tabela cresce para sempre se ninguém limpar. Não há expurgo aqui de
-- propósito: apagar evento é perder a capacidade de responder «por que este
-- valor mudou?». Quando o volume pedir, o expurgo vira decisão consciente,
-- com prazo escrito — não um default que ninguém escolheu.

create table if not exists public.eventos_stripe (
  -- O `evt_...` do Stripe. Chave primária: a unicidade é do banco.
  event_id text primary key,
  tipo text not null,
  -- Qual endpoint recebeu. Os dois webhooks compartilham esta tabela, e um
  -- evento pode legitimamente chegar aos dois.
  endpoint text not null,
  -- O objeto que o evento descreve (`sub_...`, `ch_...`, `in_...`).
  objeto_id text,
  -- `event.created`, do Stripe. É o relógio que ordena, não o nosso.
  criado_em_stripe timestamptz not null,
  recebido_em timestamptz not null default now(),
  -- Nulo enquanto não terminou. Ver a nota sobre os dois estados.
  processado_em timestamptz,
  -- Preenchido quando o processamento falhou, para investigação.
  erro text
);

-- Ordenação por objeto: «houve evento mais novo sobre este mesmo objeto?»
create index if not exists idx_eventos_stripe_objeto
  on public.eventos_stripe (objeto_id, criado_em_stripe desc);

-- Investigação: o que falhou, e o que ficou pela metade.
create index if not exists idx_eventos_stripe_pendentes
  on public.eventos_stripe (recebido_em desc)
  where processado_em is null;

alter table public.eventos_stripe enable row level security;

-- Sem policy: nenhum usuário autenticado lê ou escreve. Só o `service_role`,
-- que ignora RLS por definição, e é quem os webhooks usam. Registro de evento
-- de pagamento não tem por que ser visível ao dono da conta — e menos ainda
-- aos outros.
comment on table public.eventos_stripe is
  'Idempotência e ordenação dos webhooks do Stripe. Sem policy: service_role apenas.';
