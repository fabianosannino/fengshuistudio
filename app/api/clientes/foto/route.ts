import { NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { createRouteHandlerClient } from '../../../../src/lib/supabase-route'
import { createSupabaseAdminClient } from '../../../../src/lib/supabase-admin'
import { rateLimit, ipDaRequisicao } from '../../../../src/lib/rate-limit'
import { logger } from '../../../../src/lib/logger'
import { validateUUID } from '../../../../src/lib/validation'
import { BUCKET_CLIENTES, caminhoDoObjeto } from '../../../../src/lib/storage-imagens'
import { ErroDeImagem, lerFormularioDeImagem, normalizarImagem } from '../../../../src/lib/upload-imagem'

const ROUTE = '/api/clientes/foto'

export async function POST(request: Request) {
  const { success, indisponivel: limiteIndisponivel } = await rateLimit(ipDaRequisicao(request), { limit: 20, windowMs: 60_000, escopo: 'POST:/api/clientes/foto', exigirCompartilhado: true })
  if (limiteIndisponivel) return Response.json({ error: 'Proteção temporariamente indisponível. Tente novamente em instantes.' }, { status: 503, headers: { 'Retry-After': '30' } })
  if (!success) return NextResponse.json({ error: 'Muitas requisições. Tente novamente.' }, { status: 429 })
  try {
    const supabase = await createRouteHandlerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    const form = await lerFormularioDeImagem(request)
    const clienteId = form.get('cliente_id')
    if (typeof clienteId !== 'string' || !validateUUID(clienteId)) return NextResponse.json({ error: 'Cliente inválido.' }, { status: 400 })
    const { data: cliente, error } = await supabase.from('clientes').select('id, foto_url')
      .eq('id', clienteId).eq('consultor_id', user.id).maybeSingle()
    if (error) return NextResponse.json({ error: 'Não foi possível verificar o cliente.' }, { status: 503 })
    if (!cliente) return NextResponse.json({ error: 'Cliente não encontrado.' }, { status: 404 })
    const imagem = await normalizarImagem(form.get('foto'))
    const path = `${user.id}/${clienteId}/${randomUUID()}.${imagem.extensao}`
    const { error: uploadError } = await createSupabaseAdminClient().storage.from(BUCKET_CLIENTES)
      .upload(path, imagem.bytes, { contentType: imagem.mime, upsert: false })
    if (uploadError) return NextResponse.json({ error: 'Não foi possível enviar a foto.' }, { status: 503 })
    // Troca condicionada ao valor lido; uma segunda aba não sobrescreve em silêncio.
    let update = supabase.from('clientes').update({ foto_url: path }).eq('id', clienteId).eq('consultor_id', user.id)
    update = cliente.foto_url === null ? update.is('foto_url', null) : update.eq('foto_url', cliente.foto_url)
    const { data: salvo, error: updateError } = await update.select('id').maybeSingle()
    // Não apagar o objeto novo em falha ambígua: o commit pode ter ocorrido.
    // O inventário recursivo do titular alcança também versões sem referência.
    if (updateError) return NextResponse.json({ error: 'Não foi possível confirmar a foto. Recarregue antes de tentar novamente.' }, { status: 503 })
    if (!salvo) return NextResponse.json({ error: 'O cliente foi alterado. Recarregue antes de trocar a foto.' }, { status: 409 })
    return NextResponse.json({ foto_url: path })
  } catch (erro) {
    if (erro instanceof ErroDeImagem) return NextResponse.json({ error: erro.message }, { status: erro.status })
    logger.error('Falha no envio da foto do cliente', { route: ROUTE })
    return NextResponse.json({ error: 'Não foi possível enviar a foto.' }, { status: 503 })
  }
}

export async function DELETE(request: Request) {
  const { success, indisponivel: limiteIndisponivel } = await rateLimit(ipDaRequisicao(request), { limit: 20, windowMs: 60_000, escopo: 'DELETE:/api/clientes/foto', exigirCompartilhado: true })
  if (limiteIndisponivel) return Response.json({ error: 'Proteção temporariamente indisponível. Tente novamente em instantes.' }, { status: 503, headers: { 'Retry-After': '30' } })
  if (!success) return NextResponse.json({ error: 'Muitas requisições. Tente novamente.' }, { status: 429 })
  const supabase = await createRouteHandlerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const body = await request.json().catch(() => null)
  if (!body || typeof body.cliente_id !== 'string' || !validateUUID(body.cliente_id)) return NextResponse.json({ error: 'Cliente inválido.' }, { status: 400 })
  const { data: cliente, error } = await supabase.from('clientes').select('id, foto_url')
    .eq('id', body.cliente_id).eq('consultor_id', user.id).maybeSingle()
  if (error) return NextResponse.json({ error: 'Não foi possível verificar o cliente.' }, { status: 503 })
  if (!cliente) return NextResponse.json({ error: 'Cliente não encontrado.' }, { status: 404 })
  if (!cliente.foto_url) return NextResponse.json({ success: true })
  const path = caminhoDoObjeto(cliente.foto_url, BUCKET_CLIENTES)
  const prefixo = `${user.id}/${cliente.id}`
  const versao = path?.startsWith(`${prefixo}/`)
  const legado = path?.startsWith(prefixo) && /^\.(jpg|jpeg|png|webp)$/.test(path.slice(prefixo.length))
  if (!path || !(versao || legado) || /[%\\\x00-\x1f]/.test(path) || path.split('/').some(p => !p || p === '.' || p === '..')) {
    return NextResponse.json({ error: 'Não foi possível validar a foto vinculada.' }, { status: 409 })
  }
  // Não remover uma versão que outra aba acabou de vincular.
  const { data: salvo, error: updateError } = await supabase.from('clientes').update({ foto_url: null })
    .eq('id', cliente.id).eq('consultor_id', user.id).eq('foto_url', cliente.foto_url).select('id').maybeSingle()
  if (updateError) return NextResponse.json({ error: 'Não foi possível remover a foto.' }, { status: 503 })
  if (!salvo) return NextResponse.json({ error: 'A foto foi alterada. Recarregue a página.' }, { status: 409 })
  const { error: removeError } = await createSupabaseAdminClient().storage.from(BUCKET_CLIENTES).remove([path])
  if (removeError) {
    logger.error('Remoção física da foto pendente', { route: ROUTE })
    return NextResponse.json({ error: 'A foto saiu do perfil, mas sua remoção do armazenamento não foi confirmada.' }, { status: 503 })
  }
  return NextResponse.json({ success: true })
}
