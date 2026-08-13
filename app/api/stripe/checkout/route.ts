/**
 * Stripe Checkout API — Direct Charges
 *
 * POST /api/stripe/checkout — Create a checkout session for purchasing a product
 *   Body: { account_id, price_id, quantity?, success_url?, cancel_url? }
 *
 * Rota pública (compradores da loja não são usuários da plataforma).
 * O preço NUNCA vem do cliente: apenas um price_id existente na conta
 * conectada é aceito, e o valor é lido do Stripe no servidor.
 *
 * This uses Direct Charges with an application fee:
 * - The payment is created directly on the connected account
 * - The connected account is the merchant of record
 * - The platform collects an application_fee_amount on each transaction
 */

import { NextResponse } from 'next/server'
import type Stripe from 'stripe'
import stripeClient from '../../../../src/lib/stripe'
import { logger } from '../../../../src/lib/logger'
import { rateLimit, ipDaRequisicao } from '../../../../src/lib/rate-limit'
import { origemDaAplicacao, ehCaminhoRelativoSeguro } from '../../../../src/lib/auth-rotas'
import { createSupabaseAdminClient } from '../../../../src/lib/supabase-admin'
import { criarPedidoIniciado, anotarSessaoDoPedido } from '../../../../src/lib/pedidos-da-loja'

// Percentual que a plataforma retém em cada venda (direct charge).
const APPLICATION_FEE_PERCENT = 10
const MAX_QUANTITY = 100

/**
 * Nome do produto para fotografar no item do pedido.
 *
 * `price.product` só é objeto quando expandido, e pode vir como produto
 * apagado — que não tem `name`. Cai para o apelido do preço e, por último,
 * para um rótulo genérico: um recibo com nome fraco é melhor do que um
 * checkout que quebra por causa do rótulo.
 */
function nomeDoProduto(price: Stripe.Price): string {
  const produto = price.product
  if (produto && typeof produto === 'object' && 'name' in produto && produto.name) {
    return produto.name
  }
  return price.nickname ?? 'Produto'
}

export async function POST(request: Request) {
  const ip = ipDaRequisicao(request)
  const { success } = await rateLimit(ip, { limit: 15, windowMs: 60_000 })
  if (!success) {
    return NextResponse.json(
      { error: 'Muitas requisições. Tente novamente em alguns instantes.' },
      { status: 429, headers: { 'Retry-After': '60' } }
    )
  }

  let body: {
    account_id?: string
    price_id?: string
    quantity?: number
    success_url?: string
    cancel_url?: string
  }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Body inválido' }, { status: 400 }) }

  const accountId = body.account_id
  if (!accountId || !accountId.startsWith('acct_')) {
    return NextResponse.json({ error: 'account_id é obrigatório' }, { status: 400 })
  }

  const priceId = body.price_id
  if (!priceId || !priceId.startsWith('price_')) {
    return NextResponse.json({ error: 'price_id é obrigatório' }, { status: 400 })
  }

  const quantity = Number.isInteger(body.quantity) && body.quantity! > 0 && body.quantity! <= MAX_QUANTITY
    ? body.quantity!
    : 1

  const origin = origemDaAplicacao(request)

  /**
   * O destino pós-pagamento vinha do body sem checagem.
   *
   * Esta rota é **pública** — compradores anônimos —, então qualquer um podia
   * montar um link de loja cujo `success_url` apontasse para fora. O comprador
   * pagava de verdade, na conta certa, e caía num site escolhido pelo
   * atacante, já convencido de que estava no meio de uma compra legítima. É o
   * momento perfeito para pedir «confirme seus dados».
   *
   * Só caminho relativo à própria aplicação, pelo mesmo `ehCaminhoRelativoSeguro`
   * que o login usa: `//evil.com` e `https://evil.com` são recusados.
   */
  const destino = (doCliente: string | undefined, padrao: string): string => {
    if (doCliente && ehCaminhoRelativoSeguro(doCliente)) return `${origin}${doCliente}`
    if (doCliente) {
      logger.warn('URL de retorno recusada no checkout da loja', {
        route: '/api/stripe/checkout', recebido: doCliente,
      })
    }
    return `${origin}${padrao}`
  }

  try {
    // O preço é lido da conta conectada — buscar o price_id lá garante,
    // ao mesmo tempo, que ele pertence àquela conta e qual é o valor real.
    // `product` vem expandido porque o nome é fotografado no item do pedido, e
    // sem expandir viria só o `prod_...` — um recibo ilegível para o comprador.
    const price = await stripeClient.prices.retrieve(
      priceId, { expand: ['product'] }, { stripeAccount: accountId }
    )

    if (!price.active || price.unit_amount == null) {
      return NextResponse.json({ error: 'Produto indisponível para compra.' }, { status: 400 })
    }

    const applicationFee = Math.round(price.unit_amount * quantity * APPLICATION_FEE_PERCENT / 100)
    const total = price.unit_amount * quantity

    const supabase = createSupabaseAdminClient()

    /*
     * O vendedor precisa ser um perfil conhecido.
     *
     * `stripeAccount` já limita a contas conectadas à plataforma, mas uma conta
     * conectada sem perfil aqui é uma venda que ninguém consegue ver depois —
     * não há a quem mostrar em «Vendas Recentes», nem de quem cobrar a entrega.
     * Recusar é melhor do que registrar um pedido órfão.
     */
    const { data: vendedor, error: erroDoVendedor } = await supabase
      .from('profiles')
      .select('id')
      .eq('stripe_account_id', accountId)
      .maybeSingle()

    if (erroDoVendedor || !vendedor) {
      logger.error('Checkout da loja para conta sem perfil correspondente', {
        route: '/api/stripe/checkout', accountId, error: erroDoVendedor?.message,
      })
      return NextResponse.json({ error: 'Loja indisponível para compra.' }, { status: 400 })
    }

    /*
     * O pedido nasce **antes** do redirecionamento, para o webhook ter onde
     * escrever — ver `src/lib/pedidos-da-loja.ts`.
     *
     * E se não der para gravar, o checkout **falha**. É deliberado: esta rota
     * existe hoje porque a venda acontecia sem deixar registro, e seguir com a
     * cobrança sabendo que o registro falhou seria reintroduzir exatamente o
     * defeito. Quando a fase 1 trouxer reconciliação da loja — que recupera a
     * venda a partir do Stripe —, isto pode virar best-effort. Sem ela, não.
     */
    const pedidoId = await criarPedidoIniciado(supabase, {
      tipo: 'servico',
      vendedorTipo: 'consultor',
      vendedorPerfilId: vendedor.id,
      stripeAccountId: accountId,
      totalCentavos: total,
      taxaPlataformaCentavos: applicationFee,
      item: {
        nome: nomeDoProduto(price),
        precoUnitarioCentavos: price.unit_amount,
        quantidade: quantity,
        stripePriceId: priceId,
      },
    }, '/api/stripe/checkout')

    if (!pedidoId) {
      return NextResponse.json(
        { error: 'Não foi possível iniciar a compra. Tente novamente.' },
        { status: 503 }
      )
    }

    const session = await stripeClient.checkout.sessions.create({
      line_items: [{ price: priceId, quantity }],
      payment_intent_data: {
        application_fee_amount: applicationFee,
      },
      // O caminho principal para o webhook achar o pedido. Vai aqui porque é
      // gravado junto com a sessão; o `session_id` depende de um update depois.
      metadata: { pedido_id: pedidoId },
      mode: 'payment',
      success_url: destino(body.success_url, '/stripe/success?session_id={CHECKOUT_SESSION_ID}'),
      cancel_url: destino(body.cancel_url, `/store/${accountId}`),
    }, {
      stripeAccount: accountId, // Direct charge on the connected account
    })

    await anotarSessaoDoPedido(supabase, pedidoId, session.id, '/api/stripe/checkout')

    return NextResponse.json({ url: session.url, session_id: session.id })
  } catch (err) {
    logger.error('Stripe checkout error', { route: '/api/stripe/checkout', error: String(err) })
    return NextResponse.json({ error: 'Erro ao criar sessão de pagamento.' }, { status: 500 })
  }
}
