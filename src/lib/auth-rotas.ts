// ══════════════════════════════════════════════════════════════════════════════
// ROTAS E REGRAS DE AUTENTICAÇÃO — fonte única
// ══════════════════════════════════════════════════════════════════════════════

import { logger } from './logger'

/**
 * Rota que troca o `code` do fluxo PKCE por uma sessão.
 *
 * O Supabase Auth deste projeto opera em PKCE: os links enviados por e-mail
 * (recuperação de senha, confirmação de cadastro) não entregam uma sessão
 * pronta — entregam um código de autorização na query string, que precisa ser
 * trocado por sessão no servidor. Sem essa troca, nenhum link de e-mail
 * autentica ninguém.
 */
export const ROTA_CALLBACK_AUTH = '/auth/callback'

export const ROTA_LOGIN = '/login'
export const ROTA_REDEFINIR_SENHA = '/redefinir-senha'
export const ROTA_ESQUECI_SENHA = '/esqueci-senha'
export const DESTINO_PADRAO_POS_LOGIN = '/dashboard'

/** Mínimo de caracteres para qualquer senha definida pelo usuário. */
export const SENHA_MIN_CARACTERES = 8

/**
 * Um destino de redirect só é aceito se for um caminho relativo à própria
 * aplicação. Bloqueia open redirect: `//evil.com` e `https://evil.com` são
 * recusados.
 */
export function ehCaminhoRelativoSeguro(caminho: string): boolean {
  try {
    const path = decodeURIComponent(caminho.split(/[?#]/, 1)[0])
    if (!path.startsWith('/') || path.startsWith('//') || /[\\\u0000-\u0020\u007f]/.test(path)) return false
    const base = 'https://redirect.invalid'
    return new URL(caminho, base).origin === base
  } catch {
    return false
  }
}

/**
 * Normaliza o destino pós-callback, caindo no padrão quando o valor recebido
 * é ausente ou inseguro.
 */
export function destinoSeguro(
  valor: string | null | undefined,
  padrao: string = DESTINO_PADRAO_POS_LOGIN,
): string {
  if (!valor) return padrao
  return ehCaminhoRelativoSeguro(valor) ? valor : padrao
}

/**
 * Monta a URL de callback usada como `redirectTo`/`emailRedirectTo` nas
 * chamadas do Supabase Auth que disparam e-mail.
 */
export function urlCallbackAuth(origin: string, destino: string): string {
  const url = new URL(ROTA_CALLBACK_AUTH, origin)
  url.searchParams.set('next', destino)
  return url.toString()
}

/**
 * Manda o visitante não autenticado para o login.
 *
 * Existia em 23 telas, escrito de duas formas que **não são equivalentes**:
 * 21 usavam `window.location.href` e 2 usavam `router.push`. A diferença
 * importa: `router.push` navega dentro da SPA e **preserva a árvore React em
 * memória** — inclusive componentes que já buscaram dados com a sessão que
 * acabou de ser recusada. `window.location.href` recarrega a página e descarta
 * tudo.
 *
 * Para um guard de autenticação, descartar é o comportamento correto: se a
 * sessão não vale, nada que foi carregado sob ela deveria continuar na tela.
 * Por isso a forma unificada é a recarga, que também era a maioria.
 */
export function redirecionarParaLogin(): void {
  if (typeof window === 'undefined') return
  window.location.href = ROTA_LOGIN
}

// ── O que um visitante alcança sem sessão ────────────────────────────────────

/**
 * As páginas de marketing — o site que existe para quem ainda não é usuário.
 *
 * ## O defeito que isto corrige
 *
 * Todas estavam **atrás do login**. A Navbar e o rodapé da home pública
 * linkavam para `/precos`, `/recursos`, `/sobre`, `/para-consultores` e
 * `/rede-de-parceiros`, e cada um desses cliques levava o visitante a
 * `/login?redirect=…`. Ou seja: para saber quanto custa, era preciso ter conta;
 * para decidir criar conta, era preciso saber quanto custa.
 *
 * O `sitemap.xml` reforçava o engano ao anunciar `/planos` — que é tela de app
 * autenticada — enquanto omitia `/precos`, a página que o Google deveria
 * indexar.
 *
 * ## Por que uma constante e não uma lista no middleware
 *
 * O middleware decide o acesso e o sitemap decide o que o buscador indexa. As
 * duas listas discordavam, e a discordância era invisível: uma página podia
 * estar no sitemap e fechada, como estava. Uma fonte só torna isso impossível.
 *
 * Só entra aqui página que não lê dado de usuário. `/demonstracao` continua
 * fechada porque monta o `AppShell` incondicionalmente.
 *
 * ## Por que `/produtos` entrou depois
 *
 * Ela estava nesta mesma nota como exemplo do que **fica de fora**, e a razão
 * dada era correta na época: montava o `AppShell`. Deixou de ser quando a
 * página ganhou dois ramos — com menu para quem tem conta, sem menu para quem
 * chegou de fora — e o ramo do visitante nunca chegou a rodar, porque o
 * middleware o interceptava antes.
 *
 * Ou seja: a loja tinha código escrito para o comprador sem conta, tela
 * desenhada para ele, e um redirecionamento que garantia que ele nunca a
 * visse. A regra continua a mesma; o que mudou foi a página.
 *
 * Para uma loja isso é o defeito inteiro, não um detalhe de acesso: exigir
 * cadastro para ver o que está à venda é pedir a decisão antes de mostrar o
 * motivo dela.
 */
export const ROTAS_MARKETING = [
  '/precos',
  '/recursos',
  '/sobre',
  '/para-consultores',
  '/rede-de-parceiros',
  '/minha-casa',
  '/produtos',
] as const

/** Subpáginas de recurso — `/recursos/bagua`, `/recursos/calendario`, … */
export const PREFIXO_RECURSOS = '/recursos/'

/**
 * O domínio que o buscador deve indexar.
 *
 * Era `fengshuistudio.vercel.app` — o endereço de infraestrutura. Ele responde
 * 200, então nada quebrava; o que acontecia era pior e mais lento: o Google
 * indexava o app pelo host da Vercel, e o domínio da marca —
 * `www.fengshuistudio.com.br`, que é o que está nos cartões, nos e-mails e no
 * `success_url` do Stripe — competia com ele pelo mesmo conteúdo.
 *
 * É `www` e não o apex porque o apex responde **307 para o www**. Anunciar o
 * apex mandaria o buscador a um redirecionamento em toda página do sitemap.
 *
 * ## Não confundir com `origemDaAplicacao`
 *
 * Aquela responde «onde esta instância está rodando», e a resposta muda: numa
 * preview da Vercel é o host da preview; em desenvolvimento é `localhost`.
 * Esta é fixa e responde outra pergunta — «qual endereço o mundo deve conhecer».
 * Usar `origemDaAplicacao` aqui faria cada preview publicar um sitemap
 * anunciando a si mesma, que é a forma mais rápida de espalhar o conteúdo por
 * hosts que ninguém quer indexados.
 *
 * ## Por que mora aqui
 *
 * Porque `sitemap.ts` e `robots.ts` precisam da **mesma** resposta, e por um
 * tempo não tiveram: o sitemap foi corrigido para o domínio da marca e o robots
 * ficou apontando para o da Vercel. O buscador então pedia `robots.txt` no
 * domínio certo e recebia o endereço de um sitemap no domínio errado — a
 * correção do sitemap desfeita pelo arquivo que aponta para ele.
 */
export const URL_CANONICA = 'https://www.fengshuistudio.com.br'

/** `true` quando a rota é do site público e dispensa sessão. */
export function ehRotaDeMarketing(pathname: string): boolean {
  return (ROTAS_MARKETING as readonly string[]).includes(pathname)
    || pathname.startsWith(PREFIXO_RECURSOS)
}

/** Accept only a configured origin, without credentials, path or query. */
function origemConfigurada(valor: string): string | null {
  try {
    const url = new URL(valor)
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
    if (url.protocol !== 'https:' && !(process.env.NODE_ENV !== 'production' && local && url.protocol === 'http:')) return null
    if (url.username || url.password || url.search || url.hash || url.pathname !== '/') return null
    if (url.hostname.endsWith('.') || (!url.hostname.includes('.') && !local)) return null
    return url.origin
  } catch { return null }
}

/** Payment return URLs come from server configuration, never arbitrary headers. */
export function origemDaAplicacao(request: Request): string {
  const configuradas = [
    ...(process.env.VERCEL_ENV === 'preview' && process.env.VERCEL_URL
      ? ['https://' + process.env.VERCEL_URL] : []),
    process.env.NEXT_PUBLIC_APP_URL,
    ...(process.env.APP_ALLOWED_ORIGINS ?? '').split(','),
  ].filter((valor): valor is string => Boolean(valor?.trim()))
    .map(valor => origemConfigurada(valor.trim()))
    .filter((valor): valor is string => valor !== null)

  if (configuradas.length === 0) {
    if (process.env.NODE_ENV !== 'production') return 'http://localhost:3000'
    logger.error('Origem confiável ausente para retorno de pagamento', { route: 'auth-rotas' })
    throw new Error('Defina NEXT_PUBLIC_APP_URL ou APP_ALLOWED_ORIGINS com uma origem válida')
  }
  const pedida = request.headers.get('origin')
  return pedida && configuradas.includes(pedida) ? pedida : configuradas[0]
}
