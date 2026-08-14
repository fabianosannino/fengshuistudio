/**
 * Catálogo próprio — administração.
 *
 * GET   /api/admin/produtos — lista tudo, inclusive inativo
 * POST  /api/admin/produtos — cadastra
 * PATCH /api/admin/produtos — edita (inclui publicar/despublicar)
 *
 * ## Duas checagens, não uma
 *
 * A sessão do usuário prova quem é e o `role` é reconferido **aqui**, no
 * servidor — esconder o menu não desabilita rota. Depois disso a escrita usa
 * `service_role`, porque `produtos` tem RLS ligado e nenhuma policy: nem o
 * admin escreve com a própria sessão.
 *
 * A ordem importa. Autorizar primeiro, escalar privilégio depois, e nunca o
 * contrário.
 */

import { NextResponse } from 'next/server'
import { createRouteHandlerClient } from '../../../../src/lib/supabase-route'
import { createSupabaseAdminClient } from '../../../../src/lib/supabase-admin'
import { rateLimit, ipDaRequisicao } from '../../../../src/lib/rate-limit'
import { logger } from '../../../../src/lib/logger'
import { sanitizeString, validateUUID } from '../../../../src/lib/validation'
import { listarProdutosParaAdmin } from '../../../../src/lib/produtos-da-plataforma'

const ROUTE = '/api/admin/produtos'

const MAX_NOME = 120
const MAX_DESCRICAO = 600
/** R$ 1,00 a R$ 10.000,00 — piso do Stripe embaixo, engano de digitação em cima. */
const PRECO_MINIMO_CENTAVOS = 100
const PRECO_MAXIMO_CENTAVOS = 1_000_000

const TIPOS = ['bem_proprio_digital', 'bem_proprio_fisico'] as const

async function somenteAdmin() {
  const supabase = await createRouteHandlerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: perfil } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  return perfil?.role === 'admin' ? user : null
}

const NEGADO = NextResponse.json({ error: 'Acesso restrito' }, { status: 403 })

export async function GET(request: Request) {
  const { success } = await rateLimit(ipDaRequisicao(request), { limit: 30, windowMs: 60_000 })
  if (!success) return NextResponse.json({ error: 'Rate limit' }, { status: 429 })

  if (!await somenteAdmin()) return NEGADO

  const produtos = await listarProdutosParaAdmin(createSupabaseAdminClient(), ROUTE)
  if (!produtos) {
    return NextResponse.json({ error: 'Não foi possível carregar o catálogo.' }, { status: 503 })
  }

  return NextResponse.json({ produtos })
}

export async function POST(request: Request) {
  const { success } = await rateLimit(ipDaRequisicao(request), { limit: 20, windowMs: 60_000 })
  if (!success) return NextResponse.json({ error: 'Rate limit' }, { status: 429 })

  const admin = await somenteAdmin()
  if (!admin) return NEGADO

  let body: { nome?: string; descricao?: string; preco_centavos?: number; tipo?: string }
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }

  const nome = sanitizeString(body.nome ?? '', MAX_NOME)
  if (!nome) return NextResponse.json({ error: 'Informe o nome do produto.' }, { status: 400 })

  const preco = Math.trunc(Number(body.preco_centavos))
  if (!Number.isFinite(preco) || preco < PRECO_MINIMO_CENTAVOS || preco > PRECO_MAXIMO_CENTAVOS) {
    return NextResponse.json(
      { error: 'O preço deve ficar entre R$ 1,00 e R$ 10.000,00.' },
      { status: 400 }
    )
  }

  const tipo = (TIPOS as readonly string[]).includes(body.tipo ?? '')
    ? body.tipo!
    : 'bem_proprio_digital'

  /*
   * Nasce **inativo**, sempre.
   *
   * Digital ativo sem arquivo é recusado pelo banco (ver a constraint), e o
   * arquivo só pode ser enviado depois que a linha existe. Nascer publicado
   * faria o cadastro falhar no meio, ou — pior — passaria a valer para um
   * produto físico que ainda não tem frete nem estoque.
   */
  const { data, error } = await createSupabaseAdminClient()
    .from('produtos')
    .insert({
      tipo,
      nome,
      descricao: sanitizeString(body.descricao ?? '', MAX_DESCRICAO) || null,
      preco_centavos: preco,
      ativo: false,
    })
    .select('id')
    .single()

  if (error || !data) {
    logger.error('Não foi possível cadastrar o produto', { route: ROUTE, error: error?.message })
    return NextResponse.json({ error: 'Não foi possível cadastrar o produto.' }, { status: 503 })
  }

  logger.info('Produto do catálogo próprio cadastrado', { route: ROUTE, produtoId: data.id })
  return NextResponse.json({ id: data.id }, { status: 201 })
}

export async function PATCH(request: Request) {
  const { success } = await rateLimit(ipDaRequisicao(request), { limit: 30, windowMs: 60_000 })
  if (!success) return NextResponse.json({ error: 'Rate limit' }, { status: 429 })

  const admin = await somenteAdmin()
  if (!admin) return NEGADO

  let body: {
    id?: string; nome?: string; descricao?: string
    preco_centavos?: number; ativo?: boolean
  }
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }

  if (!body.id || !validateUUID(body.id)) {
    return NextResponse.json({ error: 'Produto inválido.' }, { status: 400 })
  }

  const campos: Record<string, unknown> = {}

  if (typeof body.nome === 'string') {
    const nome = sanitizeString(body.nome, MAX_NOME)
    if (!nome) return NextResponse.json({ error: 'Informe o nome do produto.' }, { status: 400 })
    campos.nome = nome
  }

  if (typeof body.descricao === 'string') {
    campos.descricao = sanitizeString(body.descricao, MAX_DESCRICAO) || null
  }

  if (body.preco_centavos !== undefined) {
    const preco = Math.trunc(Number(body.preco_centavos))
    if (!Number.isFinite(preco) || preco < PRECO_MINIMO_CENTAVOS || preco > PRECO_MAXIMO_CENTAVOS) {
      return NextResponse.json(
        { error: 'O preço deve ficar entre R$ 1,00 e R$ 10.000,00.' },
        { status: 400 }
      )
    }
    campos.preco_centavos = preco
  }

  if (typeof body.ativo === 'boolean') campos.ativo = body.ativo

  if (Object.keys(campos).length === 0) {
    return NextResponse.json({ error: 'Nada para alterar.' }, { status: 400 })
  }

  const { error } = await createSupabaseAdminClient()
    .from('produtos')
    .update(campos)
    .eq('id', body.id)

  if (error) {
    /*
     * A recusa mais provável aqui é a constraint: publicar um digital sem
     * arquivo. Vale explicar em vez de devolver «erro» — quem está do outro
     * lado é o admin, e a informação é acionável, não é pista para atacante.
     */
    logger.warn('Não foi possível alterar o produto', {
      route: ROUTE, produtoId: body.id, error: error.message,
    })
    const semArquivo = error.message.includes('produtos_digital_ativo_tem_arquivo')
    return NextResponse.json({
      error: semArquivo
        ? 'Envie o arquivo antes de publicar este produto.'
        : 'Não foi possível alterar o produto.',
    }, { status: semArquivo ? 400 : 503 })
  }

  return NextResponse.json({ atualizado: true })
}

/*
 * Não existe DELETE, e a ausência é deliberada.
 *
 * Um produto já vendido é a origem do arquivo que o comprador tem direito de
 * baixar — o banco recusa apagá-lo (`on delete restrict` em `pedido_itens`).
 * Tirar da vitrine é `ativo = false`, que não tira de quem comprou.
 */
