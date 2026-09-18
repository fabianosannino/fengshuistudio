/** Self-service data rights. Ownership always comes from the verified session. */
import { NextResponse } from 'next/server'
import { createRouteHandlerClient } from '../../../../src/lib/supabase-route'
import { createSupabaseAdminClient } from '../../../../src/lib/supabase-admin'
import { rateLimit, ipDaRequisicao } from '../../../../src/lib/rate-limit'
import { logger } from '../../../../src/lib/logger'
import { excluirEmissoesDoTitular } from '../../../../src/lib/relatorio-retencao'
import { removerArquivosDoTitular } from '../../../../src/lib/arquivos-do-titular'
import { exportarDadosDoTitular, listarDadosPaginados, listarDadosDasConsultas, LOTE_PORTABILIDADE } from '../../../../src/lib/portabilidade-titular'
import {
  MARCA_DE_ANONIMIZACAO, PALAVRA_DE_CONFIRMACAO, emailAnonimo, arquivosParaApagar, fotosDaConsulta, inventariar,
  BUCKETS_DO_TITULAR, COLUNAS_DE_IMAGEM_DA_CONSULTA, COLUNAS_DE_RELATORIO_DA_CONSULTA,
  TABELA_DE_FOTOS_DA_CONSULTA, type ResumoDaExclusao,
} from '../../../../src/lib/dados-do-titular'

const ROTA = '/api/conta/dados'
const SEM_CACHE = { 'Cache-Control': 'private, no-store' }

export async function GET(request: Request) {
  const { success } = await rateLimit(ipDaRequisicao(request), { limit: 5, windowMs: 60_000 })
  if (!success) return NextResponse.json({ error: 'Muitas requisições.' }, { status: 429, headers: { 'Retry-After': '60' } })
  const sessao = await createRouteHandlerClient()
  const { data: { user } } = await sessao.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  try {
    const admin = createSupabaseAdminClient()
    const emailVerificado = user.email_confirmed_at ? user.email ?? null : null
    if (new URL(request.url).searchParams.get('resumo') === '1') {
      return NextResponse.json(await inventariar(admin, user.id, emailVerificado), { headers: SEM_CACHE })
    }
    // Server access is needed for the owner's billing records. Every query is
    // scoped explicitly, including children through already-owned consultations.
    const dados = await exportarDadosDoTitular(admin, user.id, emailVerificado)
    logger.info('Portabilidade gerada pelo titular', { rota: ROTA })
    return NextResponse.json({
      gerado_em: new Date().toISOString(), conta: { id: user.id, email: user.email, criada_em: user.created_at }, ...dados,
    }, { headers: SEM_CACHE })
  } catch {
    logger.error('Portabilidade não concluída', { rota: ROTA })
    return NextResponse.json({ error: 'Não foi possível gerar a exportação completa. Tente novamente.' }, { status: 503, headers: SEM_CACHE })
  }
}

/** Failure stops the sequence. Keep metadata and authentication for retry. */
export async function POST(request: Request) {
  const { success } = await rateLimit(ipDaRequisicao(request), { limit: 3, windowMs: 60_000 })
  if (!success) return NextResponse.json({ error: 'Muitas requisições.' }, { status: 429, headers: { 'Retry-After': '60' } })
  const sessao = await createRouteHandlerClient()
  const { data: { user } } = await sessao.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  let corpo: unknown
  try { corpo = await request.json() } catch { return NextResponse.json({ error: 'Body inválido' }, { status: 400 }) }
  const confirmacao = corpo && typeof corpo === 'object' && 'confirmacao' in corpo ? corpo.confirmacao : null
  if (typeof confirmacao !== 'string' || confirmacao.trim().toUpperCase() !== PALAVRA_DE_CONFIRMACAO) {
    return NextResponse.json({ error: 'Confirmação inválida' }, { status: 400 })
  }
  const admin = createSupabaseAdminClient()
  const resumo: ResumoDaExclusao = { clientesApagados: 0, consultasApagadas: 0, arquivosApagados: 0, pedidosAnonimizados: 0 }
  try {
    const inicio = await admin.rpc('iniciar_exclusao_do_titular', { p_user_id: user.id })
    if (inicio.error) throw new Error('Início da exclusão indisponível')
    if (['cobranca', 'produtos', 'vinculos'].includes(inicio.data)) {
      return NextResponse.json({ error: 'Sua conta tem vínculos de cobrança, venda ou cadastro compartilhado que precisam ser encerrados com o suporte antes da exclusão. Nenhum dado foi removido. Você pode exportar seus dados normalmente.' }, { status: 409, headers: SEM_CACHE })
    }
    if (inicio.data !== 'pronto') throw new Error('Início da exclusão não confirmado')
    // Inventory every page before any removal. Missing data is an error, not []
    // and mutable URLs in owned records are never sufficient proof of file ownership.
    const [clientes, consultas] = await Promise.all([
      listarDadosPaginados(admin, 'clientes', 'consultor_id', user.id, 'id,foto_url'),
      listarDadosPaginados(admin, 'consultas', 'consultor_id', user.id,
        ['id', ...COLUNAS_DE_IMAGEM_DA_CONSULTA, ...COLUNAS_DE_RELATORIO_DA_CONSULTA].join(',')),
    ])
    const ids = consultas.map(l => String(l.id))
    const fotos = await listarDadosDasConsultas(admin, TABELA_DE_FOTOS_DA_CONSULTA, ids, 'id,url')
    const grupos = arquivosParaApagar({
      [BUCKETS_DO_TITULAR.clientes]: clientes.map(l => l.foto_url as string | null),
      [BUCKETS_DO_TITULAR.imoveis]: [...consultas.flatMap(l => fotosDaConsulta(l, COLUNAS_DE_IMAGEM_DA_CONSULTA)), ...fotos.map(l => l.url as string | null)],
      [BUCKETS_DO_TITULAR.relatorios]: consultas.flatMap(l => fotosDaConsulta(l, COLUNAS_DE_RELATORIO_DA_CONSULTA)),
    }, { userId: user.id, consultas: new Set(ids) })
    resumo.arquivosApagados += await excluirEmissoesDoTitular(admin, user.id)
    for (const grupo of grupos) {
      for (let inicio = 0; inicio < grupo.paths.length; inicio += LOTE_PORTABILIDADE) {
        const paths = grupo.paths.slice(inicio, inicio + LOTE_PORTABILIDADE)
        const { error } = await admin.storage.from(grupo.bucket).remove(paths)
        if (error) throw new Error('Remoção de arquivos não confirmada')
        resumo.arquivosApagados += paths.length
      }
    }
    // Include orphaned objects that older failed uploads never linked to a row.
    resumo.arquivosApagados += await removerArquivosDoTitular(admin, user.id, ids)
    // Delete only inventoried rows. New records must remain available for retry.
    for (const [tabela, linhas] of [['consultas', consultas], ['clientes', clientes]] as const) {
      for (let inicio = 0; inicio < linhas.length; inicio += LOTE_PORTABILIDADE) {
        const { error } = await admin.from(tabela).delete().eq('consultor_id', user.id)
          .in('id', linhas.slice(inicio, inicio + LOTE_PORTABILIDADE).map(l => String(l.id)))
        if (error) throw new Error('Remoção de registros não confirmada')
      }
    }
    resumo.clientesApagados = clientes.length
    resumo.consultasApagadas = consultas.length
    for (const tabela of ['clientes', 'consultas']) {
      const { count, error } = await admin.from(tabela).select('id', { count: 'exact', head: true }).eq('consultor_id', user.id)
      if (error || count !== 0) throw new Error('Inventário mudou durante a exclusão')
    }
    if (user.email && user.email_confirmed_at) {
      const { count, error } = await admin.from('pedidos')
        .update({ comprador_email: emailAnonimo(user.id), comprador_nome: MARCA_DE_ANONIMIZACAO }, { count: 'exact' })
        .eq('comprador_email', user.email)
      if (error || count === null) throw new Error('Anonimização não confirmada')
      resumo.pedidosAnonimizados = count
    }
    const servicos = await admin.from('servicos_do_parceiro').delete().eq('perfil_id', user.id)
    if (servicos.error) throw new Error('Remoção de serviços não confirmada')
    // perfis_publicos is a view. Hide its source; do not try to DELETE a read-only view.
    const perfil = await admin.from('profiles').update({
      nome_completo: MARCA_DE_ANONIMIZACAO, telefone: null, cidade: null, estado: null, bio: null, site: null,
      profissao: null, area_atuacao: null, registro_profissional: null, linkedin: null, instagram: null,
      nome_empresa: null, parceiro_visivel: false,
    }).eq('id', user.id)
    if (perfil.error) throw new Error('Anonimização do perfil não confirmada')
    const encerramento = await sessao.auth.signOut({ scope: 'global' })
    if (encerramento.error) throw new Error('Encerramento das sessões não confirmado')
    const auth = await admin.auth.admin.deleteUser(user.id)
    if (auth.error) throw new Error('Remoção da conta não confirmada')
    logger.info('Exclusão concluída pelo titular', { rota: ROTA, ...resumo })
    return NextResponse.json({ ok: true, resumo }, { headers: SEM_CACHE })
  } catch {
    logger.error('Exclusão não concluída; inventário restante preservado', { rota: ROTA })
    return NextResponse.json({ error: 'A exclusão não pôde ser concluída. Os dados restantes foram preservados para nova tentativa. Se há um relatório em preparação, aguarde até 30 minutos; se persistir, contate o suporte.' }, { status: 503, headers: SEM_CACHE })
  }
}
