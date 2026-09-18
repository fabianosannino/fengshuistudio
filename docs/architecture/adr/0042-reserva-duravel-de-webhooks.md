# 0042 — reserva durável de processamento dos webhooks

Status: implementado; 18/09/2026.

## Problema

A chave única de `eventos_stripe` impedia duas linhas, mas uma linha ainda sem
`processado_em` autorizava imediatamente outro processamento. Erros ao gravar
a conclusão também podiam terminar em HTTP 200. O endpoint Connect prosseguia
quando o controle de eventos estava indisponível.

## Decisão

A RPC `reivindicar_evento_stripe`, restrita ao servidor, bloqueia a linha e
devolve reserva com token, ocupado ou já concluído. Reserva dura cinco minutos;
os dois handlers declaram limite de execução de 60 segundos. Entrega ocupada
ou controle indisponível recebe 503 com Retry-After. Dados de evento malformados
não são substituídos pelo horário atual.

Conclusão e liberação exigem token ainda válido. Erro ou reserva perdida não
confirmam recebimento. A mensagem persistida de falha é um código genérico,
sem copiar payload, dados pessoais ou texto arbitrário de exceção. A leitura
da ordenação fica dentro do tratamento de falha e não assume sucesso em erro.

Notificações novas de reembolso usam referência do evento; as de disputa
perdida usam a referência da disputa. Índice único e upsert evitam repetir essas
notificações ao retomar uma tentativa. Linhas anteriores são preservadas.

## Limites

Isto não é execução exatamente uma vez de todos os efeitos. A reserva não
torna chamadas Stripe e múltiplas escritas locais uma transação, nem coordena
eventos diferentes sobre a mesma assinatura. Escritas de negócio continuam
precisando de idempotência e conciliação. O token cerca a conclusão; ele não
é aplicado por trigger a toda escrita de negócio. Alterar o limite de execução
exige revisar a duração da reserva, inclusive em outro provedor de hospedagem.

Continuam em revisão: coordenação entre eventos diferentes, checkout durável,
ordenação de faturas/estornos e sincronização atômica de seus efeitos. Nenhuma
dessas pendências é encerrada por este ADR.

## Evidência e reversão

23 verificações em PostgreSQL 17 descartável: concorrência real, RLS, grants,
legado, erro, retomada, vencimento, token antigo e unicidade da notificação.
Testes das duas rotas verificam recusa em 503 e falha da confirmação.
Migration aditiva; não exige remover dados para rollback da aplicação.

Fontes: [Stripe — webhooks](https://docs.stripe.com/webhooks) e
[requisições idempotentes](https://docs.stripe.com/api/idempotent_requests).
