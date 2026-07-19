# ADR 0004 — Content Security Policy com `unsafe-inline` (temporário)

- **Status:** Aceito com plano de saída
- **Data:** 2026-07-19

## Contexto

A aplicação define uma CSP em `next.config.ts`. O histórico do repositório
mostra um hotfix (commit `dcabc7b`, "URGENTE restaurar unsafe-inline no CSP —
site estava em branco") que reintroduziu `'unsafe-inline'` e `'unsafe-eval'`
em `script-src`. A causa: o app usa estilos e scripts inline (inclusive estilos
inline em JSX espalhados por toda a UI e libs de terceiros como Stripe.js e o
tag do Google), e uma CSP estrita sem nonces quebrou a renderização.

`'unsafe-inline'` em `script-src` enfraquece a proteção contra XSS: se um
atacante injetar `<script>` numa página, a CSP não o bloqueia.

## Decisão

Manter `'unsafe-inline'`/`'unsafe-eval'` **temporariamente**, como débito
consciente, e não como estado desejado. Documentado aqui para não ser esquecido.

Demais diretrizes já estão restritas (`default-src 'self'`,
`frame-ancestors 'none'`, allowlist explícita de `connect-src`, `img-src`,
`frame-src` para Stripe/Supabase/fonts).

## Plano de saída (P2)

1. Migrar scripts inline para arquivos/estratégia com **nonce por requisição**
   (Next.js suporta nonce via middleware + `Content-Security-Policy` dinâmico).
2. Remover `'unsafe-eval'` (verificar se alguma dependência realmente exige).
3. Reduzir estilos inline onde viável ou aceitar `style-src 'unsafe-inline'`
   isoladamente (risco muito menor que em `script-src`).
4. Validar em staging que Stripe Checkout, Google Tag e a geração de PDF
   continuam funcionando antes de apertar em produção.

## Consequências

- **Positivo (agora):** site funciona; risco documentado e priorizado.
- **Negativo:** superfície de XSS maior até o plano de saída ser executado.
- Mitigações vigentes que reduzem o impacto: escapamento padrão do React,
  ausência de `dangerouslySetInnerHTML` com dados de usuário, e headers
  complementares (`X-Content-Type-Options`, `X-Frame-Options`, HSTS).

## Alternativas consideradas

- **CSP estrita sem nonce agora:** rejeitado — foi o que derrubou o site.
- **Remover a CSP:** rejeitado — pior que uma CSP parcial.
