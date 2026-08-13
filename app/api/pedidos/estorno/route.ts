/**
 * POST /api/pedidos/estorno — devolve uma venda da loja ao comprador.
 *   Body: { pedido_id, motivo? }
 *
 * ## Por que esta rota existe
 *
 * O consultor **não conseguia reembolsar**. O painel Express não faz estorno,
 * e o painel da plataforma é da plataforma — ele não tem acesso. Na prática, a
 * devolução integral em 7 dias que o CDC art. 49 exige era impossível de
 * cumprir por qualquer pessoa que não fosse o dono do FengShui Studio.
 *
 * ## A comissão volta sempre
 *
 * Decisão de 13/08: a plataforma não fica com comissão de venda desfeita. Por
 * isso `refund_application_fee` é fixo em `true` e **não** é parâmetro — uma
 * regra que depende de alguém marcar uma caixa não é regra, e era exatamente
 * assim que funcionava enquanto o estorno era feito no painel do Stripe.
 *
 * ## Quem escreve o quê
 *
 * Esta rota grava `devolucao_solicitada` — o pedido do consumidor, que é o
 * fato que dispara a obrigação. O `reembolsado` e os lançamentos financeiros
 * continuam vindo do **webhook**, quando o dinheiro efetivamente volta.
 * Escrever aqui que foi reembolsado seria afirmar um fato a partir da
 * intenção, que é a mesma classe de erro de marcar «pago» na tela de sucesso.
 */

import { NextResponse } from 'next/server'
import stripeClient from '../../../../src/lib/stripe'
import { logger } from '../../../../src/lib/logger'
import { rateLimit, ipDaRequisicao } from '../../../../src/lib/rate-limit'
import { createRouteHandlerClient } from '../../../../src/lib/supabase-route'
import { createSupabaseAdminClient } from '../../../../src/lib/supabase-admin'
import { estadoDoPedido, registrarEvento } from '../../../../src/lib/pedidos-da-loja'

const ROUTE = '/api/pedidos/estorno'

/** Estados em que ainda faz sentido devolver dinheiro. */
const ESTORNAVEIS = new Set(['pago', 'preparando', 'enviado', 'entregue', 'devolucao_solicitada'])

export async function POST(request: Request) {
  const ip = ipDaRequisicao(request)
  const { success } = await rateLimit(ip, { limit: 10, windowMs: 60_000 })
  if (!success) {
    return NextResponse.json(
      { error: 'Muitas requisições. Tente novamente em alguns instantes.' },
      { status: 429, headers: { 'Retry-After': '60' } }
    )
  }

  const supabase = await createRouteHandlerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  let body: { pedido_id?: string; motivo?: string }
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }

  const pedidoId = body.pedido_id
  if (!pedidoId) return NextResponse.json({ error: 'pedido_id é obrigatório' }, { status: 400 })

  /*
   * A autorização é a própria policy: `pedidos` só devolve linha para o
   * vendedor dono ou para admin. Se a leitura vier vazia, ou o pedido não
   * existe ou não é dele — e as duas respostas devem ser a mesma, senão a
   * rota vira um oráculo que confirma a existência de pedidos alheios.
   */
  const { data: pedido, error: erroDeLeitura } = await supabase
    .from('pedidos')
    .select('id, stripe_payment_intent, stripe_account_id, pedido_eventos(evento, ocorrido_em)')
    .eq('id', pedidoId)
    .maybeSingle()

  if (erroDeLeitura) {
    logger.error('Falha ao ler o pedido para estorno', {
      route: ROUTE, pedidoId, error: erroDeLeitura.message,
    })
    return NextResponse.json({ error: 'Não foi possível processar o estorno.' }, { status: 500 })
  }

  if (!pedido) return NextResponse.json({ error: 'Pedido não encontrado.' }, { status: 404 })

  const estado = estadoDoPedido(pedido.pedido_eventos ?? [])

  if (!ESTORNAVEIS.has(estado)) {
    return NextResponse.json(
      { error: `Este pedido não pode ser estornado (situação: ${estado}).` },
      { status: 409 }
    )
  }

  if (!pedido.stripe_payment_intent || !pedido.stripe_account_id) {
    logger.error('Pedido estornável sem dados de cobrança', {
      route: ROUTE, pedidoId, estado,
    })
    return NextResponse.json({ error: 'Não foi possível processar o estorno.' }, { status: 409 })
  }

  const admin = createSupabaseAdminClient()

  // O pedido do consumidor é registrado **antes** da chamada ao Stripe: se o
  // estorno falhar, fica o rastro de que a devolução foi pedida e quando — que
  // é o que conta o prazo do «de imediato» e o que o suporte precisa ver.
  await registrarEvento(admin, {
    pedidoId,
    evento: 'devolucao_solicitada',
    origem: 'vendedor',
    referencia: `estorno:${pedidoId}`,
    motivo: body.motivo ?? null,
  }, ROUTE)

  try {
    const reembolso = await stripeClient.refunds.create({
      payment_intent: pedido.stripe_payment_intent,
      // Fixo, e não parâmetro. Ver a nota no topo do arquivo.
      refund_application_fee: true,
    }, {
      stripeAccount: pedido.stripe_account_id,
      // Dois cliques no botão não devolvem duas vezes.
      idempotencyKey: `estorno-${pedidoId}`,
    })

    logger.info('Estorno solicitado ao Stripe', {
      route: ROUTE, pedidoId, refundId: reembolso.id, status: reembolso.status,
    })

    // `reembolsado` e os lançamentos chegam pelo webhook, quando o dinheiro
    // volta de fato. Aqui a resposta é só «pedido aceito».
    return NextResponse.json({ solicitado: true, status: reembolso.status })
  } catch (err) {
    logger.error('Falha ao estornar no Stripe', { route: ROUTE, pedidoId, error: String(err) })
    return NextResponse.json(
      { error: 'Não foi possível concluir o estorno. Tente novamente.' },
      { status: 502 }
    )
  }
}
