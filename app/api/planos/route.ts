import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { createRouteHandlerClient } from '../../../src/lib/supabase-route'
import { rateLimit } from '../../../src/lib/rate-limit'

function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a.trim())
  const bufB = Buffer.from(b.trim())
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}

export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const { success } = rateLimit(ip, { limit: 10, windowMs: 60_000 })
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

  if (!plano || !['freemium', 'free', 'simples', 'pro', 'profissional'].includes(plano)) {
    return NextResponse.json({ error: 'Plano inválido' }, { status: 400 })
  }

  // Get current plan
  const { data: profile } = await supabase
    .from('profiles')
    .select('plano')
    .eq('id', user.id)
    .single()

  const isPaidPlan = ['pro', 'profissional', 'simples'].includes(plano)
  const currentIsPaid = ['pro', 'profissional', 'simples'].includes(profile?.plano || '')
  if (isPaidPlan && !currentIsPaid) {
    if (!chave_ativacao) {
      return NextResponse.json(
        { error: 'Informe uma chave de ativação válida para ativar este plano.', requiresPayment: true },
        { status: 402 }
      )
    }

    // Look up activation key in database
    const { data: dbKey } = await supabase
      .from('activation_keys')
      .select('id, key, status, expires_at')
      .eq('key', chave_ativacao.trim().toUpperCase())
      .eq('status', 'available')
      .single()

    if (!dbKey || !safeCompare(chave_ativacao.trim().toUpperCase(), dbKey.key)) {
      return NextResponse.json(
        { error: 'Chave de ativação inválida. Verifique e tente novamente.', requiresPayment: true },
        { status: 403 }
      )
    }

    // Check expiration
    if (dbKey.expires_at && new Date(dbKey.expires_at) < new Date()) {
      await supabase.from('activation_keys').update({ status: 'expired' }).eq('id', dbKey.id)
      return NextResponse.json(
        { error: 'Chave de ativação expirada.', requiresPayment: true },
        { status: 403 }
      )
    }

    // Mark key as used
    await supabase.from('activation_keys').update({
      status: 'used',
      used_at: new Date().toISOString(),
      used_by: user.id,
    }).eq('id', dbKey.id)

    // Audit log
    await supabase.from('admin_audit_log').insert({
      action: 'use_key',
      target_type: 'activation_key',
      target_id: dbKey.id,
      details: { user_id: user.id, key_partial: chave_ativacao.trim().toUpperCase().slice(0, 8) + '...' },
      performed_by: user.id,
    })
  }

  const { error } = await supabase
    .from('profiles')
    .update({ plano })
    .eq('id', user.id)

  if (error) {
    console.error('Planos update error:', error.message)
    return NextResponse.json({ error: 'Erro ao atualizar plano. Tente novamente.' }, { status: 400 })
  }

  return NextResponse.json({ plano })
}
