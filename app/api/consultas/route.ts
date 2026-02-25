import { NextResponse } from 'next/server'
import { createRouteHandlerClient } from '../../../src/lib/supabase-route'

const MAX_CONSULTAS_MES_FREE = 3

export async function POST(request: Request) {
  const supabase = await createRouteHandlerClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  // Check plan
  const { data: profile } = await supabase
    .from('profiles')
    .select('plano')
    .eq('id', user.id)
    .single()

  if (profile?.plano !== 'pro') {
    const inicioMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
    const { count } = await supabase
      .from('consultas')
      .select('*', { count: 'exact', head: true })
      .eq('consultor_id', user.id)
      .gte('criado_em', inicioMes)

    if ((count || 0) >= MAX_CONSULTAS_MES_FREE) {
      return NextResponse.json(
        { error: 'Limite de 3 consultas/mês no plano Free. Faça upgrade para continuar.' },
        { status: 403 }
      )
    }
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }

  const ALLOWED_FIELDS = ['cliente_id', 'nome_imovel', 'tipo_imovel', 'area_total_m2', 'endereco_imovel', 'porta_posicao', 'status'] as const
  const sanitized: Record<string, unknown> = {}
  for (const key of ALLOWED_FIELDS) {
    if (body[key] !== undefined) {
      sanitized[key] = body[key]
    }
  }

  if (!sanitized.cliente_id || typeof sanitized.cliente_id !== 'string') {
    return NextResponse.json({ error: 'cliente_id é obrigatório' }, { status: 400 })
  }

  const { error, data } = await supabase.from('consultas').insert({
    ...sanitized,
    consultor_id: user.id,
  }).select().single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json(data)
}
