import { NextResponse } from 'next/server'
import { createRouteHandlerClient } from '../../../../../src/lib/supabase-route'
import { createSupabaseAdminClient } from '../../../../../src/lib/supabase-admin'
import { carregarFonteRelatorio, sha256 } from '../../../../../src/lib/relatorio-fonte'
import { criarEntradaRelatorio, hashValido, idValido, jsonCanonico, objeto, referenciaValida, TABELA_EMISSOES, validarEdicao, VERSOES_RELATORIO } from '../../../../../src/lib/relatorio-emissao'
import { rateLimit, ipDaRequisicao } from '../../../../../src/lib/rate-limit'
import { logger } from '../../../../../src/lib/logger'
import { impedimentoDaAnalise } from '../../../../../src/lib/analise-bagua'

export async function POST(request: Request) {
  const { success } = await rateLimit(ipDaRequisicao(request), { limit: 20, windowMs: 60_000 })
  if (!success) return NextResponse.json({ error: 'Muitas requisições.' }, { status: 429, headers: { 'Retry-After': '60' } })
  const client = await createRouteHandlerClient()
  const { data: { user } } = await client.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  let body: unknown
  try {
    const text = await request.text()
    if (text.length > 100_000) throw new Error('Corpo excessivo')
    body = JSON.parse(text)
  } catch { return NextResponse.json({ error: 'Solicitação inválida' }, { status: 400 }) }
  if (!objeto(body) || !idValido(body.consulta_id) || !idValido(body.id) || !hashValido(body.fonte_sha256)
    || !referenciaValida(body.referencia_temporal, body.fuso, new Date())) {
    return NextResponse.json({ error: 'Recarregue o relatório antes de emitir.' }, { status: 400 })
  }
  const versoes = body.versoes
  if (!objeto(versoes) || Object.entries(VERSOES_RELATORIO).some(([chave, valor]) => versoes[chave] !== valor)) {
    return NextResponse.json({ error: 'O relatório foi atualizado. Recarregue a página antes de emitir.' }, { status: 409 })
  }
  try {
    const fonte = await carregarFonteRelatorio(client, body.consulta_id, user.id)
    if (!fonte) return NextResponse.json({ error: 'Consulta não encontrada' }, { status: 404 })
    if (sha256(jsonCanonico(fonte)) !== body.fonte_sha256) {
      return NextResponse.json({ error: 'Os dados mudaram. Recarregue o relatório e confira a nova prévia.' }, { status: 409 })
    }
    const edicao = validarEdicao(body.edicao, fonte.setores.map(s => s.id))
    if (!edicao) return NextResponse.json({ error: 'Seções ou textos inválidos' }, { status: 400 })
    const impedimento = impedimentoDaAnalise(fonte.consulta.bagua_entrada, edicao.secoes)
    if (impedimento) return NextResponse.json({ error: impedimento }, { status: 409 })
    const entrada = criarEntradaRelatorio(fonte, edicao, body.referencia_temporal as string, body.fuso as string)
    const entradaHash = sha256(jsonCanonico(entrada))
    // Só criar o cliente privilegiado depois da consulta sob RLS e ownership.
    const admin = createSupabaseAdminClient()
    const existente = await admin.from(TABELA_EMISSOES).select('id,consulta_id,consultor_id,entrada_sha256,estado,revisao_de').eq('id', body.id).maybeSingle()
    if (existente.error) throw new Error('Falha ao conferir repetição')
    if (existente.data) {
      if (existente.data.consultor_id !== user.id || existente.data.consulta_id !== body.consulta_id || existente.data.entrada_sha256 !== entradaHash) {
        return NextResponse.json({ error: 'Identificador de emissão já utilizado.' }, { status: 409 })
      }
      return NextResponse.json({ emissao: existente.data, entrada })
    }
    const anterior = await admin.from(TABELA_EMISSOES).select('id').eq('consulta_id', body.consulta_id).eq('consultor_id', user.id)
      .in('estado', ['concluida', 'legado']).order('criado_em', { ascending: false }).order('id').limit(1).maybeSingle()
    if (anterior.error) throw new Error('Falha ao ler revisão anterior')
    const row = {
      id: body.id, consulta_id: body.consulta_id, consultor_id: user.id, estado: 'preparada', revisao_de: anterior.data?.id ?? null,
      entrada, entrada_sha256: entradaHash, versao_entrada: VERSOES_RELATORIO.entrada,
      versao_motor: VERSOES_RELATORIO.motor, versao_template: VERSOES_RELATORIO.template,
      pdf_path: `${body.consulta_id}/emissoes/${body.id}.pdf`,
    }
    const { error } = await admin.from(TABELA_EMISSOES).insert(row)
    if (error) {
      if (error.code === '23505') return NextResponse.json({ error: 'Emissão concorrente. Tente novamente.' }, { status: 409 })
      throw new Error('Falha ao registrar preparação')
    }
    return NextResponse.json({ emissao: { id: row.id, revisao_de: row.revisao_de }, entrada }, { status: 201 })
  } catch {
    logger.error('Falha ao preparar emissão', { route: '/api/consultas/relatorio/preparar' })
    return NextResponse.json({ error: 'Não foi possível preparar o relatório.' }, { status: 503 })
  }
}
