# 0050 — Assinatura e benefício na mesma transação

Data: 18/09/2026. Complementa os ADRs 0041, 0042, 0047 e 0049.

## Problema

O espelho `subscriptions` era gravado antes da concessão. Falha posterior
deixava assinatura e acesso divergentes. A concessão de assinatura não recebia
o fim do período; poderia continuar vigente indefinidamente sem um webhook
de cancelamento. Eventos diferentes e a reconciliação podiam buscar estados
em paralelo e aplicar uma resposta antiga depois de outra mais recente.

## Decisão

`sincronizarAssinatura` recebe o ID e reserva a assinatura antes de consultar
o Stripe. Controle privado por assinatura concede token com prazo de cinco
minutos. Outro trabalhador espera por retry, sem ler/aplicar em paralelo.
Cada chamada Stripe tem timeout de 20s e um retry. A transação de aplicação
trava o controle, verifica token/prazo, trava o perfil, verifica novamente o
prazo e grava espelho, concessão e projeção juntos. Consome o token no commit.
Falha faz rollback; token antigo não grava nem libera outro trabalhador.

Webhooks, reconciliação e ações administrativas usam o mesmo caminho. A
assinatura lida deve corresponder ao ID, ambiente e, quando fornecido pela
fatura/ação, Customer esperado. Perfil inexistente/ambíguo, origem incompatível,
catálogo ativo desconhecido ou estado desconhecido não é sucesso silencioso.
Gravação nunca transfere uma assinatura existente para outro titular.

Assinatura ativa concede somente até o fim do período validado. Trial usa
o menor prazo entre trial_end e fim do período. Renovação past_due, paused ou
incomplete não estende o benefício anterior. Cancelamento terminal encerra
apenas a concessão dessa assinatura; chave/cortesia/migração sobrevivem.
Cancelamento agendado conserva o período vigente. A leitura canônica do ADR
0047 faz o direito expirar mesmo sem chegar outro evento.

A migração recusa concessão de assinatura viva e sem prazo finito; isso exige
reconciliação explícita, não retirada silenciosa de direito. Preflight real
encontrou zero concessões dessa origem. Gratuidade/chaves não recebem prazo
inventado. Não há backfill nem alteração de cobrança externa.
Uma constraint também impede código legado de voltar a criar uma concessão
de assinatura sem prazo. Em rollout misto, a escrita antiga falha e deve ser
repetida pela aplicação compatível, em vez de deixar benefício indefinido.

## Cancelamento pelo titular

O endpoint consulta assinaturas atuais do Customer da sessão, sem depender
do cache de status. Múltiplas assinaturas/paginação incompleta direcionam ao
portal. Atualiza apenas cancel_at_period_end, verifica a resposta e executa a
mesma sincronização. Só responde sucesso se o estado persistido confirmar o
agendamento; retry de agendamento existente não repete a alteração.

Notificação e auditoria são registros secundários. Erros são verificados e
retornados como `registro_secundario_pendente`, sem negar uma operação já
confirmada. Notificação tem referência por assinatura/período para deduplicar.
Não se alega atomicidade entre Stripe, banco e registros secundários.

## Evidência e limites

Runner PostgreSQL usa as migrations reais de concessão e plano vigente.
Reproduz o defeito anterior (espelho persistia apesar da falha na concessão),
comprova rollback completo, prazo do período/trial, preservação de cortesia,
claims concorrentes, tokens antigos, expiração enquanto espera o perfil e
recusa de transferência entre titulares. Fixtures preservam tipos/FKs do
contrato de produção. APIs testam posse, recusa, ordem claim→leitura→escrita
e cancelamento que não confirma resultado desconhecido.

A reserva ordena os trabalhadores do app; não torna leitura Stripe e escrita
Postgres uma transação distribuída. Uma alteração posterior no provedor
depende do próximo evento/reconciliação. A projeção usa estado/período da
assinatura, não substitui conciliação contábil de faturas, descontos ou estornos.
Ainda faltam coordenação de faturas/reembolsos/disputas, fatos que chegam fora
de ordem, loja e homologação financeira real em test mode. A tabela privada
contém apenas referência técnica, token transitório e relógios; não armazena
payload do cliente. Sua remoção integra o encerramento comercial pendente.

Referência: [eventos de assinatura Stripe](https://docs.stripe.com/billing/subscriptions/webhooks).
