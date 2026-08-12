# FengShui Studio

Plataforma para consultores de Feng Shui gerenciarem clientes, consultas,
diagnósticos (Ba Guá, Roda da Vida, Fluxo do Chi), relatórios em PDF, agenda,
pagamentos e uma loja virtual com Stripe Connect.

## Stack

- **Next.js 16** (App Router) + **React 19** + TypeScript
- **Supabase** — Postgres, Auth e Storage (RLS em todas as tabelas)
- **Stripe** — assinaturas da plataforma + Connect (loja dos consultores)
- **Tailwind CSS 4**, **Recharts**, **jsPDF/html2canvas**
- **Vitest** para testes

## Rodando localmente

Requer Node na versão do `.nvmrc` (20+).

```bash
nvm use            # usa a versão do .nvmrc
npm install
cp .env.example .env.local   # preencha as variáveis
npm run dev                  # http://localhost:3000
```

### Variáveis de ambiente

Veja `.env.example` para a lista completa. As essenciais:

| Variável | Uso |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Cliente Supabase (browser) |
| `SUPABASE_SERVICE_ROLE_KEY` | **Só no servidor.** Webhooks e escritas privilegiadas. Nunca com `NEXT_PUBLIC_`. |
| `STRIPE_SECRET_KEY` | API do Stripe |
| `STRIPE_WEBHOOK_SECRET` / `STRIPE_SUBSCRIPTION_WEBHOOK_SECRET` | Verificação de assinatura dos webhooks |
| `STRIPE_PRICE_*` | Prices dos planos da plataforma |

Os `STRIPE_PRICE_*` são a fonte mais comum de checkout quebrado: o ID não diz a
que modo pertence, e um preço de teste com chave de produção só falha quando um
cliente real tenta assinar. Confira antes de publicar:

```bash
STRIPE_SECRET_KEY=sk_... npx vite-node scripts/stripe/conferir-precos.mts
```

Ele pergunta ao Stripe, com a mesma chave que o app usa, se cada preço existe
naquele modo, se está ativo e se o intervalo bate com o nome da variável. Só lê.

## Scripts

```bash
npm run dev     # servidor de desenvolvimento
npm run build   # build de produção
npm run start   # servir o build
npm run lint    # ESLint
npm test        # Vitest
```

## Banco de dados

Migrations em `supabase/migrations/` (aplicar via `supabase db push` ou pelo
SQL Editor, em ordem cronológica). Toda tabela tem RLS habilitado.

## Estrutura

```
app/            # rotas Next.js (App Router), componentes e páginas
  api/          # route handlers (auth, Stripe, uploads, admin)
src/lib/        # clients Supabase, Stripe, validação, logger, constantes
src/middleware.ts     # auth de rotas + guarda de /admin
supabase/migrations/  # schema e RLS
docs/           # documentação e relatórios de auditoria
tests/          # testes Vitest
```

## Segurança

Ver [SECURITY.md](./SECURITY.md) para política de reporte e práticas adotadas,
e `docs/auditoria/` para o histórico de auditorias.
