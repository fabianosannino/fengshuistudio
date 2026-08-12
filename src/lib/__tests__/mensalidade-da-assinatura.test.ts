import { describe, expect, it } from 'vitest'
import { mensalidadeDaAssinatura } from '../plano-utils'

describe('mensalidadeDaAssinatura', () => {
  it('mensal vale o que foi cobrado', () => {
    expect(mensalidadeDaAssinatura({ price_paid: 49.9, billing_cycle: 'monthly' })).toBe(49.9)
  })

  it('anual é diluído em doze', () => {
    expect(mensalidadeDaAssinatura({ price_paid: 411.6, billing_cycle: 'yearly' })).toBeCloseTo(34.3, 2)
  })

  it('vale o que foi pago, não o preço de tabela', () => {
    // Quem assinou por R$ 20 continua valendo R$ 20 mesmo depois de a tabela
    // subir. O MRR saía de `plans.price_monthly`, que esteve em R$ 97 enquanto
    // o Stripe cobrava R$ 20 — cinco vezes a receita que existia.
    expect(mensalidadeDaAssinatura({ price_paid: 20, billing_cycle: 'monthly' })).toBe(20)
  })

  it('gratuidade real vale zero, e zero é um valor', () => {
    expect(mensalidadeDaAssinatura({ price_paid: 0, billing_cycle: 'monthly' })).toBe(0)
  })

  it('sem valor gravado é null, não zero', () => {
    // Somar zero mentiria para baixo com a mesma confiança com que a tabela
    // mentia para cima. Quem chama precisa declarar a lacuna.
    for (const v of [null, undefined]) {
      expect(mensalidadeDaAssinatura({ price_paid: v, billing_cycle: 'monthly' }), String(v)).toBeNull()
    }
  })

  it('valor negativo é dado corrompido, não crédito', () => {
    expect(mensalidadeDaAssinatura({ price_paid: -10, billing_cycle: 'monthly' })).toBeNull()
  })

  it('ciclo ausente é tratado como mensal', () => {
    // É o que o resto do código assume quando `billing_cycle` não é 'yearly'.
    expect(mensalidadeDaAssinatura({ price_paid: 30 })).toBe(30)
  })
})
