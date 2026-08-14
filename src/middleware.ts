import { type NextRequest, NextResponse } from 'next/server'
import { createSupabaseMiddlewareClient } from './lib/supabase-server'
import { ehCaminhoRelativoSeguro } from './lib/auth-rotas'
import { ehPaginaPublica, ehApiPublica } from './lib/rotas-publicas'

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

    if (!profile || profile.role !== 'admin') {
      const dashUrl = new URL('/dashboard', request.url)
      dashUrl.searchParams.set('msg', 'Acesso restrito.')
      return NextResponse.redirect(dashUrl)
    }
  }

  return response
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
