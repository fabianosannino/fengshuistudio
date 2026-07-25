import { describe, it, expect } from 'vitest'
import { areaPoligono, centroidePoligono, pontoDentroDoPoligono, calcularTaiJi, type Ponto } from '../poligono'

describe('areaPoligono', () => {
  it('quadrado 4x4 tem área 16', () => {
    expect(areaPoligono([{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 4 }, { x: 0, y: 4 }])).toBe(16)
  })

  it('é a mesma independente do sentido (horário vs anti-horário)', () => {
    const horario: Ponto[] = [{ x: 0, y: 0 }, { x: 0, y: 4 }, { x: 4, y: 4 }, { x: 4, y: 0 }]
    const antiHorario: Ponto[] = [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 4 }, { x: 0, y: 4 }]
    expect(areaPoligono(horario)).toBe(areaPoligono(antiHorario))
  })

  it('menos de 3 pontos → 0', () => {
    expect(areaPoligono([{ x: 0, y: 0 }, { x: 1, y: 1 }])).toBe(0)
  })
})

describe('centroidePoligono', () => {
  it('quadrado: centróide é o centro geométrico simples', () => {
    const c = centroidePoligono([{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 4 }, { x: 0, y: 4 }])!
    expect(c.x).toBeCloseTo(2)
    expect(c.y).toBeCloseTo(2)
  })

  it('retângulo não quadrado: centróide no meio de cada dimensão', () => {
    const c = centroidePoligono([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 2 }, { x: 0, y: 2 }])!
    expect(c.x).toBeCloseTo(5)
    expect(c.y).toBeCloseTo(1)
  })

  it('formato em L: centróide NÃO é a média dos vértices (verificado por decomposição manual em retângulos)', () => {
    // L: quadrado 4x4 menos um recorte 2x2 no canto superior direito.
    const pontosL: Ponto[] = [
      { x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 2 }, { x: 2, y: 2 }, { x: 2, y: 4 }, { x: 0, y: 4 },
    ]
    // Decomposição manual: R1 (0,0)-(4,2) área 8 centro (2,1); R2 (0,2)-(2,4) área 4 centro (1,3).
    // Centróide combinado = (8*2+4*1)/12, (8*1+4*3)/12 = 20/12, 20/12 ≈ 1.667.
    const c = centroidePoligono(pontosL)!
    expect(c.x).toBeCloseTo(20 / 12, 5)
    expect(c.y).toBeCloseTo(20 / 12, 5)
    // A média aritmética ingênua dos 6 vértices seria (2, 2) — bem diferente do centróide real.
    const mediaVertices = { x: pontosL.reduce((s, p) => s + p.x, 0) / 6, y: pontosL.reduce((s, p) => s + p.y, 0) / 6 }
    expect(Math.abs(c.x - mediaVertices.x)).toBeGreaterThan(0.1)
  })

  it('formato em U (côncavo): centróide cai na reentrância, fora da área sólida', () => {
    // U: quadrado 6x6 com um recorte retangular no meio do topo (x:1-5, y:1-6).
    const pontosU: Ponto[] = [
      { x: 0, y: 0 }, { x: 6, y: 0 }, { x: 6, y: 6 }, { x: 5, y: 6 }, { x: 5, y: 1 },
      { x: 1, y: 1 }, { x: 1, y: 6 }, { x: 0, y: 6 },
    ]
    // Decomposição manual: perna esq. (0,0)-(1,6) área 6 centro (0.5,3);
    // perna dir. (5,0)-(6,6) área 6 centro (5.5,3); base (1,0)-(5,1) área 4 centro (3,0.5).
    // Centróide = (6*0.5+6*5.5+4*3)/16, (6*3+6*3+4*0.5)/16 = 48/16, 38/16 = 3, 2.375.
    const c = centroidePoligono(pontosU)!
    expect(c.x).toBeCloseTo(3, 5)
    expect(c.y).toBeCloseTo(2.375, 5)
    // Esse ponto cai dentro do recorte vazio (x em [1,5], y em [1,6]) — fora da área construída real.
    expect(pontoDentroDoPoligono(c, pontosU)).toBe(false)
  })

  it('polígono degenerado (< 3 pontos ou área zero) → null', () => {
    expect(centroidePoligono([{ x: 0, y: 0 }, { x: 1, y: 1 }])).toBeNull()
    expect(centroidePoligono([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }])).toBeNull() // colinear, área 0
  })
})

describe('pontoDentroDoPoligono', () => {
  const quadrado: Ponto[] = [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 4 }, { x: 0, y: 4 }]

  it('ponto claramente dentro', () => {
    expect(pontoDentroDoPoligono({ x: 2, y: 2 }, quadrado)).toBe(true)
  })

  it('ponto claramente fora', () => {
    expect(pontoDentroDoPoligono({ x: 10, y: 10 }, quadrado)).toBe(false)
  })
})

describe('calcularTaiJi', () => {
  it('planta retangular: Tai Ji dentro da área, sem diagnóstico', () => {
    const r = calcularTaiJi([{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 4 }, { x: 0, y: 4 }])!
    expect(r.centro).toEqual({ x: 2, y: 2 })
    expect(r.centroForaDaArea).toBe(false)
  })

  it('planta em U: Tai Ji cai fora da área construída — diagnóstico ativado', () => {
    const pontosU: Ponto[] = [
      { x: 0, y: 0 }, { x: 6, y: 0 }, { x: 6, y: 6 }, { x: 5, y: 6 }, { x: 5, y: 1 },
      { x: 1, y: 1 }, { x: 1, y: 6 }, { x: 0, y: 6 },
    ]
    const r = calcularTaiJi(pontosU)!
    expect(r.centroForaDaArea).toBe(true)
  })

  it('polígono degenerado → null', () => {
    expect(calcularTaiJi([{ x: 0, y: 0 }, { x: 1, y: 1 }])).toBeNull()
  })
})
