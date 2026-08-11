import { NextResponse } from 'next/server'
import { createRouteHandlerClient } from '../../../../src/lib/supabase-route'
import { rateLimit, ipDaRequisicao } from '../../../../src/lib/rate-limit'
import { logger } from '../../../../src/lib/logger'
import { ALLOWED_IMAGE_TYPES, imageExtensionForMime } from '../../../../src/lib/validation'
import { escreverOuFalhar, escreverBestEffort } from '../../../../src/lib/supabase-escrita'
import { BUCKET_CLIENTES, caminhoDoObjeto } from '../../../../src/lib/storage-imagens'

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB

export async function POST(request: Request) {
  const ip = ipDaRequisicao(request)
  const { success } = await rateLimit(ip, { limit: 20, windowMs: 60_000 })
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

  const ext = imageExtensionForMime(file.type)
  if (!ALLOWED_IMAGE_TYPES.includes(file.type) || !ext) {
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

  // Delete old photo if exists. Best-effort declarado: falhar aqui vaza um
  // arquivo órfão, não corrompe dado — e não deve impedir a troca da foto.
  if (cliente.foto_url) {
    const oldPath = caminhoDoObjeto(cliente.foto_url, BUCKET_CLIENTES)
    if (oldPath) {
      await escreverBestEffort(
        supabase.storage.from('clientes-fotos').remove([oldPath]),
        { rota: '/api/clientes/foto', operacao: 'remove-foto-antiga', userId: user.id }
      )
    }
  }

  // Upload new photo — extensão derivada do MIME validado, não de file.name
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

  // A coluna continua se chamando `foto_url`, mas passa a guardar o **path**
  // do objeto: é ele que a tela manda assinar. As linhas antigas seguem com a
  // URL pública e funcionam pelo mesmo caminho (`caminhoDoObjeto`).
  const foto_url = filePath

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
  const ip = ipDaRequisicao(request)
  const { success } = await rateLimit(ip, { limit: 20, windowMs: 60_000 })
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

  // Ordem deliberada: primeiro solta a referência, depois apaga o arquivo. O
  // inverso deixaria o cliente apontando para um arquivo que não existe mais
  // se o update falhasse — imagem quebrada em vez de foto removida.
  try {
    await escreverOuFalhar(
      supabase
        .from('clientes')
        .update({ foto_url: null })
        .eq('id', cliente_id),
      { rota: '/api/clientes/foto', operacao: 'limpar-foto-url', userId: user.id }
    )
  } catch {
    // Detalhe já registrado pelo helper.
    return NextResponse.json({ error: 'Não foi possível remover a foto.' }, { status: 500 })
  }

  if (cliente.foto_url) {
    const oldPath = caminhoDoObjeto(cliente.foto_url, BUCKET_CLIENTES)
    if (oldPath) {
      await escreverBestEffort(
        supabase.storage.from('clientes-fotos').remove([oldPath]),
        { rota: '/api/clientes/foto', operacao: 'remove-foto', userId: user.id }
      )
    }
  }

  return NextResponse.json({ success: true })
}
