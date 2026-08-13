import { describe, expect, it } from 'vitest'
import {
  saldoPorParte, razaoConfereComOTotal, liquidoDoConsultor, type Lancamento,
} from '../lancamentos-do-pedido'

function l(
  tipo: string, valor: number, pagador: string, recebedor: string
): Lancamento {
  return { tipo, valor_centavos: valor, pagador, recebedor }
}

/**
 * A venda real de 13/08: R$ 5,00, comissão de R$ 0,50, tarifa do Stripe de
 * R$ 0,59. O extrato do Stripe mostrou líquido de R$ 3,91 — e é esse número
 * que o razão precisa reproduzir.
 */
const VENDA_REAL: Lancamento[] = [
  l('produto', 500, 'comprador', 'consultor'),
  l('comissao_plataforma', 50, 'consultor', 'plataforma'),
  l('tarifa_gateway', 59, 'consultor', 'gateway'),
]

/** O reembolso de 16:00, com a plataforma devolvendo a comissão. */
const REEMBOLSO: Lancamento[] = [
  l('reembolso', 500, 'consultor', 'comprador'),
  l('estorno_comissao', 50, 'plataforma', 'consultor'),
]

describe('saldoPorParte', () => {
  it('reproduz o líquido da venda real: R$ 3,91', () => {
    // Conferido contra o extrato do Stripe, não contra a nossa aritmética.
    expect(liquidoDoConsultor(VENDA_REAL)).toBe(391)
  })

  it('distribui a venda entre as quatro partes', () => {
    expect(saldoPorParte(VENDA_REAL)).toEqual({
      comprador: -500, consultor: 391, plataforma: 50, gateway: 59,
    })
  })

  it('DEVOLUÇÃO INTEGRAL: o consultor fica negativo na tarifa que não volta', () => {
    // É o número que precisa aparecer na tela antes de ele vender barato com
    // frete: mesmo com a plataforma devolvendo a comissão inteira, a devolução
    // custa a tarifa do gateway.
    const tudo = [...VENDA_REAL, ...REEMBOLSO]
    expect(liquidoDoConsultor(tudo)).toBe(-59)
  })

  it('no arrependimento o comprador sai inteiro e a plataforma zera', () => {
    const saldo = saldoPorParte([...VENDA_REAL, ...REEMBOLSO])
    expect(saldo.comprador).toBe(0)   // recebeu tudo de volta
    expect(saldo.plataforma).toBe(0)  // devolveu o que reteve
    expect(saldo.gateway).toBe(59)    // ficou com a tarifa
  })

  it('razão vazio é zero em todas as partes', () => {
    expect(saldoPorParte([])).toEqual({
      comprador: 0, consultor: 0, plataforma: 0, gateway: 0,
    })
  })

  it('valor ilegível não contamina a soma', () => {
    const comLixo = [...VENDA_REAL, l('produto', NaN, 'comprador', 'consultor')]
    expect(liquidoDoConsultor(comLixo)).toBe(391)
  })
})

describe('razaoConfereComOTotal', () => {
  /*
   * Este bloco começou como `razaoFecha`, que somava os saldos das quatro
   * partes e conferia se dava zero. Foi este teste que mostrou o problema: a
   * soma dá zero SEMPRE, porque todo lançamento tira de uma parte conhecida e
   * entrega a outra. Com a tarifa do gateway removida, ele continuava
   * «fechando». Era uma verificação que não podia falhar.
   *
   * A função foi trocada por esta, que compara com um número de fora — o
   * total do pedido. Detectar lançamento faltando de verdade exige comparar
   * com o saldo no Stripe, e isso é reconciliação, não aritmética.
   */
  it('confere quando o comprador pagou o total do pedido', () => {
    expect(razaoConfereComOTotal(VENDA_REAL, 500)).toBe(true)
  })

  it('acusa frete cobrado e não lançado', () => {
    // O caso da fase 3: pedido de R$ 5 mais R$ 2 de frete, com o frete
    // ausente do razão.
    expect(razaoConfereComOTotal(VENDA_REAL, 700)).toBe(false)
  })

  it('o reembolso não muda o que o comprador pagou', () => {
    // Ele pagou 500 e recebeu 500 de volta. O total pago continua sendo 500 —
    // fundir as duas coisas apagaria que a compra existiu.
    expect(razaoConfereComOTotal([...VENDA_REAL, ...REEMBOLSO], 500)).toBe(true)
  })
})
