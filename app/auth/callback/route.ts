import { type NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '../../../src/lib/supabase-route'
import { logger } from '../../../src/lib/logger'
import {
  ROTA_LOGIN,
  ROTA_CALLBACK_AUTH,
  destinoSeguro,
} from '../../../src/lib/auth-rotas'

/**
 * Troca o código de autorização do fluxo PKCE por uma sessão e encaminha o
 * usuário ao destino pedido em `next`.
 *
 * É por aqui que passam os links de e-mail do Supabase Auth (recuperação de
 * senha e confirmação de cadastro). O `/verify` do Supabase consome o token de
 * uso único e redireciona para cá com `?code=`; sem a troca feita abaixo o
 * cookie de sessão nunca é gravado e a página de destino não tem como
 * autenticar o usuário.
 *
 * Falhas levam ao destino sem sessão — a página de destino é quem informa que
 * o link é inválido ou expirou. Nunca detalhamos o erro na URL.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const code = searchParams.get('code')
  const next = destinoSeguro(searchParams.get('next'), ROTA_LOGIN)

  if (!code) {
    logger.warn('Callback de auth sem código de autorização', {
      route: ROTA_CALLBACK_AUTH,
      erro: searchParams.get('error'),
    })
    return NextResponse.redirect(new URL(next, request.url))
  }

  const supabase = await createRouteHandlerClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    logger.error('Falha ao trocar código por sessão', {
      route: ROTA_CALLBACK_AUTH,
      action: 'exchangeCodeForSession',
      erro: error.message,
    })
    return NextResponse.redirect(new URL(next, request.url))
  }

  return NextResponse.redirect(new URL(next, request.url))
}
