/**
 * Quais meios de pagamento oferecer na loja de cada consultor.
 *
 * ## Por que Pix entra
 *
 * A tarifa do cartão no Brasil é **3,99% + R$ 0,39** — derivado dos dois
 * primeiros pedidos reais: R$ 0,59 sobre R$ 5,00 e R$ 0,43 sobre R$ 1,00.
 * A parte percentual é razoável; a fixa é que machuca em venda pequena, onde
 * chega a 43% do total.
 *
 * Pix não tem parte fixa relevante e é como a maior parte dos brasileiros
 * paga. Numa consultoria de R$ 300 é a diferença entre uns R$ 12 e uns R$ 3.
 *
 * ## Por que não basta declarar `['card', 'pix']`
 *
 * Se a conta conectada não tiver a capacidade de Pix ativa, o Stripe **recusa
 * a criação da sessão** — e o checkout inteiro quebraria para aquele
 * consultor, cartão incluído. Trocar uma tarifa alta por uma venda impossível
 * é o pior negócio disponível.
 *
 * Por isso a lista sai da capacidade real da conta, consultada antes. É uma
 * chamada a mais por checkout, e ela compra a garantia de que o método
 * oferecido é o método que funciona.
 */

import stripeClient from './stripe'
import { logger } from './logger'

/**
 * O tipo vem do parâmetro da própria criação de sessão, e não de uma união
 * escrita à mão: assim, método novo do Stripe aparece aqui sem virar `string`.
 */
export type MetodoDePagamento = NonNullable<
  Parameters<typeof stripeClient.checkout.sessions.create>[0]
>['payment_method_types'] extends (infer M)[] | undefined ? M : never

/** Cartão sempre existe; é o piso, não a preferência. */
const SO_CARTAO: MetodoDePagamento[] = ['card']

/**
 * Os métodos que aquela conta consegue de fato receber.
 *
 * Falha de consulta cai para cartão e **registra**: seguir sem Pix é perder
 * uma economia; seguir com Pix indisponível é perder a venda.
 */
export async function metodosDaConta(
  contaConectada: string,
  origemDoLog: string
): Promise<MetodoDePagamento[]> {
  try {
    const conta = await stripeClient.accounts.retrieve(contaConectada)
    const pix = conta.capabilities?.pix_payments

    if (pix !== 'active') {
      logger.info('Pix indisponível nesta conta — checkout segue só com cartão', {
        origem: origemDoLog, contaConectada, capacidade: pix ?? 'ausente',
      })
      return SO_CARTAO
    }

    return ['card', 'pix']
  } catch (err) {
    logger.warn('Não foi possível ler as capacidades da conta — checkout só com cartão', {
      origem: origemDoLog, contaConectada, error: String(err),
    })
    return SO_CARTAO
  }
}

/**
 * ## E na venda de bem próprio, que cobra na nossa conta?
 *
 * Ali a lista **não é declarada**: `payment_method_types` é omitido, e o
 * Stripe usa os métodos que a nossa conta tem habilitados no painel.
 *
 * A diferença de tratamento tem motivo. Aqui a lista precisa ser consultada
 * porque a conta é de outra pessoa — declarar `pix` numa conta sem a
 * capacidade faz o Stripe **recusar a criação da sessão**, e o checkout
 * quebraria inteiro, cartão incluído. Na nossa conta, quem liga o Pix é quem
 * mantém o painel: omitir deixa a decisão onde ela já é tomada, e ativar o Pix
 * passa a valer sem precisar de deploy.
 */
