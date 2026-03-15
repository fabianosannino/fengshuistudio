import { NextResponse } from 'next/server'
import { createRouteHandlerClient } from '../../../src/lib/supabase-route'

const PROF_TYPES = ['consultor', 'arquiteto', 'feng_shui', 'decorador', 'outro_profissional']
const MAX_CONSULTAS_MES_FREE = 3
const MAX_IMOVEIS_PESSOAL = 3

export async function POST(request: Request) {
  const supabase = await createRouteHandlerClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  // Check profile and plan
  const { data: profile } = await supabase
    .from('profiles')
    .select('plano, tipo_usuario, role')
    .eq('id', user.id)
    .single()

  const isProfessional = profile?.tipo_usuario
    ? PROF_TYPES.includes(profile.tipo_usuario)
    : (profile?.role === 'consultor')

  if (isProfessional) {
    // Professional free plan: 3 consultations per month
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
  } else {
    // Personal user: max 3 properties total
    const { count } = await supabase
      .from('consultas')
      .select('*', { count: 'exact', head: true })
      .eq('consultor_id', user.id)

    if ((count || 0) >= MAX_IMOVEIS_PESSOAL) {
      return NextResponse.json(
        { error: 'Limite de 3 imóveis atingido na conta pessoal. Mude para uma conta profissional para continuar.' },
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
    console.error('Consulta insert error:', error.message)
    return NextResponse.json({ error: 'Erro ao criar consulta. Tente novamente.' }, { status: 400 })
  }

  return NextResponse.json(data)
}
