import { NextResponse } from 'next/server'
import stripeClient from '../../../../src/lib/stripe'
import { createRouteHandlerClient } from '../../../../src/lib/supabase-route'
import { createSupabaseAdminClient } from '../../../../src/lib/supabase-admin'
import { logger } from '../../../../src/lib/logger'
import { comCorrelacao } from '../../../../src/lib/correlacao-requisicao'
import { rateLimit, ipDaRequisicao } from '../../../../src/lib/rate-limit'
import { origemDaAplicacao } from '../../../../src/lib/auth-rotas'
import { COMBINACOES_ASSINATURA, escolhaAssinatura, idDoPreco, modoStripe, problemasDoPreco } from '../../../../src/lib/catalogo-assinaturas'
import { CheckoutEmAndamento, prepararCheckoutAssinatura } from '../../../../src/lib/checkout-assinatura'

export const maxDuration = 60

const ROUTE = '/api/stripe/subscribe'
const indisponivel = () => NextResponse.json({ error: 'Não foi possível preparar a assinatura. Tente novamente mais tarde.' }, { status: 503 })

export const POST = comCorrelacao(async (request, correlationId) => {
  const { success, indisponivel: limiteIndisponivel } = await rateLimit(ipDaRequisicao(request), { limit: 10, windowMs: 60_000, escopo: 'POST:/api/stripe/subscribe', exigirCompartilhado: true })
  if (limiteIndisponivel) return Response.json({ error: 'Proteção temporariamente indisponível. Tente novamente em instantes.' }, { status: 503, headers: { 'Retry-After': '30' } })
  if (!success) return NextResponse.json({ error: 'Muitas requisições.' }, { status: 429, headers: { 'Retry-After': '60' } })
  const supabase = await createRouteHandlerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  let body: unknown
  try {
    const texto = await request.text()
    if (texto.length > 1000) throw new Error('Body excessivo')
    body = JSON.parse(texto)
  } catch { return NextResponse.json({ error: 'Plano e ciclo inválidos.' }, { status: 400 }) }
  const escolha = escolhaAssinatura(body)
  if (!escolha) return NextResponse.json({ error: 'Plano e ciclo inválidos.' }, { status: 400 })
  const priceId = idDoPreco(escolha, process.env)
  const live = modoStripe(process.env.STRIPE_SECRET_KEY)
  if (!priceId || live === null) return indisponivel()

  try {
    const preco = await stripeClient.prices.retrieve(priceId, { expand: ['product'] })
    const problemas = problemasDoPreco(preco, escolha, live)
    // IDs repetidos entre combinações nunca são um catálogo válido.
    if (COMBINACOES_ASSINATURA.filter(c => idDoPreco(c, process.env) === priceId).length !== 1) problemas.push('preco_duplicado')
    if (problemas.length) {
      logger.error('Catálogo de assinatura inconsistente', { route: ROUTE, correlationId, plano: escolha.plan_slug, ciclo: escolha.billing_cycle, problemas })
      return indisponivel()
    }
    const resultado = await prepararCheckoutAssinatura(createSupabaseAdminClient(), stripeClient, user.id, escolha, priceId, live, origemDaAplicacao(request))
    return NextResponse.json(resultado)
  } catch (erro) {
    if (erro instanceof CheckoutEmAndamento) return NextResponse.json({ error: erro.message, portal: erro.portal }, { status: 409 })
    logger.error('Falha ao preparar checkout de assinatura', { route: ROUTE, correlationId })
    return indisponivel()
  }
})
