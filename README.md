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

Prefira uma **chave restrita** (`rk_...`) com leitura de produtos e preços: ela
serve para esta conferência e não cobra nem reembolsa se vazar. A secret key de
produção também não é revelável depois de criada — o Stripe a mostra uma vez só.

## Contestação de cobrança

`charge.dispute.created`, `.updated` e `.closed` são gravados em
`disputas_stripe`, com o prazo do Stripe para responder. É por isso que é
tabela e não log: a pergunta operacional é «quais disputas estão abertas agora
e até quando posso responder?».

**Nenhuma ação automática sobre o plano**, e é decisão. Disputa aberta não é
venda perdida — pode ser ganha, e tirar o acesso de quem contestou por engano
seria punir antes do veredito. Disputa perdida é dinheiro que foi embora e
rebaixar seria defensável, mas isso é política comercial, não código: o log sai
em nível de erro para que a decisão seja de gente. Quando a política estiver
escrita, o gancho é `registrarDisputa`.

## Reconciliação com o Stripe

Webhook é entrega best-effort: endpoint mal configurado, fora do ar ou segredo
trocado deixam o banco para trás **em silêncio**. Já aconteceu — uma compra real
foi paga e o app não soube.

`/api/admin/reconciliacao` compara a conta Stripe com a tabela `subscriptions`:

- `GET` relata as divergências e não toca em nada;
- `POST` relata e corrige o que é cópia de valor (status, valor pago, ciclo,
  cancelamento agendado).

Um cron diário às 6h UTC chama o `GET` — ver `vercel.json`. Ele **detecta e
alarma**; a correção é um `POST` deliberadamente manual, porque as primeiras
execuções merecem ser vistas antes de virarem automáticas. Divergência sai no
log em nível de erro.

Para o cron autenticar, defina `CRON_SECRET` na Vercel; a rota também aceita
sessão de admin.

Assinatura que existe no Stripe e não aqui é **recriada** pelo mesmo caminho do
webhook (`src/lib/sincronizar-assinatura.ts`), que é onde vive a resposta para
«como nasce uma assinatura».

Um caso fica fora da correção e sai em `exigem_analise`: assinatura que existe
aqui e não no Stripe. Não é dado velho, é dado inventado — apagar em silêncio
esconderia a pergunta de onde a linha veio.

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
