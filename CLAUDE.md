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

Antes de commitar mudança não-trivial: `npx tsc --noEmit && npm test`.

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
- Toda escrita no Supabase deve checar `error` (não engula falha).

## Onde vive a lógica

- **Domínio Feng Shui / regras de plano**: idealmente em `src/lib` (débito:
  parte ainda está dentro de componentes — ver auditoria).
- **I/O (Supabase/Stripe)**: rotas `/api` e `src/lib`.
- **UI**: `app/**` — evite regra de negócio nova dentro de componente.

## Documentação de arquitetura

- `docs/architecture/overview.md` — visão geral e camadas.
- `docs/architecture/adr/` — decisões (ADR): pagamentos (0002), autorização/RLS
  (0003), CSP (0004), storage/LGPD (0005). Toda decisão arquitetural nova vira
  um ADR.
- `docs/security/threat-model.md` — ativos, fronteiras e ameaças.
- `docs/domain/glossary.md` — linguagem ubíqua (Ba Guá, setores, planos).

## Débitos e histórico

`docs/auditoria/2026-07-18-auditoria-arquitetura-seguranca.md` lista os achados
e o plano P0/P1/P2. Consulte antes de decisões arquiteturais.
