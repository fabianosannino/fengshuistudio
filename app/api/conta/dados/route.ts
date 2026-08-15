/**
 * GET  /api/conta/dados — o pacote de portabilidade do titular.
 * POST /api/conta/dados — a exclusão da própria conta.
 *
 * ## Por que as duas na mesma rota
 *
 * Porque o sujeito é o mesmo e a prova é a mesma: a sessão. Separar em duas
 * rotas duplicaria a única linha que importa aqui — a que diz de quem são os
 * dados — e daria dois lugares para alguém, um dia, aceitar um id do corpo.
 *
 * ## A regra que não tem exceção
 *
 * `user.id` vem de `supabase.auth.getUser()`, **nunca** do corpo. Aceitar um id
 * de fora transformaria o `POST` numa forma de apagar a conta de terceiros e o
 * `GET` num vazamento com formulário. É o mesmo princípio já escrito no
 * `CLAUDE.md` para `account_id`.
 *
 * ## Por que a escrita usa `service_role`
 *
 * Porque a exclusão precisa alcançar o que o RLS do próprio usuário não
 * alcança: anonimizar `pedidos` em que ele foi **vendedor** (a policy deixa ler,
 * não reescrever) e remover objetos do storage. Fazer isso com a sessão dele
 * exigiria afrouxar policies para todo mundo, o tempo todo, por causa de uma
 * operação rara.
 *
 * O id continua vindo da sessão — o `service_role` amplia o que a rota pode
 * fazer, não de quem ela fala.
 */

import { NextResponse } from 'next/server'
import { createRouteHandlerClient } from '../../../../src/lib/supabase-route'
import { createSupabaseAdminClient } from '../../../../src/lib/supabase-admin'
import { rateLimit, ipDaRequisicao } from '../../../../src/lib/rate-limit'
import { logger } from '../../../../src/lib/logger'
import { escreverBestEffort } from '../../../../src/lib/supabase-escrita'
import {
  MARCA_DE_ANONIMIZACAO, PALAVRA_DE_CONFIRMACAO, emailAnonimo,
  fotosParaApagar, fotosDaConsulta, inventariar,
  COLUNAS_DE_FOTO_DA_CONSULTA, type ResumoDaExclusao,
} from '../../../../src/lib/dados-do-titular'

const ROTA = '/api/conta/dados'

/** GET — o pacote de portabilidade. */
export async function GET(request: Request) {
  const { success } = await rateLimit(ipDaRequisicao(request), { limit: 5, windowMs: 60_000 })
  if (!success) {
    return NextResponse.json({ error: 'Muitas requisições.' }, { status: 429, headers: { 'Retry-After': '60' } })
  }

  const supabase = await createRouteHandlerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  // Cada consulta usa a sessão do titular: o RLS é a garantia de que ele só
  // leva o que é dele, e não uma condição `eq()` que alguém pode esquecer.
  const [perfil, clientes, consultas, assinaturas, faturas, concessoes, comprasDele] =
    await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
      supabase.from('clientes').select('*').eq('consultor_id', user.id),
      supabase.from('consultas').select('*').eq('consultor_id', user.id),
      supabase.from('subscriptions').select('*').eq('user_id', user.id),
      supabase.from('invoices').select('*').eq('user_id', user.id),
      supabase.from('concessoes_de_plano').select('*').eq('user_id', user.id),
      user.email
        ? supabase.from('pedidos').select('*').eq('comprador_email', user.email)
        : Promise.resolve({ data: [] }),
    ])

  logger.info('Portabilidade solicitada pelo titular', { rota: ROTA })

  return NextResponse.json({
    gerado_em: new Date().toISOString(),
    conta: { id: user.id, email: user.email, criada_em: user.created_at },
    perfil: perfil.data ?? null,
    // Os clientes do consultor vão junto: são a base de trabalho dele, e
    // portabilidade sem eles entregaria metade do que ele construiu aqui.
    clientes: clientes.data ?? [],
    consultas: consultas.data ?? [],
    assinaturas: assinaturas.data ?? [],
    faturas: faturas.data ?? [],
    concessoes_de_plano: concessoes.data ?? [],
    compras: comprasDele.data ?? [],
  })
}

/** POST — a exclusão. Exige a palavra de confirmação no corpo. */
export async function POST(request: Request) {
  const { success } = await rateLimit(ipDaRequisicao(request), { limit: 3, windowMs: 60_000 })
  if (!success) {
    return NextResponse.json({ error: 'Muitas requisições.' }, { status: 429, headers: { 'Retry-After': '60' } })
  }

  const supabase = await createRouteHandlerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  let corpo: { confirmacao?: string }
  try { corpo = await request.json() } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }
  if ((corpo.confirmacao ?? '').trim().toUpperCase() !== PALAVRA_DE_CONFIRMACAO) {
    return NextResponse.json({ error: 'Confirmação inválida' }, { status: 400 })
  }

  const admin = createSupabaseAdminClient()
  const resumo: ResumoDaExclusao = {
    clientesApagados: 0, consultasApagadas: 0, fotosApagadas: 0, pedidosAnonimizados: 0,
  }

  // ── 1. As fotos, antes das linhas ─────────────────────────────────────
  // Nesta ordem de propósito: apagar as linhas primeiro perderia os caminhos,
  // e os objetos ficariam órfãos no bucket — visíveis para quem tivesse o link,
  // sem nada no banco que dissesse que existem.
  const [fotosDeClientes, fotosDeImoveis] = await Promise.all([
    admin.from('clientes').select('foto_url').eq('consultor_id', user.id),
    admin.from('consultas')
      .select(COLUNAS_DE_FOTO_DA_CONSULTA.join(','))
      .eq('consultor_id', user.id),
  ])

  const valoresDeImoveis = (fotosDeImoveis.data ?? []).flatMap((linha) =>
    fotosDaConsulta(linha as unknown as Record<string, unknown>)
  )

  for (const grupo of fotosParaApagar(
    (fotosDeClientes.data ?? []).map((l) => (l as { foto_url?: string }).foto_url),
    valoresDeImoveis
  )) {
    const { error } = await admin.storage.from(grupo.bucket).remove(grupo.paths)
    if (error) {
      // Best-effort declarado (ADR 0020): a exclusão do banco segue, e a lacuna
      // fica no log em vez de virar um 500 que deixa a conta intacta. Objeto
      // que sobrou é achável pelo log; conta não excluída não é achável.
      logger.error('Falha ao remover fotos do titular', { rota: ROTA, bucket: grupo.bucket, erro: error.message })
    } else {
      resumo.fotosApagadas += grupo.paths.length
    }
  }

  // ── 2. O que é de terceiro sai por completo ───────────────────────────
  // `clientes` e `consultas` guardam dados de gente que nunca abriu conta aqui.
  // O único fundamento para mantê-los era o contrato com quem está saindo.
  const inventario = await inventariar(admin, user.id, user.email ?? null)
  resumo.clientesApagados = inventario.clientes
  resumo.consultasApagadas = inventario.consultas

  await escreverBestEffort(
    admin.from('consultas').delete().eq('consultor_id', user.id),
    { operacao: 'excluir consultas do titular', rota: ROTA }
  )
  await escreverBestEffort(
    admin.from('clientes').delete().eq('consultor_id', user.id),
    { operacao: 'excluir clientes do titular', rota: ROTA }
  )

  // ── 3. O pedido fica; a identidade sai ────────────────────────────────
  // Registro fiscal, e a plataforma reteve comissão: os valores e a referência
  // do Stripe seguram o razão de pé. Some quem a pessoa era.
  if (user.email) {
    await escreverBestEffort(
      admin.from('pedidos')
        .update({ comprador_email: emailAnonimo(user.id), comprador_nome: MARCA_DE_ANONIMIZACAO })
        .eq('comprador_email', user.email),
      { operacao: 'anonimizar compras do titular', rota: ROTA }
    )
    resumo.pedidosAnonimizados = inventario.pedidosComoComprador
  }

  // ── 4. A vitrine pública some ─────────────────────────────────────────
  // `perfis_publicos` é projeção deliberada (ADR 0028). Deixá-la manteria nome,
  // cidade e foto de alguém que pediu para sair, na parte mais visível do site.
  await escreverBestEffort(
    admin.from('perfis_publicos').delete().eq('id', user.id),
    { operacao: 'remover projeção pública do titular', rota: ROTA }
  )
  await escreverBestEffort(
    admin.from('servicos_do_parceiro').delete().eq('perfil_id', user.id),
    { operacao: 'remover serviços do parceiro', rota: ROTA }
  )

  // ── 5. A conta ────────────────────────────────────────────────────────
  // O perfil é anonimizado em vez de removido: `pedidos` referencia
  // `vendedor_perfil_id`, e apagar a linha derrubaria o registro fiscal junto.
  await escreverBestEffort(
    admin.from('profiles').update({
      nome_completo: MARCA_DE_ANONIMIZACAO,
      telefone: null, cidade: null, estado: null, bio: null, site: null,
      profissao: null, area_atuacao: null, registro_profissional: null,
      linkedin: null, instagram: null, nome_empresa: null,
      parceiro_visivel: false,
    }).eq('id', user.id),
    { operacao: 'anonimizar perfil do titular', rota: ROTA }
  )

  // O usuário do Auth some por último: enquanto ele existir, a sessão ainda
  // vale, e uma falha antes daqui deixa a conta alcançável para tentar de novo.
  const { error: erroDoAuth } = await admin.auth.admin.deleteUser(user.id)
  if (erroDoAuth) {
    logger.error('Falha ao remover usuário do Auth', { rota: ROTA, erro: erroDoAuth.message })
    return NextResponse.json(
      { error: 'A exclusão começou mas não pôde ser concluída. Fale com o suporte.' },
      { status: 500 }
    )
  }

  logger.info('Conta excluída a pedido do titular', { rota: ROTA, ...resumo })
  return NextResponse.json({ ok: true, resumo })
}
