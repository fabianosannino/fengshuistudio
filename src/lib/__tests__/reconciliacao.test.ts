import { describe, expect, it } from 'vitest'
import {
  compararAssinaturas, resumirDivergencias, statusEquivalente,
  type AssinaturaNoStripe, type AssinaturaNoBanco,
} from '../reconciliacao'

function noStripe(over: Partial<AssinaturaNoStripe> = {}): AssinaturaNoStripe {
  return {
    id: 'sub_1', status: 'active', valor: 49.9, intervalo: 'month',
    customerId: 'cus_1', cancelaNoFim: false, fimDoPeriodo: null, ...over,
  }
}

function noBanco(over: Partial<AssinaturaNoBanco> = {}): AssinaturaNoBanco {
  return {
    id: 'linha-1', gateway_subscription_id: 'sub_1', status: 'active',
    price_paid: 49.9, billing_cycle: 'monthly', cancel_at_period_end: false,
    current_period_end: null, ...over,
  }
}

describe('compararAssinaturas', () => {
  it('em dia não gera divergência', () => {
    expect(compararAssinaturas([noStripe()], [noBanco()])).toEqual([])
  })

  it('assinatura que nunca chegou ao banco', () => {
    // É o caso de 12/08: paga no Stripe, invisível para o app, porque o
    // endpoint de webhook ainda não existia quando o evento foi emitido.
    const [d] = compararAssinaturas([noStripe()], [])
    expect(d.tipo).toBe('ausente_no_banco')
    expect(d.gatewaySubscriptionId).toBe('sub_1')
    expect(d.corrigivel).toBe(true)
  })

  it('status divergente é apontado com os dois lados', () => {
    const [d] = compararAssinaturas(
      [noStripe({ status: 'canceled' })],
      [noBanco({ status: 'active' })],
    )
    expect(d.tipo).toBe('status_diferente')
    expect(d.noStripe).toBe('cancelled')
    expect(d.noBanco).toBe('active')
  })

  it('valor divergente — o que o cartão pagou manda', () => {
    const [d] = compararAssinaturas(
      [noStripe({ valor: 49.9 })],
      [noBanco({ price_paid: 97 })],
    )
    expect(d.tipo).toBe('valor_diferente')
    expect(d.noStripe).toBe(49.9)
  })

  it('diferença de centavo não conta — é arredondamento de numeric', () => {
    expect(compararAssinaturas([noStripe({ valor: 49.9 })], [noBanco({ price_paid: 49.9 })])).toEqual([])
    expect(compararAssinaturas([noStripe({ valor: 49.9 })], [noBanco({ price_paid: 49.895 })])).toEqual([])
  })

  it('valor ausente no banco é divergência, não empate', () => {
    const [d] = compararAssinaturas([noStripe({ valor: 20 })], [noBanco({ price_paid: null })])
    expect(d.tipo).toBe('valor_diferente')
    expect(d.noBanco).toBeNull()
  })

  it('ciclo divergente', () => {
    const [d] = compararAssinaturas(
      [noStripe({ intervalo: 'year', valor: 411.6 })],
      [noBanco({ billing_cycle: 'monthly', price_paid: 411.6 })],
    )
    expect(d.tipo).toBe('ciclo_diferente')
    expect(d.noStripe).toBe('yearly')
  })

  it('cancelamento agendado que o banco não sabe', () => {
    const [d] = compararAssinaturas(
      [noStripe({ cancelaNoFim: true })],
      [noBanco({ cancel_at_period_end: false })],
    )
    expect(d.tipo).toBe('cancelamento_diferente')
    expect(d.noStripe).toBe(true)
  })

  it('null no banco e false no Stripe são a mesma coisa', () => {
    expect(compararAssinaturas(
      [noStripe({ cancelaNoFim: false })],
      [noBanco({ cancel_at_period_end: null })],
    )).toEqual([])
  })

  it('linha viva que o Stripe desconhece exige análise, não correção', () => {
    // Não é dado velho, é dado inventado. Apagar em silêncio esconderia a
    // pergunta de onde a linha veio.
    const [d] = compararAssinaturas([], [noBanco({ status: 'active' })])
    expect(d.tipo).toBe('ausente_no_stripe')
    expect(d.corrigivel).toBe(false)
  })

  it('linha cancelada e ausente no Stripe é desfecho normal', () => {
    expect(compararAssinaturas([], [noBanco({ status: 'cancelled' })])).toEqual([])
  })

  it('linha sem id do gateway é ignorada dos dois lados', () => {
    // Assinatura concedida por chave de ativação não existe no Stripe e não
    // deveria aparecer como divergência.
    expect(compararAssinaturas([], [noBanco({ gateway_subscription_id: null })])).toEqual([])
  })

  it('acumula divergências distintas da mesma assinatura', () => {
    const d = compararAssinaturas(
      [noStripe({ status: 'canceled', valor: 20, intervalo: 'year' })],
      [noBanco({ status: 'active', price_paid: 97, billing_cycle: 'monthly' })],
    )
    expect(d.map(x => x.tipo).sort()).toEqual(
      ['ciclo_diferente', 'status_diferente', 'valor_diferente'])
  })
})

describe('statusEquivalente', () => {
  it('traduz o vocabulário do Stripe para o da coluna', () => {
    // Sem isto, `active` contra `active` pareceria divergência toda vez.
    expect(statusEquivalente('active')).toBe('active')
    expect(statusEquivalente('trialing')).toBe('active')
    expect(statusEquivalente('past_due')).toBe('past_due')
    expect(statusEquivalente('unpaid')).toBe('past_due')
    expect(statusEquivalente('canceled')).toBe('cancelled')
    expect(statusEquivalente('incomplete_expired')).toBe('cancelled')
    expect(statusEquivalente('incomplete')).toBe('pending')
  })

  it('status desconhecido passa como veio, em vez de virar outro', () => {
    // Inventar uma tradução esconderia um status novo do Stripe.
    expect(statusEquivalente('status_novo_do_stripe')).toBe('status_novo_do_stripe')
  })
})

describe('resumirDivergencias', () => {
  it('conta por tipo', () => {
    const d = compararAssinaturas(
      [noStripe({ id: 'sub_1' }), noStripe({ id: 'sub_2' })],
      [],
    )
    expect(resumirDivergencias(d)).toEqual({ ausente_no_banco: 2 })
  })

  it('lista vazia resume em objeto vazio', () => {
    expect(resumirDivergencias([])).toEqual({})
  })
})
