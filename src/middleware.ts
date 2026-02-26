import { NextResponse, type NextRequest } from 'next/server'

// Middleware desabilitado - @supabase/ssr nao esta instalado
// Reabilitar quando Supabase estiver configurado no projeto
export async function middleware(request: NextRequest) {
  return NextResponse.next()
}

export const config = {
  matcher: [],
}
