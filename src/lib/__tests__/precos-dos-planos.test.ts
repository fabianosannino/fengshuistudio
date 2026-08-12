import { describe, expect, it } from 'vitest'
import {
  PRECOS_DOS_PLANOS, mensalEquivalenteCentavos, descontoAnualPercentual,
  formatarCentavos,
} from '../plano-utils'

/**
 * Os valores do catálogo de produção do Stripe, conferidos em 12/08/2026 com
 * `scripts/stripe/conferir-precos.mts`. Se algum destes falhar, o app está
 * anunciando um preço diferente do que o cartão do cliente vai pagar — que foi
 * exatamente o defeito que originou este módulo.
 */
const STRIPE_PRODUCAO = {
  simples: { mensal: 2000, anual: 16800 },
  profissional: { mensal: 4990, anual: 41160 },
} as const

describe('PRECOS_DOS_PLANOS', () => {
  it('bate com o catálogo do Stripe', () => {
    for (const [plano, esperado] of Object.entries(STRIPE_PRODUCAO)) {
      const preco = PRECOS_DOS_PLANOS[plano as keyof typeof STRIPE_PRODUCAO]
      expect(preco.mensalCentavos, `${plano} mensal`).toBe(esperado.mensal)
      expect(preco.anualCentavos, `${plano} anual`).toBe(esperado.anual)
    }
  })

  it('o Free não cobra nada', () => {
    expect(PRECOS_DOS_PLANOS.free).toEqual({ mensalCentavos: 0, anualCentavos: 0 })
  })

  it('o anual nunca custa mais que doze mensalidades', () => {
    // Um plano anual mais caro que pagar mês a mês não é um plano, é um erro
    // de digitação — e o cliente só descobriria na fatura.
    for (const [plano, { mensalCentavos, anualCentavos }] of Object.entries(PRECOS_DOS_PLANOS)) {
      expect(anualCentavos, plano).toBeLessThanOrEqual(mensalCentavos * 12)
    }
  })
})

describe('mensalEquivalenteCentavos', () => {
  it('arredonda para baixo — anunciar acima do cobrado é o defeito original', () => {
    // 41160 / 12 = 3430 exato; 16800 / 12 = 1400 exato. O piso importa para
    // valores que não dividem certo.
    expect(mensalEquivalenteCentavos('profissional')).toBe(3430)
    expect(mensalEquivalenteCentavos('simples')).toBe(1400)
    expect(mensalEquivalenteCentavos('free')).toBe(0)
  })

  it('nunca passa do preço mensal cheio', () => {
    for (const plano of ['free', 'simples', 'profissional'] as const) {
      expect(mensalEquivalenteCentavos(plano), plano)
        .toBeLessThanOrEqual(PRECOS_DOS_PLANOS[plano].mensalCentavos)
    }
  })
})

describe('descontoAnualPercentual', () => {
  it('calcula o desconto real, não o presumido', () => {
    // `/precos` assumia «dois meses grátis» (17%) e anunciava R$ 40,83/mês no
    // Profissional, quando o Stripe cobra R$ 34,30 — a página vendia caro.
    expect(descontoAnualPercentual('profissional')).toBe(31)
    expect(descontoAnualPercentual('simples')).toBe(30)
  })

  it('Free devolve null, não zero', () => {
    // «Sem desconto» e «não se aplica» são coisas diferentes; 0% no Free seria
    // um selo sem sentido.
    expect(descontoAnualPercentual('free')).toBeNull()
  })
})

describe('formatarCentavos', () => {
  it('mantém as duas casas — preço não abrevia', () => {
    // `49.9` exibido como «R$ 49,9» é o começo do caminho que levou a «R$ 49».
    expect(formatarCentavos(4990)).toBe('R$ 49,90')
    expect(formatarCentavos(2000)).toBe('R$ 20,00')
    expect(formatarCentavos(41160)).toBe('R$ 411,60')
    expect(formatarCentavos(0)).toBe('R$ 0,00')
  })
})
