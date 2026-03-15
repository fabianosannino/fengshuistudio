import { NextResponse } from 'next/server'
import { createRouteHandlerClient } from '../../../src/lib/supabase-route'

const MAX_CLIENTES_FREE = 5

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
    const { count } = await supabase
      .from('clientes')
      .select('*', { count: 'exact', head: true })
      .eq('consultor_id', user.id)
      .eq('ativo', true)

    if ((count || 0) >= MAX_CLIENTES_FREE) {
      return NextResponse.json(
        { error: 'Limite de 5 clientes no plano Free. Faça upgrade para cadastrar mais.' },
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

  const { nome_completo, email, telefone, cidade, estado, notas } = body as {
    nome_completo?: string; email?: string; telefone?: string;
    cidade?: string; estado?: string; notas?: string
  }

  if (!nome_completo || typeof nome_completo !== 'string' || nome_completo.trim().length === 0) {
    return NextResponse.json({ error: 'Nome completo é obrigatório' }, { status: 400 })
  }

  const { error, data } = await supabase.from('clientes').insert({
    nome_completo: nome_completo.trim(),
    email: email || null,
    telefone: telefone || null,
    cidade: cidade || null,
    estado: estado || null,
    notas: notas || null,
    consultor_id: user.id,
  }).select().single()

  if (error) {
    console.error('Cliente insert error:', error.message)
    return NextResponse.json({ error: 'Erro ao cadastrar cliente. Tente novamente.' }, { status: 400 })
  }

  return NextResponse.json(data)
}
