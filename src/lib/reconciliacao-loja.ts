/**
 * Reconciliação da loja — o Stripe e o banco contam a mesma venda?
 *
 * ## Por que existe
 *
 * O mesmo motivo da reconciliação das assinaturas: **webhook não é garantia**.
 * Ele pode não chegar, chegar depois da janela de reentrega, ou morrer no meio
 * de um deploy. Quando isso acontece com uma venda, o dinheiro se move e este
 * lado não sabe — que é o defeito de origem da loja inteira.
 *
 * ## O que ela destrava
 *
 * Enquanto não existia, o checkout precisava **recusar a compra** se não
 * conseguisse gravar o pedido: sem forma de recuperar a venda depois, derrubar
 * era a única resposta honesta. Com a reconciliação rodando no cron diário, a
 * venda passa a ser recuperável a partir do Stripe.
 *
 * ## A parte pura fica aqui
 *
 * `compararVendas` não fala com ninguém. É o que permite testar o caso que
 * importa — cobrança no Stripe sem pedido aqui — sem precisar de venda real.
 */

/** O que o Stripe conta sobre uma cobrança da loja. */
export interface CobrancaNoStripe {
  /** `pi_...` — a chave que liga os dois lados. */
  paymentIntentId: string
  contaConectada: string
  /** Em centavos, como tudo neste projeto. */
  valorCentavos: number
  /** Quanto já foi devolvido. Zero quando não houve reembolso. */
  reembolsadoCentavos: number
  criadoEm: string
  compradorEmail: string | null
}

/** O que o banco guarda. */
export interface PedidoNoBanco {
  id: string
  numero: string
  stripe_payment_intent: string | null
  total_centavos: number
  /** Derivado dos eventos antes de comparar — aqui já chega pronto. */
  estado: string
}

export type TipoDeDivergenciaDaLoja =
  /** Cobrado no Stripe e sem pedido aqui. É o pior caso: venda invisível. */
  | 'venda_ausente_no_banco'
  /** O pedido existe, mas nunca recebeu o `pago`. Webhook perdido. */
  | 'pagamento_nao_registrado'
  /** Devolvido no Stripe e ainda «pago» aqui. */
  | 'reembolso_nao_registrado'
  /** Valores diferentes para a mesma cobrança. */
  | 'valor_diferente'
  /** Pedido pago aqui sem cobrança correspondente no Stripe. */
  | 'pedido_sem_cobranca'

export interface DivergenciaDaLoja {
  tipo: TipoDeDivergenciaDaLoja
  paymentIntentId: string
  pedidoId?: string
  numero?: string
  noStripe: string | number | null
  noBanco: string | number | null
  /**
   * `true` quando a correção é mecânica.
   *
   * `pedido_sem_cobranca` é o único que não é: um pedido pago sem cobrança no
   * Stripe não é dado velho, é dado que não deveria existir. Corrigir sem
   * entender de onde veio apagaria a evidência do problema.
   */
  corrigivel: boolean
}

/** Estados em que o pedido afirma que o dinheiro entrou. */
const AFIRMA_PAGAMENTO = new Set([
  'pago', 'preparando', 'enviado', 'entregue', 'devolucao_solicitada',
])

/**
 * Compara os dois lados e devolve o que não bate.
 *
 * A chave é o `payment_intent`. Não o `session_id`: sessão expira e some, e o
 * `pi_` sobrevive à cobrança inteira, inclusive ao reembolso.
 */
export function compararVendas(
  noStripe: CobrancaNoStripe[],
  noBanco: PedidoNoBanco[]
): DivergenciaDaLoja[] {
  const divergencias: DivergenciaDaLoja[] = []

  const porIntent = new Map<string, PedidoNoBanco>()
  for (const pedido of noBanco) {
    if (pedido.stripe_payment_intent) porIntent.set(pedido.stripe_payment_intent, pedido)
  }

  const vistosNoStripe = new Set<string>()

  for (const cobranca of noStripe) {
    vistosNoStripe.add(cobranca.paymentIntentId)
    const pedido = porIntent.get(cobranca.paymentIntentId)

    if (!pedido) {
      divergencias.push({
        tipo: 'venda_ausente_no_banco',
        paymentIntentId: cobranca.paymentIntentId,
        noStripe: cobranca.valorCentavos,
        noBanco: null,
        corrigivel: true,
      })
      continue
    }

    const comum = {
      paymentIntentId: cobranca.paymentIntentId,
      pedidoId: pedido.id,
      numero: pedido.numero,
    }

    if (!AFIRMA_PAGAMENTO.has(pedido.estado) && pedido.estado !== 'reembolsado') {
      divergencias.push({
        ...comum, tipo: 'pagamento_nao_registrado',
        noStripe: 'pago', noBanco: pedido.estado, corrigivel: true,
      })
    }

    if (cobranca.reembolsadoCentavos > 0 && pedido.estado !== 'reembolsado') {
      divergencias.push({
        ...comum, tipo: 'reembolso_nao_registrado',
        noStripe: cobranca.reembolsadoCentavos, noBanco: pedido.estado, corrigivel: true,
      })
    }

    if (cobranca.valorCentavos !== pedido.total_centavos) {
      divergencias.push({
        ...comum, tipo: 'valor_diferente',
        noStripe: cobranca.valorCentavos, noBanco: pedido.total_centavos, corrigivel: true,
      })
    }
  }

  /*
   * O outro sentido: pedido que afirma pagamento sem cobrança do lado de lá.
   *
   * Pedido `iniciado` sem cobrança é normal — é carrinho abandonado, e
   * acusá-lo encheria o relatório de ruído que esconderia o que importa.
   */
  for (const pedido of noBanco) {
    if (!pedido.stripe_payment_intent) continue
    if (vistosNoStripe.has(pedido.stripe_payment_intent)) continue
    if (!AFIRMA_PAGAMENTO.has(pedido.estado)) continue

    divergencias.push({
      tipo: 'pedido_sem_cobranca',
      paymentIntentId: pedido.stripe_payment_intent,
      pedidoId: pedido.id,
      numero: pedido.numero,
      noStripe: null,
      noBanco: pedido.estado,
      corrigivel: false,
    })
  }

  return divergencias
}

/** Contagem por tipo, para o relatório caber numa linha de log. */
export function resumirDivergenciasDaLoja(
  divergencias: DivergenciaDaLoja[]
): Record<string, number> {
  const resumo: Record<string, number> = {}
  for (const d of divergencias) resumo[d.tipo] = (resumo[d.tipo] ?? 0) + 1
  return resumo
}
