-- ═══════════════════════════════════════════════════════════════════════════
-- Foto do produto e promoção por prazo
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Duas coisas que a vitrine não tinha:
--
-- 1. **imagem** — os cartões eram só texto, e `produtos` não tinha coluna de
--    foto nenhuma. O bucket que existe (`produtos-digitais`) recusa `image/*`
--    no próprio Postgres, porque ele guarda o entregável, não a ilustração.
-- 2. **promoção** — mudar o preço obrigava a editar o produto e depois lembrar
--    de voltar atrás. «Lembrar de voltar atrás» é o que esta migration remove.

-- ── 1. A foto ──────────────────────────────────────────────────────────────
--
-- Guarda **path**, nunca URL (ADR 0022). A diferença com as outras fotos do
-- app é o bucket: este é público, e a razão está no ADR 0035.

alter table public.produtos
  add column if not exists imagem_path text;

comment on column public.produtos.imagem_path is
  'Path da foto no bucket público produtos-imagens. Nunca URL: o endereço se '
  'monta na leitura, e um bucket que mude não obriga a reescrever linha.';

-- ── 2. A promoção ──────────────────────────────────────────────────────────
--
-- Três colunas, e **nenhuma** chamada `em_promocao`.
--
-- Um booleano gravado precisaria de alguém — pessoa ou rotina — para virá-lo
-- quando o prazo acabasse. Enquanto esse alguém não rodasse, o banco afirmaria
-- uma promoção encerrada, e a afirmação seria lida pelo checkout: o comprador
-- pagaria o preço de uma campanha que terminou ontem.
--
-- É o ADR 0027 na íntegra — estado que muda com o tempo é derivado, não
-- gravado. Aqui o dado gravado é a **janela**, que não muda sozinha; «está em
-- promoção» sai de comparar `now()` com ela, e sai igual em toda leitura,
-- porque só existe uma função que responde isso (`precoVigente`).

alter table public.produtos
  add column if not exists promocao_preco_centavos integer,
  add column if not exists promocao_inicio timestamptz,
  add column if not exists promocao_fim timestamptz;

-- As três juntas ou nenhuma. Preço sem janela seria desconto eterno escrito
-- como se fosse campanha; janela sem preço não desconta nada e ainda assim
-- pintaria o selo de promoção na vitrine.
alter table public.produtos
  drop constraint if exists produtos_promocao_completa;
alter table public.produtos
  add constraint produtos_promocao_completa check (
    (promocao_preco_centavos is null and promocao_inicio is null and promocao_fim is null)
    or
    (promocao_preco_centavos is not null and promocao_inicio is not null and promocao_fim is not null)
  );

-- Promoção que não desconta é engano de digitação, e o engano é caro nos dois
-- sentidos: para cima o comprador paga mais vendo um selo que promete menos;
-- igual, a vitrine risca um preço e mostra o mesmo número ao lado.
alter table public.produtos
  drop constraint if exists produtos_promocao_desconta;
alter table public.produtos
  add constraint produtos_promocao_desconta check (
    promocao_preco_centavos is null
    or (promocao_preco_centavos > 0 and promocao_preco_centavos < preco_centavos)
  );

-- Janela invertida nunca vale — o produto ficaria com três colunas
-- preenchidas, selo nenhum e o admin convencido de ter agendado a campanha.
alter table public.produtos
  drop constraint if exists produtos_promocao_janela;
alter table public.produtos
  add constraint produtos_promocao_janela check (
    promocao_fim is null or promocao_fim > promocao_inicio
  );

-- Promoção só em venda nossa.
--
-- Na indicação quem vende é o parceiro (ADR 0032) e o preço da nossa linha é
-- referência — a vitrine já diz «a partir de», porque pode ter mudado lá. Uma
-- promoção nossa sobre esse valor anunciaria um desconto que não damos, num
-- preço que não cobramos, numa loja que não é nossa. O comprador chegaria ao
-- site do parceiro e encontraria outro número, com o nosso nome no anúncio.
alter table public.produtos
  drop constraint if exists produtos_promocao_so_no_que_vendemos;
alter table public.produtos
  add constraint produtos_promocao_so_no_que_vendemos check (
    promocao_preco_centavos is null or modo_de_venda = 'marketplace'
  );

comment on column public.produtos.promocao_preco_centavos is
  'Preço enquanto a janela estiver aberta. O preco_centavos continua sendo o '
  'cheio — é o «de» riscado na vitrine, e o valor para onde se volta sozinho.';

comment on column public.produtos.promocao_inicio is
  'Abertura da janela. Permite agendar: uma campanha que começa sexta é '
  'cadastrada quarta e não depende de alguém publicar na hora.';

comment on column public.produtos.promocao_fim is
  'Fechamento da janela. NÃO existe coluna em_promocao: o estado sai da '
  'comparação com now() (ADR 0027). Um booleano gravado dependeria de alguém '
  'virá-lo no minuto certo, e até lá o checkout cobraria a campanha encerrada.';

-- A consulta da vitrine já filtra por `ativo`; entre os ativos, saber quais
-- estão em janela aberta é o que a tela de admin pergunta ao listar.
create index if not exists idx_produtos_promocao_aberta
  on public.produtos (promocao_fim)
  where promocao_fim is not null;

-- ── 3. O bucket da foto ────────────────────────────────────────────────────
--
-- **Público**, ao contrário de todos os outros deste projeto. Ver ADR 0035.
--
-- Em uma linha: o ADR 0022 fechou `clientes-fotos` e `imoveis-fotos` porque
-- são fotos da casa de alguém, e a URL pública é permanente e adivinhável. A
-- foto de produto é o oposto pela finalidade — ela existe para ser vista por
-- quem ainda não é cliente, na página mais pública do site.
--
-- URL assinada aqui não protegeria nada e cobraria caro: expira, então nenhum
-- CDN a guarda, e cada visitante da vitrine faria o servidor assinar de novo
-- cada imagem. Defesa de um segredo que não existe, paga em latência.
--
-- 2 MB e três formatos. `image/svg+xml` fica **de fora** de propósito: SVG é
-- documento com script, e num bucket público serviria HTML executável a partir
-- do nosso domínio.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'produtos-imagens', 'produtos-imagens', true, 2097152,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = true,
  file_size_limit = 2097152,
  allowed_mime_types = excluded.allowed_mime_types;

-- Leitura anônima é o ponto do bucket público. A escrita continua só por
-- `service_role`, pela rota de admin — sem policy de insert, ninguém mais
-- grava.
drop policy if exists "produtos_imagens_leitura_publica" on storage.objects;
create policy "produtos_imagens_leitura_publica"
  on storage.objects for select
  using (bucket_id = 'produtos-imagens');
