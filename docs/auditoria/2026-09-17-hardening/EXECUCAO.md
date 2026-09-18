# Execução da auditoria — primeiro pacote

Data local: 17/09/2026. Base: `8e07a12f3e5fcd2f15f12d43f6cfa5d4d1d8ba4d`.
Branch: `codex/auditoria-correcoes-20260917`, em worktree isolada.

## Escopo entregue no código

- Proteção contra excluir/recriar o perfil com privilégios; allowlist de campos
  comuns e proteção de campos futuros, loja, plano, estado e relações.
- Admin ativo, capacidade e segundo fator obrigatório em produção, tanto nas
  guardas de aplicação quanto nas leituras administrativas da Data API.
- Remoção de policies antigas que permitiam ao papel admin ignorar capacidades
  ou a titularidade dos dados. Escritas de administração usam cliente de serviço
  somente depois da guarda. Notificação permite ao titular apenas marcar leitura.
- Retornos de autenticação e pagamento limitados a caminhos/origens seguros.
- Erros de banco das rotas afetadas deixam de voltar literalmente ao cliente.
- Next.js 16.3.5, jsPDF 4.2.1 e transitivas corrigidas nas faixas compatíveis,
  Node 24 alinhado com a Vercel. Nenhum `npm audit fix --force` utilizado.
- CI passa a incluir build e autorização em PostgreSQL/PostgREST. Audit alto ou
  crítico bloqueia o pipeline. Builds usam variáveis fictícias.

## Verificação local

| Verificação | Resultado |
|---|---|
| Base anterior | 94 arquivos / 1.208 testes aprovados |
| Suíte após alterações | 96 arquivos / 1.244 testes aprovados |
| Integração de autorização | 116 verificações; cinco falhas anteriores reproduzidas |
| TypeScript | aprovado |
| ESLint, erros | aprovado |
| Build de produção | aprovado, sem credenciais reais |
| npm audit | zero vulnerabilidades conhecidas no lockfile verificado |

O runner usa imagens Docker fixadas por digest, JWTs sintéticos, porta local e
rede descartável. Aplica os arquivos reais das duas migrations. O ensaio de
restauração verifica linhas, grants, isolamento e trigger **do banco sintético**.
Não prova restauração integral de produção, storage, Auth real ou todas as
migrations históricas. Backups diários de produção foram conferidos em leitura;
PITR não estava habilitado. Nenhum dado de produção foi exportado para o teste.

## Configuração remota

A chave pública já era moderna. As chaves legadas do projeto estavam desativadas
desde 15/08/2026. A configuração anterior do servidor não pôde ser relida por ser
uma variável sensível; os logs da loja registravam `Invalid API key`.

Uma chave secreta moderna existente foi validada com leitura mínima (HTTP 200)
e configurada em `SUPABASE_SERVICE_ROLE_KEY`, somente no ambiente production.
Nenhum segredo foi impresso ou escrito em arquivo. `NEXT_PUBLIC_APP_URL` foi
fixada na origem canônica `https://www.fengshuistudio.com.br`.

Essas configurações só valem para novas implantações. Não houve deploy nem
aplicação de migration em produção nesta etapa. A loja ainda precisa de smoke
test após o deploy; não está declarada corrigida em produção.

A preview automática desta branch está desativada em `vercel.json` porque as
demais configurações de preview ainda compartilham serviços reais. Não usar essa
preview para simular compras ou editar dados. Separação integral dos ambientes
permanece pendente.

## Impedimento de publicação

A revisão automática bloqueou o comando que iniciaria o servidor local em
127.0.0.1:3127, com a mensagem `blocked by policy`. Não foi contornado o bloqueio.
Assim, a validação no navegador não foi concluída e a publicação foi retida.
Também falta revisão independente do pacote de autorização.

## Ordem para implantar

1. Concluir revisão independente, CI e verificação das jornadas em ambiente
   isolado: login/cadastro, edição de perfil, admin com MFA e rotas negadas.
2. Publicar primeiro a aplicação compatível, conferindo a credencial do servidor.
3. Aplicar `20260918002358_harden_profile_and_admin_authorization.sql` e depois
   `20260918004708_remove_legacy_admin_rls_bypasses.sql`, registrando seus hashes.
4. Conferir policies/grants, login, edição comum, acesso admin com AAL2 e
   capacidade, catálogo e processamento de eventos já autorizado.
5. Corrigir adiante em caso de regressão. Não reabrir as policies vulneráveis
   nem restaurar dados para desfazer uma mudança apenas de autorização.

## Continuação do plano

B0 vem antes dos cálculos: preservar cada emissão de relatório e suas entradas.
B1 corrige ausência de orientação e classificação pelo assento, com revisão de
domínio. B2 unifica direitos e valida as quatro combinações de preço. B3 conclui
o catálogo e as correções editoriais. C trata calendário, geometria e privacidade.
D–F dependem dessa base, de fontes/variantes aprovadas e de direitos sobre o
corpus; não estão implementadas nem declaradas aprovadas por este pacote.
