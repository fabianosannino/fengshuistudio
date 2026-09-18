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

PR #198 integrado em `93bc988d4abe67559e9811cd33a3ea1728c9babd` após CI
35312697039 verde. Migration remota `20260918055745`. Readback: 13 clientes,
17 consultas, zero intenções de exclusão e RPC somente service_role; duas
contas existentes têm vínculo comercial e passam a exigir encerramento
coordenado. Produção READY `dpl_Hp5GzA5QjKi7CuBi7t1arsvgT6za`, mesmo SHA.
Advisors mantiveram o ERROR da view pública e dois WARN anteriores, com um
INFO adicional esperado pela tabela técnica de exclusões sem policy de usuário.

Segundo pacote: scripts automáticos GA/Plausible suspensos até definir e
verificar o contrato de coleta (ADR 0045). IDs de ambiente não bastam para
reativar. Não se afirma que a revisão de consentimento/retenção esteja pronta.

PR #201 integrado em `2677f114e233953e7cd46bea309c45c3577a7718`, CI
35314899010 verde e produção READY `dpl_HXopnE1qmZtd5NBMXUMNXLN58pJM`.

Terceiro pacote: validação e reencode de imagens nas quatro rotas do app,
limites reais de multipart e pixels, remoção de metadados e troca de arquivos
sem apagar a versão anterior. ADR 0046 registra a fronteira ainda pendente
com a API direta de Storage e a retenção de versões. Não fecha C3 integralmente.

PR #202 integrado em `be665b0f6d44a8fc80a0f92cf6ba00360578c8fa`, CI
35316239827 verde, 1.585 testes em 120 arquivos. Produção READY
`dpl_79StutQhzf3taBHSam6NMXc9EwM1`, mesmo SHA.

Quarto pacote: rate limit atômico no Redis, escopo por operação e HMAC em vez
do IP em texto. Operações sensíveis protegidas retornam 503 quando o contador
compartilhado está indisponível em produção; leituras de menor risco admitem
fallback limitado a 10 mil chaves por instância. Runner Redis isolado incluído
no CI. Decisão, impacto de disponibilidade e limites no ADR 0048.

Verificação local do quarto pacote: 1.615 testes em 121 arquivos, typecheck e
build aprovados, lint sem erros (103 avisos). Oito verificações Redis reais,
incluindo 32 trabalhadores concorrentes; nenhuma credencial de produção.

PR #204 integrado em `faa8df46ce62769dcfcbc36d4075e4800fddce68`, CI
35318757268 verde e produção READY `dpl_ExqgP2ELwfxTqdjKH46BCGpyQBeB`.
GET sem sessão em `/api/conta/dados` respondeu 401 após passar pelo contador
compartilhado; verifica conectividade/EVAL sem executar portabilidade.

Coordenação de checkout (ADR 0049) amplia a recusa de exclusão a tentativas
de cobrança ainda não reconciliadas e inclui suas referências na exportação
do titular. Encerramento comercial/retencão continuam pendentes.
