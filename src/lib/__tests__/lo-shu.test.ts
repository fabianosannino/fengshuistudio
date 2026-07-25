import { describe, it, expect } from 'vitest'
import { CAMINHO_VOO, normalizar1a9, construirGridVoo } from '../lo-shu'

describe('CAMINHO_VOO', () => {
  it('segue a trajetória fixa do Lo Shu: Centro → NO → O → NE → S → N → SO → E → SE', () => {
    expect(CAMINHO_VOO).toEqual(['C', 'NW', 'W', 'NE', 'S', 'N', 'SW', 'E', 'SE'])
  })
})

describe('normalizar1a9', () => {
  it('mantém valores já em 1-9', () => {
    expect(normalizar1a9(1)).toBe(1)
    expect(normalizar1a9(9)).toBe(9)
    expect(normalizar1a9(5)).toBe(5)
  })

  it('faz wrap de 0 para 9 e de 10 para 1', () => {
    expect(normalizar1a9(0)).toBe(9)
    expect(normalizar1a9(10)).toBe(1)
  })

  it('faz wrap de valores negativos', () => {
    expect(normalizar1a9(-1)).toBe(8)
  })
})

describe('construirGridVoo', () => {
  it('reproduz a carta do Período 8 amplamente publicada (4-9-2/3-5-7/8-1-6, Sul no topo)', () => {
    const grid = construirGridVoo('C', 8, 'frente')
    expect(grid).toEqual({ C: 8, NW: 9, W: 1, NE: 2, S: 3, N: 4, SW: 5, E: 6, SE: 7 })
  })

  it('voo reverso decresce a cada palácio seguinte no caminho', () => {
    const grid = construirGridVoo('C', 5, 'verso')
    expect(grid.C).toBe(5)
    expect(grid.NW).toBe(4)
    expect(grid.W).toBe(3)
  })

  it('toda grade é sempre uma permutação completa de 1-9', () => {
    for (const semente of [1, 2, 3, 4, 5, 6, 7, 8, 9]) {
      for (const sentido of ['frente', 'verso'] as const) {
        const valores = Object.values(construirGridVoo('N', semente, sentido)).sort((a, b) => a - b)
        expect(valores).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9])
      }
    }
  })
})
