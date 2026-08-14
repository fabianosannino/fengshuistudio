# CLAUDE.md — regras para o Claude Code neste repositório

Contexto operacional para agentes trabalhando no FengShui Studio. Leia antes
de gerar ou alterar código.

## O que é

App Next.js 16 (App Router) + Supabase + Stripe Connect para consultores de
Feng Shui. Não é monorepo — estrutura standalone.

## Comandos

```bash
npm run dev     # desenvolvimento
npm run build   # build de produção (valida tipos)
npm run lint    # ESLint
npm test        # Vitest (npm test -- <arquivo> para um teste)
npx tsc --noEmit  # typecheck isolado
```

Antes de commitar mudança não-trivial: `npx tsc --noEmit && npm test && npm run lint`.
O lint **bloqueia o CI** — não há erro tolerado. As poucas supressões existentes
são por sítio e trazem a razão ao lado; se precisar de uma nova, escreva o porquê.

## Convenções

- **Arquivos**: `kebab-case.ts`. Componentes React em `PascalCase.tsx` sob
  `app/components/`. Sufixos de rota: `route.ts`, `page.tsx`.
- **Imports**: relativos a partir de `app/api/...` para `src/lib` (ex.:
  `../../../src/lib/...`). O alias `@/` existe mas não é usado de forma
  consistente — siga o padrão do arquivo vizinho.
- **Erros**: `fail fast`. Nunca retornar 200 com `{ error }`; use o status HTTP
  correto. Respostas ao cliente são **genéricas**; detalhe vai no `logger`.
- **Sem `console.log`**: use `src/lib/logger.ts` (estruturado, sem PII).
- **Sem strings/números mágicos**: constantes nomeadas (`src/lib/constants.ts`,
  `plano-utils.ts`).
- **Estado que muda com o tempo é derivado, não gravado** (ADR 0027). «Atrasado»
  sai da data de vencimento, nunca de `pagamentos.status`; a etapa da consulta
  sai dos dados presentes, não de uma coluna. Guardar os dois cria duas
  verdades, e a que envelhece é a gravada.
- **O plano vem de concessões, não de um campo** (ADR 0029). `profiles.plano` é
  projeção; a verdade está em `concessoes_de_plano`, cada uma com origem
  (`assinatura`, `chave`, `cortesia`) e prazo. Escrever naquela coluna fora de
  `recalcularPlanoDoPerfil` recria o defeito que originou a tabela: cancelar
  uma assinatura apagava um Profissional vindo de chave, porque o valor não
  dizia de onde tinha vindo.
- **Papel ≠ plano** (ADR 0024). `papelDoUsuario` responde «atende clientes ou
  cuida da própria casa?» e decide menu e home; `planoUsuario` responde «o que
  comprou?» e decide limites. Um consultor no free é as duas coisas.
- **O pedido da loja não tem `status`** (ADR 0030). O estado sai de
  `pedido_eventos`, que é append-only por trigger — o banco recusa `update` e
  `delete`. Corrigir um evento é **acrescentar** o que corrige, e o estado é a
  precedência entre os fatos, não o último a chegar: é o que faz um `pago`
  atrasado não desfazer um reembolso. `pago` é escrito **só** pelo webhook,
  nunca pela tela de sucesso.
- **Quem pode baixar o bem digital é calculado, não liberado** (ADR 0031). O
  direito sai da posse do token do pedido mais `pedidoRendeuReceita` — nunca de
  uma coluna `download_liberado`, que o reembolso não desfaria. O arquivo mora
  em bucket privado e a URL assinada nasce no clique, com minutos de validade.
- **Na indicação, quem vende é o parceiro — e a vitrine diz isso** (ADR 0032).
  `modo_de_venda` mora no produto com constraint bicondicional: indicação exige
  link externo, marketplace o proíbe. O clique passa por `/api/loja/indicacao`,
  que recebe o **id do produto** (nunca a URL, que faria um redirecionador
  aberto) e mede **volume, não identidade**.
- **Ausência ≠ zero.** Setor não avaliado é `null` e aparece como «—», nunca
  como 0%; item de checklist não verificado não entra no denominador; área da
  Roda sem resposta não vira média. Vale para score, checklist, Roda da Vida e
  período do imóvel.

## Segurança — inegociável

- **Segredos**: nunca no código. `SUPABASE_SERVICE_ROLE_KEY` só no servidor,
  nunca com `NEXT_PUBLIC_`. Use `src/lib/supabase-admin.ts` (import
  `server-only`) para escritas privilegiadas/webhooks.
- **RLS** em toda tabela. Colunas `role`/`plano`/`stripe_*` de `profiles` são
  protegidas por trigger — escrevê-las exige `service_role`.
- **Autorização**: rotas de usuário derivam ownership do `user.id` autenticado,
  **nunca** de IDs vindos do body (ex.: `account_id`). Rotas `/api/admin/*`
  re-verificam `role` no servidor.
- **Preço nunca vem do cliente**: checkout lê o `price` da conta conectada.
- **Uploads**: validar MIME por whitelist e derivar a extensão do MIME
  (`imageExtensionForMime`), nunca de `file.name`.
- **Toda escrita no Supabase deve checar `error`.** O client resolve a promise
  com `{ data, error }` — não rejeita. Um `await` solto engole a falha e o
  `try/catch` em volta nunca dispara. Use `escreverOuFalhar` (lança) ou
  `escreverBestEffort` (devolve boolean para você tratar) de
  `src/lib/supabase-escrita.ts`. Best-effort é decisão declarada, não descuido.
- **Foto nunca é renderizada a partir do valor cru do banco.** Os buckets estão
  fechando (ADR 0022): passe o valor por `useUrlsAssinadas`/`urlExibivel`, que
  aceita tanto URL pública legada quanto path. Upload novo grava **path**.
- **Rate limit é `await`** e a chave vem de `ipDaRequisicao(request)` — nunca de
  `x-forwarded-for.split(',')[0]`, que é a ponta que o cliente escreve.

## Onde vive a lógica

- **Domínio Feng Shui / regras de plano**: idealmente em `src/lib` (débito:
  parte ainda está dentro de componentes — ver auditoria).
- **I/O (Supabase/Stripe)**: rotas `/api` e `src/lib`.
- **UI**: `app/**` — evite regra de negócio nova dentro de componente.

## Migrations

`supabase/migrations/` é aplicado normalmente. `supabase/migrations-manuais/`
**não é** — é onde ficam as mudanças outward-facing e difíceis de reverter, cuja
verificação depende de Supabase real e browser (hoje: fechar os buckets de
fotos). Cada arquivo traz o próprio checklist de staging. Não mova nada para lá
sem explicar por que o CI não consegue verificar, e não mova de lá para cá sem
 ter rodado o checklist.

**Nomeie migration nova com timestamp, não com data.** Use
`YYYYMMDDHHMMSS_descricao.sql`. As 20 já aplicadas usam só a data (8 dígitos), e
nove dias têm mais de um arquivo — a ordem entre eles sai da ordenação
alfabética do nome, por sorte, e há dependências reais entre alguns. As antigas
**não** devem ser renomeadas: o Supabase registra a migration pelo nome, então
renomear faria reaplicar. É achado A9 da auditoria, resolvido daqui pra frente.

**Schema base:** `supabase/schema/00-schema-base.sql` é um retrato das tabelas e
tipos, não uma migration — existe porque o schema nasceu fora de migrations
(achado A8) e um restore em julho o levou junto. Regere depois de qualquer
mudança estrutural aplicada fora de migration; as consultas estão em
`scripts/schema/README.md`.

## Documentação de arquitetura

- `docs/architecture/overview.md` — visão geral e camadas.
- `docs/architecture/adr/` — decisões (ADR): pagamentos (0002), autorização/RLS
  (0003), CSP (0004), storage/LGPD (0005), cálculos de Feng Shui (0007–0012),
  hierarquia de precedência entre métodos (0013), referência de norte e
  declinação (0014), fronteira de classificação dos remédios (0015),
  questionário de facing (0016), curadoria de evidência com proveniência
  (0017), Ba Guá fixo no BTB (0018), erro genérico ≠ erro enganoso (0019), lacuna declarada em auditoria (0020), modelos de pontuação escolhidos pelo consultor (0021), fotos por URL assinada (0022), rate limit com degradação declarada (0023),
  papel do usuário separado do plano (0024), cliente final recebe julgamento e
  não score (0025), fila offline da vistoria (0026), estado derivado em vez de
  status gravado (0027), `perfis_publicos` como projeção pública deliberada (0028), plano derivado de
  concessões (0029), pedido como máquina de estados (0030), entrega digital
  derivada do pedido (0031), indicação diz quem vende (0032).
  Toda decisão arquitetural nova vira um ADR.
- `docs/domain/modelo-da-loja.md` — modelo da loja e as fases. Leia antes de
  mexer em pedido, comissão ou afiliado.
- `docs/security/threat-model.md` — ativos, fronteiras e ameaças.
- `docs/domain/glossary.md` — linguagem ubíqua (Ba Guá, setores, planos).
- `docs/domain/fengshui-metodos-referencia.md` — documento-mestre dos métodos e
  o anexo de status de implementação.

## Recomendações ao cliente: nada sem proveniência

Toda dica que vira `Remedio` precisa de **fonte nomeada, localizador e citação
literal** em `src/lib/curadoria-evidencia.ts` — o tipo obriga, não é convenção.
Dica sem fonte localizável continua aparecendo como texto, **sem selo de
evidência**: é o comportamento honesto, não uma pendência a "resolver"
inventando classificação.

Ao mexer nisso:

- As citações são conferíveis: `python3 scripts/citacoes/extrair-corpus.py &&
  python3 scripts/citacoes/verificar-citacoes.py` (precisa de `docs/Books` e
  `pip install pypdf`; não roda no CI).
- `docs/domain/curadoria-dicas.md` é **gerado** —
  `npx vite-node scripts/citacoes/gerar-planilha.mts`. Não editar à mão.
- `contraindicacao` é **impressa no relatório do cliente**: sem referência a
  arquivo de código, sem discussão de curadoria. Isso vai em `nota`, que não
  chega ao relatório.
- Aspas duplas nesses textos são reservadas a citação de obra; para citar texto
  do próprio app use «guilemetes», senão o verificador cobra a frase como se
  fosse do livro.

## Débitos e histórico

`docs/auditoria/2026-07-18-auditoria-arquitetura-seguranca.md` lista os achados
e o plano P0/P1/P2. `docs/auditoria/2026-08-11-fechamento-de-pendencias.md` diz o
que foi fechado, o que ficou e por quê — comece por ele. Consulte antes de
decisões arquiteturais.
