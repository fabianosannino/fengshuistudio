import { describe, expect, it } from 'vitest'
import {
  declinacaoAutomatica, explicarFalha, LAT_LIMITE_CONFIAVEL,
} from '../declinacao-automatica'
import { magneticoParaVerdadeiro, declinacaoPlausivel } from '../declinacao-magnetica'
import { montanhaDoGrau } from '../montanhas'

/** Data dentro da janela de validade do ciclo WMM vigente (2024-11 a 2029-11). */
const HOJE = new Date('2026-07-26T12:00:00Z')

describe('valores conferidos contra a calculadora oficial do NOAA', () => {
  // Tolerância de 1°: o teste existe para pegar erro de sinal, de ordem
  // lat/lon ou de modelo expirado — não para auditar o WMM, que é a fonte.
  const CASOS: Array<[string, number, number, number]> = [
    ['São Paulo', -23.55, -46.63, -21.9],
    ['Brasília', -15.79, -47.88, -22.1],
    ['Manaus', -3.12, -60.02, -17.0],
    ['Londres', 51.51, -0.13, 1.2],
    ['Tóquio', 35.68, 139.69, -7.9],
  ]

  for (const [cidade, lat, lon, esperado] of CASOS) {
    it(`${cidade}: ~${esperado}°`, () => {
      const r = declinacaoAutomatica(lat, lon, HOJE)
      expect(r.ok, `falhou: ${!r.ok ? r.motivo : ''}`).toBe(true)
      if (!r.ok) return
      expect(r.declinacao).toBeCloseTo(esperado, 0)
    })
  }

  it('o Brasil tem declinação OESTE (negativa) — pega inversão de sinal', () => {
    // Se alguém trocar o sinal, todos os "close to" acima ainda poderiam passar
    // por arredondamento em algum ponto; esta asserção é direta.
    for (const [, lat, lon] of CASOS.slice(0, 3)) {
      const r = declinacaoAutomatica(lat, lon, HOJE)
      expect(r.ok).toBe(true)
      if (r.ok) expect(r.declinacao).toBeLessThan(0)
    }
  })

  it('lat/lon trocados dão resultado diferente — a ordem do par importa', () => {
    // geomagnetism recebe [lat, lon]. Inverter é o erro clássico e silencioso.
    const certo = declinacaoAutomatica(-23.55, -46.63, HOJE)
    const trocado = declinacaoAutomatica(-46.63, -23.55, HOJE)
    expect(certo.ok && trocado.ok).toBe(true)
    if (certo.ok && trocado.ok) {
      expect(Math.abs(certo.declinacao - trocado.declinacao)).toBeGreaterThan(1)
    }
  })
})

describe('proveniência: o modelo se identifica', () => {
  it('devolve nome do modelo e fim da validade', () => {
    const r = declinacaoAutomatica(-23.55, -46.63, HOJE)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    // O consultor tem direito de saber QUAL modelo produziu o número.
    expect(r.modelo).toMatch(/^WMM/)
    expect(new Date(r.validoAte).getTime()).toBeGreaterThan(HOJE.getTime())
  })

  it('arredonda a 1 casa — mais dígitos seriam precisão falsa', () => {
    const r = declinacaoAutomatica(-23.55, -46.63, HOJE)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.declinacao * 10).toBeCloseTo(Math.round(r.declinacao * 10), 10)
  })
})

describe('fail-closed: nunca devolve zero como padrão', () => {
  it('data fora da janela de validade do WMM não extrapola — falha', () => {
    // O ponto central desta feature. Quando o ciclo expirar, o cálculo para de
    // funcionar em vez de devolver número plausível e errado.
    const r = declinacaoAutomatica(-23.55, -46.63, new Date('2040-01-01'))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.motivo).toBe('fora-da-validade-do-modelo')
  })

  it('data anterior ao modelo mais antigo também falha', () => {
    const r = declinacaoAutomatica(-23.55, -46.63, new Date('1990-01-01'))
    expect(r.ok).toBe(false)
  })

  it.each([
    ['NaN', NaN, 0],
    ['latitude > 90', 91, 0],
    ['latitude < -90', -91, 0],
    ['longitude > 180', 0, 181],
    ['longitude < -180', 0, -181],
  ])('coordenada inválida (%s) devolve motivo, não zero', (_rotulo, lat, lon) => {
    const r = declinacaoAutomatica(lat, lon, HOJE)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.motivo).toBe('coordenada-invalida')
  })

  it('latitude polar é recusada: a bússola não é confiável lá', () => {
    const r = declinacaoAutomatica(LAT_LIMITE_CONFIAVEL + 1, 0, HOJE)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.motivo).toBe('latitude-extrema')
  })

  it('toda falha tem mensagem que aponta a entrada manual', () => {
    const motivos = [
      'coordenada-invalida', 'latitude-extrema',
      'fora-da-validade-do-modelo', 'resultado-implausivel',
    ] as const
    for (const m of motivos) {
      const texto = explicarFalha(m)
      expect(texto.length).toBeGreaterThan(20)
      // Exceto na latitude polar, onde nem a bússola serve, a saída é manual.
      if (m !== 'latitude-extrema') expect(texto).toMatch(/manualmente/)
    }
  })
})

describe('integração com o resto do sistema', () => {
  it('o resultado passa pelo MESMO validador da entrada manual', () => {
    const r = declinacaoAutomatica(-23.55, -46.63, HOJE)
    expect(r.ok).toBe(true)
    if (r.ok) expect(declinacaoPlausivel(r.declinacao)).toBe(true)
  })

  it('aplicar a declinação de SP desloca a leitura em ~1,5 Montanha', () => {
    // É o motivo de tudo isto existir (ADR 0014): ignorar a declinação no
    // Brasil erra a Montanha. Aqui isso fica demonstrado, não afirmado.
    const r = declinacaoAutomatica(-23.55, -46.63, HOJE)
    expect(r.ok).toBe(true)
    if (!r.ok) return

    const magnetico = 10
    const verdadeiro = magneticoParaVerdadeiro(magnetico, r.declinacao)
    expect(montanhaDoGrau(magnetico).pinyin).not.toBe(montanhaDoGrau(verdadeiro).pinyin)
    // ~21,9° de declinação / 15° por Montanha ≈ 1,5 Montanha de erro.
    expect(Math.abs(r.declinacao) / 15).toBeGreaterThan(1)
  })
})
