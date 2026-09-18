import { NextResponse } from 'next/server'
import { createRouteHandlerClient } from '../../../../src/lib/supabase-route'
import { createSupabaseAdminClient } from '../../../../src/lib/supabase-admin'
import { excluirEmissoesDoTitular } from '../../../../src/lib/relatorio-retencao'
import { idValido } from '../../../../src/lib/relatorio-emissao'
import { logger } from '../../../../src/lib/logger'

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  if (!idValido(id)) return NextResponse.json({ error: 'Consulta inválida' }, { status: 400 })
  const client = await createRouteHandlerClient()
  const { data: { user } } = await client.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const consulta = await client.from('consultas').select('id').eq('id', id).eq('consultor_id', user.id).maybeSingle()
  if (consulta.error) return NextResponse.json({ error: 'Não foi possível conferir a consulta.' }, { status: 503 })
  if (!consulta.data) return NextResponse.json({ error: 'Consulta não encontrada' }, { status: 404 })
  try {
    await excluirEmissoesDoTitular(createSupabaseAdminClient(), user.id, id)
    const { error } = await client.from('consultas').delete().eq('id', id).eq('consultor_id', user.id)
    if (error) throw new Error('Exclusão incompleta')
    return NextResponse.json({ ok: true })
  } catch {
    logger.error('Exclusão da consulta não concluída', { route: '/api/consultas/[id]', consultaId: id })
    return NextResponse.json({ error: 'Não foi possível concluir a exclusão. Se há uma emissão em preparação, aguarde até 30 minutos e tente novamente.' }, { status: 503 })
  }
}
