# ADR 0052 — Reembolsos da loja por estado atual e diferença no razão

Status: aceito em 18/09/2026.

## Problema

O escritor antigo somava `charge.amount_refunded`, cumulativo, sob referências
de eventos diferentes. Devolver 500 e depois mais 500 podia lançar 500 + 1000.
Também tratava estorno parcial ou pendente como integral e podia ignorar falha
de escrita. O histórico existente é imutável e não pode ser apagado para corrigir
o saldo.

## Decisão

Reservar `pedido:<uuid>` antes de reler o pedido e a Stripe. Conferir conta,
PaymentIntent, cobrança capturada, BRL, modo, vendedor e comissão contratada.
Ler a lista completa de até cem reembolsos e de estornos da comissão. A comissão
é consultada na plataforma; a cobrança direta, na conta conectada. Uma lista
incompleta ou referência incompatível permanece retryable.

Uma RPC exclusiva de service_role bloqueia o pedido, confere o token vigente e
grava snapshot, vínculos únicos por conta/reembolso, ajustes e evento na mesma
transação. Só `succeeded` entra no valor devolvido; pendências e falhas conservam
seus estados. Cada reembolso conhecido preserva ID e valor; snapshots posteriores
não podem omiti-lo. Um retry idêntico e com razão alinhado não cria nova revisão.

O ajuste é a diferença entre o total confirmado atual e o saldo já lançado.
Valor excedente antigo recebe lançamento inverso, sem editar o passado nem
movimentar dinheiro na Stripe. A tarifa do gateway não é inventada ou estornada.
A revisão emitida pelo banco ordena snapshots; a ordem de entrega dos eventos
não decide qual estado financeiro prevalece.

`charge.refunded` e `refund.created/updated/failed` usam o mesmo caminho nas
duas contas. `application_fee.refunded` e `application_fee.refund.updated` chegam
à plataforma e resolvem a conta pelo objeto de comissão relido; isto alcança
comissões devolvidas depois do reembolso principal.

## Leituras e autorização

Todos os consumidores dos eventos carregam o resumo financeiro. O estado
distingue reembolso parcial de integral e resumo inválido exige revisão. O
comprador vê somente os campos públicos; não recebe os identificadores técnicos
do snapshot. O botão de estorno aceita o parcial e solicita o saldo remanescente.

Download continua exigindo `pago`, token válido e estado elegível. Reembolso
parcial permanece bloqueado, como no comportamento anterior; atribuir o estorno
a itens/licenças específicos exige política e modelagem próprias. Um reembolso
pendente não é dinheiro devolvido; falha confirmada recupera o estado derivado
dos demais fatos. Cancelamentos e disputas continuam tendo precedência.

A reconciliação casa pagamento + conta e compara o saldo do razão. O agregado
da cobrança é apenas sinal para investigação: o corretor sempre relê os estados
individuais. Enquanto houver pendência na Stripe, pode haver divergência sem
ajuste monetário. Leituras de pedidos/contas incompletas falham explicitamente.
Isto não redefine indicadores de receita, liquidação ou contabilidade fiscal.

## Publicação e reversão

Preflight exige ausência de PaymentIntents duplicados por conta. Não há backfill
automático nem mudança em pedidos existentes durante o DDL.

Publicar primeiro o código aprovado no CI. Até aplicar o DDL, reembolsos da loja
respondem com erro retryable, sem executar o escritor cumulativo. Confirmar o
SHA em produção e aguardar mais de 60 segundos, limite dos handlers antigos,
antes de aplicar a migration. Isto evita sobreposição entre os escritores
antigo e novo. Conferir ACL/RLS e contagens, então habilitar os novos eventos nos
destinos Stripe existentes, sem mudar URL, versão ou segredo.

Se houver regressão, manter eventos retryable e corrigir adiante. Não voltar ao
escritor cumulativo, descartar filas ou remover tabelas/histórico. A conciliação
legada em produção exige execução identificada e relatório próprio; este pacote
não dispara e-mails, cobranças ou reembolsos reais.

## Evidência e limites

Runner PostgreSQL reproduz a soma indevida, conserva linhas históricas e verifica
ajuste inverso, replay, falhas/pêndencias, comissões Connect, propriedade, ACLs,
rollback integral e expiração durante lock. Testes de API cobrem seleção da conta,
eventos separados de comissão, retry e autorização de download. A alteração nas
telas foi revisada quanto a tipos, derivação de estado e rótulos; navegação
autenticada em browser não foi validada nesta execução.

Não encerra homologação Stripe em test mode, checkout durável da loja, ciclo de
disputas Connect, reconciliação de todo o histórico ou relatórios financeiros.
Não há transação distribuída entre Stripe e banco: o estado é relido sob reserva
e eventos subsequentes convergem a projeção.

Referências: [Refunds](https://docs.stripe.com/api/refunds/list),
[Fee refunds](https://docs.stripe.com/api/fee_refunds/list),
[tipos de evento](https://docs.stripe.com/api/events/types).
