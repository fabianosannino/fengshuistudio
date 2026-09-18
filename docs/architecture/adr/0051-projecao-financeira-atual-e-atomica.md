# 0051 — Faturas, reembolsos e disputas sob reserva

Data: 18/09/2026. Complementa 0042, 0045 e 0050.

## Problema

O filtro genérico de eventos anteriores podia descartar fatos distintos do
mesmo objeto. O escritor de fatura paga ignorava erros de leitura, tinha uma
janela de duplicação e sobrescrevia `refunded` com `paid`. O reembolso buscava
apenas as dez últimas faturas e um campo antigo `payment_intent`; erros podiam
ser engolidos antes de publicar notificação de sucesso. A disputa usava o
snapshot do evento e podia ser registrada sem titular após falha no provedor.

## Contrato

Eventos de assinatura/fatura/reembolso/disputa não passam pelo filtro global
de ordem. A reivindicação por event_id continua; o processamento consulta o
recurso atual sob uma segunda reserva por fatura ou disputa, antes da leitura
Stripe. Token de cinco minutos é conferido depois de todos os locks e
consumido com o commit. Falha permanece retryable, inclusive titular ausente.
Nenhum erro bruto do provedor ou payload pessoal é registrado.

Faturas ganham índice único pelo ID Stripe. A transação grava valor bruto,
valor pago, estado atual de cada reembolso e soma dos estornos confirmados.
`invoice.paid` atrasado lê os reembolsos atuais e não apaga estorno conhecido.
Os estados pending/requires_action/failed/canceled são preservados e não
contam como dinheiro devolvido. Identidade de reembolso tem vínculo global
único com a fatura; não pode mudar de titular nem de valor. Snapshot completo
não pode omitir reembolso já conhecido. Notificação deduplicada pelo ID do
reembolso e sua gravação participam da mesma transação.

O vínculo moderno é InvoicePayments → PaymentIntent → Charge → Refunds.
Aceitamos apenas pagamentos BRL integralmente atribuídos à fatura, com
Customer consistente, modo compatível e valores inteiros. Vínculo compartilhado,
pagamento externo/creditado sem correspondência, forma não suportada ou
paginação incompleta exigem conciliação específica; não se estima a parcela.
Uma leitura tem orçamento de 35s, chamadas de até 10s sem retry interno,
no máximo dez pagamentos e cem reembolsos. A reentrega externa é o retry.

Disputas consultam o estado atual após reservar o ID. Falha ao ler a cobrança
não vira disputa sem titular. Customer comprovadamente ausente pode ser compra
de convidado; Customer conhecido sem perfil é falha retryable. `won`, `lost`,
`warning_closed` e `prevented` são terminais. Fim/atualização são instantes de
observação local, não alegações sobre a data de liquidação bancária. Nenhuma
disputa muda automaticamente o plano; essa política comercial não foi criada.

## Migração e privacidade

DDL recusa faturas duplicadas e reembolsos legados sem referências conciliadas.
Preflight real encontrou zero faturas e zero disputas. Não altera Stripe nem
backfills ambíguos. Tabelas privadas contêm controles e vínculos técnicos,
sem acesso de anon/authenticated. O estado dos reembolsos acompanha a fatura
na exportação do titular, que também inclui suas disputas; a exclusão de contas comerciais já exige encerramento
específico. O vínculo privado impede apagar fatura financeira em cascata.

## Verificação e limites

Runner PostgreSQL reproduz a regressão anterior, recusa migração insegura,
testa concorrência, expiração durante espera, ACLs, totais, unicidade global,
titular, rollback de notificação e finais de disputa. APIs exercitam o caminho
real do handler, erro de provedor, associação moderna, listas incompletas,
eventos antigos e estados de estorno distintos.

É projeção operacional atual, não razão contábil completo: o registro de eventos
preserva IDs/tipos/instantes, mas não reconstrói todas as transições financeiras.
Não há transação distribuída entre Stripe e PostgreSQL. Liquidação, saldo,
impostos, descontos históricos, notas de crédito, múltiplas moedas, relatórios
financeiros e reconciliação ampliada ainda precisam de contratos próprios.

O caminho legado de pedidos da loja conserva temporariamente seu filtro de
ordem e não usa essa projeção. Novos eventos refund.* de loja são retryable
até haver conciliação própria, sem acionar o escritor cumulativo legado.
Configuração do destino deve incluir refund.created, refund.updated e
refund.failed; código publicado sozinho não comprova essa configuração.
Homologação real permanece dependente de test mode isolado, sem testes de
cobrança no ambiente live.

Referências primárias: [InvoicePayments](https://docs.stripe.com/api/invoice-payment/list),
[Refund](https://docs.stripe.com/api/refunds/object),
[Dispute](https://docs.stripe.com/api/disputes/object).
