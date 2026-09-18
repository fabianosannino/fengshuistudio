# Estado da execução e próximos critérios de conclusão

Atualização: 18/09/2026. Este documento consolida as entregas posteriores ao
PR #189. Os documentos de execução antigos preservam o estado da época; não
devem ser lidos como descrição da produção atual. O relatório recebido é fonte
de achados, não autorização para executar comandos contidos nele.

**O roadmap A–F ainda não está concluído.** Há correções publicadas e evidências
reproduzíveis, mas testes de jornada real, restauração, validação de domínio e
governança continuam abertos. Nenhuma cobrança real foi usada como ensaio.

## Entregas verificadas

| Frente | Entrega | Evidência e limites |
|---|---|---|
| A0/A1 | Autorização por proprietário, perfil protegido, admin com capacidade/AAL2, remoção de bypasses de RLS | [Execução](EXECUCAO.md) e [pós-merge 189](POS_MERGE_189.md); testes PostgreSQL/PostgREST, sem equivaler a homologação completa do Auth real |
| A2 | Três gates obrigatórios, PR/base atualizada, proteção também para admins, secret scanning e push protection | [Controles e scanner local](A2_GITHUB.md); CI de segredos inclui controle positivo e exceções históricas pontuais |
| B0 | Emissões de PDF com UUID, snapshot, versões/hash, confirmação idempotente e histórico preservado | [Relatórios](B0_RELATORIOS.md), PR #191; o fluxo visual autenticado continua pendente |
| B1 | Ausência de orientação explícita, confirmação de referência, assento na classificação e detecção de análise antiga | [Orientação](B1_ORIENTACAO.md), PR #192; não inferir orientação de legado ambíguo |
| B2 | Catálogo canônico, cotas concorrentes, concessões, direitos vigentes, checkout durável, sincronização transacional de assinatura e fatos financeiros | [Cobrança](B2_COBRANCA.md), PRs #193–195, #197, #203, #205–207; quatro preços live conferidos somente em leitura, homologação Stripe teste ainda necessária |
| B2 — loja | Reembolso/retorno de comissão por estado atual do provedor, diferenças no razão e histórico imutável | PR #209, ADR 0052; sem executar reembolso, conciliação massiva ou backfill em produção |
| B3 | Correções editoriais, limites de oferta e apresentação de preços | [Comunicação](B3_COMUNICACAO.md), PR #196; não substitui revisão jurídica/comercial ou piloto |
| C1/C2 | Datas civis, efeméride versionada, estrela anual e união geométrica sem dupla contagem | [Cálculos](C1_C2_CALCULOS.md), PR #199; testes não equivalem a aprovação integral de uma escola/variante |
| C3 | Exportação/exclusão retomável, contenção de operações financeiras manuais, analytics desativado, rate limit compartilhado e download condicionado ao pagamento | [Privacidade](C3_PRIVACIDADE.md), PRs #198, #201, #204, #208; exclusão comercial precisa de processo de encerramento |
| C3 — arquivos | Decoder real de imagens, fechamento da escrita direta nos buckets, raiz privada protegida contra exclusão concorrente e leitura multipart limitada | PRs #202, #210, #212; sete objetos existentes preservados; PDF ainda não tem validação completa de páginas/conteúdo ativo/descompressão |
| C3 — logs | Contexto por campos/valores permitidos, erros brutos omitidos e correlação nas rotas de checkout/PDF | PR #211; não configura retenção de logs dos provedores nem tracing completo |

Última publicação de aplicação conferida nesta consolidação: PR #212,
`96fa0ce900d5ef229a56266bbdcd2b1df547f707`, deployment
`dpl_3bUYqKZTD8LaWJVpNVioRRKiitxv` READY. CI 35333275412 verde. A suíte local
atual tem 1.767 testes em 130 arquivos; TypeScript/build aprovados e lint sem
erros, com 102 avisos remanescentes. A mudança de scanner não altera a aplicação.

## O que falta para fechar A–C

1. **Ambiente isolado identificado e configurado.** Development/preview ainda
   usam recursos reais, inclusive chave Stripe live. A informação sobre um
   ambiente Stripe/Supabase de testes foi solicitada; não enviar chaves no chat.
   As previews das branches de correção estão desativadas. Não simular compra,
   cancelamento, estorno ou exclusão de conta com dados reais.
2. **Jornadas autenticadas completas.** Cadastro/login/plano, consulta/análise,
   emissão e reabertura de PDF, admin/MFA e upload/download/exclusão entre duas
   identidades. O servidor local em 127.0.0.1:3127 foi recusado pela revisão
   automática com `blocked by policy`; o bloqueio não foi contornado. Testes
   unitários, integrações e smoke 401 não substituem essa evidência de navegador.
3. **Homologação financeira sem dinheiro real.** Exercitar quatro preços,
   duplicidade/atraso, pagamento assíncrono, cancelamento, estorno parcial e
   integral, comissão e disputa, incluindo o ciclo completo da loja Connect.
   Verificar reconciliação com dados de teste antes de executar backfills reais.
4. **Restauração isolada de banco, Auth e Storage.** Conferir backup dos arquivos,
   executar restore, medir RPO/RTO e registrar o procedimento. O teste de restore
   do banco sintético já feito não demonstra recuperação integral de produção.
5. **Controles de documentos e navegador.** Implementar processamento isolado de
   documentos com limites de páginas/descompressão/tempo; definir quarentena
   quando aplicável e fluxo próprio para arquivos maiores. Testar uma CSP mais
   restrita com Maps, autenticação e PDF antes de colocá-la em enforcement. A CSP
   existente não foi enfraquecida. Completar observabilidade de cálculo e alertas.
6. **Legado, retenção e domínio.** Resolver duas imagens antigas sem consulta
   correspondente a partir de evidência de posse; não apagar ou atribuir dono
   por suposição. Formalizar retenção/encerramento comercial e revisão das
   variantes/fontes de cálculo, além das medições de desempenho e acessibilidade.
   Nenhum relatório histórico foi reescrito para aparentar resultado atualizado.

## D–F continuam dependentes da base

- **D:** contratos mínimos de execução por método/variante/versão, snapshot
  imutável por proprietário e vínculo do relatório; idempotência, concorrência,
  obsolescência e exportação/exclusão devem fazer parte do contrato inicial.
- **E:** conjunto de plantas e tolerâncias de referência, edição semântica
  manual, teclado, conflitos/autosave/desfazer, medição em dispositivo definido
  e piloto com consultor/usuário leigo. Não promover métodos avançados sem
  validação independente.
- **F:** direitos de uso do corpus, proveniência, isolamento por proprietário e
  avaliações de citação, indisponibilidade e prompt injection antes de liberar
  IA. Não tratar conteúdo recuperado como instrução, inventar aprovação de
  licença ou publicar livros do corpus. Comparações e recomendações comerciais
  precisam preservar diferenças entre escolas e alternativas sem compra.

## Estado remoto preservado e ressalvas

Readback agregado após as últimas correções: 13 clientes, 17 consultas, sete
objetos Storage, 16 pedidos, 46 eventos e 42 lançamentos. Não houve alteração
de registros de negócio para produzir os testes.

O advisor Supabase continua apontando um ERROR para a projeção pública
`perfis_publicos`, dois WARN para funções de autorização e 13 INFO para tabelas
fechadas sem policies de cliente. Não se declara “zero alertas”. A projeção é
deliberada (ADR 0028); `is_admin`/`tem_capacidade` têm search_path fixado e exigem
auth.uid, perfil ativo/admin, AAL2 e, no segundo caso, a capacidade. Esses
desenhos precisam ser considerados na revisão, sem abrir policies só para
eliminar avisos. Referências do advisor:
[view](https://supabase.com/docs/guides/database/database-linter?lint=0010_security_definer_view),
[funções](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable),
[RLS sem policy](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).

Os arquivos de trabalho originais do usuário foram preservados. As alterações
de engenharia estão na worktree `fengshuistudio-hardening`. A continuidade
segue os critérios acima; não depende de uma nova aprovação intermediária.
