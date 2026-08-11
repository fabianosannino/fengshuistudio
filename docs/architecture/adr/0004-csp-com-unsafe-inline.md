# ADR 0004 — Content Security Policy com `unsafe-inline`

- **Status:** Aceito — plano de saída revisto em 2026-08-11 (o original não era executável)
- **Data:** 2026-07-19
- **Revisão:** 2026-08-11

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

## Revisão de 2026-08-11 — o passo 1 não funciona neste app

O plano original abria com «migrar para nonce por requisição». Foi tentado, e
**não é aplicável enquanto o app for pré-renderizado**. A evidência é direta:

Quase toda rota sai como `○` (estática) no build — `/landing`, `/login`,
`/dashboard`, `/clientes`, `/bagua-planta`, praticamente tudo fora dos
segmentos dinâmicos. O nonce, por definição, é sorteado a cada requisição; o
HTML pré-renderizado é gravado no build. Servindo `/landing` com a CSP de nonce,
a resposta vem com `x-nextjs-prerender: 1`, **22 tags `<script>` e zero
atributos `nonce`**. O browser bloquearia todos: a página fica morta — o mesmo
sintoma do hotfix `dcabc7b` que originou este ADR, por uma causa diferente.

Fazer o nonce valer exige `dynamic = 'force-dynamic'` em todas as páginas, o
que custa o cache estático do site institucional inteiro. **Isso é uma decisão
de arquitetura de renderização, não um ajuste de cabeçalho**, e é o que este
ADR passa a registrar como pré-requisito — em vez de tratar o nonce como uma
tarefa pendente de meia hora.

### O que foi feito no lugar (2026-08-11)

Sem depender daquela decisão:

1. `'unsafe-eval'` **removido em produção** (fica só em desenvolvimento, onde o
   React Refresh precisa).
2. `base-uri 'self'` — sem ela, um `<base>` injetado reescreve o destino de
   todo caminho relativo da página, inclusive o dos scripts.
3. `form-action 'self'` — formulário injetado não posta credencial para fora.
4. `object-src 'none'` — vetor legado que o app não usa.

Verificado no build de produção com browser: `/landing`, `/login`, `/precos`,
`/termos` e `/para-consultores` carregam com zero violações de CSP no console.

O cabeçalho saiu do meio do `next.config.ts` para `src/lib/csp.ts`, com cada
liberação justificada e coberta por teste.

### O que continua em aberto

- `script-src 'unsafe-inline'`: depende da decisão de renderização acima.
- `style-src 'unsafe-inline'`: a UI é `style={{...}}` em milhares de elementos.
  Sem a diretiva, o app renderiza sem estilo nenhum. Sair disto é migrar a
  estilização (CSS Modules/Tailwind) — trabalho de porte próprio. O custo de
  manter é menor: um XSS ainda injetaria estilo (exfiltração via seletor de
  atributo, por exemplo), mas não executaria script por essa via.

## Consequências

- **Positivo (agora):** site funciona; risco documentado e priorizado.
- **Negativo:** superfície de XSS maior até o plano de saída ser executado.
- Mitigações vigentes que reduzem o impacto: escapamento padrão do React,
  ausência de `dangerouslySetInnerHTML` com dados de usuário, e headers
  complementares (`X-Content-Type-Options`, `X-Frame-Options`, HSTS).

## Alternativas consideradas

- **CSP estrita sem nonce agora:** rejeitado — foi o que derrubou o site.
- **Remover a CSP:** rejeitado — pior que uma CSP parcial.
