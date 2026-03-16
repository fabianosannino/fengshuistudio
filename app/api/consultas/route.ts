import { NextResponse } from 'next/server'
import { createRouteHandlerClient } from '../../../src/lib/supabase-route'
import { rateLimit } from '../../../src/lib/rate-limit'
import { planoEfetivo, podeClientes, isProfissional as isProfissionalFn, planoUsuario } from '../../../src/lib/plano-utils'
const MAX_CONSULTAS_MES_FREE = 3
const MAX_IMOVEIS_PESSOAL = 3

export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const { success, remaining } = rateLimit(ip, { limit: 20, windowMs: 60_000 })
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

  // Check profile and plan
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  const isProfessional = isProfissionalFn(profile)
  const plano = planoUsuario(profile)

  // Professional users: unlimited (plano is already 'profissional' via planoUsuario)
  // Simples plan: 1 active consultation at a time
  // Free plan: 3 total properties

  if (plano !== 'profissional') {
    if (plano === 'simples') {
      // Simples plan: max 1 active (non-archived) consultation
      const { count } = await supabase
        .from('consultas')
        .select('*', { count: 'exact', head: true })
        .eq('consultor_id', user.id)
        .neq('status', 'arquivado')

      if ((count || 0) >= 1) {
        return NextResponse.json(
          { error: 'Limite de 1 imóvel ativo no plano Simples. Arquive o atual ou faça upgrade.' },
          { status: 403 }
        )
      }
    } else {
      // Free plan: max 3 total properties
      const { count } = await supabase
        .from('consultas')
        .select('*', { count: 'exact', head: true })
        .eq('consultor_id', user.id)

      if ((count || 0) >= MAX_IMOVEIS_PESSOAL) {
        return NextResponse.json(
          { error: 'Limite de 3 imóveis atingido. Faça upgrade para continuar.' },
          { status: 403 }
        )
      }
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
