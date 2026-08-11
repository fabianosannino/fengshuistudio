import { NextResponse } from 'next/server'
import { createRouteHandlerClient } from '../../../../src/lib/supabase-route'
import { rateLimit, ipDaRequisicao } from '../../../../src/lib/rate-limit'
import { logger } from '../../../../src/lib/logger'
import { ALLOWED_IMAGE_TYPES, imageExtensionForMime } from '../../../../src/lib/validation'
import { escreverBestEffort } from '../../../../src/lib/supabase-escrita'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const BUCKET = 'imoveis-fotos'

export async function POST(request: Request) {
  const ip = ipDaRequisicao(request)
  const { success } = await rateLimit(ip, { limit: 30, windowMs: 60_000 })
  if (!success) {
    return Response.json(
      { error: 'Muitas requisições. Tente novamente em alguns instantes.' },
      { status: 429, headers: { 'Retry-After': '60' } }
    )
  }

  try {
    const supabase = await createRouteHandlerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const formData = await request.formData()
    const consultaId = formData.get('consulta_id') as string | null
    const file = formData.get('planta') as File | null

    if (!consultaId || !file) {
      return NextResponse.json({ error: 'consulta_id e planta são obrigatórios' }, { status: 400 })
    }

    const ext = imageExtensionForMime(file.type)
    if (!ALLOWED_IMAGE_TYPES.includes(file.type) || !ext) {
      return NextResponse.json({ error: 'Formato inválido. Use JPG, PNG ou WEBP.' }, { status: 400 })
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'Arquivo muito grande. Máximo 10MB.' }, { status: 400 })
    }

    // Verify consultation belongs to user
    const { data: consulta, error: consultaError } = await supabase
      .from('consultas')
      .select('id, consultor_id')
      .eq('id', consultaId)
      .eq('consultor_id', user.id)
      .single()

    if (consultaError) {
      logger.error('Consulta query error', { route: '/api/consultas/bagua-planta', error: consultaError.message })
      return NextResponse.json({ error: 'Erro ao verificar consulta.' }, { status: 500 })
    }

    if (!consulta) {
      return NextResponse.json({ error: 'Consulta não encontrada' }, { status: 404 })
    }

    // Delete previous plant image if any
    const { data: files, error: listError } = await supabase.storage
      .from(BUCKET)
      .list(`${consultaId}/bagua-planta`)

    if (listError) {
      logger.error('Storage list error', { route: '/api/consultas/bagua-planta', error: listError.message })
      // Continue anyway - bucket might be empty or not exist yet for this path
    }

    if (files && files.length > 0) {
      // Best-effort: um arquivo antigo que sobra vaza armazenamento, mas
      // bloquear o upload da planta nova seria pior para o consultor.
      await escreverBestEffort(
        supabase.storage.from(BUCKET).remove(
          files.map(f => `${consultaId}/bagua-planta/${f.name}`)
        ),
        { rota: '/api/consultas/bagua-planta', operacao: 'remove-planta-antiga', userId: user.id }
      )
    }

    // Upload new plant image — extensão derivada do MIME validado
    const filePath = `${consultaId}/bagua-planta/planta.${ext}`
    const buffer = await file.arrayBuffer()
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(filePath, buffer, { contentType: file.type, upsert: true })

    if (uploadError) {
      logger.error('Storage upload error', { route: '/api/consultas/bagua-planta', bucket: BUCKET, error: uploadError.message })
      return NextResponse.json({ error: 'Erro ao enviar imagem. Tente novamente.' }, { status: 500 })
    }

    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(filePath)

    return NextResponse.json({ url: urlData.publicUrl })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido'
    logger.error('bagua-planta route error', { route: '/api/consultas/bagua-planta', error: message })
    return NextResponse.json({ error: 'Erro interno. Tente novamente.' }, { status: 500 })
  }
}
