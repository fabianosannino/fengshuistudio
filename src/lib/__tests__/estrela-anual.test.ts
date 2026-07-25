import { describe, it, expect } from 'vitest'
import { calcularEstrelaAnual, calcularGradeAnual, estrelaAnualDaData } from '../estrela-anual'

describe('calcularEstrelaAnual', () => {
  it('âncoras obrigatórias do documento: 2024→3, 2025→2, 2026→1, 2027→9', () => {
    expect(calcularEstrelaAnual(2024)).toBe(3)
    expect(calcularEstrelaAnual(2025)).toBe(2)
    expect(calcularEstrelaAnual(2026)).toBe(1)
    expect(calcularEstrelaAnual(2027)).toBe(9)
  })

  it('decresce 1 a cada ano dentro do mesmo século (com wrap 1→9)', () => {
    for (let ano = 2001; ano <= 2099; ano++) {
      const atual = calcularEstrelaAnual(ano)
      const anterior = calcularEstrelaAnual(ano - 1)
      const esperado = atual === 9 ? 1 : atual + 1
      expect(anterior).toBe(esperado)
    }
  })

  it('sempre devolve um número entre 1 e 9', () => {
    for (let ano = 1950; ano <= 2050; ano++) {
      const e = calcularEstrelaAnual(ano)
      expect(e).toBeGreaterThanOrEqual(1)
      expect(e).toBeLessThanOrEqual(9)
    }
  })
})

describe('calcularGradeAnual', () => {
  it('a estrela do Centro é sempre a Estrela Anual do ano', () => {
    expect(calcularGradeAnual(2024).C).toBe(3)
    expect(calcularGradeAnual(2026).C).toBe(1)
  })

  it('é sempre uma permutação completa de 1-9', () => {
    for (let ano = 2020; ano <= 2030; ano++) {
      const valores = Object.values(calcularGradeAnual(ano)).sort((a, b) => a - b)
      expect(valores).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9])
    }
  })
})

describe('estrelaAnualDaData', () => {
  it('aplica o ajuste de ano solar (Li Chun) antes de calcular', () => {
    expect(estrelaAnualDaData('2026-06-15')).toBe(1) // 2026 solar → 1
    expect(estrelaAnualDaData('2026-01-10')).toBe(calcularEstrelaAnual(2025)) // ainda 2025 solar
  })

  it('data ausente/inválida → null', () => {
    expect(estrelaAnualDaData(null)).toBeNull()
    expect(estrelaAnualDaData('data-invalida')).toBeNull()
  })
})
