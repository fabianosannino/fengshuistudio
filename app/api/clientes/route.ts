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

  const body = await request.json()
  const { error, data } = await supabase.from('clientes').insert({
    ...body,
    consultor_id: user.id,
  }).select().single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json(data)
}
