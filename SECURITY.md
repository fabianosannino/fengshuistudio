# Política de Segurança — FengShui Studio

## Reportar uma vulnerabilidade

Se você encontrou uma vulnerabilidade, **não abra uma issue pública**. Envie
um e-mail para **suporte@fengshuistudio.com.br** com:

- descrição do problema e do impacto;
- passos para reproduzir (PoC, se possível);
- versão/commit afetado.

Retornamos um aviso de recebimento em até 72 horas úteis e trabalhamos numa
correção coordenada antes de qualquer divulgação.

## Escopo

Aplicação Next.js (App Router) com Supabase (Postgres + Auth + Storage) e
Stripe Connect. Interessam especialmente:

- burlas de autenticação/autorização (RLS, roles, ownership entre consultores);
- manipulação de valores em pagamentos (checkout, application fee, assinaturas);
- exposição de dados pessoais de clientes (LGPD) — fotos de imóveis, endereço,
  telefone, e-mail;
- injeção (SQL, path/extension em uploads), XSS, open redirect.

## Práticas adotadas

- **Segredos**: nunca versionados. `.env.local` (gitignored) + `.env.example`
  (sem valores). A `SUPABASE_SERVICE_ROLE_KEY` é exclusiva do servidor e nunca
  recebe prefixo `NEXT_PUBLIC_`.
- **RLS obrigatório** em todas as tabelas; isolamento por `consultor_id`/
  `user_id`. Colunas privilegiadas de `profiles` (`role`, `plano`, `stripe_*`)
  protegidas por trigger contra escrita direta do usuário.
- **Autorização em profundidade**: middleware + verificação de role no servidor
  nas rotas `/api/admin/*`, além do RLS.
- **Webhooks Stripe**: assinatura verificada (`constructEvent`) e escritas via
  `service_role` (sem sessão de usuário).
- **Preços server-side**: o checkout nunca aceita valor vindo do cliente; lê o
  `price` da conta conectada no Stripe.
- **Cabeçalhos**: HSTS, X-Frame-Options, X-Content-Type-Options, CSP,
  Permissions-Policy (ver `next.config.ts`).
- **Erros**: respostas ao cliente são genéricas; detalhes ficam no log
  estruturado (sem PII).

## Débitos conhecidos

Rastreados em `docs/auditoria/2026-07-18-auditoria-arquitetura-seguranca.md`
(planos P1/P2): migração dos buckets de fotos para privados + URLs assinadas,
rate limit distribuído e endurecimento do CSP (remoção de `unsafe-inline`).
