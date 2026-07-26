import { describe, expect, it } from 'vitest'
import { processarAmostrasBussola } from '../bussola-dispositivo'

describe('processarAmostrasBussola', () => {
  it('devolve tudo null/zero para array vazio (fail-closed)', () => {
    const r = processarAmostrasBussola([])
    expect(r).toEqual({
      media: null, desvio: null, amostrasTotais: 0, amostrasUsadas: 0, amostrasDescartadas: 0, confianca: null,
    })
  })

  it('amostra única: sem outlier a rejeitar, confiança alta', () => {
    const r = processarAmostrasBussola([123])
    expect(r.media).toBeCloseTo(123, 5)
    expect(r.desvio).toBe(0)
    expect(r.amostrasUsadas).toBe(1)
    expect(r.amostrasDescartadas).toBe(0)
    expect(r.confianca).toBe('high')
  })

  it('amostras idênticas (MAD=0): nenhuma rejeitada, confiança alta', () => {
    const r = processarAmostrasBussola([10, 10, 10, 10])
    expect(r.media).toBeCloseTo(10, 5)
    expect(r.desvio).toBe(0)
    expect(r.amostrasUsadas).toBe(4)
    expect(r.amostrasDescartadas).toBe(0)
    expect(r.confianca).toBe('high')
  })

  it('rejeita 1 outlier evidente entre um cluster apertado', () => {
    const r = processarAmostrasBussola([10, 10, 10, 10, 10, 10, 50])
    expect(r.amostrasUsadas).toBe(6)
    expect(r.amostrasDescartadas).toBe(1)
    expect(r.media).toBeCloseTo(10, 5)
    expect(r.desvio).toBe(0)
    expect(r.confianca).toBe('high')
  })

  it('rejeita outlier corretamente através da descontinuidade 359°/0° (aritmética circular)', () => {
    // Cluster em torno de 0° (usando o "lado" 359-361=1), mais um outlier bem distante em 200°.
    const r = processarAmostrasBussola([359, 0, 1, 359, 0, 1, 200])
    expect(r.amostrasUsadas).toBe(6)
    expect(r.amostrasDescartadas).toBe(1)
    // Média circular do cluster {359,0,1,359,0,1} deve cair perto de 0°, não de 180° (o que
    // uma média aritmética ingênua daria) — é exatamente o bug que mediaCircular existe para evitar.
    expect(r.media).not.toBeNull()
    expect(Math.min(r.media as number, 360 - (r.media as number))).toBeLessThan(2)
    expect(r.confianca).toBe('high')
  })

  it('escala realista (~50 amostras/5s): cluster apertado com poucos picos de interferência', () => {
    const cluster = [88, 89, 90, 91, 92, 89, 90, 91, 90, 89]
    const amostras = Array.from({ length: 47 }, (_, i) => cluster[i % cluster.length])
    amostras.push(10, 200, 300) // 3 picos de interferência pontual, bem fora do cluster
    const r = processarAmostrasBussola(amostras)
    expect(r.amostrasTotais).toBe(50)
    expect(r.amostrasUsadas).toBe(47)
    expect(r.amostrasDescartadas).toBe(3)
    expect(r.media).not.toBeNull()
    expect(r.media as number).toBeGreaterThan(88)
    expect(r.media as number).toBeLessThan(92)
    expect(r.confianca).not.toBe('low')
  })

  it('ruído genuíno e disperso (sem outliers isolados): confiança baixa, nada é descartado à toa', () => {
    const r = processarAmostrasBussola([0, 30, 60, 90, 120, 150, 180])
    expect(r.confianca).toBe('low')
    expect(r.desvio as number).toBeGreaterThan(5)
  })

  it('desvio exatamente no limite de 2° é classificado como alta confiança (limiar inclusivo)', () => {
    const r = processarAmostrasBussola([88, 92])
    expect(r.desvio).toBeCloseTo(2, 5)
    expect(r.confianca).toBe('high')
  })

  it('desvio exatamente no limite de 5° é classificado como média confiança (limiar inclusivo)', () => {
    const r = processarAmostrasBussola([85, 95])
    expect(r.desvio).toBeCloseTo(5, 5)
    expect(r.confianca).toBe('medium')
  })
})
