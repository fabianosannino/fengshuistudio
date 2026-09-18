import { describe, expect, it } from 'vitest'
import { analisarContornoNaGrade } from '../contorno-na-grade'
import { areaPoligono, calcularTaiJi, type Ponto } from '../poligono'

const referencia = { x: 0, y: 0, w: 300, h: 300 }
const retangulo = [{ x: 0, y: 0 }, { x: 300, y: 0 }, { x: 300, y: 300 }, { x: 0, y: 300 }]
// Recuo de 100 × 100 no meio superior; extensão de 60 × 100 no meio direito.
const recuo: Ponto[] = [
  { x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 200, y: 100 },
  { x: 200, y: 0 }, { x: 300, y: 0 }, { x: 300, y: 300 }, { x: 0, y: 300 },
]
const comExtensao = [...recuo.slice(0, 6),
  { x: 300, y: 100 }, { x: 360, y: 100 }, { x: 360, y: 200 }, { x: 300, y: 200 },
  ...recuo.slice(6)]

describe('E-CONT-02 — contorno sobre referência fixa', () => {
  it('retângulo completo cobre as nove células, sem falta ou área externa', () => {
    const celulas = analisarContornoNaGrade(retangulo, referencia)
    expect(celulas).toHaveLength(9)
    expect(celulas.every(c => c.cobertura === 1 && !c.ausente && c.excessoArea === 0)).toBe(true)
  })

  it('acrescentar uma extensão preserva a falta e todos os limites; só o centroide muda', () => {
    const antes = analisarContornoNaGrade(recuo, referencia)
    const depois = analisarContornoNaGrade(comExtensao, referencia)
    expect(depois.map(c => c.limites)).toEqual(antes.map(c => c.limites))
    expect(depois.map(c => c.cobertura)).toEqual(antes.map(c => c.cobertura))
    expect(depois[1]).toEqual(antes[1])
    expect(depois[1]).toMatchObject({ ausente: true, cobertura: 0, limites: { x: 100, y: 0, w: 100, h: 100 } })
    expect(depois.map(c => c.excessoArea)).toEqual([0, 0, 0, 0, 0, 6000, 0, 0, 0])
    expect(calcularTaiJi(comExtensao)?.centro).not.toEqual(calcularTaiJi(recuo)?.centro)
    expect(referencia).toEqual({ x: 0, y: 0, w: 300, h: 300 })
  })

  it('conta saliências dos quatro lados e dos cantos uma única vez', () => {
    const pontos = [{ x: -60, y: -60 }, { x: 360, y: -60 }, { x: 360, y: 360 }, { x: -60, y: 360 }]
    const celulas = analisarContornoNaGrade(pontos, referencia)
    expect(celulas.reduce((a, c) => a + c.excessoArea, 0)).toBe(420 * 420 - 300 * 300)
    expect(celulas[0].excessoArea).toBe(15600)
    expect(celulas[4].excessoArea).toBe(0)
    expect(celulas.every(c => c.cobertura === 1 && !c.ausente)).toBe(true)
    expect(celulas.flatMap(c => c.poligonosExternos).reduce((a, p) => a + areaPoligono(p), 0)).toBe(86400)
  })

  it('preserva divisórias salvas e a soma de área com polígonos côncavos', () => {
    const celulas = analisarContornoNaGrade(comExtensao, referencia, [0.25, 0.75], [0.2, 0.8])
    expect(celulas[4].limites).toEqual({ x: 60, y: 75, w: 180, h: 150 })
    const interna = celulas.reduce((a, c) => a + c.cobertura * c.limites.w * c.limites.h, 0)
    const externa = celulas.reduce((a, c) => a + c.excessoArea, 0)
    expect(interna + externa).toBeCloseTo(areaPoligono(comExtensao))
  })

  it('a orientação dos vértices não altera cobertura ou área', () => {
    const resumir = (p: Ponto[]) => analisarContornoNaGrade(p, referencia).map(({ cobertura, excessoArea, ausente }) => ({ cobertura, excessoArea, ausente }))
    expect(resumir([...comExtensao].reverse())).toEqual(resumir(comExtensao))
  })

  it.each([
    { ...referencia, w: 0 }, { ...referencia, h: -1 }, { ...referencia, x: NaN },
    { ...referencia, x: 1e16, w: 4 },
  ])('recusa referência inválida sem números enganosos: %j', b => {
    expect(analisarContornoNaGrade(retangulo, b)).toEqual([])
  })

  it('recusa pontos degenerados/não finitos e divisórias fora de ordem', () => {
    expect(analisarContornoNaGrade([{ x: 1, y: 1 }], referencia)).toEqual([])
    expect(analisarContornoNaGrade([{ x: NaN, y: 1 }, ...retangulo], referencia)).toEqual([])
    expect(analisarContornoNaGrade(retangulo, referencia, [0.8, 0.2])).toEqual([])
  })
})
