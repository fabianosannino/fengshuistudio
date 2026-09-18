import { NextResponse } from 'next/server'
import { createRouteHandlerClient } from '../../../src/lib/supabase-route'
import { createSupabaseAdminClient } from '../../../src/lib/supabase-admin'
import { rateLimit, ipDaRequisicao } from '../../../src/lib/rate-limit'
import { logger } from '../../../src/lib/logger'
import { planoEfetivo } from '../../../src/lib/plano-utils'
import stripeClient from '../../../src/lib/stripe'

const ROUTE = '/api/planos'
const VALID_PLANOS = ['freemium', 'free', 'starter', 'simples', 'pro', 'profissional']
const indisponivel = () => NextResponse.json({ error: 'Não foi possível atualizar seu plano. Tente novamente.' }, { status: 503 })

export async function POST(request: Request) {
  const { success } = await rateLimit(ipDaRequisicao(request), { limit: 10, windowMs: 60_000 })
  if (!success) return NextResponse.json({ error: 'Muitas requisições.' }, { status: 429, headers: { 'Retry-After': '60' } })
  const supabase = await createRouteHandlerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  let plano: string, chave: string | undefined
  try {
    const texto = await request.text()
    if (texto.length > 1000) throw new Error('Corpo excessivo')
    const body = JSON.parse(texto)
    if (!body || typeof body !== 'object' || Array.isArray(body) || typeof body.plano !== 'string'
      || !VALID_PLANOS.includes(body.plano) || (body.chave_ativacao !== undefined && typeof body.chave_ativacao !== 'string')) throw new Error('Corpo inválido')
    plano = body.plano
    chave = body.chave_ativacao?.trim()
    if (chave && chave.length > 200) throw new Error('Chave inválida')
  } catch { return NextResponse.json({ error: 'Plano ou chave inválidos.' }, { status: 400 }) }

  const { data: profile, error } = await supabase.from('profiles').select('plano,stripe_customer_id').eq('id', user.id).single()
  if (error || !profile) return indisponivel()
  const atual = planoEfetivo(profile.plano), alvo = planoEfetivo(plano)
  const admin = createSupabaseAdminClient()

  if (alvo !== 'free') {
    if (!chave) {
      if (alvo === atual) return NextResponse.json({ plano: atual })
      return NextResponse.json({ error: 'Informe uma chave válida ou assine pelo checkout.', requiresPayment: true }, { status: 402 })
    }
    // Consumption, grant and audit either commit together or all roll back.
    const { data: efetivo, error: ativacaoError } = await admin.rpc('ativar_chave_de_plano', {
      p_usuario: user.id, p_chave: chave, p_plano: alvo,
    })
    if (ativacaoError) {
      if (ativacaoError.message === 'chave_invalida') return NextResponse.json({ error: 'Chave inválida, expirada ou incompatível com este plano.', requiresPayment: true }, { status: 403 })
      logger.error('Falha ao ativar chave', { route: ROUTE, code: ativacaoError.code })
      return indisponivel()
    }
    return NextResponse.json({ plano: efetivo })
  }

  try {
    if (profile.stripe_customer_id) {
      // Read the provider as well: a delayed webhook cannot hide an active bill.
      const pagina = await stripeClient.subscriptions.list({ customer: profile.stripe_customer_id, status: 'all', limit: 100 })
      if (pagina.has_more) return NextResponse.json({ error: 'Gerencie suas assinaturas no portal de cobrança.', portal: true }, { status: 409 })
      const ativas = pagina.data.filter(s => !['canceled', 'incomplete_expired'].includes(s.status))
      if (ativas.length) {
        for (const assinatura of ativas) {
          if (!assinatura.cancel_at_period_end) await stripeClient.subscriptions.update(assinatura.id, { cancel_at_period_end: true })
          const { error: escrita } = await admin.from('subscriptions').update({ cancel_at_period_end: true })
            .eq('user_id', user.id).eq('gateway_subscription_id', assinatura.id)
          if (escrita) return indisponivel()
        }
        return NextResponse.json({ plano: atual, cancelamento_agendado: true,
          mensagem: 'Renovação cancelada. O período pago e os benefícios de outras origens são preservados.' })
      }
    } else {
      const { data: vinculadas, error: leitura } = await admin.from('subscriptions').select('id')
        .eq('user_id', user.id).not('gateway_subscription_id', 'is', null).in('status', ['active', 'past_due', 'trial', 'paused']).limit(1)
      if (leitura || vinculadas?.length) return indisponivel()
    }
    const { data: efetivo, error: renunciaError } = await admin.rpc('renunciar_concessoes_nao_pagas', { p_usuario: user.id })
    if (renunciaError) return indisponivel()
    return NextResponse.json({ plano: efetivo, mensagem: efetivo === 'free' ? 'Benefícios gratuitos encerrados. Seu plano agora é Free.' : 'Os direitos da assinatura foram preservados. A sincronização pode levar alguns instantes.' })
  } catch {
    logger.error('Falha ao atualizar renovação da assinatura', { route: ROUTE })
    return indisponivel()
  }
}
