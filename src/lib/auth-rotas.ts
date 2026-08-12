// ══════════════════════════════════════════════════════════════════════════════
// ROTAS E REGRAS DE AUTENTICAÇÃO — fonte única
// ══════════════════════════════════════════════════════════════════════════════

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
