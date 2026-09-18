import { NextResponse } from 'next/server'
import { createRouteHandlerClient } from '../../../../../src/lib/supabase-route'
import { carregarFonteRelatorio, sha256 } from '../../../../../src/lib/relatorio-fonte'
import { idValido, jsonCanonico } from '../../../../../src/lib/relatorio-emissao'
import { logger } from '../../../../../src/lib/logger'

export async function GET(request: Request) {
  const client = await createRouteHandlerClient()
  const { data: { user } } = await client.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const id = new URL(request.url).searchParams.get('consulta_id')
  if (!idValido(id)) return NextResponse.json({ error: 'Consulta inválida' }, { status: 400 })
  try {
    const fonte = await carregarFonteRelatorio(client, id, user.id)
    if (!fonte) return NextResponse.json({ error: 'Consulta não encontrada' }, { status: 404 })
    return NextResponse.json({ fonte, fonte_sha256: sha256(jsonCanonico(fonte)), referencia_temporal: new Date().toISOString() }, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    logger.error('Falha ao carregar entradas do relatório', { route: '/api/consultas/relatorio/entrada' })
    return NextResponse.json({ error: 'Não foi possível carregar as entradas do relatório.' }, { status: 503 })
  }
}
