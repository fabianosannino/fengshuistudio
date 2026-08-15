import { type NextRequest, NextResponse } from 'next/server'
import { createSupabaseMiddlewareClient } from './lib/supabase-server'
import { ehCaminhoRelativoSeguro } from './lib/auth-rotas'
import { ehPaginaPublica, ehApiPublica } from './lib/rotas-publicas'
import { PAPEL_ADMIN } from './lib/guarda-admin'
import {
  decidirAcesso, mfaExigido, isentaDeMfa,
  ROTA_DE_VERIFICACAO, VARIAVEL_DO_INTERRUPTOR,
  type NiveisDaSessao,
} from './lib/mfa-admin'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // As listas moram em `rotas-publicas.ts` — aqui elas não tinham teste, e o
  // que faltava nelas era a loja inteira. Ver a nota naquele arquivo.
  if (ehPaginaPublica(pathname) || ehApiPublica(pathname)) {
    return NextResponse.next()
  }

  const { supabase, response } = createSupabaseMiddlewareClient(request)

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    if (pathname.startsWith('/api')) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }
    const loginUrl = new URL('/login', request.url)
    // Validate redirect param to prevent open redirect attacks
    if (ehCaminhoRelativoSeguro(pathname)) {
      loginUrl.searchParams.set('redirect', pathname)
    }
    return NextResponse.redirect(loginUrl)
  }

  // Protect /admin routes — require role = 'admin'
  if (pathname.startsWith('/admin')) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role !== PAPEL_ADMIN) {
      const dashUrl = new URL('/dashboard', request.url)
      dashUrl.searchParams.set('msg', 'Acesso restrito.')
      return NextResponse.redirect(dashUrl)
    }

    /**
     * O segundo fator, para as páginas.
     *
     * As rotas de API conferem por conta própria em `exigirAdmin` — o
     * middleware não substitui aquilo, porque um matcher é uma lista e listas
     * esquecem rotas. Aqui a checagem existe para que o admin **veja** a tela
     * de verificação em vez de um painel que carrega e depois falha em cada
     * chamada.
     *
     * A tela de verificação fica de fora, senão a exigência bloquearia
     * justamente a página que existe para satisfazê-la.
     */
    if (!isentaDeMfa(pathname)) {
      const acesso = decidirAcesso(
        await niveisDaSessao(supabase),
        mfaExigido(process.env[VARIAVEL_DO_INTERRUPTOR])
      )
      if (acesso !== 'liberado') {
        const verificacao = new URL(ROTA_DE_VERIFICACAO, request.url)
        if (acesso === 'indeterminado') verificacao.searchParams.set('estado', 'indisponivel')
        return NextResponse.redirect(verificacao)
      }
    }
  }

  return response
}

/**
 * Os níveis de garantia da sessão, com falha fechada.
 *
 * Duplica a leitura de `guarda-admin.ts` de propósito: aquele módulo importa
 * `next/server` e o `logger`, e o middleware roda no Edge, onde a superfície de
 * importação precisa ficar mínima. O que **não** está duplicado é a decisão —
 * `decidirAcesso` é a mesma função nos dois caminhos, e é ela que define o que
 * cada combinação significa.
 */
async function niveisDaSessao(
  supabase: ReturnType<typeof createSupabaseMiddlewareClient>['supabase']
): Promise<NiveisDaSessao> {
  try {
    const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
    if (error || !data) return { currentLevel: null, nextLevel: null }
    return {
      currentLevel: data.currentLevel as NiveisDaSessao['currentLevel'],
      nextLevel: data.nextLevel as NiveisDaSessao['nextLevel'],
    }
  } catch {
    return { currentLevel: null, nextLevel: null }
  }
}

/**
 * O middleware não roda em arquivo estático.
 *
 * `robots.txt` e `sitemap.xml` estavam de fora das exceções — a lista cobria
 * imagens, `.js` e `.json`, mas não `.txt` nem `.xml`. Os dois passavam pela
 * checagem de sessão e respondiam com redirect para o login.
 *
 * O efeito é silencioso e inteiro: o buscador pede `robots.txt`, recebe uma
 * página de login, e não indexa nada. O `sitemap.xml` que lista as páginas de
 * marketing ficava inalcançável justamente por quem ele existe para informar.
 *
 * São nomeados um a um em vez de `.txt|.xml` genérico: uma exceção por extensão
 * abriria qualquer rota futura que terminasse assim, sem ninguém reparar.
 */
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|manifest\\.json|sw\\.js|robots\\.txt|sitemap\\.xml|icons/.*|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|json|js)$).*)',
  ],
}
