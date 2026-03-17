import { NextResponse } from 'next/server'
import { createRouteHandlerClient } from '../../../../src/lib/supabase-route'
import { rateLimit } from '../../../../src/lib/rate-limit'
import { logger } from '../../../../src/lib/logger'

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const { success } = rateLimit(ip, { limit: 20, windowMs: 60_000 })
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
  const file = formData.get('foto') as File | null
  const clienteId = formData.get('cliente_id') as string | null

  if (!file || !clienteId) {
    return NextResponse.json({ error: 'Foto e cliente_id são obrigatórios' }, { status: 400 })
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: 'Formato inválido. Use JPG, PNG ou WEBP.' }, { status: 400 })
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: 'Arquivo muito grande. Máximo 5MB.' }, { status: 400 })
  }

  // Verify client belongs to user
  const { data: cliente } = await supabase
    .from('clientes')
    .select('id, foto_url')
    .eq('id', clienteId)
    .eq('consultor_id', user.id)
    .single()

  if (!cliente) {
    return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 })
  }

  // Delete old photo if exists
  if (cliente.foto_url) {
    const oldPath = cliente.foto_url.split('/clientes-fotos/')[1]
    if (oldPath) {
      await supabase.storage.from('clientes-fotos').remove([oldPath])
    }
  }

  // Upload new photo
  const ext = file.name.split('.').pop() || 'jpg'
  const filePath = `${user.id}/${clienteId}.${ext}`
  const buffer = await file.arrayBuffer()

  const { error: uploadError } = await supabase.storage
    .from('clientes-fotos')
    .upload(filePath, buffer, {
      contentType: file.type,
      upsert: true,
    })

  if (uploadError) {
    logger.error('Upload error', { route: '/api/clientes/foto', error: uploadError.message })
    return NextResponse.json({ error: 'Erro ao fazer upload da foto.' }, { status: 500 })
  }

  // Get public URL
  const { data: urlData } = supabase.storage
    .from('clientes-fotos')
    .getPublicUrl(filePath)

  const foto_url = urlData.publicUrl

  // Update client record
  const { error: updateError } = await supabase
    .from('clientes')
    .update({ foto_url })
    .eq('id', clienteId)

  if (updateError) {
    logger.error('Update error', { route: '/api/clientes/foto', error: updateError.message })
    return NextResponse.json({ error: 'Erro ao atualizar cliente.' }, { status: 500 })
  }

  return NextResponse.json({ foto_url })
}

export async function DELETE(request: Request) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const { success } = rateLimit(ip, { limit: 20, windowMs: 60_000 })
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

  let body: { cliente_id?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }

  const { cliente_id } = body
  if (!cliente_id) {
    return NextResponse.json({ error: 'cliente_id é obrigatório' }, { status: 400 })
  }

  const { data: cliente } = await supabase
    .from('clientes')
    .select('id, foto_url')
    .eq('id', cliente_id)
    .eq('consultor_id', user.id)
    .single()

  if (!cliente) {
    return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 })
  }

  if (cliente.foto_url) {
    const oldPath = cliente.foto_url.split('/clientes-fotos/')[1]
    if (oldPath) {
      await supabase.storage.from('clientes-fotos').remove([oldPath])
    }
  }

  await supabase
    .from('clientes')
    .update({ foto_url: null })
    .eq('id', cliente_id)

  return NextResponse.json({ success: true })
}
