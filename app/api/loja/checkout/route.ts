/**
 * POST /api/loja/checkout — compra de bem próprio da plataforma (fase 2).
 *   Body: `{ produto_id, quantidade? }`
 *
 * Rota pública: o comprador não tem conta, como no resto da loja.
 *
 * ## Por que não é a mesma rota do checkout do consultor
 *
 * Porque o vendedor é outro, e quase tudo muda com ele:
 *
 * | | consultor | plataforma |
 * |---|---|---|
 * | cobrança | direct charge na conta conectada | na nossa conta |
 * | comissão | 10% retidos por nós | não existe |
 * | catálogo | `price_id` do Stripe da conta | `produtos`, aqui |
 * | entrega | com o consultor | conosco |
 *
 * Unificar as duas num `if` daria uma rota em que metade dos parâmetros está
 * sempre inerte — que é o mesmo defeito que o modelo da loja recusa no
 * `pedidos` com um `tipo` e tudo anulável (seção 1).
 *
 * ## O preço
 *
 * Não vem do cliente, e aqui também não vem do Stripe. No catálogo do
 * consultor, buscar o `price_id` na conta conectada prova de uma vez que o
 * preço é real e que pertence àquela conta. No nosso catálogo o dono do dado é
 * este banco: o valor sai de `produtos`, e o corpo da requisição só escolhe
 * **qual** produto.
 */

import { NextResponse } from 'next/server'
import stripeClient from '../../../../src/lib/stripe'
import { logger } from '../../../../src/lib/logger'
import { rateLimit, ipDaRequisicao } from '../../../../src/lib/rate-limit'
import { origemDaAplicacao } from '../../../../src/lib/auth-rotas'
import { validateUUID } from '../../../../src/lib/validation'
import { createSupabaseAdminClient } from '../../../../src/lib/supabase-admin'
import { criarPedidoIniciado, anotarSessaoDoPedido } from '../../../../src/lib/pedidos-da-loja'
import { produtoParaVenda, ehDigital } from '../../../../src/lib/produtos-da-plataforma'

const ROUTE = '/api/loja/checkout'

const MAX_QUANTIDADE = 20

/** Digital não tem por que ser comprado em lote: o mesmo arquivo, n vezes. */
const QUANTIDADE_DE_DIGITAL = 1

export async function POST(request: Request) {
  const { success } = await rateLimit(ipDaRequisicao(request), { limit: 15, windowMs: 60_000 })
  if (!success) {
    return NextResponse.json(
      { error: 'Muitas requisições. Tente novamente em alguns instantes.' },
      { status: 429, headers: { 'Retry-After': '60' } }
    )
  }

  let body: { produto_id?: string; quantidade?: number }
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }

  if (!body.produto_id || !validateUUID(body.produto_id)) {
    return NextResponse.json({ error: 'Produto inválido.' }, { status: 400 })
  }

  const supabase = createSupabaseAdminClient()
  const produto = await produtoParaVenda(supabase, body.produto_id, ROUTE)

  // Inexistente e inativo respondem igual: distinguir contaria a quem sonda
  // quais ids existem. Mesma escolha do 404 idêntico no pedido por token.
  if (!produto) {
    return NextResponse.json({ error: 'Produto indisponível para compra.' }, { status: 404 })
  }

  /*
   * A fase 2 vende **só digital**.
   *
   * O físico está no schema porque as fases seguintes vão usá-lo, e recusar
   * aqui é o que impede que um produto físico cadastrado cedo demais seja
   * comprado sem que exista frete, endereço, estoque ou nota fiscal. O banco
   * aceitaria a linha; esta rota é onde a fase termina.
   */
  if (!ehDigital(produto.tipo)) {
    logger.warn('Tentativa de comprar produto não-digital no checkout da fase 2', {
      route: ROUTE, produtoId: produto.id, tipo: produto.tipo,
    })
    return NextResponse.json({ error: 'Produto indisponível para compra.' }, { status: 404 })
  }

  const quantidade = ehDigital(produto.tipo)
    ? QUANTIDADE_DE_DIGITAL
    : Math.min(Math.max(1, Math.trunc(body.quantidade ?? 1)), MAX_QUANTIDADE)

  const total = produto.preco_centavos * quantidade
  const origin = origemDaAplicacao(request)

  try {
    /*
     * O pedido nasce antes do redirecionamento, e o checkout **falha** se não
     * der para gravá-lo — a mesma regra da venda do consultor, pela mesma
     * razão: sem pedido, o webhook não tem onde escrever, e a venda voltaria a
     * acontecer sem registro deste lado.
     *
     * `taxaPlataformaCentavos: 0` não é «não sei»: numa venda nossa não existe
     * comissão a reter de ninguém. O razão do pedido vai mostrar produto e
     * tarifa do gateway, e nenhuma linha de comissão — porque não houve.
     */
    const pedido = await criarPedidoIniciado(supabase, {
      tipo: produto.tipo,
      vendedorTipo: 'plataforma',
      vendedorPerfilId: null,
      stripeAccountId: null,
      totalCentavos: total,
      taxaPlataformaCentavos: 0,
      item: {
        nome: produto.nome,
        descricao: produto.descricao,
        precoUnitarioCentavos: produto.preco_centavos,
        quantidade,
        produtoId: produto.id,
      },
    }, ROUTE)

    if (!pedido) {
      return NextResponse.json(
        { error: 'Não foi possível iniciar a compra. Tente novamente.' },
        { status: 503 }
      )
    }

    /*
     * `price_data` em vez de `price`: o catálogo é nosso, e espelhar cada
     * produto como um `price` no Stripe criaria uma segunda cópia do preço que
     * envelheceria em silêncio. O valor cobrado é o que está no banco no
     * instante do clique, e o item do pedido guarda a fotografia dele.
     *
     * Sem `stripeAccount`: a cobrança acontece na conta da plataforma. É a
     * diferença que faz esta venda ser nossa.
     *
     * E sem `payment_method_types`: na nossa conta o Stripe usa o que está
     * habilitado no painel. Declarar a lista aqui faria ativar o Pix exigir um
     * deploy — ver a nota em `metodos-de-pagamento.ts` sobre por que na conta
     * conectada a lista **precisa** ser consultada.
     */
    const session = await stripeClient.checkout.sessions.create({
      mode: 'payment',
      line_items: [{
        quantity: quantidade,
        price_data: {
          currency: 'brl',
          unit_amount: produto.preco_centavos,
          product_data: {
            name: produto.nome,
            ...(produto.descricao ? { description: produto.descricao } : {}),
          },
        },
      }],
      metadata: { pedido_id: pedido.id },
      success_url: `${origin}/pedido/${pedido.tokenPublico}`,
      cancel_url: `${origin}/produtos`,
    })

    await anotarSessaoDoPedido(supabase, pedido.id, session.id, ROUTE)

    logger.info('Checkout de bem próprio iniciado', {
      route: ROUTE, pedidoId: pedido.id, produtoId: produto.id,
    })

    return NextResponse.json({ url: session.url })
  } catch (err) {
    logger.error('Falha ao criar a sessão de checkout do bem próprio', {
      route: ROUTE, produtoId: produto.id, error: String(err),
    })
    return NextResponse.json({ error: 'Erro ao criar sessão de pagamento.' }, { status: 500 })
  }
}
