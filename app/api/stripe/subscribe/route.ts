import { createHash, randomInt } from 'node:crypto'
import { NextResponse } from 'next/server'
import stripeClient from '../../../../src/lib/stripe'
import { createRouteHandlerClient } from '../../../../src/lib/supabase-route'
import { createSupabaseAdminClient } from '../../../../src/lib/supabase-admin'
import { logger } from '../../../../src/lib/logger'
import { rateLimit, ipDaRequisicao } from '../../../../src/lib/rate-limit'
import { origemDaAplicacao } from '../../../../src/lib/auth-rotas'
import { COMBINACOES_ASSINATURA, escolhaAssinatura, idDoPreco, modoStripe, problemasDoPreco } from '../../../../src/lib/catalogo-assinaturas'

const ROUTE = '/api/stripe/subscribe'
const indisponivel = () => NextResponse.json({ error: 'Não foi possível preparar a assinatura. Tente novamente mais tarde.' }, { status: 503 })

export async function POST(request: Request) {
  const { success } = await rateLimit(ipDaRequisicao(request), { limit: 10, windowMs: 60_000 })
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
      logger.error('Catálogo de assinatura inconsistente', { route: ROUTE, plano: escolha.plan_slug, ciclo: escolha.billing_cycle, problemas })
      return indisponivel()
    }
    const { data: profile, error: erroPerfil } = await supabase.from('profiles').select('stripe_customer_id').eq('id', user.id).single()
    if (erroPerfil || !profile) return indisponivel()
    const anterior = profile.stripe_customer_id as string | null
    let customerId = anterior
    if (customerId) {
      try {
        const existente = await stripeClient.customers.retrieve(customerId)
        if (existente.deleted) customerId = null
      } catch (erro) {
        // Timeout, rate limit, credencial inválida e indisponibilidade NÃO provam inexistência.
        const e = erro as { code?: string; statusCode?: number }
        if (e.code === 'resource_missing' && e.statusCode === 404) customerId = null
        else throw erro
      }
    }
    if (!customerId) {
      const chave = createHash('sha256').update(`${user.id}:${live}:${anterior ?? 'inicial'}`).digest('hex')
      const customer = await stripeClient.customers.create({ email: user.email, metadata: { supabase_user_id: user.id } }, { idempotencyKey: `customer-v2-${chave}` })
      customerId = customer.id
      const { data: vinculado, error } = await createSupabaseAdminClient().from('profiles').update({ stripe_customer_id: customerId }).eq('id', user.id).select('id').single()
      if (error || !vinculado) return indisponivel()
    }
    const existentes = await stripeClient.subscriptions.list({ customer: customerId, status: 'all', limit: 100 })
    if (existentes.has_more || existentes.data.some(s => !['canceled', 'incomplete_expired'].includes(s.status))) {
      return NextResponse.json({ error: 'Você já tem uma assinatura em andamento. Use o portal de cobrança para gerenciá-la.', portal: true }, { status: 409 })
    }
    const origin = origemDaAplicacao(request)
    const session = await stripeClient.checkout.sessions.create({
      integration_identifier: `fengshui-subscription-${Array.from({length:8},()=>String.fromCharCode(97+randomInt(26))).join('')}`,
      customer: customerId, mode: 'subscription', line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: { metadata: { ...escolha, supabase_user_id: user.id } },
      success_url: `${origin}/stripe/success?session_id={CHECKOUT_SESSION_ID}&type=subscription`,
      cancel_url: `${origin}/planos?plano=${escolha.plan_slug}&ciclo=${escolha.billing_cycle}`,
      allow_promotion_codes: true,
    })
    return NextResponse.json({ url: session.url, session_id: session.id })
  } catch {
    logger.error('Falha ao preparar checkout de assinatura', { route: ROUTE })
    return indisponivel()
  }
}
