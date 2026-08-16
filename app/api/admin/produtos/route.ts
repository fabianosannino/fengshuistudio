/**
 * Catálogo próprio — administração.
 *
 * GET   /api/admin/produtos — lista tudo, inclusive inativo
 * POST  /api/admin/produtos — cadastra
 * PATCH /api/admin/produtos — edita: nome, descrição, preço, publicação e
 *                             promoção (as três colunas dela, ou nenhuma)
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
import { exigirCapacidade, respostaDaGuarda } from '../../../../src/lib/guarda-admin'
import { createSupabaseAdminClient } from '../../../../src/lib/supabase-admin'
import { rateLimit, ipDaRequisicao } from '../../../../src/lib/rate-limit'
import { logger } from '../../../../src/lib/logger'
import { sanitizeString, validateUUID } from '../../../../src/lib/validation'
import {
  listarProdutosParaAdmin, ehLinkDeIndicacaoSeguro,
} from '../../../../src/lib/produtos-da-plataforma'
import { recusaDaPromocao, MENSAGEM_DA_RECUSA } from '../../../../src/lib/promocao-do-produto'

const ROUTE = '/api/admin/produtos'

const MAX_NOME = 120
const MAX_DESCRICAO = 600
const MAX_LINK = 500
/** R$ 1,00 a R$ 10.000,00 — piso do Stripe embaixo, engano de digitação em cima. */
const PRECO_MINIMO_CENTAVOS = 100
const PRECO_MAXIMO_CENTAVOS = 1_000_000

const TIPOS = ['bem_proprio_digital', 'bem_proprio_fisico', 'bem_de_terceiro'] as const

async function somenteAdmin() {
  const supabase = await createRouteHandlerClient()
  const guarda = await exigirCapacidade(supabase, 'catalogo:escrever')
  return guarda.ok ? guarda.user : null
}

const NEGADO = NextResponse.json({ error: 'Acesso restrito' }, { status: 403 })

export async function GET(request: Request) {
  const { success } = await rateLimit(ipDaRequisicao(request), { limit: 30, windowMs: 60_000 })
  if (!success) return NextResponse.json({ error: 'Rate limit' }, { status: 429 })

  if (!await somenteAdmin()) return NEGADO

  const supabase = createSupabaseAdminClient()
  const produtos = await listarProdutosParaAdmin(supabase, ROUTE)
  if (!produtos) {
    return NextResponse.json({ error: 'Não foi possível carregar o catálogo.' }, { status: 503 })
  }

  /*
   * Cliques por produto — o número que torna a comissão da indicação cobrável.
   *
   * Contado aqui, sobre as linhas lidas, em vez de virar coluna em `produtos`:
   * um contador gravado precisaria ser incrementado a cada clique e ficaria
   * errado na primeira escrita perdida. A contagem é derivada, como o resto.
   */
  const { data: cliques, error: erroDosCliques } = await supabase
    .from('cliques_de_indicacao')
    .select('produto_id')
    .limit(10_000)

  if (erroDosCliques) {
    logger.warn('Não foi possível contar os cliques de indicação', {
      route: ROUTE, error: erroDosCliques.message,
    })
  }

  const porProduto = new Map<string, number>()
  for (const c of cliques ?? []) {
    porProduto.set(c.produto_id, (porProduto.get(c.produto_id) ?? 0) + 1)
  }

  return NextResponse.json({
    produtos: produtos.map(p => ({ ...p, cliques: porProduto.get(p.id) ?? 0 })),
  })
}

export async function POST(request: Request) {
  const { success } = await rateLimit(ipDaRequisicao(request), { limit: 20, windowMs: 60_000 })
  if (!success) return NextResponse.json({ error: 'Rate limit' }, { status: 429 })

  const admin = await somenteAdmin()
  if (!admin) return NEGADO

  let body: {
    nome?: string; descricao?: string; preco_centavos?: number; tipo?: string
    modo_de_venda?: string; link_externo?: string; parceiro?: string
  }
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
   * Indicação: o terceiro vende na loja dele e o dinheiro não passa por aqui.
   *
   * As duas checagens abaixo repetem o que o banco já garante por constraint,
   * e a repetição é deliberada: aqui elas viram mensagem para o admin, lá elas
   * são a garantia de que nenhum caminho — script, correção manual, rota nova
   * — escapa. Uma sem a outra deixa metade do problema.
   */
  const indicacao = body.modo_de_venda === 'indicacao'

  if (indicacao && tipo !== 'bem_de_terceiro') {
    return NextResponse.json(
      { error: 'Indicação só existe para produto de terceiro.' },
      { status: 400 }
    )
  }

  const link = indicacao ? sanitizeString(body.link_externo ?? '', MAX_LINK) : null

  if (indicacao && !ehLinkDeIndicacaoSeguro(link)) {
    return NextResponse.json(
      { error: 'Informe o link do parceiro começando com https://' },
      { status: 400 }
    )
  }

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
      modo_de_venda: indicacao ? 'indicacao' : 'marketplace',
      nome,
      descricao: sanitizeString(body.descricao ?? '', MAX_DESCRICAO) || null,
      preco_centavos: preco,
      link_externo: link,
      parceiro: sanitizeString(body.parceiro ?? '', MAX_NOME) || null,
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
    /** `null` explícito encerra a promoção; ausente não mexe nela. */
    promocao?: { preco_centavos: number; inicio: string; fim: string } | null
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

  let precoCheio: number | null = null

  if (body.preco_centavos !== undefined) {
    const preco = Math.trunc(Number(body.preco_centavos))
    if (!Number.isFinite(preco) || preco < PRECO_MINIMO_CENTAVOS || preco > PRECO_MAXIMO_CENTAVOS) {
      return NextResponse.json(
        { error: 'O preço deve ficar entre R$ 1,00 e R$ 10.000,00.' },
        { status: 400 }
      )
    }
    campos.preco_centavos = preco
    precoCheio = preco
  }

  if (typeof body.ativo === 'boolean') campos.ativo = body.ativo

  /*
   * A promoção é atômica: as três colunas juntas, ou as três nulas.
   *
   * `promocao: null` é encerrar — e é o botão «Encerrar promoção» da tela.
   * Encerrar antes da hora precisa existir: uma campanha é uma promessa com
   * prazo, e o prazo pode ter sido digitado errado.
   */
  if (body.promocao === null) {
    campos.promocao_preco_centavos = null
    campos.promocao_inicio = null
    campos.promocao_fim = null
  } else if (body.promocao) {
    /*
     * O preço cheio de referência é o **que vai valer depois deste PATCH**:
     * quando o mesmo pedido muda o preço e cria a promoção, comparar com o
     * valor antigo aprovaria uma promoção que não desconta o preço novo.
     *
     * Quando o PATCH não mexe no preço, o cheio vem do banco — e por isso a
     * leitura acontece antes da escrita, e não como confirmação depois.
     */
    const { data: atual, error: erroDaLeitura } = await createSupabaseAdminClient()
      .from('produtos')
      .select('preco_centavos, modo_de_venda')
      .eq('id', body.id)
      .maybeSingle()

    if (erroDaLeitura || !atual) {
      logger.warn('Não foi possível ler o produto para validar a promoção', {
        route: ROUTE, produtoId: body.id, error: erroDaLeitura?.message,
      })
      return NextResponse.json({ error: 'Produto não encontrado.' }, { status: 404 })
    }

    /*
     * Promoção só no que vendemos.
     *
     * Na indicação quem vende é o parceiro, e o preço da nossa linha é
     * referência — a vitrine já diz «a partir de». Descontar ali anunciaria um
     * desconto que não damos, num preço que não cobramos: o comprador chegaria
     * ao site do parceiro e encontraria outro número, com o nosso nome no
     * anúncio. O banco também recusa; aqui vira frase que o admin entende.
     */
    if (atual.modo_de_venda === 'indicacao') {
      return NextResponse.json(
        { error: 'Indicação não tem promoção — quem define o preço é o parceiro.' },
        { status: 400 }
      )
    }

    if (precoCheio === null) precoCheio = atual.preco_centavos as number

    const proposta = {
      precoCentavos: Math.trunc(Number(body.promocao.preco_centavos)),
      inicio: String(body.promocao.inicio ?? ''),
      fim: String(body.promocao.fim ?? ''),
    }

    const recusa = recusaDaPromocao(proposta, precoCheio, new Date())
    if (recusa) {
      return NextResponse.json({ error: MENSAGEM_DA_RECUSA[recusa] }, { status: 400 })
    }

    campos.promocao_preco_centavos = proposta.precoCentavos
    campos.promocao_inicio = new Date(proposta.inicio).toISOString()
    campos.promocao_fim = new Date(proposta.fim).toISOString()
  }

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
