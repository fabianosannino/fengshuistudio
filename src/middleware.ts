import { type NextRequest, NextResponse } from 'next/server'
import { createSupabaseMiddlewareClient } from './lib/supabase-server'

const PUBLIC_ROUTES = ['/', '/login', '/esqueci-senha', '/redefinir-senha', '/landing', '/termos', '/privacidade']

// APIs públicas: webhooks do Stripe (chegam sem cookie de sessão e validam
// assinatura na própria rota) e as APIs da loja pública (compradores
// anônimos). As demais rotas /api exigem sessão e respondem 401 — nunca
// redirect, que quebraria fetch() e integrações externas.
const PUBLIC_API_PREFIXES = ['/api/stripe/webhooks', '/api/stripe/checkout', '/api/stripe/products']

function isSafeRedirect(path: string): boolean {
  // Only allow relative paths starting with / and no protocol://
  return path.startsWith('/') && !path.startsWith('//') && !path.includes('://')
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Allow public routes
  if (PUBLIC_ROUTES.includes(pathname) || pathname.startsWith('/loja') || pathname === '/consultores') {
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
    if (isSafeRedirect(pathname)) {
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

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|manifest\\.json|sw\\.js|icons/.*|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|json|js)$).*)',
  ],
}
