import { NextResponse } from 'next/server'
import { createRouteHandlerClient } from '../../../../src/lib/supabase-route'
import { rateLimit } from '../../../../src/lib/rate-limit'

export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const { success } = rateLimit(ip, { limit: 10, windowMs: 60_000 })
  if (!success) return Response.json({ error: 'Rate limit' }, { status: 429 })

  const supabase = await createRouteHandlerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { data: adminProfile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()
  if (!adminProfile || adminProfile.role !== 'admin') {
    return NextResponse.json({ error: 'Acesso restrito' }, { status: 403 })
  }

  let body: { user_id: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }

  if (!body.user_id) {
    return NextResponse.json({ error: 'user_id obrigatório' }, { status: 400 })
  }

  // Get target user
  const { data: target } = await supabase
    .from('profiles')
    .select('id, nome_completo, plano')
    .eq('id', body.user_id)
    .single()

  if (!target) {
    return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
  }

  if (target.plano === 'pro') {
    return NextResponse.json({ error: 'Usuário já possui plano Pro' }, { status: 400 })
  }

  const previousPlan = target.plano

  const { error } = await supabase
    .from('profiles')
    .update({ plano: 'pro' })
    .eq('id', body.user_id)

  if (error) {
    console.error('Admin promote error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  // Audit log
  await supabase.from('admin_audit_log').insert({
    action: 'promote_user',
    target_type: 'user',
    target_id: body.user_id,
    details: { nome: target.nome_completo, from_plan: previousPlan, to_plan: 'pro' },
    performed_by: user.id,
  })

  return NextResponse.json({ success: true, nome: target.nome_completo })
}

// GET — search users for autocomplete
export async function GET(request: Request) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const { success } = rateLimit(ip, { limit: 30, windowMs: 60_000 })
  if (!success) return Response.json({ error: 'Rate limit' }, { status: 429 })

  const supabase = await createRouteHandlerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { data: adminProfile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()
  if (!adminProfile || adminProfile.role !== 'admin') {
    return NextResponse.json({ error: 'Acesso restrito' }, { status: 403 })
  }

  const url = new URL(request.url)
  const q = url.searchParams.get('q') || ''
  if (q.length < 2) {
    return NextResponse.json({ users: [] })
  }

  const { data } = await supabase
    .from('profiles')
    .select('id, nome_completo, plano')
    .or(`nome_completo.ilike.%${q}%`)
    .limit(10)

  return NextResponse.json({ users: data || [] })
}
