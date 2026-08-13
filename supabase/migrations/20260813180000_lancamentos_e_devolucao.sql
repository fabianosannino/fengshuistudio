-- ═══════════════════════════════════════════════════════════════════════════
-- `pedido_lancamentos` e o evento `devolucao_solicitada` — fase 1 da loja
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ## Por que o dinheiro precisa de razão própria
--
-- Frete de ida, frete de volta, comissão da plataforma, estorno de comissão e
-- tarifa do gateway são **fatos financeiros diferentes**, com regras de
-- reversão e partes diferentes. Somar tudo em `pedidos.total_centavos` e tentar
-- desmontar depois é impossível: a soma já perdeu a informação.
--
-- A pergunta que este razão precisa responder é «quem ficou com o prejuízo
-- desta devolução?». Com o desenho abaixo ela é uma soma; com um campo de
-- sinal seria interpretação — e interpretação diverge entre a tela do
-- consultor e a do admin.
--
-- ## `pagador` e `recebedor`, não sinal
--
-- Cada lançamento diz **de quem** para **quem**, com valor sempre positivo. São
-- quatro partes possíveis, e a quarta é o que torna o modelo honesto:
--
--   comprador | consultor | plataforma | gateway
--
-- O `gateway` existe porque a tarifa do Stripe **não volta no reembolso**, e
-- ela saiu do saldo do consultor — numa cobrança direta é ele o vendedor. Sem
-- essa parte no razão, o dinheiro não fecharia e alguém acabaria «corrigindo»
-- a diferença com um ajuste sem procedência.
--
-- ## O desfecho de um arrependimento (decisão de 13/08)
--
--   comprador   → recebe tudo de volta
--   plataforma  → zero a zero: devolve a comissão que reteve
--   consultor   → perde a tarifa do gateway e o frete de volta
--
-- Modelo completo: `docs/domain/modelo-da-loja.md`, seção 12-A.

-- ── O evento que faltava ────────────────────────────────────────────────────
--
-- `devolucao_solicitada` é o fato que dispara a obrigação de devolver, e é
-- dele que corre o «de imediato» do CDC art. 49. Sem ele, a única data
-- disponível seria a do estorno — que é o efeito, não a causa, e não serve
-- para provar quando o consumidor pediu.

alter table public.pedido_eventos drop constraint if exists pedido_eventos_evento_check;
alter table public.pedido_eventos add constraint pedido_eventos_evento_check
  check (evento in (
    'iniciado', 'pago', 'cancelado', 'preparando', 'enviado',
    'entregue', 'devolucao_solicitada', 'reembolsado', 'contestado',
    'disputa_resolvida'
  ));

-- ── O razão ─────────────────────────────────────────────────────────────────

create table if not exists public.pedido_lancamentos (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references public.pedidos(id) on delete cascade,

  tipo text not null check (tipo in (
    'produto', 'frete', 'comissao_plataforma', 'tarifa_gateway',
    'reembolso', 'frete_devolucao', 'estorno_comissao'
  )),

  -- Sempre positivo. O sentido está nas partes, não no sinal.
  valor_centavos integer not null check (valor_centavos > 0),
  pagador text not null check (pagador in ('comprador', 'consultor', 'plataforma', 'gateway')),
  recebedor text not null check (recebedor in ('comprador', 'consultor', 'plataforma', 'gateway')),
  check (pagador <> recebedor),

  ocorrido_em timestamptz not null default now(),
  origem text not null check (origem in (
    'webhook_stripe', 'vendedor', 'comprador', 'admin', 'sistema'
  )),
  referencia text,
  motivo text,
  criado_em timestamptz not null default now()
);

comment on table public.pedido_lancamentos is
  'Razão do pedido. Append-only. Valor positivo; o sentido vem de pagador/recebedor.';

-- Append-only, pela mesma função que protege `pedido_eventos`.
-- Corrigir um lançamento errado é **acrescentar** o que corrige — um estorno é
-- um fato novo, nunca a edição do fato anterior.
drop trigger if exists pedido_lancamentos_sem_update on public.pedido_lancamentos;
create trigger pedido_lancamentos_sem_update
  before update or delete on public.pedido_lancamentos
  for each row execute function public.pedido_eventos_somente_insere();

create index if not exists idx_pedido_lancamentos_pedido
  on public.pedido_lancamentos (pedido_id, ocorrido_em);

-- Mesma idempotência estrutural de `pedido_eventos`: o webhook pode rodar de
-- novo de propósito (`retomado`, `sem_garantia`), e sem isto a segunda volta
-- duplicaria o lançamento — inventando dinheiro que não existiu.
create unique index if not exists idx_pedido_lancamentos_idempotencia
  on public.pedido_lancamentos (pedido_id, tipo, referencia)
  where referencia is not null;

-- ── RLS ─────────────────────────────────────────────────────────────────────
--
-- Mesma regra dos eventos: o vendedor lê o que é do pedido dele; escrita é só
-- `service_role`. Deixar o vendedor escrever no razão permitiria declarar um
-- estorno que nunca aconteceu.

alter table public.pedido_lancamentos enable row level security;

drop policy if exists "vendedor le os lancamentos dos proprios pedidos" on public.pedido_lancamentos;
create policy "vendedor le os lancamentos dos proprios pedidos"
  on public.pedido_lancamentos for select to authenticated
  using (exists (
    select 1 from public.pedidos p
    where p.id = pedido_lancamentos.pedido_id
      and (auth.uid() = p.vendedor_perfil_id or public.is_admin())
  ));

-- ── Frete no pedido ─────────────────────────────────────────────────────────
--
-- O checkout precisa cobrar frete, e `total_centavos` sozinho não diz quanto
-- dele era frete — informação que o arrependimento exige, porque o frete de
-- ida volta junto. A coluna é a projeção; o lançamento é o fato.

alter table public.pedidos
  add column if not exists frete_centavos integer not null default 0
  check (frete_centavos >= 0);
