/**
 * Reconciliação: o que o Stripe diz contra o que o banco guarda.
 *
 * ## Por que existe
 *
 * Em 12/08/2026 uma compra real foi paga e o app não soube. O endpoint de
 * webhook ainda não existia, então o `customer.subscription.created` nunca foi
 * entregue — e não havia nada que percebesse isso. O dinheiro entrou, o plano
 * não mudou, e a única forma de descobrir teria sido o cliente reclamar.
 *
 * Webhook é entrega best-effort. Endpoint mal configurado, fora do ar, segredo
 * trocado, evento fora da janela de reentrega: em todos esses casos o banco
 * fica para trás em silêncio. Idempotência (ver `eventos-stripe`) impede
 * processar duas vezes; ela não recupera o que nunca chegou.
 *
 * ## O desenho
 *
 * Este módulo é **puro**: recebe as duas listas e devolve as divergências. Ele
 * não fala com o Stripe, não escreve no banco e não decide sozinho o que
 * corrigir. Isso é o que permite testá-lo com casos que seriam caros de
 * reproduzir de verdade — assinatura cancelada no Stripe e ativa aqui,
 * assinatura que nunca chegou, valor divergente.
 *
 * ## A direção da verdade
 *
 * O Stripe manda. Ele é quem cobra o cartão; o banco é espelho. Onde os dois
 * discordam sobre uma assinatura, a resposta é sempre «o banco está errado» —
 * nunca o contrário, e nunca «vamos pedir ao Stripe que mude».
 *
 * A exceção é a ausência ao contrário: assinatura que existe **aqui** e não lá.
 * Isso não é dado velho, é dado inventado — e apagar em silêncio esconderia a
 * pergunta que importa: de onde veio essa linha?
 */

/** Como o Stripe descreve uma assinatura, no que interessa aqui. */
export interface AssinaturaNoStripe {
  id: string
  status: string
  /** Em reais — já dividido por 100. */
  valor: number | null
  intervalo: 'month' | 'year' | null
  customerId: string | null
  /** `cancel_at_period_end` do Stripe. */
  cancelaNoFim: boolean
  fimDoPeriodo: string | null
}

/** Como o banco guarda. */
export interface AssinaturaNoBanco {
  id: string
  gateway_subscription_id: string | null
  status: string | null
  price_paid: number | null
  billing_cycle: string | null
  cancel_at_period_end: boolean | null
  current_period_end: string | null
}

export type TipoDeDivergencia =
  /** Existe no Stripe e não aqui. É o caso da compra de 12/08. */
  | 'ausente_no_banco'
  /** Existe aqui e não no Stripe. Dado inventado, não dado velho. */
  | 'ausente_no_stripe'
  | 'status_diferente'
  | 'valor_diferente'
  | 'ciclo_diferente'
  | 'cancelamento_diferente'

export interface Divergencia {
  tipo: TipoDeDivergencia
  /** O `sub_...` do Stripe — é a chave que liga os dois lados. */
  gatewaySubscriptionId: string
  /** Id da linha no banco, quando existe. */
  linhaId?: string
  /** O que o Stripe diz. */
  noStripe: string | number | boolean | null
  /** O que o banco guarda. */
  noBanco: string | number | boolean | null
  /**
   * `true` quando a correção é mecânica: copiar o valor do Stripe para o banco.
   *
   * `ausente_no_stripe` é o único que não é — exige entender de onde a linha
   * veio antes de mexer nela.
   */
  corrigivel: boolean
}

/**
 * O status do Stripe traduzido para o vocabulário da coluna `subscriptions.status`.
 *
 * Espelha `mapStripeStatus` do webhook. Sem isso, `active` contra `active`
 * pareceria divergência a cada comparação.
 */
export function statusEquivalente(statusDoStripe: string): string {
  switch (statusDoStripe) {
    case 'active':
    case 'trialing':
      return 'active'
    case 'past_due':
    case 'unpaid':
      return 'past_due'
    case 'canceled':
    case 'incomplete_expired':
      return 'cancelled'
    case 'incomplete':
    case 'paused':
      return 'pending'
    default:
      return statusDoStripe
  }
}

/** Diferença de centavo não é divergência — é arredondamento de `numeric`. */
const TOLERANCIA_EM_REAIS = 0.01

/**
 * Compara os dois lados e devolve o que não bate.
 *
 * A lista vazia é a resposta boa: o banco reflete o Stripe.
 */
export function compararAssinaturas(
  noStripe: AssinaturaNoStripe[],
  noBanco: AssinaturaNoBanco[]
): Divergencia[] {
  const divergencias: Divergencia[] = []

  const porGatewayId = new Map<string, AssinaturaNoBanco>()
  for (const linha of noBanco) {
    if (linha.gateway_subscription_id) porGatewayId.set(linha.gateway_subscription_id, linha)
  }

  for (const assinatura of noStripe) {
    const linha = porGatewayId.get(assinatura.id)

    if (!linha) {
      divergencias.push({
        tipo: 'ausente_no_banco',
        gatewaySubscriptionId: assinatura.id,
        noStripe: assinatura.status,
        noBanco: null,
        corrigivel: true,
      })
      continue
    }

    const statusEsperado = statusEquivalente(assinatura.status)
    if (linha.status !== statusEsperado) {
      divergencias.push({
        tipo: 'status_diferente',
        gatewaySubscriptionId: assinatura.id,
        linhaId: linha.id,
        noStripe: statusEsperado,
        noBanco: linha.status,
        corrigivel: true,
      })
    }

    if (assinatura.valor !== null) {
      const gravado = typeof linha.price_paid === 'number' ? linha.price_paid : null
      if (gravado === null || Math.abs(gravado - assinatura.valor) > TOLERANCIA_EM_REAIS) {
        divergencias.push({
          tipo: 'valor_diferente',
          gatewaySubscriptionId: assinatura.id,
          linhaId: linha.id,
          noStripe: assinatura.valor,
          noBanco: gravado,
          corrigivel: true,
        })
      }
    }

    if (assinatura.intervalo) {
      const cicloEsperado = assinatura.intervalo === 'year' ? 'yearly' : 'monthly'
      if (linha.billing_cycle !== cicloEsperado) {
        divergencias.push({
          tipo: 'ciclo_diferente',
          gatewaySubscriptionId: assinatura.id,
          linhaId: linha.id,
          noStripe: cicloEsperado,
          noBanco: linha.billing_cycle,
          corrigivel: true,
        })
      }
    }

    // `null` no banco e `false` no Stripe é a mesma coisa: não cancela.
    if (assinatura.cancelaNoFim !== Boolean(linha.cancel_at_period_end)) {
      divergencias.push({
        tipo: 'cancelamento_diferente',
        gatewaySubscriptionId: assinatura.id,
        linhaId: linha.id,
        noStripe: assinatura.cancelaNoFim,
        noBanco: Boolean(linha.cancel_at_period_end),
        corrigivel: true,
      })
    }
  }

  const idsNoStripe = new Set(noStripe.map(a => a.id))
  for (const linha of noBanco) {
    if (!linha.gateway_subscription_id) continue
    if (idsNoStripe.has(linha.gateway_subscription_id)) continue
    // Só conta como divergência se a linha se diz viva: assinatura cancelada
    // aqui e ausente lá é o desfecho normal de um cancelamento antigo.
    if (linha.status === 'cancelled') continue

    divergencias.push({
      tipo: 'ausente_no_stripe',
      gatewaySubscriptionId: linha.gateway_subscription_id,
      linhaId: linha.id,
      noStripe: null,
      noBanco: linha.status,
      // Deliberadamente não corrigível: apagar ou cancelar em silêncio
      // esconderia a pergunta de onde essa linha veio.
      corrigivel: false,
    })
  }

  return divergencias
}

/** Resumo por tipo, para o relatório e para o log. */
export function resumirDivergencias(divergencias: Divergencia[]): Record<string, number> {
  const resumo: Record<string, number> = {}
  for (const d of divergencias) resumo[d.tipo] = (resumo[d.tipo] ?? 0) + 1
  return resumo
}
