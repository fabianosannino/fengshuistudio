# 0045 — contenção de confirmações financeiras e rastreadores

Status: contenção aplicada; implementação completa pendente. 18/09/2026.

## Ações administrativas financeiras

`mark_paid` alterava a fatura e reativava assinatura localmente, sem confirmar
recebimento no provedor. `refund` buscava payment_intent no formato antigo da
invoice; sem encontrar, podia confirmar reembolso sem movimentar dinheiro.
Crédito era somente anotação local, mas a notificação dizia que fora aplicado.
Faltavam idempotência durável, validação cumulativa de valor e distinção entre
reembolso parcial, pendente e concluído. A busca de fatura também não
restringia ao usuário alvo.

Esses dois caminhos foram removidos. Depois de autenticação, capacidade e
validação de entrada, retornam 409 com orientação para o Dashboard Stripe,
sem escrita local, notificação ou movimento financeiro. Benefícios, portal,
cancelamento e estornos de pedidos da loja usam fluxos próprios e não foram
removidos. Não se afirma que a conciliação de faturas já está completa.

Reativação exige contrato de operação persistido antes da chamada externa,
posse verificada por usuário/customer/invoice, valores inteiros em centavos,
limites cumulativos, Invoice Payments da versão atual do SDK, retorno
idempotente e conciliação de falhas. Crédito precisa representar um crédito
real do provedor ou uma anotação claramente distinta. Só confirmação
definitiva permite afirmar conclusão. Ensaios de modo teste são obrigatórios;
o ambiente development atual com chave live não é substituto.

## Analytics

O componente anterior enviava pathname e query string ao GA e injetava
rastreadores automáticos. URLs privadas, tokens e referrers podiam participar
da coleta, inclusive depois de uma navegação SPA. Os scripts foram suspensos;
IDs de ambiente existentes não os reativam. Não se apaga histórico nem se
altera configuração das contas externas neste pacote.

Uma nova implementação precisa definir consentimento/base e finalidade,
allowlist de páginas públicas, payload mínimo sem IDs/queries/referrers,
retensão e teste de rede cobrindo navegação pública para privada. Remover
query somente de um evento manual não impede coleta automática do SDK.

Referências: [Invoice Payments](https://docs.stripe.com/api/invoice-payment/list),
[estornos](https://docs.stripe.com/api/refunds/create) e
[liquidação de fatura](https://docs.stripe.com/api/invoices/pay).
