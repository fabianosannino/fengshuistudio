/**
 * Content-Security-Policy da aplicação.
 *
 * ## Por que `script-src 'unsafe-inline'` continua aqui
 *
 * A saída natural seria nonce por requisição: o Next carimba os scripts que
 * emite e o que não tiver o nonce daquela requisição não roda. **Foi tentado e
 * não funciona neste app**, e a evidência é direta:
 *
 * Quase toda rota é pré-renderizada estaticamente (`○` no build — `/landing`,
 * `/login`, `/dashboard`, `/clientes`, `/bagua-planta`… praticamente tudo fora
 * dos segmentos dinâmicos). O nonce, por definição, é sorteado por requisição;
 * o HTML pré-renderizado é gravado no build. Servindo `/landing` com a CSP de
 * nonce, a resposta traz `x-nextjs-prerender: 1`, **22 tags `<script>` e zero
 * atributos `nonce`** — ou seja, o browser bloquearia todos e a página ficaria
 * morta.
 *
 * Fazer o nonce funcionar exige tornar **todas** as páginas dinâmicas. Isso é
 * uma decisão de arquitetura e de custo (perde-se o cache estático de todo o
 * site institucional), não um efeito colateral aceitável de endurecer um
 * cabeçalho. Fica registrado como tal no ADR 0004, não como pendência trivial.
 *
 * ## Por que `'unsafe-eval'` voltou para produção
 *
 * Tirá-la foi uma mudança minha, revertida no mesmo dia depois de quebrar a
 * aplicação em produção: o DevTools acusou `script-src` bloqueando `eval`, com
 * a página de relatório inutilizada.
 *
 * O que a investigação mostrou, e vale registrar para não se repetir:
 *
 * - **Não é o gerador de PDF.** `jspdf` e `html2canvas` não têm uma ocorrência
 *   de `eval(` ou `new Function` nos bundles, e um teste em Chromium sob esta
 *   CSP exata gera o PDF sem violação nenhuma.
 * - O consumidor de `eval` é uma das origens que a própria allowlist libera —
 *   Google Maps (que exige `eval` de forma documentada), GTM ou o Vercel Live.
 *   **Qual delas não foi isolado**, e a reversão não depende disso.
 *
 * E o ponto que deveria ter pesado antes: enquanto `'unsafe-inline'` continuar
 * em `script-src` — e ele continua, pelo motivo acima —, **remover
 * `'unsafe-eval'` compra quase nada**. Quem consegue injetar script inline não
 * precisa de `eval`. Era endurecimento aparente com custo real de quebra.
 *
 * Sair de `'unsafe-eval'` de verdade passa por sair de `'unsafe-inline'`
 * primeiro, e isso é a decisão de arquitetura registrada no ADR 0004.
 *
 * ## O que dá para fechar sem essa decisão — e está fechado aqui
 *
 * - `base-uri 'self'`: sem ela, um `<base>` injetado reescreve o destino de
 *   todo caminho relativo da página, inclusive o dos scripts.
 * - `form-action 'self'`: impede que um formulário injetado poste credenciais
 *   em domínio de terceiro.
 * - `object-src 'none'`: `<object>`/`<embed>` são vetor de execução legado que
 *   este app não usa em lugar nenhum.
 *
 * Nenhuma delas depende de nonce, então valem para as páginas estáticas
 * também. O que continua em aberto é o `'unsafe-inline'` de script — e com ele
 * a CSP limita, mas não impede, a execução de script injetado.
 */

/**
 * A política é a mesma em desenvolvimento e produção. Já foi parametrizada por
 * ambiente, quando `'unsafe-eval'` saía em produção; como isso quebrou o app e
 * foi revertido, um parâmetro que não muda nada só convidaria a supor que as
 * duas pontas divergem — e a CSP de produção deve ser exatamente a que se testa.
 */
export function montarCsp(): string {
  const script = [
    "'self'",
    // Ver a nota no topo: obrigatório enquanto as páginas forem pré-renderizadas.
    "'unsafe-inline'",
    // Idem: exigido por uma das origens da allowlist (Maps/GTM/Vercel Live) e
    // pelo React Refresh em desenvolvimento. Não faz sentido tirar enquanto
    // 'unsafe-inline' estiver aqui.
    "'unsafe-eval'",
    'https://vercel.live',
    'https://js.stripe.com',
    'https://www.googletagmanager.com',
    'https://maps.googleapis.com',
  ]

  return [
    "default-src 'self'",
    `script-src ${script.join(' ')}`,
    // A UI inteira é `style={{...}}`, o que vira atributo `style`. Sem esta
    // diretiva o app renderiza sem estilo nenhum. Sair disto é migrar a
    // estilização, não ajustar o cabeçalho.
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob: https:",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://vercel.live wss://ws-us3.pusher.com https://viacep.com.br https://api.stripe.com https://fonts.googleapis.com https://maps.googleapis.com https://maps.gstatic.com",
    "frame-src 'self' https://js.stripe.com https://checkout.stripe.com https://billing.stripe.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join('; ')
}
