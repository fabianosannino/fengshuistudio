# ADR 0041 — Concessões e ativação atômicas

Status: aceito para implementação — 18/09/2026.

O módulo de concessões preservava origens no webhook, mas a ativação por chave,
a promoção administrativa e a cortesia ainda escreviam `profiles.plano`
diretamente. Além disso, a chave era consumida antes de conferir o benefício;
uma falha intermediária a deixava usada sem entregar o plano. Conceder cortesia
também cancelava assinaturas pagas, contrariando a independência das origens.

Agora a referência de uma concessão é única dentro da origem e não pode mudar
de proprietário. As RPCs de concessão/encerramento bloqueiam o perfil, alteram
somente a origem solicitada e recalculam a projeção na mesma transação. São
`SECURITY INVOKER`, sem `search_path` implícito, concedidas apenas ao serviço.
O código autentica o usuário/administrador antes de obter esse cliente.

A ativação bloqueia perfil e chave, verifica estado, prazo, plano e duração,
consome a chave, concede o benefício e registra auditoria atomicamente. O retry
do mesmo titular lê o resultado sem prolongar sua validade ou reativar uma
concessão à qual ele já renunciou. Outra pessoa não pode usar a mesma chave.
Desconto parcial não é gratuidade: chaves desse tipo são recusadas nesta rota.
Não existe chave usada na produção inventariada; nenhum backfill foi necessário.

Benefício administrativo usa origem `cortesia` e referência estável por
titular. Sua alteração preserva assinatura, chave e migração. A ação no painel
passa a se chamar «Ajustar Benefício Manual» para expor esse contrato. O painel
deriva os benefícios da tabela de concessões; não fabrica assinatura paga para
representar cortesia. Sua duração em meses respeita o calendário UTC.

Escolher Free com cobrança ativa consulta o Stripe e agenda o fim da renovação,
preservando os direitos do período e das outras origens. Sem cobrança ativa,
a renúncia explícita alcança somente concessões não pagas. Cancelamento no
admin também depende de sucesso no provedor e passa pelo sincronizador comum;
timeout não é prova de cancelamento. A reconciliação deixa de atualizar apenas
o status local: a correção usa a mesma concessão do webhook.

O cliente Stripe da aplicação só aceita chaves live em `VERCEL_ENV=production`
e chaves test nos outros ambientes. A leitura de configuração confirmou que
`development` contém chave live: esse ambiente não está homologado para testes
financeiros. Scripts separados de conferência somente leitura continuam
explicitamente controlados e não recebem essa restrição de aplicação.

Validação: transações reais no PostgreSQL 17 com concorrência entre titulares,
rollback por falha de auditoria, retries, validade e cancelamento de uma origem
preservando outra. Testes das rotas conferem identidade derivada da sessão,
falha do provedor, ausência de gravação direta no perfil e resposta de erro.
Migrations são aditivas, não revogam concessões existentes nem consomem chaves.

Esta entrega não afirma exclusividade do processamento de eventos nem proteção
durável do checkout após a janela de idempotência do Stripe. Esses trabalhos e
o ensaio financeiro em ambiente isolado continuam na etapa B2. A atualização
de projeções vencidas e sua leitura nos pontos de autorização também precisa
ser concluída; um cache não deve transformar prazo em direito permanente.
