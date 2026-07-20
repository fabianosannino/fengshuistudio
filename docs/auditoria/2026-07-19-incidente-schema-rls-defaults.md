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

## Pendências (PR próprio — precisam de decisão de produto)

1. ~~**Leitura pública de `profiles`**~~ — **RESOLVIDO** em
   `20260720_perfis_publicos_view.sql` (ADR 0006): view `perfis_publicos` com
   colunas não-PII, e as telas públicas (`/parceiros`, `/consultores`,
   `/loja/[slug]`) repontadas para ela. `profiles` segue deny-all para anon.
2. **Tabelas de admin/sistema** ainda em deny-all: `activation_keys`,
   `admin_audit_log`, `audit_log`, `conteudo_admin`, `weekly_reports`.
   Aceitável no curto prazo (acesso via `service_role`/rotas admin), mas
   `conteudo_admin` (biblioteca de conteúdo por plano) pode precisar de
   leitura para consultores.
3. **Causa raiz do restore** — investigar o que resetou o schema (para não
   repetir) e avaliar se um **PITR** para antes da regressão recupera algo
   que ficou pelo caminho. As correções acima são aditivas e não dependem do
   PITR.
4. **Advisor**: `SECURITY DEFINER` views e funções (`is_admin`,
   `protect_profile_privileged_columns`) executáveis por anon/authenticated —
   revisar em item separado.
