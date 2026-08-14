-- ═══════════════════════════════════════════════════════════════════════════
-- `pedidos.confirmacao_enviada_em` — para não mandar o mesmo e-mail duas vezes
-- ═══════════════════════════════════════════════════════════════════════════
--
-- O webhook roda de novo **de propósito** em dois casos: quando uma tentativa
-- anterior morreu no meio (`retomado`) e quando não deu para consultar a
-- tabela de controle (`sem_garantia`). Nos dois, refazer o trabalho é o certo
-- — inserir de novo é barrado pelos índices de idempotência, e o estado
-- derivado não muda.
--
-- E-mail não tem esse conserto. Ele já saiu, e reenviar é o comprador
-- recebendo duas vezes a confirmação da mesma compra — que é o tipo de coisa
-- que faz alguém desconfiar de cobrança dupla.
--
-- Daí a marca de data. Não é estado do pedido: é registro de um efeito
-- externo que não dá para desfazer, e por isso mora numa coluna própria em vez
-- de virar evento na máquina de estados.
--
-- **Limite conhecido:** duas execuções simultâneas podem ler `null` juntas e
-- enviar duas vezes. Fica declarado em vez de escondido — a janela é de
-- milissegundos, acontece só em reentrega concorrente, e o preço de fechá-la
-- (lock ou unique index com upsert antes do envio) não se paga contra um
-- e-mail duplicado raro.

alter table public.pedidos
  add column if not exists confirmacao_enviada_em timestamptz;

comment on column public.pedidos.confirmacao_enviada_em is
  'Quando a confirmação foi enviada ao comprador. Impede reenvio em reentrega do webhook.';
