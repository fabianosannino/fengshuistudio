# Auditoria de Arquitetura, Clean Code e Segurança — FengShui Studio

**Data:** 2026-07-18
**Escopo:** código completo (`app/`, `src/`, `supabase/migrations/`, configs), verificação funcional (build, typecheck, lint, testes) e conformidade com o playbook CollabZ Craftsmanship (regras R1–R16).

> **Status de remediação (atualizado):** P0 e a maior parte do P1 já implementados no PR #70.
> Corrigidos: C1–C10, A1, A3 (mensagens genéricas), A6 (extensão de upload por MIME),
> C8 parcial (listagem de storage por dono). Adicionados: client `service_role`,
> `.env.example`, `SECURITY.md`, `CLAUDE.md`, `.nvmrc`, README real, workflow de CI,
> remoção de arquivo morto, e 17 erros de lint de baixo risco zerados (67→50).
> **Correção adicional (bug):** `SETOR_DICAS`/`CRITERIO_DICAS` estavam duplicados e
> **divergiram** — a tela de detalhe da consulta usava a versão rica (5 dicas) e o PDF
> do relatório a versão truncada (3 dicas), para a mesma consulta. Unificado numa fonte
> única em `constants.ts` (versão superset, sem perda), com teste de regressão.
>
> **`refactor(types)`:** os 36 `any` explícitos foram eliminados com tipos apropriados
> (novos tipos JSONB em `types.ts`; mudança só de anotação, zero efeito em runtime, tsc
> como gate). Lint: 50 → **14 erros** (restam apenas 13 `set-state-in-effect` + 1
> `immutability`, regras estilísticas do React Compiler).
>
> **Atualização de 2026-08-11 — ver `2026-08-11-fechamento-de-pendencias.md`.**
> Fechados desde então: rate limit compartilhado + IP não spoofável (A4/A5, ADR 0023),
> lint a zero e bloqueante no CI, `unsafe-eval` fora de produção e as diretivas que
> faltavam na CSP (ADR 0004 revisto — o plano de nonce **não é executável** enquanto
> as páginas forem pré-renderizadas), escritas sem checagem de `error` no
> `/api/admin/subscriptions` e nos demais sítios da triagem de 26/07, follow-up do
> advisor, motor de recomendação unificado, e a extração de geometria/escala do
> `bagua-planta` para `src/lib`.
>
> **C8 (buckets privados):** o código está pronto e em produção — rota de assinatura
> com verificação de posse, todas as telas resolvendo URL assinada, uploads gravando
> path (ADR 0022). Falta **aplicar** `supabase/migrations-manuais/20260811_fechar_buckets_privados.sql`,
> que exige validação em staging (a geração do PDF usa `html2canvas`). **Até lá as
> fotos seguem públicas.**
>
> **Pendências restantes:** `script-src`/`style-src 'unsafe-inline'` (dependem de
> decisões de arquitetura, não de ajuste de cabeçalho), carga de dados no cliente
> (R1 — 6 supressões de lint declaradas), `relatorio/page.tsx` e `consultas/[id]`
> ainda acima de 1.000 linhas, schema base no repo (A8/A9).

---

## Plano de migração — buckets privados + URLs assinadas (C8 completo, LGPD)

**Por que não foi feito neste PR:** mudança *outward-facing* e difícil de reverter que
exige verificação em staging (não reproduzível sem Supabase real + browser). Estado atual
mapeado: o banco guarda a **URL pública completa** (não o path) em `consultas.foto_geral_url`,
`consultas.fotos_comodos[].fotos[]`, `consultas.fotos_antes[]`, `consultas.fotos_depois[]`,
`consultas.bagua_entrada.planta_url` e `clientes.foto_url`; todos os ~13 pontos de render são
client components; e a geração de PDF (`relatorio`) usa `html2canvas` com `useCORS` — as
imagens precisam carregar antes da captura, senão o PDF sai em branco.

**Sequência segura (PR próprio, com staging):**
1. Nova rota `GET /api/storage/signed?path=...` que verifica ownership (consulta/cliente do
   `user.id`) e retorna `createSignedUrl` (TTL curto).
2. Passar as 3 rotas de upload a salvar o **path** (não a URL pública); ajustar os 3 pontos de
   DELETE que hoje derivam o path por `split('/bucket/')`.
3. Backfill idempotente das linhas existentes: URL pública → path.
4. Nos ~13 pontos de render, resolver a signed URL antes de exibir (com `crossOrigin` correto
   para o `html2canvas`). **Validar a geração de PDF em staging** — ponto de maior risco.
5. Só então: `UPDATE storage.buckets SET public = false` para `imoveis-fotos` e `clientes-fotos`.
**Método:** análise estática integral de todas as rotas API (23), todas as páginas/componentes (53 `.tsx`, ~20.660 linhas), todas as 17 migrations SQL, mais execução de `tsc`, `eslint`, `vitest` e `next build`.

---

## 1. Verificação de funcionamento (estado atual)

| Verificação | Resultado |
|---|---|
| `tsc --noEmit` (typecheck) | ✅ Limpo |
| `next build` (produção) | ✅ Passa |
| `vitest run` | ✅ 88 testes, 6 arquivos, todos passando |
| `eslint` | ❌ **67 erros, 61 warnings** (128 problemas) |

Detalhe do lint: 36× `no-explicit-any` (erro), 13× `react-hooks/set-state-in-effect`, 8× `react/no-unescaped-entities`, 5× `react-hooks/immutability`, 4× `no-html-link-for-pages`, 47× `no-unused-vars` (warning), 9× `no-img-element`. Um dos erros é bug real: `app/stripe/products/page.tsx:46` usa `loadProducts` antes da declaração dentro de closure de `useEffect`.

**Conclusão da seção:** o sistema compila e os testes passam, mas o lint quebrado indica que ele não roda no fluxo de trabalho (não há CI — ver §5).

---

## 2. Achados CRÍTICOS (segurança e funcionamento)

### C1 — Auto-promoção a admin e burla de plano via RLS de `profiles`
`supabase/migrations/20260316_complete_setup_with_rls.sql:86-90`

A policy de UPDATE é `USING (id = auth.uid()) WITH CHECK (id = auth.uid())`, sem restrição de coluna. RLS é por linha, não por coluna: **qualquer usuário autenticado pode executar, com a anon key pública, `UPDATE profiles SET role='admin', plano='profissional' WHERE id = auth.uid()`** via PostgREST. Escalada de privilégio total + burla de billing. Viola R11/R13.

*Correção:* trigger `BEFORE UPDATE` que rejeita mudança de `role`/`plano`/`stripe_*` quando `NOT is_admin()`, ou coluna-level privileges (`REVOKE UPDATE (role, plano) ON profiles FROM authenticated`).

### C2 — Tabela `plans` sem RLS
`supabase/migrations/20260404_billing_system.sql:7-17`

Única tabela criada sem `ENABLE ROW LEVEL SECURITY`. Com os GRANTs default do Supabase, ela fica **legível e gravável via API pública** — qualquer um pode alterar preços e features dos planos. Viola R13 diretamente.

### C3 — Usuário concede a si mesmo assinatura paga / marca fatura como paga
`20260404_billing_system.sql:54-57` (subscriptions) e `:91-94` (invoices)

`FOR ALL USING (is_admin() OR user_id = auth.uid())` sem `WITH CHECK` explícito — o `USING` vale para escrita. Usuário comum pode inserir `subscriptions` com `status='active'` e `plan_id` Profissional, ou marcar `invoices` como `status='paid'`. Mesmo padrão em `store_orders` (`20260407_store_slug_and_sales.sql:28-31`): o vendedor pode zerar `platform_fee`.

*Correção:* separar policies — SELECT para o dono; INSERT/UPDATE/DELETE apenas `is_admin()` (escritas legítimas de billing devem vir do webhook com service_role).

### C4 — Audit trail apagável por qualquer usuário
`20260317_security_and_performance_fixes.sql:80-90`

`cleanup_old_audit_logs()` é `SECURITY DEFINER` (roda como owner, fura RLS) e, sem `REVOKE`, o Postgres concede `EXECUTE` a `PUBLIC` por default. Qualquer autenticado pode chamá-la via RPC e **apagar a trilha de auditoria** — o oposto de append-only (R14).

*Correção:* `REVOKE EXECUTE ON FUNCTION cleanup_old_audit_logs() FROM PUBLIC, anon, authenticated;` + `SET search_path`.

### C5 — Manipulação de preço no checkout
`app/api/stripe/checkout/route.ts:29-90`

A rota não autentica e aceita `unit_amount`, `account_id` e `product_name` do corpo da requisição. O valor cobrado e a `application_fee_amount` derivam do `unit_amount` **enviado pelo cliente** — o comprador define o próprio preço (ex.: R$ 0,01). `validateCurrency` só limita a faixa, não impede subvalorização.

*Correção:* aceitar apenas `price_id` de Price criado server-side e validar que pertence ao `account_id` informado; nunca aceitar `unit_amount` do cliente.

### C6 — Middleware bloqueia os webhooks do Stripe e a loja pública
`src/middleware.ts:15` + `config.matcher`

O matcher cobre `/api/*` e `PUBLIC_ROUTES` não inclui rotas de API. Consequências:

1. **Webhooks quebrados:** `POST /api/stripe/webhooks` e `/api/stripe/webhooks/subscriptions` chegam sem cookie de sessão → redirect 307 para `/login` → o Stripe trata como falha. A sincronização de assinaturas/faturas via webhook **nunca funciona em produção**.
2. **Loja pública quebrada para anônimos:** `/loja/[slug]` (página pública) chama `fetch('/api/stripe/products')` e `fetch('/api/stripe/checkout')` (`app/loja/[slug]/page.tsx:33,45`) — para visitante não logado o middleware redireciona o fetch para o HTML do login. A vitrine só funciona para usuários logados.

*Correção:* excluir `/api/stripe/webhooks` (e as APIs públicas da loja) do matcher ou incluí-las em lista pública; deixar cada rota API responder 401 em vez de redirect.

### C7 — Webhooks escrevem no banco com client anônimo e engolem erros
`app/api/stripe/webhooks/subscriptions/route.ts:52+`

O handler usa `createRouteHandlerClient()` (anon key + cookies). Em contexto de webhook não há sessão → todas as escritas em `subscriptions`, `profiles`, `invoices`, `payment_notifications` dependem de RLS permitir escrita **anônima**. Ou falham silenciosamente (nenhum `.update()`/`.insert()` checa `error` — viola R7), ou só "funcionam" por causa das policies furadas de C3. Mesmo corrigindo C6, o webhook não sincroniza corretamente.

*Correção:* usar client com `SUPABASE_SERVICE_ROLE_KEY` exclusivo do webhook (após verificação de assinatura, que já existe e está correta) e checar `error` de cada escrita.

### C8 — Fotos de imóveis de clientes públicas (LGPD)
`supabase/migrations/20260316_fix_storage_bucket.sql:8-19, 67-80`

Bucket `imoveis-fotos` com `public=true` + policy de SELECT `USING (bucket_id='imoveis-fotos')`: **qualquer pessoa com a URL acessa fotos do interior de residências de clientes, sem autenticação**. A policy de listagem exige apenas `auth.uid() IS NOT NULL` — qualquer consultor lista arquivos de todos. Upload/update/delete estão corretos (por dono). Dado pessoal sensível exposto — risco LGPD direto (R11/R14).

*Correção:* bucket privado + URLs assinadas; policies de SELECT/list amarradas a `consultas.consultor_id = auth.uid()`.

### C9 — Operações Stripe em conta de terceiros (ownership ausente)
`app/api/stripe/products/route.ts:32-40` e `app/api/stripe/account-link/route.ts:22-30`

Quando o corpo traz `account_id`, ele é usado sem verificar se pertence ao usuário autenticado — dá para criar produtos ou gerar link de onboarding **na conta Stripe conectada de outro consultor**.

*Correção:* ignorar `account_id` do corpo; derivar sempre do `profiles.stripe_account_id` do próprio usuário.

### C10 — Ativação de planos com validação incompleta
`app/api/planos/route.ts:41-91`

Dois buracos: (1) a chave de ativação não tem seu `plan_type` comparado ao plano solicitado — chave de plano barato ativa plano caro; (2) a exigência de chave só vale se o usuário **não** está em plano pago (`isPaidPlan && !currentIsPaid`) — quem está no `simples` faz upgrade para `profissional` **sem chave nenhuma**.

---

## 3. Achados ALTOS

| # | Achado | Local |
|---|---|---|
| A1 | Funções `SECURITY DEFINER` sem `SET search_path` (vetor de injeção por search_path; flag do advisor Supabase) | `is_admin()` e `cleanup_old_audit_logs()` em 4 migrations |
| A2 | Policy de parceiros expõe a **linha inteira** de `profiles` (incl. `stripe_account_id`, `stripe_customer_id`, `role`, `plano`) a qualquer autenticado | `20260316_complete_setup_with_rls.sql:78-83` — usar view com colunas públicas |
| A3 | Vazamento de detalhes internos ao cliente: `error.message` do Supabase/Stripe retornado no body em ~10 rotas | ex.: `clientes/route.ts:92`, `bagua-planta/route.ts:52,86,97`, `admin/relatorios/route.ts:222`, todas as rotas `stripe/*` |
| A4 | Rate limiter in-memory (`Map` por instância) — inócuo em serverless/Vercel; chave = primeiro IP do `x-forwarded-for`, spoofável. Brute-force de chaves de ativação viável | `src/lib/rate-limit.ts` |
| A5 | Rotas Stripe sem rate limit e (checkout/products GET) sem auth — abuso de custo/API | `stripe/checkout`, `stripe/products`, `stripe/account*`, `stripe/portal` |
| A6 | Upload: extensão sem whitelist em 2 das 3 rotas (`file.name.split('.').pop()`), MIME confiado do cliente em todas | `clientes/foto/route.ts:63`, `consultas/bagua-planta/route.ts:76` (`consultas/fotos` faz certo) |
| A7 | `resolvePlanSlug` com fallback para `'profissional'` — preço desconhecido concede o plano mais alto | `stripe/webhooks/subscriptions/route.ts:528` |
| A8 | Schema base inexistente no repo: nenhuma migration cria `profiles`, `clientes`, `consultas`, `setores_bagua`, `diagnostico_criterios`, `pagamentos`, `rituais` nem o enum `consulta_status` — schema aplicado à mão no SQL Editor (drift confirmado pelas 4 migrations `fix_missing_columns`) | `supabase/migrations/` |
| A9 | Nomeação de migrations com prefixo de data (8 dígitos) em vez de timestamp — ordem entre arquivos do mesmo dia é alfabética por sorte; há dependências reais entre arquivos do mesmo dia | todas as 17 migrations |

---

## 4. Arquitetura e Clean Code (regras R1–R10 do playbook)

### R1 (regra da dependência) — violada sistematicamente
- **31 de 53 componentes** importam o client Supabase e fazem CRUD direto do browser (inventário completo no anexo §7). Não existe camada de aplicação/domínio: a segurança de todo o CRUD de negócio depende 100% do RLS — que, como visto em §2, tem furos. As rotas `/api` cobrem só admin, Stripe e uploads.
- Lógica de domínio Feng Shui dentro de componente: `gerarRecomendacoes()` (motor de recomendações), `getScore()`, `comodoFavorabilidade()`, `getProdutosSugeridos()` — tudo em `app/consultas/[id]/page.tsx:165-463`. Regra de status financeiro (`pago/pendente/atrasado` + vencimento) reimplementada em `dashboard` e `pagamentos`. Limites de plano recalculados inline em `consultas/nova/page.tsx:183-185` em vez de usar `limiteImoveis()` que já existe em `plano-utils.ts`.

### R3 (um nível de abstração) / tamanho
- 12 arquivos > 500 linhas; `app/bagua-planta/page.tsx` tem **2.097 linhas** misturando geometria de canvas, persistência e UI. `admin/subscriptions/route.ts` tem um `switch` de ~330 linhas com Stripe + banco + notificações inline.

### R4 (DRY de conhecimento) — violações reais
- `SETOR_DICAS` e `CRITERIO_DICAS` **duplicados literalmente** em `src/lib/constants.ts:159-185` e `app/consultas/[id]/page.tsx:120-187` — duas fontes da verdade para regra de domínio.
- Guard de auth copiado em ~20 páginas, com 3 comportamentos divergentes (`window.location.href='/login'` vs `router.push('/login')` vs `router.push('/')`).
- Fetch de perfil repetido em ~10 lugares apesar de `AppProvider` já oferecer contexto com cache TTL (infra boa, subutilizada).
- Formatação de moeda/data inline em 21 arquivos, sem helper central.
- Testes duplicados e divergentes: `tests/rate-limit.test.ts` (64 linhas) vs `src/lib/__tests__/rate-limit.test.ts` (91 linhas) testam o mesmo módulo.

### R7 (fail fast) 
- Positivo: nenhuma rota retorna 200 com `{error}`; status HTTP corretos em toda a API.
- Negativo: dezenas de `.select()/.update()` no cliente e no webhook sem checar `error` — falha vira estado vazio silencioso (`FlowLayout.tsx:44-58`, `AppShell.tsx:85-108`, `calendario/page.tsx:104-110`, webhook inteiro).

### R8 (sem strings mágicas)
- Status como literais espalhados (`'pago'`, `'finalizada'`, `'em_andamento'`, `'active'`, `'past_due'`…) sem enum/constante; thresholds `>= 70`/`>= 40` e cores hex de status repetidas em dezenas de pontos.

### React/efeitos
- Zero proteção contra race condition/setState-após-unmount nos ~60 `useEffect` (nenhum `AbortController`/flag `cancelled` no projeto).
- Listener de `focus` recarrega todas as queries sem debounce (`consultas/[id]/page.tsx:433-438`).
- 50 de 53 componentes são `'use client'` — até landing, termos e privacidade, perdendo SSR/SEO.
- ~259 `<button>` sem `type` (risco de submit acidental em forms).
- Páginas `/admin/*` não têm guard de redirect próprio (o middleware cobre navegação, e as APIs re-verificam role — correto —, mas a casca renderiza para não-admin).

### Pontos positivos (registrar o que está bem)
- Autenticação consistente nas rotas API; rotas admin re-verificam `role` no servidor (defesa em profundidade real).
- Webhooks **verificam assinatura** com `constructEvent`; comparação de chave de ativação em tempo constante (`timingSafeEqual`); whitelist de campos contra mass-assignment em `consultas/route.ts`.
- Middleware protege contra open redirect; sem segredos hardcoded; sem `service_role` vazada; segredos ausentes do bundle do cliente.
- Logging estruturado via `logger` nas rotas (zero `console.log` em `app/api`).
- `plano-utils.ts`, `constants.ts` e `roda-da-vida-constants.ts` são fontes canônicas bem documentadas; 88 testes unitários sobre elas.
- `dashboard` usa `Promise.allSettled` com degradação graciosa.

---

## 5. Estrutura do repositório (R12, R15, R16)

Contra a estrutura canônica do playbook para Next.js standalone:

| Item | Estado |
|---|---|
| `.env.example` | ❌ ausente (obrigatório — R12) |
| `CLAUDE.md`, `SECURITY.md`, `CONTRIBUTING.md`, `LICENSE`, `.nvmrc` | ❌ ausentes |
| CI (`.github/workflows` com lint + test + audit + gitleaks) | ❌ inexistente |
| `docs/architecture/adr/`, `docs/security/threat-model.md`, `docs/domain/glossary.md` | ❌ inexistentes (há apenas `docs/DOCUMENTACAO_SISTEMA.md`, que é bom) |
| README | ❌ template genérico do create-next-app, sem customização |
| Binários versionados | ❌ 12 arquivos `.xlsx/.docx/.pdf/.png` (~1,5 MB) na raiz, com versionamento por nome de arquivo (`v3`, `v3.1`…`v3.4`) — pertencem a um drive, não ao git |
| Arquivo morto | ❌ `app/layout.tsx_ols` versionado |
| Alias de import | ❌ inconsistente: `tsconfig` mapeia `@/*` → raiz, `vitest.config` mapeia `@` → `src/`, e o código não usa alias nenhum — imports relativos `../../../../src/lib/...` em toda a API |
| Layout de pastas | ⚠️ híbrido: `app/` na raiz + `src/lib` + `src/middleware.ts`; componentes em `app/components` (padrão do playbook: tudo sob `src/`, componentes separados de rotas) |
| Migrations | ❌ ver A8/A9 (schema base fora do repo, nomeação sem timestamp) |

---

## 6. Plano de correção priorizado

**P0 — agora (segurança explorável remotamente):**
1. Migration de emergência: proteger `role`/`plano` em `profiles` (C1); habilitar RLS em `plans` (C2); trocar policies de escrita de `subscriptions`/`invoices`/`store_orders` para admin/service-role (C3); `REVOKE EXECUTE` + `search_path` nas funções (C4, A1).
2. `checkout`: remover `unit_amount` do contrato, usar apenas `price_id` validado (C5).
3. `products`/`account-link`: derivar `account_id` do profile do usuário (C9).
4. `planos`: validar `plan_type` da chave e exigir chave também em upgrade entre planos pagos (C10).
5. Bucket `imoveis-fotos` privado + URLs assinadas (C8).

**P1 — esta semana (funcionamento do billing):**
6. Middleware: liberar webhooks e APIs públicas da loja; APIs respondem 401, não redirect (C6).
7. Webhooks com client `service_role` + checagem de `error` em toda escrita (C7).
8. Corrigir fallback de `resolvePlanSlug` (A7); mensagens de erro genéricas ao cliente (A3); whitelist de extensão nos 2 uploads restantes (A6).
9. Zerar os 67 erros de lint (inclui o bug real de `stripe/products/page.tsx:46`) e adicionar CI: `tsc && eslint && vitest && npm audit` + gitleaks.

**P2 — próximo ciclo (arquitetura/manutenibilidade):**
10. Extrair domínio: recomendações/score/favorabilidade, status financeiro e limites de plano para `src/lib` (ou `src/domain/`), eliminando a duplicata de `SETOR_DICAS`/`CRITERIO_DICAS`.
11. Hook único `useProfile`/`useAuthGuard` consumindo o `AppProvider` existente; helper central de formatação.
12. Quebrar `bagua-planta/page.tsx` (2.097 linhas) e os demais >500; extrair o `switch` de `admin/subscriptions`.
13. Rate limit com store compartilhado (Upstash/Redis) (A4/A5).
14. Higiene do repo: `.env.example`, `SECURITY.md`, `CLAUDE.md`, `.nvmrc`, README real, remover binários e `layout.tsx_ols`, unificar alias `@/` , consolidar testes duplicados, `db pull` do schema base para o repo + adotar timestamps de migration (A8/A9).
15. ADRs retroativos (R16): Stripe Connect direct charges, modelo de chaves de ativação, PWA/service worker, decisão do CSP com `unsafe-inline` (commit `dcabc7b` reintroduziu por hotfix — documentar plano de saída com nonces).

---

## 7. Anexo — inventário de acesso direto ao Supabase pelo cliente

31 arquivos fazem CRUD direto do browser (segurança dependente exclusivamente de RLS): `dashboard`, `bagua-planta`, `pagamentos`, `perfil`, `roda-da-vida`, `planos`, `consultas` (lista, `[id]`, `nova`, `relatorio`), `curas`, `clientes` (lista e `[id]`), `calendario`, `parceiros`, `produtos`, `consultores`, `loja/[slug]`, `stripe/onboard`, `stripe/products`, e os componentes `AppProvider`, `AppShell`, `FlowLayout`, `NotificationBell` (`payment_notifications` SELECT/UPDATE), `PaymentBanner` (`invoices`). Tabelas alcançadas: `profiles`, `clientes`, `consultas`, `setores_bagua`, `diagnostico_criterios`, `pagamentos`, `rituais`, `subscriptions`, `invoices`, `payment_notifications`, `store_orders`, `consultor_curas_custom`, `produtos_afiliados`.

Inventário completo de RLS por tabela (17 tabelas + storage) está em §2/§3; a única tabela sem RLS é `plans`.
