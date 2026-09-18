import { describe, expect, it } from 'vitest'
import { ambienteStripePermitido } from '../src/lib/ambiente-stripe'
describe('isolamento do ambiente de cobrança', () => {
  for (const prefix of ['sk', 'rk']) {
    it.each([undefined, 'development', 'preview'])(`${prefix}: ambiente %s só aceita teste`, ambiente => {
      expect(ambienteStripePermitido(`${prefix}_live_synthetic`, ambiente)).toBe(false)
      expect(ambienteStripePermitido(`${prefix}_test_synthetic`, ambiente)).toBe(true)
    })
    it(`${prefix}: produção só aceita live`, () => {
      expect(ambienteStripePermitido(`${prefix}_test_synthetic`, 'production')).toBe(false)
      expect(ambienteStripePermitido(`${prefix}_live_synthetic`, 'production')).toBe(true)
    })
  }
  it('formato desconhecido falha fechado', () => {
    expect(ambienteStripePermitido('unknown', 'production')).toBe(false)
  })
})
