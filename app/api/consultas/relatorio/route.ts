import { NextResponse } from 'next/server'
import { createRouteHandlerClient } from '../../../../src/lib/supabase-route'
import { createSupabaseAdminClient } from '../../../../src/lib/supabase-admin'
import { rateLimit, ipDaRequisicao } from '../../../../src/lib/rate-limit'
import { logger } from '../../../../src/lib/logger'
import { BUCKET_RELATORIO, idValido, MAX_PDF_RELATORIO, pdfTemAssinatura, PRAZO_PREPARACAO_MS, TABELA_EMISSOES } from '../../../../src/lib/relatorio-emissao'
import { listarHistoricoRelatorio } from '../../../../src/lib/relatorio-retencao'
import { sha256 } from '../../../../src/lib/relatorio-fonte'

const ROUTE = '/api/consultas/relatorio'
export const maxDuration = 60
const SIGNED_URL_TTL = 60
function indisponivel() {
  return NextResponse.json({ error: 'Não foi possível acessar o relatório. Tente novamente.' }, { status: 503 })
}

/** Confirma uma emissão preparada; nunca escreve no caminho legado ou usa upsert. */
export async function POST(request: Request) {
  const { success, indisponivel: limiteIndisponivel } = await rateLimit(ipDaRequisicao(request), { limit: 20, windowMs: 60_000, escopo: 'POST:/api/consultas/relatorio', exigirCompartilhado: true })
  if (limiteIndisponivel) return Response.json({ error: 'Proteção temporariamente indisponível. Tente novamente em instantes.' }, { status: 503, headers: { 'Retry-After': '30' } })
  if (!success) return NextResponse.json({ error: 'Muitas requisições.' }, { status: 429, headers: { 'Retry-After': '60' } })
  const client = await createRouteHandlerClient()
  const { data: { user } } = await client.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  let form: FormData
  try { form = await request.formData() } catch { return NextResponse.json({ error: 'Envio inválido' }, { status: 400 }) }
  const file = form.get('pdf')
  const id = form.get('emissao_id')
  const consultaId = form.get('consulta_id')
  if (!idValido(id) || !idValido(consultaId)) return NextResponse.json({ error: 'Recarregue a página e prepare uma nova emissão.' }, { status: 400 })
  if (!(file instanceof File) || file.type !== 'application/pdf' || file.size > MAX_PDF_RELATORIO) {
    return NextResponse.json({ error: 'Envie um PDF de até 4 MB.' }, { status: 400 })
  }
  try {
    const { data: emissao, error } = await client.from(TABELA_EMISSOES).select('id,estado,criado_em,pdf_path,pdf_sha256,pdf_bytes,concluido_em').eq('id', id).eq('consulta_id', consultaId).eq('consultor_id', user.id).maybeSingle()
    if (error) return indisponivel()
    if (!emissao) return NextResponse.json({ error: 'Emissão não encontrada' }, { status: 404 })
    const bytes = new Uint8Array(await file.arrayBuffer())
    if (!pdfTemAssinatura(bytes)) return NextResponse.json({ error: 'O arquivo não possui estrutura básica de PDF válida.' }, { status: 400 })
    const hash = sha256(bytes)
    if (emissao.estado !== 'preparada') {
      if (emissao.estado === 'concluida' && emissao.pdf_sha256 === hash && emissao.pdf_bytes === bytes.length) {
        return NextResponse.json({ ok: true, emissao_id: id, gerado_em: emissao.concluido_em })
      }
      return NextResponse.json({ error: 'Esta emissão já foi encerrada. Gere uma revisão.' }, { status: 409 })
    }
    if (Date.now() - new Date(emissao.criado_em).getTime() > PRAZO_PREPARACAO_MS) {
      return NextResponse.json({ error: 'A preparação expirou. Recarregue a página e gere uma nova emissão.' }, { status: 409 })
    }
    const admin = createSupabaseAdminClient()
    const bucket = admin.storage.from(BUCKET_RELATORIO)
    const upload = await bucket.upload(emissao.pdf_path, bytes, { contentType: 'application/pdf', upsert: false })
    if (upload.error) {
      // A confirmação pode ter falhado depois de o upload ter sido aceito.
      // Só retomar se os bytes já presentes forem exatamente os mesmos.
      const existente = await bucket.download(emissao.pdf_path)
      if (existente.error || !existente.data) return indisponivel()
      if (sha256(new Uint8Array(await existente.data.arrayBuffer())) !== hash) {
        return NextResponse.json({ error: 'Já existe outro arquivo nesta emissão. Gere uma revisão.' }, { status: 409 })
      }
    }
    const finalizada = await admin.rpc('concluir_emissao_relatorio', { p_id: id, p_consultor: user.id, p_sha256: hash, p_bytes: bytes.length })
    if (finalizada.error || !finalizada.data) {
      // Não remover o objeto: um timeout pode ter ocorrido APÓS o commit.
      // O caminho pertence à emissão preparada e uma repetição é idempotente.
      logger.error('Confirmação de emissão pendente', { route: ROUTE, emissaoId: id })
      return indisponivel()
    }
    return NextResponse.json({ ok: true, emissao_id: id, gerado_em: finalizada.data })
  } catch {
    logger.error('Falha na persistência de emissão', { route: ROUTE })
    return indisponivel()
  }
}

/** Histórico ou download de uma emissão específica. Preparações não são PDFs salvos. */
export async function GET(request: Request) {
  const client = await createRouteHandlerClient()
  const { data: { user } } = await client.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const params = new URL(request.url).searchParams
  const consultaId = params.get('consulta_id')
  const emissaoId = params.get('emissao_id')
  if (!idValido(consultaId) || (emissaoId !== null && !idValido(emissaoId))) return NextResponse.json({ error: 'Identificador inválido' }, { status: 400 })
  try {
    const consulta = await client.from('consultas').select('id').eq('id', consultaId).eq('consultor_id', user.id).maybeSingle()
    if (consulta.error) return indisponivel()
    if (!consulta.data) return NextResponse.json({ error: 'Consulta não encontrada' }, { status: 404 })
    if (params.get('historico') === '1') {
      const historico = await listarHistoricoRelatorio(client, user.id, consultaId)
      return NextResponse.json({ emissoes: historico }, { headers: { 'Cache-Control': 'no-store' } })
    }
    let query = client.from(TABELA_EMISSOES).select('id,pdf_path,pdf_sha256,concluido_em,estado').eq('consulta_id', consultaId).eq('consultor_id', user.id)
      .in('estado', ['concluida', 'legado'])
    if (emissaoId) query = query.eq('id', emissaoId)
    const { data: emissao, error } = await query.order('criado_em', { ascending: false }).order('id').limit(1).maybeSingle()
    if (error) return indisponivel()
    if (!emissao) return NextResponse.json(emissaoId ? { error: 'Emissão não encontrada' } : { url: null, gerado_em: null }, { status: emissaoId ? 404 : 200 })
    const bucket = createSupabaseAdminClient().storage.from(BUCKET_RELATORIO)
    const arquivo = await bucket.download(emissao.pdf_path)
    if (arquivo.error || !arquivo.data) return indisponivel()
    if (emissao.pdf_sha256 && sha256(new Uint8Array(await arquivo.data.arrayBuffer())) !== emissao.pdf_sha256) {
      logger.error('Integridade do PDF divergente', { route: ROUTE, emissaoId: emissao.id })
      return indisponivel()
    }
    const { data: signed, error: signingError } = await bucket.createSignedUrl(emissao.pdf_path, SIGNED_URL_TTL)
    if (signingError || !signed) return indisponivel()
    return NextResponse.json({ url: signed.signedUrl, gerado_em: emissao.concluido_em, emissao_id: emissao.id, legado: emissao.estado === 'legado' }, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    logger.error('Falha na leitura de emissão', { route: ROUTE })
    return indisponivel()
  }
}
