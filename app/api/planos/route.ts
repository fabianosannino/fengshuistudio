import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { createRouteHandlerClient } from '../../../src/lib/supabase-route'
import { createSupabaseAdminClient } from '../../../src/lib/supabase-admin'
import { rateLimit, ipDaRequisicao } from '../../../src/lib/rate-limit'
import { logger } from '../../../src/lib/logger'
import { planoEfetivo, enumDoPlano } from '../../../src/lib/plano-utils'
import stripeClient from '../../../src/lib/stripe'

const VALID_PLANOS = ['freemium', 'free', 'simples', 'pro', 'profissional'] as const

function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a.trim())
  const bufB = Buffer.from(b.trim())
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}

export async function POST(request: Request) {
  const ip = ipDaRequisicao(request)
  const { success } = await rateLimit(ip, { limit: 10, windowMs: 60_000 })
  if (!success) {
    return Response.json(
      { error: 'Muitas requisições. Tente novamente em alguns instantes.' },
      { status: 429, headers: { 'Retry-After': '60' } }
    )
  }

  const supabase = await createRouteHandlerClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  let plano: string
  let chave_ativacao: string | undefined
  try {
    const body = await request.json()
    plano = body.plano
    chave_ativacao = body.chave_ativacao
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }

  if (!plano || !(VALID_PLANOS as readonly string[]).includes(plano)) {
    return NextResponse.json({ error: 'Plano inválido' }, { status: 400 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('plano')
    .eq('id', user.id)
    .single()

  const planoAtual = planoEfetivo(profile?.plano)
  const planoAlvo = planoEfetivo(plano)

  // Escritas privilegiadas (chave, audit log, plano) usam service_role:
  // o RLS de activation_keys/admin_audit_log é admin-only e a coluna
  // profiles.plano é protegida por trigger contra escrita do usuário.
  const admin = createSupabaseAdminClient()

  // Qualquer mudança PARA plano pago diferente do atual exige chave —
  // inclusive upgrade/downgrade entre planos pagos.
  const precisaChave = planoAlvo !== 'free' && planoAlvo !== planoAtual

  if (precisaChave) {
    if (!chave_ativacao) {
      return NextResponse.json(
        { error: 'Informe uma chave de ativação válida para ativar este plano.', requiresPayment: true },
        { status: 402 }
      )
    }

    const chaveNormalizada = chave_ativacao.trim().toUpperCase()

    const { data: dbKey } = await admin
      .from('activation_keys')
      .select('id, key, status, expires_at, plan_type')
      .eq('key', chaveNormalizada)
      .eq('status', 'available')
      .single()

    if (!dbKey || !safeCompare(chaveNormalizada, dbKey.key)) {
      return NextResponse.json(
        { error: 'Chave de ativação inválida. Verifique e tente novamente.', requiresPayment: true },
        { status: 403 }
      )
    }

    if (dbKey.expires_at && new Date(dbKey.expires_at) < new Date()) {
      await admin.from('activation_keys').update({ status: 'expired' }).eq('id', dbKey.id)
      return NextResponse.json(
        { error: 'Chave de ativação expirada.', requiresPayment: true },
        { status: 403 }
      )
    }

    // A chave só ativa o plano para o qual foi emitida.
    if (planoEfetivo(dbKey.plan_type) !== planoAlvo) {
      return NextResponse.json(
        { error: 'Esta chave de ativação não é válida para o plano selecionado.', requiresPayment: true },
        { status: 403 }
      )
    }

    // Queima a chave condicionada ao status para evitar uso duplo concorrente.
    const { data: burnedKey, error: burnError } = await admin
      .from('activation_keys')
      .update({
        status: 'used',
        used_at: new Date().toISOString(),
        used_by: user.id,
      })
      .eq('id', dbKey.id)
      .eq('status', 'available')
      .select('id')
      .single()

    if (burnError || !burnedKey) {
      logger.error('Activation key burn failed', { route: '/api/planos', error: burnError?.message })
      return NextResponse.json(
        { error: 'Chave de ativação inválida. Verifique e tente novamente.', requiresPayment: true },
        { status: 403 }
      )
    }

    const { error: auditError } = await admin.from('admin_audit_log').insert({
      action: 'use_key',
      target_type: 'activation_key',
      target_id: dbKey.id,
      details: { user_id: user.id, key_partial: chaveNormalizada.slice(0, 8) + '...' },
      performed_by: user.id,
    })
    if (auditError) {
      logger.error('Audit log insert failed', { route: '/api/planos', error: auditError.message })
    }
  }

  // ── Ir para o Free com assinatura ativa ────────────────────────────────────
  //
  // Antes, escolher Free mudava só a coluna: o app rebaixava o acesso e o
  // Stripe continuava cobrando todo mês. O cliente perdia o recurso e seguia
  // pagando por ele.
  //
  // Agora o cancelamento é **agendado para o fim do período**, e o plano
  // **não** muda agora. Quem pagou o mês tem direito ao mês; rebaixar no ato
  // seria tirar o que já foi comprado. O rebaixamento vem do webhook quando o
  // período fechar — é a mesma porta por onde entram os outros cancelamentos,
  // e ter uma porta só é o que impede as duas divergirem.
  if (planoAlvo === 'free' && planoAtual !== 'free') {
    const { data: assinatura } = await admin
      .from('subscriptions')
      .select('id, gateway_subscription_id, current_period_end, cancel_at_period_end')
      .eq('user_id', user.id)
      .in('status', ['active', 'past_due', 'trial'])
      .maybeSingle()

    if (assinatura?.gateway_subscription_id) {
      if (assinatura.cancel_at_period_end) {
        return NextResponse.json({
          plano: planoAtual,
          cancelamento_agendado: true,
          acesso_ate: assinatura.current_period_end,
          mensagem: 'O cancelamento já estava agendado. O acesso continua até o fim do período pago.',
        })
      }

      try {
        await stripeClient.subscriptions.update(assinatura.gateway_subscription_id, {
          cancel_at_period_end: true,
        })
      } catch (err) {
        // Falhar aqui e mudar o plano assim mesmo recriaria o defeito: acesso
        // removido, cobrança de pé. Melhor não mudar nada e dizer.
        logger.error('Não foi possível agendar o cancelamento no Stripe', {
          route: '/api/planos',
          subscriptionId: assinatura.gateway_subscription_id,
          error: String(err),
        })
        return NextResponse.json(
          { error: 'Não foi possível agendar o cancelamento. Tente novamente.' },
          { status: 502 }
        )
      }

      const { error: erroAoMarcar } = await admin
        .from('subscriptions')
        .update({ cancel_at_period_end: true })
        .eq('id', assinatura.id)

      if (erroAoMarcar) {
        // O Stripe já aceitou; a coluna é espelho e a reconciliação corrige.
        logger.error('Cancelamento agendado no Stripe mas não gravado', {
          route: '/api/planos', subscriptionId: assinatura.id, error: erroAoMarcar.message,
        })
      }

      return NextResponse.json({
        plano: planoAtual,
        cancelamento_agendado: true,
        acesso_ate: assinatura.current_period_end,
        mensagem: 'Cancelamento agendado. O acesso continua até o fim do período já pago.',
      })
    }
  }

  // Grava o valor do enum, não o que veio no body. A coluna é `plano_tipo`
  // (`freemium | starter | pro | agencia`) e a tela manda o vocabulário do app
  // (`free | simples | profissional`) — gravar cru derrubava toda troca de
  // plano com `invalid input value for enum plano_tipo: "free"`.
  const { error } = await admin
    .from('profiles')
    .update({ plano: enumDoPlano(planoAlvo) })
    .eq('id', user.id)

  if (error) {
    logger.error('Planos update error', { route: '/api/planos', error: error.message })
    return NextResponse.json({ error: 'Erro ao atualizar plano. Tente novamente.' }, { status: 500 })
  }

  return NextResponse.json({ plano: planoAlvo })
}
