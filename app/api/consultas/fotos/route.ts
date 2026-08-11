import { NextResponse } from 'next/server'
import { createRouteHandlerClient } from '../../../../src/lib/supabase-route'
import { rateLimit } from '../../../../src/lib/rate-limit'
import { logger } from '../../../../src/lib/logger'
import { ALLOWED_IMAGE_TYPES, imageExtensionForMime } from '../../../../src/lib/validation'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const BUCKET = 'imoveis-fotos'

export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const { success } = rateLimit(ip, { limit: 60, windowMs: 60_000 })
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

  const formData = await request.formData()
  const consultaId = formData.get('consulta_id') as string | null
  const tipo = formData.get('tipo') as string | null // 'geral' or 'comodo'
  const comodo = formData.get('comodo') as string | null
  const files = formData.getAll('fotos') as File[]

  if (!consultaId || !tipo) {
    return NextResponse.json({ error: 'consulta_id e tipo são obrigatórios' }, { status: 400 })
  }

  if (tipo === 'comodo' && !comodo) {
    return NextResponse.json({ error: 'Nome do cômodo é obrigatório' }, { status: 400 })
  }

  if (files.length === 0) {
    return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 })
  }

  // Verify consultation belongs to user
  const { data: consulta } = await supabase
    .from('consultas')
    .select('id, consultor_id')
    .eq('id', consultaId)
    .eq('consultor_id', user.id)
    .single()

  if (!consulta) {
    return NextResponse.json({ error: 'Consulta não encontrada' }, { status: 404 })
  }

  // Validate files
  for (const file of files) {
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      return NextResponse.json({ error: `Formato inválido: ${file.name}. Use JPG, PNG ou WEBP.` }, { status: 400 })
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: `Arquivo muito grande: ${file.name}. Máximo 10MB.` }, { status: 400 })
    }
  }

  const uploadedUrls: string[] = []

  for (const file of files) {
    // Extensão derivada do MIME já validado acima, nunca de file.name.
    const safeExt = imageExtensionForMime(file.type) ?? 'jpg'
    const folder = tipo === 'geral' ? 'geral' : comodo!.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase()
    const filePath = `${consultaId}/${folder}/${crypto.randomUUID()}.${safeExt}`

    const buffer = await file.arrayBuffer()
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(filePath, buffer, { contentType: file.type, upsert: false })

    if (uploadError) {
      logger.error('Upload error', { route: '/api/consultas/fotos', error: uploadError.message })
      return NextResponse.json({ error: `Erro ao enviar ${file.name}.` }, { status: 500 })
    }

    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(filePath)
    uploadedUrls.push(urlData.publicUrl)
  }

  return NextResponse.json({ urls: uploadedUrls })
}

export async function DELETE(request: Request) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const { success } = rateLimit(ip, { limit: 30, windowMs: 60_000 })
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

  let body: { consulta_id?: string; url?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }

  const { consulta_id, url } = body
  if (!consulta_id || !url) {
    return NextResponse.json({ error: 'consulta_id e url são obrigatórios' }, { status: 400 })
  }

  // Verify ownership
  const { data: consulta } = await supabase
    .from('consultas')
    .select('id')
    .eq('id', consulta_id)
    .eq('consultor_id', user.id)
    .single()

  if (!consulta) {
    return NextResponse.json({ error: 'Consulta não encontrada' }, { status: 404 })
  }

  // Extract path from URL
  const pathMatch = url.split(`/${BUCKET}/`)[1]
  if (pathMatch) {
    // A RLS de storage.objects amarra o arquivo ao dono da consulta (primeira
    // pasta do path). Sem checar o erro, uma remoção recusada pela policy
    // devolvia `success: true` e a foto continuava lá.
    const { error: removeError } = await supabase.storage.from(BUCKET).remove([pathMatch])
    if (removeError) {
      logger.error('Falha ao remover foto do storage', {
        route: '/api/consultas/fotos', consultaId: consulta_id, error: removeError.message,
      })
      return NextResponse.json({ error: 'Não foi possível remover a foto' }, { status: 500 })
    }
  }

  return NextResponse.json({ success: true })
}
