import { NextResponse } from 'next/server'
import { createRouteHandlerClient } from '../../../../src/lib/supabase-route'
import { rateLimit } from '../../../../src/lib/rate-limit'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const BUCKET = 'imoveis-fotos'

export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const { success } = rateLimit(ip, { limit: 30, windowMs: 60_000 })
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

    if (!ALLOWED_TYPES.includes(file.type)) {
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
      console.error('Consulta query error:', consultaError.message)
      return NextResponse.json({ error: 'Erro ao verificar consulta: ' + consultaError.message }, { status: 500 })
    }

    if (!consulta) {
      return NextResponse.json({ error: 'Consulta não encontrada' }, { status: 404 })
    }

    // Delete previous plant image if any
    const { data: files, error: listError } = await supabase.storage
      .from(BUCKET)
      .list(`${consultaId}/bagua-planta`)

    if (listError) {
      console.error('Storage list error:', listError.message)
      // Continue anyway - bucket might be empty or not exist yet for this path
    }

    if (files && files.length > 0) {
      await supabase.storage.from(BUCKET).remove(
        files.map(f => `${consultaId}/bagua-planta/${f.name}`)
      )
    }

    // Upload new plant image
    const ext = file.name.split('.').pop() || 'png'
    const filePath = `${consultaId}/bagua-planta/planta.${ext}`
    const buffer = await file.arrayBuffer()
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(filePath, buffer, { contentType: file.type, upsert: true })

    if (uploadError) {
      console.error('Storage upload error:', uploadError.message)
      return NextResponse.json(
        { error: `Erro ao enviar imagem. Verifique se o bucket "${BUCKET}" existe no Supabase Storage. Detalhe: ${uploadError.message}` },
        { status: 500 }
      )
    }

    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(filePath)

    return NextResponse.json({ url: urlData.publicUrl })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido'
    console.error('bagua-planta route error:', message)
    return NextResponse.json({ error: `Erro interno: ${message}` }, { status: 500 })
  }
}
