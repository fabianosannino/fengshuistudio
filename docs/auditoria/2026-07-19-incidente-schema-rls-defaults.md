# Incidente — perda de RLS policies e DEFAULTs de coluna (produção)

**Data:** 2026-07-19
**Severidade:** Alta (camada de dados quebrada para usuários logados)
**Origem:** descoberto ao investigar a recomendação nº 6 da avaliação de
experiência do cliente (tabela `diagnostico_criterios` vazia).

## Resumo

A investigação do "diagnóstico só vive no JSONB" revelou que o problema não
era de modelagem, mas **duas regressões de schema em produção**, coerentes com
um restore/rebuild do banco que não reaplicou o schema por completo:

1. **RLS ligado sem nenhuma policy** em 18 tabelas centrais (`profiles`,
   `consultas`, `clientes`, `setores_bagua`, `diagnostico_criterios`,
   `pagamentos`, `rituais`, `fotos_consulta`, `prescricoes`, `notificacoes`,
   `assinaturas`, `cronograma_lunar`, `consultor_curas_custom`, …). RLS
   ligado + zero policies = **deny-all**: o papel `authenticated` (o cliente
   do navegador após login) não conseguia ler nem escrever as próprias linhas.

2. **DEFAULTs de coluna ausentes** em todas as tabelas: `id uuid NOT NULL`
   sem `gen_random_uuid()` e colunas de auditoria (`criado_em`,
   `atualizado_em`, …) `timestamptz NOT NULL` sem `now()`. Como o app não
   envia essas colunas, **todo INSERT novo falhava** com violação de NOT NULL.

### Por que passou despercebido

- As telas de leitura que ainda "funcionavam" liam por **views
  `SECURITY DEFINER`** (`vw_dashboard_consultor`, `vw_rituais_pendentes`), que
  rodam com privilégio do criador e furam o RLS.
- Os writes de `diagnostico_criterios` (e outros) **não checavam o `error`**
  retornado pelo Supabase — violação direta do CLAUDE.md ("Toda escrita no
  Supabase deve checar `error`"). As falhas eram silenciosas.
- As linhas existentes (14 consultas, 101 setores) são **legado**, criadas
  quando o schema ainda estava íntegro.

## Como foi confirmado

Três fontes independentes concordaram:
- Consulta direta ao catálogo (`pg_policy`, `pg_attrdef`).
- **Advisor de segurança do Supabase** (`rls_enabled_no_policy` nas 18 tabelas).
- **Teste simulando o login de um consultor real** (`set role authenticated` +
  `request.jwt.claims`): antes das correções, o dono via **0 consultas, 0
  setores, 0 critérios**; um INSERT batia no deny-all / na coluna sem default.

## Correção aplicada (produção + migrations no repo)

Migrations idempotentes, todas aditivas e reversíveis:

| Migration | O que faz |
| --- | --- |
| `20260719_rls_restore_consultor_dados.sql` | Policies RLS owner-scoped na cadeia de dados do consultor (posse por `consultor_id = auth.uid()` ou via `consultas`). |
| `20260719_rls_profiles_own_row.sql` | `profiles`: usuário lê/edita o próprio perfil; admin gerencia todos. Colunas privilegiadas seguem protegidas pelo trigger de 20260718. |
| `20260719_restore_id_defaults.sql` | `default gen_random_uuid()` em toda coluna `id uuid` sem default (exceto `profiles.id`, que vem de `auth.users`). |
| `20260719_restore_timestamp_defaults.sql` | `default now()` em toda coluna `timestamptz NOT NULL` sem default. |

**Código:** `app/bagua-planta/page.tsx` passou a checar o `error` dos writes
de `diagnostico_criterios` (fail-loud), para que uma regressão futura não
volte a falhar em silêncio.

### Validação pós-correção

Com o login simulado do dono: **14 consultas, 101 setores, 12 clientes**
visíveis (era 0/0/0). Um **outro** usuário vê **0** em tudo (isolamento
multi-tenant confirmado). O dono conseguiu **criar setor + critério** com `id`
e `criado_em` automáticos (e limpeza do registro de teste).

## Atualização 2026-07-20 — terceira perda descoberta: constraints

Ao versionar o schema legado (item 1 do plano de melhorias), descobriu-se que
a mesma regressão também levou **todas as constraints exceto as primary
keys**: zero FKs, zero uniques, zero checks e zero índices secundários em
todo o schema `public`.

Efeitos: o `upsert(onConflict:'consulta_id,numero')` do Ba Guá falhava com
42P10 (sem unique não há ON CONFLICT) — salvar setores continuava quebrado
mesmo após RLS/defaults; sem integridade referencial, deletes deixavam
órfãos; idempotência de webhooks sem unicidade.

**Corrigido em `20260720_restore_constraints.sql`** (aplicada em produção):
3 uniques app-críticos + 3 índices únicos parciais de idempotência
(gateway_*), **35 FKs** (NOT VALID → validadas; todas validaram — zero
órfãos) com CASCADE na cadeia de posse e SET NULL nos opcionais, e 21
índices de FK. Validado como o dono autenticado: upsert onConflict funciona
sem duplicar, cascade limpa `diagnostico_criterios`, e a FK bloqueia órfãos
mesmo via `service_role` (defesa em profundidade abaixo do RLS).

## Pendências (PR próprio — precisam de decisão de produto)

1. ~~**Leitura pública de `profiles`**~~ — **RESOLVIDO** em
   `20260720_perfis_publicos_view.sql` (ADR 0006): view `perfis_publicos` com
   colunas não-PII, e as telas públicas (`/parceiros`, `/consultores`,
   `/loja/[slug]`) repontadas para ela. `profiles` segue deny-all para anon.
2. ~~**Tabelas de admin/sistema** em deny-all~~ — **RESOLVIDO** em
   `20260720_rls_admin_sistema.sql`: policies escopadas a `is_admin()` em
   `activation_keys`, `admin_audit_log`, `audit_log`, `conteudo_admin`,
   `weekly_reports`. Descoberto que o painel admin lê essas tabelas com o
   client autenticado (não service_role) — o deny-all quebrava o painel.
   **Agora nenhuma tabela do schema fica em deny-all.** (Leitura de
   `conteudo_admin` por consultor conforme plano fica para quando a
   biblioteca for ligada na UI.)
3. **Causa raiz do restore** — **INVESTIGADO.** A tabela de histórico
   `supabase_migrations.schema_migrations` contém **apenas as migrations
   recentes** (a partir de `security_hardening_20260718`) — **não há nenhuma
   migration da criação do schema original** (tabelas, defaults, policies).
   Ou seja: o schema base foi criado **fora de migrations** (provavelmente
   pelo SQL editor / dashboard ao longo do tempo), então defaults e policies
   viviam **só no banco vivo**, sem estar versionados. Qualquer
   restore/rebuild que reconstruiu a estrutura a partir de uma fonte
   incompleta **perdeu** o que não estava em migration — exatamente o que
   observamos (ids/timestamps sem default, RLS sem policy).
   - **Não há "migration ruim"** que tenha derrubado algo; o problema é
     estrutural (schema não versionado).
   - **Mitigação aplicada:** defaults e policies agora estão **capturados em
     migrations** neste repositório (fonte de verdade). Um futuro rebuild os
     reaplica.
   - **Recomendações:** (a) daqui em diante, toda mudança de schema via
     migration (não pelo dashboard); (b) confirmar **PITR** ligado no plano do
     Supabase; (c) rodar `supabase db pull` uma vez para versionar o restante
     do schema legado (constraints, índices, enums) que ainda só existe no
     banco vivo.
4. **Advisor** — **PARCIALMENTE RESOLVIDO** em `20260720_hardening_advisor.sql`:
   - Removidas as views `SECURITY DEFINER` mortas `vw_dashboard_consultor` e
     `vw_rituais_pendentes` (não usadas por nenhuma tela, com SELECT para
     anon/authenticated e **sem filtro por `auth.uid()`** → vazavam dados de
     todos os consultores via PostgREST). Eram o que mascarava este incidente.
   - `revoke execute` na função de trigger `protect_profile_privileged_columns()`
     (não deve ser chamável via RPC).
   - **Mantido:** `is_admin()` executável por anon (as policies de billing de
     `20260718` miram PUBLIC e a referenciam; revogar quebraria a leitura de
     `plans`). A view `perfis_publicos` segue `SECURITY DEFINER` de propósito
     (ADR 0006).
   - **Follow-up menor:** re-escopar as policies de billing de PUBLIC →
     `authenticated` e então revogar `is_admin()` de anon; ativar "leaked
     password protection" no Auth.
