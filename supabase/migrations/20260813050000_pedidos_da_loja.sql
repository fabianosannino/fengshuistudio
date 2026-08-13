-- ═══════════════════════════════════════════════════════════════════════════
-- `pedidos` e `pedido_eventos` — a venda da loja passa a existir deste lado
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ## O defeito
--
-- `store_orders` existe desde abril, com RLS, índice único e FK. E tem zero
-- linhas, porque **nada escreve nela**. O checkout da loja cria a sessão no
-- Stripe e termina ali; não há tratamento de `checkout.session.completed` em
-- lugar nenhum.
--
-- Consequência: uma venda move dinheiro e não deixa registro aqui. A tela
-- «Vendas Recentes» lê `store_orders` e mostraria vazio para sempre, e a taxa
-- de 10% seria retida sem número para conferir nem para documentar.
--
-- É a mesma forma do defeito da assinatura antes da reconciliação: o fato
-- existe no Stripe e não existe aqui.
--
-- ## Por que não é só «passar a escrever em store_orders»
--
-- Porque `store_orders` tem uma coluna `status` sobrescrita, e é exatamente o
-- desenho que o projeto passou 13/08 desfazendo em dois lugares: «atrasado»
-- gravado em vez de derivado da data, plano gravado sem a procedência que
-- permite desfazer só a parte certa.
--
-- Um pedido muda de estado por caminhos independentes — pagamento, envio,
-- reembolso, contestação — e cada um chega por uma origem diferente, às vezes
-- fora de ordem. Uma coluna que guarda só o último valor não sabe dizer quem
-- escreveu, quando, nem o que havia antes.
--
-- ## O desenho
--
-- `pedido_eventos` é append-only: cada linha é um fato com data, origem e
-- motivo. O estado corrente é **derivado** — ver `estadoDoPedido` em
-- `src/lib/pedidos-da-loja.ts`. É o ADR 0027 aplicado ao pedido.
--
-- Efeito colateral que vale nomear: **entrega fora de ordem deixa de
-- corromper**. O estado sai da precedência entre os eventos, não da ordem em
-- que eles chegaram, então um `pago` que chega depois de um `reembolsado` não
-- desfaz o reembolso. Com coluna sobrescrita, desfaria.
--
-- Modelo completo: `docs/domain/modelo-da-loja.md`. Esta migration é a fase 0.

-- ── pedidos ─────────────────────────────────────────────────────────────────

create table if not exists public.pedidos (
  id uuid primary key default gen_random_uuid(),

  -- Humano, para o suporte conseguir falar do pedido ao telefone.
  numero text not null unique default (
    'P' || to_char(now(), 'YYMMDD') || '-' || upper(substr(gen_random_uuid()::text, 1, 6))
  ),

  -- Um pedido tem **um** vendedor e **um** tipo. Não é preferência de
  -- modelagem: um direct charge acontece numa conta conectada só, então um
  -- pedido que mistura vendedores é um objeto que o Stripe não consegue pagar.
  tipo text not null check (tipo in ('servico', 'bem_proprio', 'bem_de_terceiro')),
  vendedor_tipo text not null check (vendedor_tipo in ('consultor', 'plataforma', 'terceiro')),
  -- Nulo quando quem vende é a própria plataforma.
  vendedor_perfil_id uuid references public.profiles(id) on delete set null,

  -- O comprador da loja não tem conta na plataforma. O e-mail chega pela
  -- sessão do Stripe, só na confirmação — por isso nasce nulo.
  -- É dado pessoal: ver docs/security/threat-model.md.
  comprador_email text,
  comprador_nome text,

  stripe_session_id text unique,
  stripe_payment_intent text,
  stripe_account_id text,

  moeda text not null default 'BRL',
  total_centavos integer not null check (total_centavos >= 0),
  taxa_plataforma_centavos integer not null default 0 check (taxa_plataforma_centavos >= 0),

  criado_em timestamptz not null default now()

  -- NÃO existe coluna `status`. É o ponto inteiro desta migration.
  -- Quem for adicionar uma: o estado sai de `pedido_eventos`, e gravá-lo aqui
  -- recria as duas verdades — sendo a gravada a que envelhece.
);

comment on table public.pedidos is
  'Venda da loja. O estado NÃO fica aqui: é derivado de pedido_eventos (ADR 0027).';

-- ── pedido_itens ────────────────────────────────────────────────────────────

create table if not exists public.pedido_itens (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references public.pedidos(id) on delete cascade,

  -- Fotografia do instante da compra, **não** referência a catálogo vivo.
  -- O vendedor edita o produto amanhã; o que o comprador pagou hoje não pode
  -- mudar junto. Um pedido que lê o preço atual é um recibo que reescreve o
  -- passado — e isso só aparece numa contestação, que é tarde.
  nome text not null,
  descricao text,
  preco_unitario_centavos integer not null check (preco_unitario_centavos >= 0),
  quantidade integer not null check (quantidade > 0),

  stripe_price_id text,
  criado_em timestamptz not null default now()
);

-- ── pedido_eventos ──────────────────────────────────────────────────────────

create table if not exists public.pedido_eventos (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references public.pedidos(id) on delete cascade,

  -- A fase 0 só produz `iniciado`, `pago`, `reembolsado` e `contestado`.
  -- Os demais entram agora para que a fase 1 não precise de migration nova.
  evento text not null check (evento in (
    'iniciado', 'pago', 'cancelado', 'preparando', 'enviado',
    'entregue', 'reembolsado', 'contestado', 'disputa_resolvida'
  )),

  -- Quando o fato aconteceu — não quando a linha foi escrita. É o que permite
  -- reconstituir a ordem quando a entrega vem embaralhada.
  ocorrido_em timestamptz not null default now(),

  origem text not null check (origem in (
    'webhook_stripe', 'vendedor', 'comprador', 'admin', 'sistema'
  )),
  -- `evt_...` do Stripe, id do admin — conforme a origem.
  referencia text,
  motivo text,
  dados jsonb,

  criado_em timestamptz not null default now()
);

comment on table public.pedido_eventos is
  'Append-only. O estado corrente do pedido é derivado daqui, nunca gravado.';

-- Append-only de verdade, não por combinação.
--
-- Sem isto, «append-only» é um comentário que a próxima pessoa com acesso ao
-- service_role desfaz sem perceber — e o valor da tabela é exatamente não ter
-- sido editada. Corrigir um evento errado é **acrescentar** o que corrige.
--
-- O `delete` é barrado junto com o `update`, e isso tem duas consequências que
-- precisam estar escritas em vez de descobertas:
--
-- 1. **`delete from pedidos` falha**, porque o cascade esbarra aqui. É o
--    desfecho certo: venda registrada é documento com prazo de guarda fiscal,
--    não linha descartável. Apagar um evento para mudar o estado derivado
--    reescreveria o passado tão bem quanto um `update`.
-- 2. **Apagar dado pessoal (LGPD) é anonimizar, não deletar.** O PII do
--    comprador mora em `pedidos` (`comprador_email`, `comprador_nome`), que
--    não tem este trigger. O pedido continua; quem comprou deixa de constar.
create or replace function public.pedido_eventos_somente_insere()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception 'pedido_eventos é append-only: use INSERT para corrigir, nunca % ', tg_op;
end;
$$;

drop trigger if exists pedido_eventos_sem_update on public.pedido_eventos;
create trigger pedido_eventos_sem_update
  before update or delete on public.pedido_eventos
  for each row execute function public.pedido_eventos_somente_insere();

-- ── Índices ─────────────────────────────────────────────────────────────────

create index if not exists idx_pedidos_vendedor
  on public.pedidos (vendedor_perfil_id, criado_em desc);

create index if not exists idx_pedidos_payment_intent
  on public.pedidos (stripe_payment_intent)
  where stripe_payment_intent is not null;

create index if not exists idx_pedido_itens_pedido
  on public.pedido_itens (pedido_id);

-- A consulta quente: todos os eventos de um pedido, para derivar o estado.
create index if not exists idx_pedido_eventos_pedido
  on public.pedido_eventos (pedido_id, ocorrido_em);

-- Idempotência estrutural do que vem do Stripe.
--
-- `reivindicarEvento` já descarta reentrega, mas devolve `retomado` quando uma
-- tentativa anterior morreu no meio, e `sem_garantia` quando não deu para
-- consultar — nos dois casos o handler roda de novo, de propósito. Sem este
-- índice, rodar de novo empilharia um segundo `pago` do mesmo `evt_...`.
--
-- O estado derivado não mudaria (a precedência ignora duplicata), mas o
-- histórico passaria a mentir sobre quantas vezes o fato aconteceu — e o
-- histórico é a razão de a tabela existir.
create unique index if not exists idx_pedido_eventos_idempotencia
  on public.pedido_eventos (pedido_id, evento, referencia)
  where referencia is not null;

-- ── RLS ─────────────────────────────────────────────────────────────────────
--
-- O vendedor lê os próprios pedidos. Escrita é só `service_role`: o pedido
-- nasce numa rota pública e é confirmado por webhook, e deixar o vendedor
-- escrever permitiria marcar como pago o que não foi.
--
-- O comprador não tem conta, então **não há policy que o alcance** —
-- `auth.uid()` não existe para ele. Ver o próprio pedido vai exigir link
-- assinado com prazo, na fase 1. Não é esquecimento: é o que RLS não resolve.

alter table public.pedidos enable row level security;
alter table public.pedido_itens enable row level security;
alter table public.pedido_eventos enable row level security;

drop policy if exists "vendedor le os proprios pedidos" on public.pedidos;
create policy "vendedor le os proprios pedidos"
  on public.pedidos for select to authenticated
  using (auth.uid() = vendedor_perfil_id or public.is_admin());

drop policy if exists "vendedor le os itens dos proprios pedidos" on public.pedido_itens;
create policy "vendedor le os itens dos proprios pedidos"
  on public.pedido_itens for select to authenticated
  using (exists (
    select 1 from public.pedidos p
    where p.id = pedido_itens.pedido_id
      and (auth.uid() = p.vendedor_perfil_id or public.is_admin())
  ));

drop policy if exists "vendedor le os eventos dos proprios pedidos" on public.pedido_eventos;
create policy "vendedor le os eventos dos proprios pedidos"
  on public.pedido_eventos for select to authenticated
  using (exists (
    select 1 from public.pedidos p
    where p.id = pedido_eventos.pedido_id
      and (auth.uid() = p.vendedor_perfil_id or public.is_admin())
  ));

-- ── store_orders sai ────────────────────────────────────────────────────────
--
-- Zero linhas conferidas antes de escrever esta migration, e o único leitor
-- (`/stripe/onboard`) passa a ler `pedidos` no mesmo commit. Não há dado a
-- migrar.
--
-- Deixá-la de pé seria pior do que removê-la: uma tabela de pedidos vazia,
-- com `status` sobrescrito e RLS plausível, é um convite a alguém voltar a
-- usá-la sem saber por que ela foi abandonada.

drop table if exists public.store_orders;
