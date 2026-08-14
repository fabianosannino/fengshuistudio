-- ═══════════════════════════════════════════════════════════════════════════
-- Fase 2 da loja — bem próprio digital: a plataforma passa a ser vendedora
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Até aqui toda venda da loja tinha o **consultor** como vendedor: cobrança
-- direta na conta conectada, comissão de 10% retida pela plataforma. Esta
-- migration abre o segundo trilho — o produto é nosso, a cobrança é na nossa
-- conta, não existe conta conectada nem comissão a reter.
--
-- Não é o mesmo pedido com outro `vendedor_tipo`: é outro vendedor, outra
-- obrigação de entrega e outro documento fiscal (seção 1 do modelo da loja).
-- O que as três vendas compartilham é o **dinheiro**, e é por isso que
-- `pedidos`, `pedido_eventos` e `pedido_lancamentos` continuam os mesmos.
--
-- ## Por que digital antes de físico
--
-- Porque o físico trava em coisa que não é código — inscrição estadual,
-- emissor de NF-e, estoque, frete e logística reversa. O digital testa o
-- trilho inteiro (catálogo nosso, cobrança nossa, entrega nossa, devolução
-- nossa) sem esperar certificado nenhum.

-- ── produtos ────────────────────────────────────────────────────────────────
--
-- Catálogo **nosso**. Não confundir com `produtos_afiliados`, que é a vitrine
-- de links para lojas de fora: lá nenhum dinheiro passa por aqui e não existe
-- pedido deste lado. São a mesma palavra e naturezas diferentes — seção 8 do
-- modelo.

create table if not exists public.produtos (
  id uuid primary key default gen_random_uuid(),

  -- O tipo decide quem entrega, quem emite documento fiscal e — a parte que
  -- vira código imediatamente — de quando conta o prazo de arrependimento.
  -- `bem_proprio_fisico` e `bem_de_terceiro` já entram no check para que as
  -- fases 3 e 4 não precisem de migration só para alargar a lista.
  tipo text not null check (tipo in (
    'bem_proprio_digital', 'bem_proprio_fisico', 'bem_de_terceiro'
  )),

  -- `indicacao` é o terceiro vendendo na loja dele com link nosso; nenhum
  -- dinheiro passa por aqui. Bem próprio nunca é indicação — não faz sentido
  -- indicar a própria loja.
  modo_de_venda text not null default 'marketplace'
    check (modo_de_venda in ('marketplace', 'indicacao')),
  constraint produtos_indicacao_so_de_terceiro
    check (modo_de_venda = 'marketplace' or tipo = 'bem_de_terceiro'),

  -- Nulo = a plataforma é a vendedora. É a mesma convenção de
  -- `pedidos.vendedor_perfil_id`, e o que a torna segura é `vendedor_tipo`
  -- lá: aqui, quem vende sai do `tipo`.
  vendedor_perfil_id uuid references public.profiles(id) on delete restrict,

  nome text not null,
  descricao text,
  preco_centavos integer not null check (preco_centavos > 0),
  ativo boolean not null default false,

  -- Entrega do digital. `arquivo_path` é **path** no bucket privado, nunca
  -- URL: bucket fechado é a regra do ADR 0022, e URL gravada é o defeito que
  -- ele corrigiu nas fotos.
  arquivo_path text,
  arquivo_nome text,
  arquivo_mime text,
  arquivo_bytes integer,

  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),

  -- A invariante que impede vender o que não dá para entregar.
  --
  -- Sem ela, «publicar o produto» e «subir o arquivo» são dois passos e nada
  -- obriga o segundo — o comprador pagaria e cairia numa página de download
  -- vazia. O banco recusa antes: digital ativo **tem** arquivo.
  constraint produtos_digital_ativo_tem_arquivo check (
    not ativo or tipo <> 'bem_proprio_digital' or arquivo_path is not null
  )
);

comment on table public.produtos is
  'Catálogo próprio da plataforma. Não confundir com produtos_afiliados (vitrine de links externos).';

create index if not exists idx_produtos_ativos
  on public.produtos (ativo, criado_em desc);

-- `updated_at` de sempre — a coluna existe para o admin saber o que mexeu por
-- último, não para derivar estado.
create or replace function public.produtos_toca_atualizado_em()
returns trigger
language plpgsql
as $$
begin
  new.atualizado_em := now();
  return new;
end;
$$;

drop trigger if exists produtos_atualizado_em on public.produtos;
create trigger produtos_atualizado_em
  before update on public.produtos
  for each row execute function public.produtos_toca_atualizado_em();

-- ── RLS: nenhuma policy, e isso é a decisão ─────────────────────────────────
--
-- Com RLS ligado e zero policies, `anon` e `authenticated` não leem nada. O
-- catálogo público sai por `/api/loja/produtos`, com **lista branca de
-- colunas** — a regra do ADR 0028.
--
-- A razão é `arquivo_path`. Uma policy `select ... using (ativo)` devolveria a
-- linha inteira, path do arquivo incluído. O bucket é privado e o path sozinho
-- não baixa nada, mas publicar o endereço do que se quer proteger é começar a
-- defesa um passo atrás sem ganhar nada.
alter table public.produtos enable row level security;

-- ── pedido_itens.produto_id ─────────────────────────────────────────────────
--
-- O item continua sendo **fotografia** do instante da compra: nome, descrição
-- e preço permanecem copiados, e não passam a ser lidos daqui. A FK serve para
-- uma coisa só — saber qual arquivo entregar.
--
-- `on delete restrict` de propósito: apagar um produto já vendido tiraria do
-- comprador o acesso ao que ele pagou. O banco recusa; o caminho é
-- `ativo = false`, que tira da vitrine sem tirar de quem comprou.
alter table public.pedido_itens
  add column if not exists produto_id uuid references public.produtos(id) on delete restrict;

create index if not exists idx_pedido_itens_produto
  on public.pedido_itens (produto_id)
  where produto_id is not null;

-- ── pedidos.tipo: `bem_proprio` vira digital ou físico ──────────────────────
--
-- Não é cosmético. `prazoDeArrependimento` conta de marcos diferentes:
--
--   | o que              | conta a partir de |
--   |--------------------|-------------------|
--   | bem físico         | `entregue`        |
--   | bem digital        | `pago`            |
--   | serviço            | a contratação     |
--
-- Com um `bem_proprio` só, um e-book cairia no ramo do físico e esperaria um
-- evento `entregue` que nunca vem — o prazo ficaria `null` para sempre e o
-- comprador **nunca** conseguiria pedir devolução. O direito existiria no CDC
-- e não existiria no app.
--
-- A troca é segura porque a coluna nunca recebeu esse valor: as 4 linhas em
-- produção são todas `servico`. Conferido antes de escrever esta migration.
alter table public.pedidos drop constraint if exists pedidos_tipo_check;
alter table public.pedidos add constraint pedidos_tipo_check check (tipo in (
  'servico', 'bem_proprio_digital', 'bem_proprio_fisico', 'bem_de_terceiro'
));

-- ── Bucket privado do arquivo entregue ──────────────────────────────────────
--
-- Privado, sem policy em `storage.objects`: nem `anon` nem `authenticated`
-- alcançam o objeto. O upload é feito com `service_role` pela rota de admin, e
-- o download sai por URL assinada de curta duração, emitida só depois de o
-- servidor conferir o token do pedido e o estado derivado.
--
-- O que o comprador compra é o arquivo. Bucket público aqui não é vazamento de
-- dado pessoal — é o produto de graça para quem descobrir a URL.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'produtos-digitais', 'produtos-digitais', false, 104857600,
  array[
    'application/pdf',
    'application/epub+zip',
    'application/zip',
    'audio/mpeg',
    'video/mp4'
  ]
)
on conflict (id) do update set
  public = false,
  file_size_limit = 104857600,
  allowed_mime_types = excluded.allowed_mime_types;
