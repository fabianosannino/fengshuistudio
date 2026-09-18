import { NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { createRouteHandlerClient } from '../../../../src/lib/supabase-route'
import { rateLimit, ipDaRequisicao } from '../../../../src/lib/rate-limit'
import { logger } from '../../../../src/lib/logger'
import { validateUUID } from '../../../../src/lib/validation'
import { caminhoDoObjeto } from '../../../../src/lib/storage-imagens'
import { ErroDeImagem, lerFormularioDeImagem, normalizarImagem } from '../../../../src/lib/upload-imagem'
import { MAX_IMAGENS_POR_ENVIO } from '../../../../src/lib/upload-imagem-limites'

const BUCKET = 'imoveis-fotos'
const ROUTE = '/api/consultas/fotos'

export async function POST(request: Request) {
  const { success, indisponivel: limiteIndisponivel } = await rateLimit(ipDaRequisicao(request), { limit: 60, windowMs: 60_000, escopo: 'POST:/api/consultas/fotos', exigirCompartilhado: true })
  if (limiteIndisponivel) return Response.json({ error: 'Proteção temporariamente indisponível. Tente novamente em instantes.' }, { status: 503, headers: { 'Retry-After': '30' } })
  if (!success) return NextResponse.json({ error: 'Muitas requisições. Tente novamente.' }, { status: 429, headers: { 'Retry-After': '60' } })
  try {
    const supabase = await createRouteHandlerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    const form = await lerFormularioDeImagem(request)
    const consultaId = form.get('consulta_id')
    const tipo = form.get('tipo')
    const comodo = form.get('comodo')
    const files = form.getAll('fotos')
    if (typeof consultaId !== 'string' || !validateUUID(consultaId) || (tipo !== 'geral' && tipo !== 'comodo')) {
      return NextResponse.json({ error: 'Consulta ou tipo de foto inválido.' }, { status: 400 })
    }
    if (tipo === 'comodo' && (typeof comodo !== 'string' || !comodo.trim() || comodo.length > 100)) {
      return NextResponse.json({ error: 'Informe o cômodo com até 100 caracteres.' }, { status: 400 })
    }
    if (files.length === 0 || files.length > MAX_IMAGENS_POR_ENVIO) return NextResponse.json({ error: 'Envie de 1 a 10 imagens.' }, { status: 400 })
    const { data: consulta, error } = await supabase.from('consultas').select('id')
      .eq('id', consultaId).eq('consultor_id', user.id).maybeSingle()
    if (error) return NextResponse.json({ error: 'Não foi possível verificar a consulta.' }, { status: 503 })
    if (!consulta) return NextResponse.json({ error: 'Consulta não encontrada.' }, { status: 404 })
    // Validar o lote inteiro antes da primeira escrita; decodificar sequencialmente.
    const imagens = []
    for (const file of files) imagens.push(await normalizarImagem(file))
    const folder = tipo === 'geral' ? 'geral' : (comodo as string).replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase()
    const paths: string[] = []
    for (const imagem of imagens) {
      const path = `${consultaId}/${folder}/${randomUUID()}.${imagem.extensao}`
      const { error: uploadError } = await supabase.storage.from(BUCKET)
        .upload(path, imagem.bytes, { contentType: imagem.mime, upsert: false })
      if (uploadError) {
        // Somente objetos desta tentativa, que ainda não foram entregues ao cliente.
        if (paths.length) {
          const { error: removeError } = await supabase.storage.from(BUCKET).remove(paths)
          if (removeError) logger.error('Limpeza de envio incompleto pendente', { route: ROUTE })
        }
        return NextResponse.json({ error: 'Não foi possível enviar as fotos. Tente novamente.' }, { status: 503 })
      }
      paths.push(path)
    }
    return NextResponse.json({ paths })
  } catch (erro) {
    if (erro instanceof ErroDeImagem) return NextResponse.json({ error: erro.message }, { status: erro.status })
    logger.error('Falha no envio das fotos', { route: ROUTE })
    return NextResponse.json({ error: 'Não foi possível enviar as fotos.' }, { status: 503 })
  }
}

export async function DELETE(request: Request) {
  const { success, indisponivel: limiteIndisponivel } = await rateLimit(ipDaRequisicao(request), { limit: 30, windowMs: 60_000, escopo: 'DELETE:/api/consultas/fotos', exigirCompartilhado: true })
  if (limiteIndisponivel) return Response.json({ error: 'Proteção temporariamente indisponível. Tente novamente em instantes.' }, { status: 503, headers: { 'Retry-After': '30' } })
  if (!success) return NextResponse.json({ error: 'Muitas requisições. Tente novamente.' }, { status: 429 })
  const supabase = await createRouteHandlerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const body = await request.json().catch(() => null)
  if (!body || typeof body.consulta_id !== 'string' || !validateUUID(body.consulta_id) || typeof body.url !== 'string') {
    return NextResponse.json({ error: 'Consulta e foto são obrigatórias.' }, { status: 400 })
  }
  const path = caminhoDoObjeto(body.url, BUCKET)
  if (!path || !path.startsWith(`${body.consulta_id}/`) || path.split('/').some(p => !p || p === '.' || p === '..') || /[%\\\x00-\x1f]/.test(path)) {
    return NextResponse.json({ error: 'Foto não pertence à consulta informada.' }, { status: 400 })
  }
  // Planta é histórico da análise, não uma foto removível por esta rota.
  if (path.split('/')[1] === 'bagua-planta') return NextResponse.json({ error: 'Plantas são preservadas no histórico da consulta.' }, { status: 409 })
  const { data: consulta, error } = await supabase.from('consultas').select('id')
    .eq('id', body.consulta_id).eq('consultor_id', user.id).maybeSingle()
  if (error) return NextResponse.json({ error: 'Não foi possível verificar a consulta.' }, { status: 503 })
  if (!consulta) return NextResponse.json({ error: 'Consulta não encontrada.' }, { status: 404 })
  const { error: removeError } = await supabase.storage.from(BUCKET).remove([path])
  if (removeError) return NextResponse.json({ error: 'Não foi possível remover a foto.' }, { status: 503 })
  return NextResponse.json({ success: true })
}
