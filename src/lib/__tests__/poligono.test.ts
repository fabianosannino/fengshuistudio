import { describe, it, expect } from 'vitest'
import {
  areaPoligono, centroidePoligono, pontoDentroDoPoligono, calcularTaiJi,
  retanguloDelimitador, recortarPoligono, coberturaPorCelula, setoresAusentes,
  type Ponto,
} from '../poligono'

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

describe('retanguloDelimitador', () => {
  it('quadrado: delimitador é ele mesmo', () => {
    expect(retanguloDelimitador([{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 4 }, { x: 0, y: 4 }]))
      .toEqual({ x: 0, y: 0, w: 4, h: 4 })
  })

  it('formato em L: delimitador é o retângulo total, não a área real', () => {
    const pontosL: Ponto[] = [
      { x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 2 }, { x: 2, y: 2 }, { x: 2, y: 4 }, { x: 0, y: 4 },
    ]
    expect(retanguloDelimitador(pontosL)).toEqual({ x: 0, y: 0, w: 4, h: 4 })
  })

  it('lista vazia → null', () => {
    expect(retanguloDelimitador([])).toBeNull()
  })
})

describe('recortarPoligono', () => {
  it('polígono totalmente dentro do retângulo: devolve a mesma área', () => {
    const quadrado: Ponto[] = [{ x: 2, y: 2 }, { x: 4, y: 2 }, { x: 4, y: 4 }, { x: 2, y: 4 }]
    const recorte = recortarPoligono(quadrado, { x: 0, y: 0, w: 10, h: 10 })
    expect(areaPoligono(recorte)).toBeCloseTo(4)
  })

  it('polígono totalmente fora: devolve vazio', () => {
    const quadrado: Ponto[] = [{ x: 20, y: 20 }, { x: 24, y: 20 }, { x: 24, y: 24 }, { x: 20, y: 24 }]
    expect(recortarPoligono(quadrado, { x: 0, y: 0, w: 10, h: 10 })).toEqual([])
  })

  it('triângulo cortado ao meio por um retângulo: área é metade da original', () => {
    // Triângulo (0,0)-(10,0)-(10,10), área 50. Recorte em x<=5 corta a metade esquerda.
    const triangulo: Ponto[] = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }]
    expect(areaPoligono(triangulo)).toBeCloseTo(50)
    const recorte = recortarPoligono(triangulo, { x: 0, y: 0, w: 5, h: 10 })
    expect(areaPoligono(recorte)).toBeCloseTo(12.5) // triângulo semelhante de lado 5: área (5*5)/2
  })
})

describe('coberturaPorCelula', () => {
  it('quadrado que preenche exatamente o próprio bounding box: cobertura 1 em todas as 9 células', () => {
    const quadrado: Ponto[] = [{ x: 0, y: 0 }, { x: 9, y: 0 }, { x: 9, y: 9 }, { x: 0, y: 9 }]
    const celulas = coberturaPorCelula(quadrado)
    expect(celulas).toHaveLength(9)
    for (const c of celulas) expect(c.cobertura).toBeCloseTo(1)
  })

  it('formato em L alinhado à grade 3×3 (9x9 menos o bloco 3x3 superior-direito): essa célula tem cobertura 0, as outras 8 têm cobertura 1', () => {
    const pontosL: Ponto[] = [
      { x: 0, y: 0 }, { x: 6, y: 0 }, { x: 6, y: 3 }, { x: 9, y: 3 }, { x: 9, y: 9 }, { x: 0, y: 9 },
    ]
    const celulas = coberturaPorCelula(pontosL)
    const celulaFaltante = celulas.find(c => c.linha === 0 && c.coluna === 2)!
    expect(celulaFaltante.cobertura).toBeCloseTo(0)
    for (const c of celulas) {
      if (c.linha === 0 && c.coluna === 2) continue
      expect(c.cobertura).toBeCloseTo(1)
    }
  })

  it('triângulo diagonal: gera cobertura fracionária (0, 0.5 e 1) nas células certas', () => {
    // Triângulo (0,0)-(9,0)-(9,9), metade do quadrado 9x9 (abaixo da diagonal y=x).
    const triangulo: Ponto[] = [{ x: 0, y: 0 }, { x: 9, y: 0 }, { x: 9, y: 9 }]
    const celulas = coberturaPorCelula(triangulo)
    const cobertura = (linha: number, coluna: number) => celulas.find(c => c.linha === linha && c.coluna === coluna)!.cobertura
    expect(cobertura(0, 0)).toBeCloseTo(0.5)
    expect(cobertura(0, 1)).toBeCloseTo(1)
    expect(cobertura(0, 2)).toBeCloseTo(1)
    expect(cobertura(1, 0)).toBeCloseTo(0)
    expect(cobertura(1, 1)).toBeCloseTo(0.5)
    expect(cobertura(1, 2)).toBeCloseTo(1)
    expect(cobertura(2, 0)).toBeCloseTo(0)
    expect(cobertura(2, 1)).toBeCloseTo(0)
    expect(cobertura(2, 2)).toBeCloseTo(0.5)
  })

  it('polígono degenerado → lista vazia', () => {
    expect(coberturaPorCelula([{ x: 0, y: 0 }, { x: 1, y: 1 }])).toEqual([])
  })
})

describe('setoresAusentes', () => {
  it('quadrado perfeito: nenhum setor ausente', () => {
    const quadrado: Ponto[] = [{ x: 0, y: 0 }, { x: 9, y: 0 }, { x: 9, y: 9 }, { x: 0, y: 9 }]
    expect(setoresAusentes(quadrado)).toEqual([])
  })

  it('formato em L: exatamente a célula removida aparece como setor ausente', () => {
    const pontosL: Ponto[] = [
      { x: 0, y: 0 }, { x: 6, y: 0 }, { x: 6, y: 3 }, { x: 9, y: 3 }, { x: 9, y: 9 }, { x: 0, y: 9 },
    ]
    const ausentes = setoresAusentes(pontosL)
    expect(ausentes).toHaveLength(1)
    expect(ausentes[0]).toMatchObject({ linha: 0, coluna: 2 })
  })

  it('nunca inclui a célula Central (linha 1, coluna 1), mesmo com limiar permissivo', () => {
    const pontosL: Ponto[] = [
      { x: 0, y: 0 }, { x: 6, y: 0 }, { x: 6, y: 3 }, { x: 9, y: 3 }, { x: 9, y: 9 }, { x: 0, y: 9 },
    ]
    const ausentes = setoresAusentes(pontosL, 0.99) // limiar quase máximo: quase tudo "conta" como ausente
    expect(ausentes.some(c => c.linha === 1 && c.coluna === 1)).toBe(false)
  })
})
