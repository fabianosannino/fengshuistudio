# ADR 0039 — contrato de cobrança por Price

Data: 2026-09-18. Status: aceito.

## Decisão

O checkout exige plano e ciclo explícitos. JSON inválido, propriedades extras
ou valores fora do contrato retornam 400. Configuração ausente retorna 503;
o preço genérico legado deixa de ser fallback.

O Price do ambiente é confrontado com o contrato em centavos: moeda BRL,
valor, recorrência mensal/anual de uma unidade, produto existente/ativo e
modo live/test. O script de conferência usa o mesmo validador nas quatro
combinações e verifica que mensal/anual compartilham produto dentro do plano
e que planos diferentes usam produtos distintos.

Metadata da assinatura não concede direitos. A sincronização identifica o
Price configurado e confere seus atributos, quantidade e modo. Preço
desconhecido preserva direitos já concedidos e não concede outros. Estado
desconhecido, incompleto, pendente ou pausado não cria concessão. `unpaid` e
cancelamento encerram apenas a concessão da assinatura correspondente.

Eventos de assinatura consultam o estado atual no Stripe. Uma fatura altera
apenas sua própria assinatura; faturas avulsas não reativam todas as
assinaturas do perfil. Falha de persistência não é marcada como sucesso.
Uma assinatura nova não cancela registros vizinhos nem gratuidades.

Customer só é recriado após exclusão confirmada ou erro 404/resource_missing.
Criação usa chave idempotente por proprietário/modo/Customer anterior; timeout
e erro de credencial não provam ausência. A retenção da chave no Stripe não
substitui coordenação durável de checkout, que será tratada na continuação B2.
Uma assinatura ainda em andamento encaminha o usuário ao portal de cobrança.

Direitos continuam sendo 3/10/ilimitado imóveis, 0/25/ilimitado clientes e PDF
com marca/com marca/limpo. A matriz tipada ganha versão e projeta as telas.
Cadastro e callback preservam destino seguro, plano e ciclo; o anual exibe
seu total. O retorno do checkout não concede acesso.

## Referências

- [Stripe Price](https://docs.stripe.com/api/prices/object): atributos do catálogo.
- [Idempotência](https://docs.stripe.com/api/idempotent_requests): retries e retenção de chaves.
- [Webhooks](https://docs.stripe.com/webhooks#event-ordering): eventos não têm ordem garantida.

## Limites desta entrega

Ainda é necessário serializar cotas/reativações e finalizar a coordenação
durável de eventos e checkouts no banco. A projeção `plans.features` será
reconciliada na mesma entrega aditiva. Não há migração ampla de API ou Connect.
Stripe Tax não foi ativado: sua configuração depende de registros tributários
válidos, conforme [cobrança de tributos recorrentes](https://docs.stripe.com/billing/taxes/collect-taxes).
