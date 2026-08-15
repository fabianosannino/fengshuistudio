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
  return caminho.startsWith('/') && !caminho.startsWith('//') && !caminho.includes('://')
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
 * Só entra aqui página que não lê dado de usuário. `/produtos` e
 * `/demonstracao` continuam fechadas porque montam o `AppShell`.
 */
export const ROTAS_MARKETING = [
  '/precos',
  '/recursos',
  '/sobre',
  '/para-consultores',
  '/rede-de-parceiros',
  '/minha-casa',
] as const

/** Subpáginas de recurso — `/recursos/bagua`, `/recursos/calendario`, … */
export const PREFIXO_RECURSOS = '/recursos/'

/** `true` quando a rota é do site público e dispensa sessão. */
export function ehRotaDeMarketing(pathname: string): boolean {
  return (ROTAS_MARKETING as readonly string[]).includes(pathname)
    || pathname.startsWith(PREFIXO_RECURSOS)
}

/**
 * A origem configurada dá para usar como base de link?
 *
 * Não valida se o domínio existe — isso é resolução de DNS, e não cabe numa
 * função síncrona. Valida a forma, que é onde o engano de digitação aparece:
 *
 * - precisa parsear como URL absoluta `http`/`https`;
 * - o host precisa ter ponto (`localhost` só passa fora de produção, e ali a
 *   função nem chega aqui);
 * - o host **não** pode terminar em ponto. `fengshuistudio.vercel.` parseia,
 *   porque ponto final é raiz de DNS válida na especificação — e é exatamente
 *   a forma que um `app` faltando produz.
 */
function ehOrigemUsavel(valor: string): boolean {
  let url: URL
  try { url = new URL(valor) } catch { return false }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') return false
  if (url.hostname.endsWith('.')) return false
  return url.hostname.includes('.') || url.hostname === 'localhost'
}

/**
 * A URL pública desta instalação, para montar links de volta do Stripe.
 *
 * ## O defeito
 *
 * As rotas faziam `process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'`.
 * A variável não está definida em produção, então o `success_url` de uma compra
 * real apontou para `localhost:3000` — o cliente pagou com cartão e caiu em
 * «ERR_CONNECTION_REFUSED». O pagamento acontece do lado do Stripe, então o
 * dinheiro entra e só a volta quebra: o pior formato possível, porque parece
 * falha de compra e convida a tentar de novo.
 *
 * Um fallback certo em desenvolvimento e catastrófico em produção, escolhido em
 * silêncio pela ausência de uma variável.
 *
 * ## A ordem
 *
 * O cabeçalho `origin` da própria requisição vem primeiro: ele é o endereço em
 * que o usuário realmente está, e não depende de configuração. A variável fica
 * como segunda opção, para o caso de a chamada não trazer `origin`.
 * `localhost` só entra em desenvolvimento — em produção, sem nenhum dos dois, é
 * melhor falhar do que mandar um cliente pagante para lugar nenhum.
 */
export function origemDaAplicacao(request: Request): string {
  const doPedido = request.headers.get('origin')
  if (doPedido && /^https?:\/\//.test(doPedido)) return doPedido

  const daConfiguracao = process.env.NEXT_PUBLIC_APP_URL
  if (daConfiguracao) {
    const limpa = daConfiguracao.replace(/\/+$/, '')
    if (ehOrigemUsavel(limpa)) return limpa

    /*
     * Variável mal digitada não vira link quebrado em silêncio.
     *
     * Aconteceu: `NEXT_PUBLIC_APP_URL` estava como
     * `https://fengshuistudio.vercel.` — faltando o `app`. O checkout não
     * sofreu, porque ali a requisição vem do browser e traz `origin`; o
     * webhook, que não traz, caiu nesta variável e mandou ao comprador um
     * e-mail de confirmação cujo **único** link não abria.
     *
     * O pior formato de erro: nada quebra, o e-mail é entregue, e só o
     * destinatário descobre — se reclamar.
     */
    logger.error('NEXT_PUBLIC_APP_URL não parece uma origem válida — ignorada', {
      route: 'auth-rotas', valor: limpa,
    })
  }

  if (process.env.NODE_ENV !== 'production') return 'http://localhost:3000'

  throw new Error('Sem origem: defina NEXT_PUBLIC_APP_URL ou envie o cabeçalho origin')
}
