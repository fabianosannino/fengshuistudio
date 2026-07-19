# Visão Geral da Arquitetura — FengShui Studio

> Documento vivo. Para o histórico de achados e débitos, ver
> `docs/auditoria/`. Para decisões pontuais, ver `docs/architecture/adr/`.

## O que é

Plataforma SaaS para consultores de Feng Shui gerenciarem clientes, consultas,
diagnósticos (Ba Guá, Roda da Vida, Fluxo do Chi), relatórios em PDF, agenda,
pagamentos e uma loja virtual. Aplicação **Next.js 16 (App Router)** standalone
(não é monorepo).

## Componentes

```
Navegador (React 19, 'use client')
   │
   ├── Supabase JS (anon key)  ──►  Supabase Postgres
   │       CRUD de negócio direto do cliente,                (RLS obrigatório
   │       protegido exclusivamente por RLS                   em toda tabela)
   │
   └── fetch /api/*  ──►  Route Handlers (Next.js, servidor)
                             ├── auth via cookies (supabase-route)
                             ├── escritas privilegiadas via service_role
                             │     (supabase-admin, import 'server-only')
                             └── Stripe (assinaturas + Connect)
                                   ▲
                                   └── Webhooks Stripe ──► service_role
```

## Camadas e onde vive a lógica

| Camada | Onde | Observação |
|---|---|---|
| UI | `app/**/*.tsx` | Quase tudo `'use client'`. Débito: regra de negócio ainda dentro de componentes. |
| I/O HTTP | `app/api/**/route.ts` | Auth, Stripe, uploads, admin. |
| Domínio / regras | `src/lib/*` | `constants.ts`, `plano-utils.ts`, `roda-da-vida-constants.ts`, `validation.ts`. Fonte canônica — o objetivo é migrar a lógica que ainda está em componentes para cá. |
| Persistência | Supabase (`supabase/migrations/`) | RLS por `consultor_id`/`user_id`. |

## Modelo de segurança (resumo — ver ADR 0003)

- **Autenticação:** Supabase Auth (cookies). `middleware.ts` protege rotas e
  o grupo `/admin`.
- **Autorização em profundidade:** middleware + re-verificação de `role` no
  servidor nas rotas `/api/admin/*` + RLS no banco.
- **Colunas privilegiadas** de `profiles` (`role`, `plano`, `stripe_*`) são
  protegidas por trigger — só mudam via `service_role`.
- **Webhooks e escritas de billing** usam `service_role`; nunca a anon key.
- **Preço nunca vem do cliente** (ver ADR 0002).

## Fluxos principais

1. **Consulta / diagnóstico Ba Guá:** consultor faz upload de planta, marca
   setores no canvas (`app/bagua-planta`), pontua critérios; o app gera
   recomendações e um relatório em PDF client-side (`html2canvas` + `jspdf`).
2. **Assinatura da plataforma:** Stripe Checkout em modo `subscription`;
   webhooks sincronizam `subscriptions`/`invoices`/`profiles.plano`.
3. **Loja do consultor (Stripe Connect):** vitrine pública `/loja/[slug]`;
   compras via Direct Charges na conta conectada, com application fee da
   plataforma.

## Débitos conhecidos

Rastreados em `docs/auditoria/2026-07-18-auditoria-arquitetura-seguranca.md`
(plano P2): buckets de fotos privados + URLs assinadas (LGPD), extração da
lógica de domínio dos componentes, rate limit distribuído, CSP sem
`unsafe-inline`, reconciliação do motor de recomendações do `bagua-planta`,
schema base versionado.
