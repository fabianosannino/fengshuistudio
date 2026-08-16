/**
 * Como se desfaz uma venda — e por que não é do mesmo jeito nas duas.
 *
 * ## O defeito que isto corrige
 *
 * `/api/pedidos/estorno` exigia `stripe_account_id`:
 *
 *     if (!pedido.stripe_payment_intent || !pedido.stripe_account_id) return 409
 *
 * Numa venda de **bem próprio** aquela coluna é nula **por desenho** — a
 * cobrança acontece na conta da plataforma, não na de um consultor. A rota foi
 * escrita nas fases 0 e 1, quando só existia venda de consultor, e a fase 2
 * acrescentou um tipo de venda que ela não sabia desfazer.
 *
 * O `logger.error` junto piorava: tratava o desenho correto como dado
 * corrompido, mandando quem investigasse procurar corrupção que não existe.
 *
 * ## Por que não era detalhe
 *
 * A página do comprador mostra «Solicitar devolução». O e-mail de confirmação
 * promete os 7 dias do CDC, art. 49. Do outro lado não havia tela que
 * cumprisse — o direito era anunciado em dois lugares e não existia no
 * sistema.
 *
 * Nos testes deu para contornar estornando direto pelo Stripe. Um comprador de
 * verdade não tem esse contorno.
 */

import type Stripe from 'stripe'

/** Estados em que ainda faz sentido devolver dinheiro. */
export const ESTORNAVEIS = new Set([
  'pago', 'preparando', 'enviado', 'entregue', 'devolucao_solicitada',
])

export interface PedidoParaEstornar {
  stripe_payment_intent?: string | null
  /** `null` na venda de bem próprio: a cobrança é na conta da plataforma. */
  stripe_account_id?: string | null
}

/**
 * O que falta para estornar — ou `null` quando não falta nada.
 *
 * Só o `payment_intent` é indispensável: sem ele não há o que devolver. A
 * ausência de `stripe_account_id` **não** é impedimento, e essa é a correção:
 * ela distingue onde a cobrança aconteceu, não se ela pode ser desfeita.
 */
export function faltaParaEstornar(pedido: PedidoParaEstornar): 'cobranca' | null {
  return pedido.stripe_payment_intent ? null : 'cobranca'
}

/**
 * Os parâmetros do estorno, que mudam com quem vendeu.
 *
 * ## As duas diferenças, e as duas têm a mesma raiz
 *
 * **`stripeAccount`** — cobrança direta vive na conta do vendedor, e o estorno
 * precisa acontecer lá. Cobrança da plataforma vive na nossa, e passar
 * `stripeAccount: null` ao SDK não é o mesmo que omitir: é pedir uma conta
 * chamada «null».
 *
 * **`refund_application_fee`** — só existe onde houve `application_fee`. Numa
 * venda nossa não há comissão a devolver, porque não há comissão: não se cobra
 * comissão de si mesmo. Mandar o parâmetro assim mesmo faria o Stripe recusar
 * a chamada inteira, e o comprador ficaria sem o dinheiro por causa de um
 * campo que descrevia uma cobrança que não aconteceu.
 *
 * A raiz é a mesma nas duas: **quem recebeu decide como se devolve.**
 */
export function parametrosDoEstorno(
  pedido: PedidoParaEstornar,
  pedidoId: string
): {
  corpo: Stripe.RefundCreateParams
  opcoes: Stripe.RequestOptions
} {
  const naContaConectada = Boolean(pedido.stripe_account_id)

  return {
    corpo: {
      payment_intent: pedido.stripe_payment_intent!,
      /*
       * Na venda do consultor, fixo em `true` e nunca parâmetro.
       *
       * Decisão de 13/08: a plataforma não fica com comissão de venda
       * desfeita. Uma regra que depende de alguém marcar uma caixa não é
       * regra — era exatamente assim que funcionava enquanto o estorno era
       * feito no painel do Stripe.
       */
      ...(naContaConectada ? { refund_application_fee: true } : {}),
    },
    opcoes: {
      // Dois cliques no botão não devolvem duas vezes.
      idempotencyKey: `estorno-${pedidoId}`,
      ...(naContaConectada ? { stripeAccount: pedido.stripe_account_id! } : {}),
    },
  }
}

/**
 * Quem pode mandar estornar este pedido.
 *
 * Na venda do consultor é ele — o dinheiro é dele, e a policy de `pedidos` já
 * só devolve a linha para o dono. Na venda de bem próprio o vendedor somos
 * nós, e «nós» no sistema é o admin com capacidade.
 *
 * Sem esta distinção, a rota teria que escolher entre duas coisas erradas:
 * deixar qualquer consultor desfazer venda da plataforma, ou exigir admin para
 * o consultor desfazer a própria venda.
 */
export function quemEstorna(pedido: { vendedor_tipo?: string | null }): 'vendedor' | 'admin' {
  return pedido.vendedor_tipo === 'plataforma' ? 'admin' : 'vendedor'
}
