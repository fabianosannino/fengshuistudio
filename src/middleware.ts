import { type NextRequest, NextResponse } from 'next/server'
import { createSupabaseMiddlewareClient } from './lib/supabase-server'
import { ROTA_CALLBACK_AUTH, ehCaminhoRelativoSeguro, ehRotaDeMarketing } from './lib/auth-rotas'

// `/auth/callback` é público por necessidade: é ele quem cria a sessão a
// partir do link de e-mail. Exigir sessão ali tornaria o fluxo impossível.
const PUBLIC_ROUTES = ['/', '/login', '/esqueci-senha', '/redefinir-senha', '/landing', '/termos', '/privacidade', ROTA_CALLBACK_AUTH]

// APIs públicas: webhooks do Stripe (chegam sem cookie de sessão e validam
// assinatura na própria rota) e as APIs da loja pública (compradores
// anônimos). As demais rotas /api exigem sessão e respondem 401 — nunca
// redirect, que quebraria fetch() e integrações externas.
const PUBLIC_API_PREFIXES = ['/api/stripe/webhooks', '/api/stripe/checkout', '/api/stripe/products']

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Allow public routes
  if (PUBLIC_ROUTES.includes(pathname) || ehRotaDeMarketing(pathname) || pathname.startsWith('/loja') || pathname === '/consultores') {
    return NextResponse.next()
  }

  if (PUBLIC_API_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
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
