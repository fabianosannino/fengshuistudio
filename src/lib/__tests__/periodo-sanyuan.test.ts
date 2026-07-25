import { describe, it, expect } from 'vitest'
import { periodoDoAnoSolar, periodoDaData, periodoAtual, INICIO_CICLO_SAN_YUAN } from '../periodo-sanyuan'

describe('periodoDoAnoSolar', () => {
  it('âncoras conhecidas: Período 8 (2004-2023) e Período 9 (2024-2043)', () => {
    expect(periodoDoAnoSolar(2004)).toBe(8)
    expect(periodoDoAnoSolar(2023)).toBe(8)
    expect(periodoDoAnoSolar(2024)).toBe(9)
    expect(periodoDoAnoSolar(2043)).toBe(9)
  })

  it('início do ciclo de referência (1864) é Período 1', () => {
    expect(periodoDoAnoSolar(INICIO_CICLO_SAN_YUAN)).toBe(1)
  })

  it('o ciclo de 180 anos repete (2044 volta a ser Período 1)', () => {
    expect(periodoDoAnoSolar(2044)).toBe(1)
  })
})

describe('periodoDaData', () => {
  it('aplica o ajuste de ano solar (Li Chun) antes de calcular o período', () => {
    expect(periodoDaData('2024-01-10')).toBe(8) // ainda 2023 solar
    expect(periodoDaData('2024-02-04')).toBe(9) // já 2024 solar
  })

  it('dado ausente/inválido/anterior a 1864 → null (fail-closed)', () => {
    expect(periodoDaData(null)).toBeNull()
    expect(periodoDaData('data-invalida')).toBeNull()
    expect(periodoDaData('1800-01-01')).toBeNull()
  })
})

describe('periodoAtual', () => {
  it('aceita uma data de referência para testabilidade', () => {
    expect(periodoAtual(new Date(2025, 5, 15))).toBe(9)
    expect(periodoAtual(new Date(2004, 5, 15))).toBe(8)
  })
})
