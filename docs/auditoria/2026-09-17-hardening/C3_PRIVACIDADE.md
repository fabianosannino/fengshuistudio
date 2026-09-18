# C3 — privacidade: portabilidade e exclusão

Primeiro pacote em 18/09/2026. Decisão e limites: ADR 0043.

- Exportação paginada com posse explícita, filhos das próprias consultas e
  compras pelo e-mail verificado. Falha não confirma arquivo completo.
- Inventário da tela pelo servidor, sem confundir indisponibilidade com zero.
- Caminhos validados e arquivos órfãos dentro das raízes conhecidas incluídos.
- Erros de Storage, banco, anonimização e Auth interrompem a sequência.
- Proteção de upload/exclusão concorrentes por RLS restritiva e locks.
- Encerramento comercial pendente recusa antes de remover dados; intenção
  durável impede anexar cobrança durante a exclusão.
- Consulta da conta Stripe limitada à conta do titular autenticado.

Inventário de produção conferido somente em leitura: colunas de arquivos em
clientes, consultas, fotos_consulta, relatorio_emissoes, profiles, produtos e
conteudo_admin. Avatar/logo e arquivos de conteudo_admin sem valores; um
produto com arquivo/imagem, preservado. FKs de produtos restringem remover o
vendedor; pedidos preservam os fatos comerciais. Não se excluiu conta, objeto
ou registro real durante o ensaio.

Continuação C3: analytics sem dados pessoais, limites de uploads, CSP gradual,
comportamento do rate limit e observabilidade. Encerramento de conta com
cobrança/vendas exige fluxo coordenado próprio; não está concluído por este
pacote. Testes da API Storage, restauração de backup com arquivos e jornada
autenticada real continuam pendentes. Não há certificação jurídica ou de
conformidade inferida dos testes técnicos.

Verificação local: 1.479 testes em 114 arquivos e typecheck aprovados; lint
sem erros (105 avisos anteriores). Build com configuração sintética aprovado.
Runner PostgreSQL com 32 verificações, sem dados de produção. Exclusão de
consulta individual também remove suas fotos, preservando as de clientes.
