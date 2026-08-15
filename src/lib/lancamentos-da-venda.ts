/**
 * Traduz o que o Stripe conta sobre uma venda para lançamentos do razão.
 *
 * Fica separado de `lancamentos-do-pedido.ts` porque aquele é aritmética pura
 * — testável sem Stripe nenhum — e este precisa falar com a API. A divisão é
 * a mesma de `concessoes-de-plano.ts`: a regra de um lado, a I/O do outro.
 *
 * ## Por que buscar a tarifa em vez de calcular
 *
 * A tarifa do gateway varia com bandeira, parcelamento e país do cartão.
 * Estimá-la daria um razão que quase fecha — e um razão que quase fecha é pior
 * do que um que não fecha, porque ninguém percebe a diferença. Ela vem da
 * `balance_transaction`, que é o que o Stripe efetivamente descontou.
 *
 * Quando a busca falha, o lançamento **não é inventado**: fica registrado no
 * log que o razão está incompleto. Lacuna declarada, ADR 0020.
 */

import type Stripe from 'stripe'
import stripeClient from './stripe'
import { logger } from './logger'
import { registrarLancamento, type ParteDoPedido } from './lancamentos-do-pedido'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Lançamentos de uma venda paga: o que o comprador pagou, o que a plataforma
 * reteve e o que o gateway ficou.
 */
export async function registrarLancamentosDaVenda(
  supabase: SupabaseClient,
  venda: {
    pedidoId: string
    totalCentavos: number
    freteCentavos: number
    taxaPlataformaCentavos: number
    paymentIntent: string | null
    contaConectada: string | null
    /**
     * Quem vendeu — e, portanto, quem recebe e de quem sai a tarifa.
     *
     * Na fase 2 a plataforma passou a vender bem próprio, e sem este parâmetro
     * o razão diria que o dinheiro de uma venda nossa foi para «consultor».
     * O saldo continuaria fechando (ele fecha por construção), e a resposta a
     * «quanto os consultores receberam?» é que ficaria errada — silenciosamente,
     * porque nada quebra.
     */
    vendedor: VendedorDaVenda
    referencia: string
    ocorridoEm: string
  },
  origemDoLog: string
): Promise<void> {
  const produto = Math.max(0, venda.totalCentavos - venda.freteCentavos)
  const comum = {
    pedidoId: venda.pedidoId,
    origem: 'webhook_stripe' as const,
    referencia: venda.referencia,
    ocorridoEm: venda.ocorridoEm,
  }

  await registrarLancamento(supabase, {
    ...comum, tipo: 'produto', valorCentavos: produto,
    pagador: 'comprador', recebedor: venda.vendedor,
  }, origemDoLog)

  await registrarLancamento(supabase, {
    ...comum, tipo: 'frete', valorCentavos: venda.freteCentavos,
    pagador: 'comprador', recebedor: venda.vendedor,
  }, origemDoLog)

  // Valor zero não vira linha (ver `registrarLancamento`), e é assim que a
  // venda própria fica **sem** lançamento de comissão: não existe comissão a
  // reter de si mesmo. Ausência ≠ zero, também no razão.
  await registrarLancamento(supabase, {
    ...comum, tipo: 'comissao_plataforma', valorCentavos: venda.taxaPlataformaCentavos,
    pagador: venda.vendedor, recebedor: 'plataforma',
  }, origemDoLog)

  const tarifa = await tarifaDoGateway(venda.paymentIntent, venda.contaConectada, origemDoLog)
  if (tarifa === null) return

  await registrarLancamento(supabase, {
    ...comum, tipo: 'tarifa_gateway', valorCentavos: tarifa,
    pagador: venda.vendedor, recebedor: 'gateway',
    motivo: 'Tarifa do Stripe, retida do saldo do vendedor',
  }, origemDoLog)
}

/**
 * Escreve a tarifa que faltou no razão de uma venda já confirmada.
 *
 * ## Por que existe uma segunda chance
 *
 * `registrarLancamentosDaVenda` roda dentro do webhook, segundos depois do
 * pagamento, e às vezes o Stripe devolve a cobrança sem a
 * `balance_transaction` — o objeto existe, a leitura não o alcança. Medido em
 * 15/08 em duas de cinco vendas próprias.
 *
 * O webhook não tem como vencer essa corrida sem atrasar o registro do
 * pagamento, que é o fato que importa. Então a completude do razão vira
 * trabalho de quem roda depois: a reconciliação chama isto.
 *
 * ## O que **não** faz
 *
 * Não recalcula nem corrige linha existente — só acrescenta a que falta. A
 * tabela é append-only por trigger, e reescrever razão seria trocar o fato
 * registrado pela nossa leitura de hoje.
 *
 * Devolve `true` quando o razão ficou completo, e `false` quando a tarifa
 * continua indisponível — e aí a lacuna segue declarada no log, como antes.
 */
export async function completarTarifaDaVenda(
  supabase: SupabaseClient,
  pedido: {
    pedidoId: string
    paymentIntent: string
    contaConectada: string | null
    vendedor: VendedorDaVenda
    ocorridoEm?: string | null
  },
  origemDoLog: string
): Promise<boolean> {
  const tarifa = await tarifaDoGateway(pedido.paymentIntent, pedido.contaConectada, origemDoLog)
  if (tarifa === null) return false

  return registrarLancamento(supabase, {
    pedidoId: pedido.pedidoId,
    tipo: 'tarifa_gateway',
    valorCentavos: tarifa,
    pagador: pedido.vendedor,
    recebedor: 'gateway',
    origem: 'webhook_stripe',
    /*
     * A referência amarra o conserto à cobrança e é o que torna a execução de
     * amanhã inofensiva: o índice de unicidade recusa o segundo insert com a
     * mesma referência dentro do tipo.
     */
    referencia: `reconciliacao:tarifa:${pedido.paymentIntent}`,
    ocorridoEm: pedido.ocorridoEm ?? null,
    motivo: 'Tarifa do Stripe, retida do saldo do vendedor — completada pela reconciliação',
  }, origemDoLog)
}

/** Quem fica com o dinheiro da venda: o consultor ou a própria plataforma. */
export type VendedorDaVenda = Extract<ParteDoPedido, 'consultor' | 'plataforma'>

/**
 * A tarifa efetivamente descontada, lida da `balance_transaction`.
 *
 * `null` quando não deu para ler — e aí o razão fica declaradamente
 * incompleto, em vez de fechado com um número inventado.
 */
async function tarifaDoGateway(
  paymentIntent: string | null,
  contaConectada: string | null,
  origemDoLog: string
): Promise<number | null> {
  /**
   * Toda saída sem tarifa diz **por quê**.
   *
   * Antes, só o `catch` registrava. Os outros três retornos eram mudos — e a
   * promessa no topo deste arquivo («fica registrado no log que o razão está
   * incompleto») valia para um caso em quatro.
   *
   * O custo apareceu em 15/08, no pedido `P260815-C799D5`: o razão saiu sem
   * `tarifa_gateway`, sem nenhuma linha de log, e as duas vendas próprias
   * anteriores tinham a linha. Não deu para dizer qual condição disparou —
   * a `balance_transaction` existia no Stripe, com `fee: 43`, criada dois
   * segundos antes de o webhook gravar.
   *
   * Uma lacuna que não se anuncia não é lacuna declarada: é a mesma coisa que
   * um erro engolido, só que com um comentário dizendo o contrário.
   */
  function semTarifa(porque: string): null {
    logger.warn('Razão sem tarifa do gateway — lacuna declarada', {
      origem: origemDoLog, paymentIntent, contaConectada, porque,
    })
    return null
  }

  if (!paymentIntent) return semTarifa('pedido sem payment_intent')

  try {
    /*
     * Sem conta conectada, a cobrança é da própria plataforma — venda de bem
     * próprio. A `balance_transaction` mora na conta onde o dinheiro caiu, e
     * pedi-la com `stripeAccount` de uma conta que não existe devolveria erro.
     *
     * Antes, `contaConectada` nula abortava a busca e o razão saía sem a
     * tarifa. Ficaria calado justo na venda em que a tarifa é a **única**
     * dedução, porque não há comissão nenhuma para explicar a diferença.
     */
    const intent = await stripeClient.paymentIntents.retrieve(
      paymentIntent,
      { expand: ['latest_charge.balance_transaction'] },
      contaConectada ? { stripeAccount: contaConectada } : undefined
    )

    const cobranca = intent.latest_charge
    if (!cobranca) return semTarifa('payment_intent sem latest_charge')
    if (typeof cobranca === 'string') return semTarifa('latest_charge não expandiu')

    const transacao = cobranca.balance_transaction
    if (!transacao) return semTarifa('cobrança sem balance_transaction')
    if (typeof transacao === 'string') return semTarifa('balance_transaction não expandiu')

    // `fee` inclui a comissão da plataforma quando ela é cobrada como
    // application fee. Subtrair evita contar os nossos 10% duas vezes — uma
    // como `comissao_plataforma` e outra dentro da tarifa.
    const comissaoDentroDaTarifa = (transacao.fee_details ?? [])
      .filter(d => d.type === 'application_fee')
      .reduce((soma, d) => soma + (d.amount ?? 0), 0)

    return Math.max(0, transacao.fee - comissaoDentroDaTarifa)
  } catch (err) {
    return semTarifa(`erro ao consultar o Stripe: ${String(err)}`)
  }
}

/**
 * Lançamentos de um reembolso: o que voltou ao comprador e o que a plataforma
 * devolveu de comissão.
 *
 * A tarifa do gateway **não** gera lançamento aqui, e a ausência é o ponto:
 * ela não volta. O `tarifa_gateway` do momento da venda continua de pé, e é
 * por isso que o saldo do consultor fica negativo num pedido devolvido —
 * exatamente o número que ele precisa ver.
 */
export async function registrarLancamentosDoReembolso(
  supabase: SupabaseClient,
  reembolso: {
    pedidoId: string
    cobranca: Stripe.Charge
    /** Quem devolve. Numa venda própria somos nós dos dois lados. */
    vendedor: VendedorDaVenda
    referencia: string
    ocorridoEm: string
  },
  origemDoLog: string
): Promise<void> {
  const comum = {
    pedidoId: reembolso.pedidoId,
    origem: 'webhook_stripe' as const,
    referencia: reembolso.referencia,
    ocorridoEm: reembolso.ocorridoEm,
  }

  await registrarLancamento(supabase, {
    ...comum, tipo: 'reembolso', valorCentavos: reembolso.cobranca.amount_refunded ?? 0,
    pagador: reembolso.vendedor, recebedor: 'comprador',
  }, origemDoLog)

  const devolvida = await comissaoDevolvida(reembolso.cobranca, origemDoLog)
  if (!devolvida) return

  await registrarLancamento(supabase, {
    ...comum, tipo: 'estorno_comissao', valorCentavos: devolvida,
    pagador: 'plataforma', recebedor: reembolso.vendedor,
    motivo: 'A plataforma não retém comissão de venda desfeita',
  }, origemDoLog)
}

/**
 * Quanto da comissão voltou, lido da `application_fee`.
 *
 * É consultado em vez de assumido porque o estorno pode ter sido feito **pelo
 * painel do Stripe**, onde devolver a comissão é uma caixa que alguém marca. A
 * rota do app sempre devolve; o painel, não necessariamente. Registrar o que
 * pedimos, em vez do que aconteceu, faria o razão descrever a intenção.
 */
async function comissaoDevolvida(
  cobranca: Stripe.Charge,
  origemDoLog: string
): Promise<number> {
  const taxa = cobranca.application_fee
  if (!taxa) return 0

  try {
    const id = typeof taxa === 'string' ? taxa : taxa.id
    // A `application_fee` vive na **plataforma**, não na conta conectada —
    // por isso sem `stripeAccount`.
    const registro = await stripeClient.applicationFees.retrieve(id)
    return registro.amount_refunded ?? 0
  } catch (err) {
    logger.warn('Não foi possível ler o estorno da comissão — razão incompleto', {
      origem: origemDoLog, error: String(err),
    })
    return 0
  }
}
