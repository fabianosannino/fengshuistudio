import { NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { createRouteHandlerClient } from '../../../../src/lib/supabase-route'
import { rateLimit, ipDaRequisicao } from '../../../../src/lib/rate-limit'
import { logger } from '../../../../src/lib/logger'
import { validateUUID } from '../../../../src/lib/validation'
import { ErroDeImagem, lerFormularioDeImagem, normalizarImagem } from '../../../../src/lib/upload-imagem'

const ROUTE = '/api/consultas/bagua-planta'
const BUCKET = 'imoveis-fotos'

export async function POST(request: Request) {
  const { success, indisponivel: limiteIndisponivel } = await rateLimit(ipDaRequisicao(request), { limit: 30, windowMs: 60_000, escopo: 'POST:/api/consultas/bagua-planta', exigirCompartilhado: true })
  if (limiteIndisponivel) return Response.json({ error: 'Proteção temporariamente indisponível. Tente novamente em instantes.' }, { status: 503, headers: { 'Retry-After': '30' } })
  if (!success) return NextResponse.json({ error: 'Muitas requisições. Tente novamente.' }, { status: 429, headers: { 'Retry-After': '60' } })
  try {
    const supabase = await createRouteHandlerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    const form = await lerFormularioDeImagem(request)
    const consultaId = form.get('consulta_id')
    if (typeof consultaId !== 'string' || !validateUUID(consultaId)) return NextResponse.json({ error: 'Consulta inválida.' }, { status: 400 })
    const { data: consulta, error } = await supabase.from('consultas').select('id')
      .eq('id', consultaId).eq('consultor_id', user.id).maybeSingle()
    if (error) return NextResponse.json({ error: 'Não foi possível verificar a consulta.' }, { status: 503 })
    if (!consulta) return NextResponse.json({ error: 'Consulta não encontrada.' }, { status: 404 })
    const imagem = await normalizarImagem(form.get('planta'))
    // Cada versão tem um objeto próprio. Rascunhos e emissões anteriores não
    // perdem sua imagem ao enviar outra planta ou ao falhar a gravação do JSON.
    const path = `${consultaId}/bagua-planta/${randomUUID()}.${imagem.extensao}`
    const { error: uploadError } = await supabase.storage.from(BUCKET)
      .upload(path, imagem.bytes, { contentType: imagem.mime, upsert: false })
    if (uploadError) return NextResponse.json({ error: 'Não foi possível enviar a planta.' }, { status: 503 })
    return NextResponse.json({ path })
  } catch (erro) {
    if (erro instanceof ErroDeImagem) return NextResponse.json({ error: erro.message }, { status: erro.status })
    logger.error('Falha no envio da planta', { route: ROUTE })
    return NextResponse.json({ error: 'Não foi possível enviar a planta.' }, { status: 503 })
  }
}
