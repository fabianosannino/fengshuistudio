/**
 * Persistência do relatório PDF de uma consulta.
 *
 * POST /api/consultas/relatorio  (multipart: pdf, consulta_id)
 *   Salva/atualiza o PDF no bucket PRIVADO 'relatorios' e registra a data.
 *
 * GET  /api/consultas/relatorio?consulta_id=...
 *   Retorna uma URL assinada de curta duração para baixar a versão salva.
 *
 * O bucket é privado (contém PII do cliente). Todo acesso passa por aqui:
 * ownership verificado com o client do usuário; storage + escrita via service_role.
 */

import { NextResponse } from 'next/server'
import { createRouteHandlerClient } from '../../../../src/lib/supabase-route'
import { createSupabaseAdminClient } from '../../../../src/lib/supabase-admin'
import { rateLimit } from '../../../../src/lib/rate-limit'
import { logger } from '../../../../src/lib/logger'

const BUCKET = 'relatorios'
const MAX_PDF_SIZE = 20 * 1024 * 1024 // 20MB
const SIGNED_URL_TTL = 60 // segundos

const ROUTE = '/api/consultas/relatorio'

export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const { success } = rateLimit(ip, { limit: 20, windowMs: 60_000 })
  if (!success) {
    return NextResponse.json(
      { error: 'Muitas requisições. Tente novamente em alguns instantes.' },
      { status: 429, headers: { 'Retry-After': '60' } }
    )
  }

  const supabase = await createRouteHandlerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const formData = await request.formData()
  const file = formData.get('pdf') as File | null
  const consultaId = formData.get('consulta_id') as string | null

  if (!file || !consultaId) {
    return NextResponse.json({ error: 'pdf e consulta_id são obrigatórios' }, { status: 400 })
  }
  if (file.type !== 'application/pdf') {
    return NextResponse.json({ error: 'Formato inválido — apenas PDF.' }, { status: 400 })
  }
  if (file.size > MAX_PDF_SIZE) {
    return NextResponse.json({ error: 'Relatório muito grande. Máximo 20MB.' }, { status: 400 })
  }

  // Ownership: a consulta precisa ser do próprio consultor.
  const { data: consulta } = await supabase
    .from('consultas')
    .select('id')
    .eq('id', consultaId)
    .eq('consultor_id', user.id)
    .single()
  if (!consulta) {
    return NextResponse.json({ error: 'Consulta não encontrada' }, { status: 404 })
  }

  const admin = createSupabaseAdminClient()
  const path = `${consultaId}/relatorio.pdf`
  const buffer = await file.arrayBuffer()

  const { error: uploadError } = await admin.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType: 'application/pdf', upsert: true })
  if (uploadError) {
    logger.error('Falha ao salvar relatório', { route: ROUTE, consultaId, error: uploadError.message })
    return NextResponse.json({ error: 'Erro ao salvar o relatório. Tente novamente.' }, { status: 500 })
  }

  const geradoEm = new Date().toISOString()
  const { error: dbError } = await admin
    .from('consultas')
    .update({ relatorio_pdf_path: path, relatorio_gerado_em: geradoEm })
    .eq('id', consultaId)
  if (dbError) {
    logger.error('Falha ao registrar relatório', { route: ROUTE, consultaId, error: dbError.message })
    return NextResponse.json({ error: 'Erro ao registrar o relatório. Tente novamente.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, gerado_em: geradoEm })
}

export async function GET(request: Request) {
  const supabase = await createRouteHandlerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const consultaId = new URL(request.url).searchParams.get('consulta_id')
  if (!consultaId) {
    return NextResponse.json({ error: 'consulta_id é obrigatório' }, { status: 400 })
  }

  const { data: consulta } = await supabase
    .from('consultas')
    .select('relatorio_pdf_path, relatorio_gerado_em')
    .eq('id', consultaId)
    .eq('consultor_id', user.id)
    .single()
  if (!consulta) {
    return NextResponse.json({ error: 'Consulta não encontrada' }, { status: 404 })
  }
  if (!consulta.relatorio_pdf_path) {
    return NextResponse.json({ url: null, gerado_em: null })
  }

  const admin = createSupabaseAdminClient()
  const { data: signed, error } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(consulta.relatorio_pdf_path, SIGNED_URL_TTL)
  if (error || !signed) {
    logger.error('Falha ao gerar URL do relatório', { route: ROUTE, consultaId, error: error?.message })
    return NextResponse.json({ error: 'Erro ao abrir o relatório salvo.' }, { status: 500 })
  }

  return NextResponse.json({ url: signed.signedUrl, gerado_em: consulta.relatorio_gerado_em })
}
