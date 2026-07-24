import { describe, it, expect } from 'vitest'
import { calcularMingGua, normalizarGenero } from '../ming-gua'

describe('normalizarGenero', () => {
  it('aceita variações comuns', () => {
    expect(normalizarGenero('Masculino')).toBe('masculino')
    expect(normalizarGenero('FEMININO')).toBe('feminino')
    expect(normalizarGenero('m')).toBe('masculino')
    expect(normalizarGenero('F')).toBe('feminino')
  })

  it('desconhecido → null (fail-closed)', () => {
    expect(normalizarGenero('outro')).toBeNull()
    expect(normalizarGenero('')).toBeNull()
    expect(normalizarGenero(null)).toBeNull()
  })
})

describe('calcularMingGua — fórmula clássica', () => {
  it('masculino 1990 → Kua 1 (grupo Leste)', () => {
    // 9+0=9; 10−9=1
    const r = calcularMingGua('1990-06-15', 'masculino')!
    expect(r.kua).toBe(1)
    expect(r.grupo).toBe('leste')
    expect(r.direcoes.shengChi).toBe('Sudeste')
  })

  it('feminino 1990 → Kua 8 (5 vira 8 no feminino)', () => {
    // 9+5=14→5 → 8
    const r = calcularMingGua('1990-06-15', 'feminino')!
    expect(r.kua).toBe(8)
    expect(r.grupo).toBe('oeste')
    expect(r.direcoes.tienYi).toBe('Noroeste')
  })

  it('masculino 1985 → Kua 6', () => {
    // 8+5=13→4; 10−4=6
    expect(calcularMingGua('1985-06-15', 'masculino')!.kua).toBe(6)
  })

  it('masculino 1959 → Kua 5 vira 2 no masculino', () => {
    // 5+9=14→5; 10−5=5 → 2
    const r = calcularMingGua('1959-06-15', 'masculino')!
    expect(r.kua).toBe(2)
    expect(r.grupo).toBe('oeste')
  })

  it('regra pós-2000: masculino 2005 → Kua 4; feminino 2005 → Kua 2', () => {
    // masc: 9−5=4 · fem: 5+6=11→2
    expect(calcularMingGua('2005-06-15', 'masculino')!.kua).toBe(4)
    expect(calcularMingGua('2005-06-15', 'feminino')!.kua).toBe(2)
  })

  it('ano solar: nascido em janeiro pertence ao ano anterior', () => {
    // 10/01/1990 → ano solar 1989: 8+9=17→8; 10−8=2
    expect(calcularMingGua('1990-01-10', 'masculino')!.kua).toBe(2)
    // 04/02/1990 (Li Chun) já conta como 1990 → Kua 1
    expect(calcularMingGua('1990-02-04', 'masculino')!.kua).toBe(1)
  })

  it('masculino 1900 → 10−0=10→1 (redução dupla)', () => {
    expect(calcularMingGua('1900-06-15', 'masculino')!.kua).toBe(1)
  })

  it('nunca devolve Kua 5', () => {
    for (let ano = 1940; ano <= 2030; ano++) {
      for (const g of ['masculino', 'feminino'] as const) {
        const r = calcularMingGua(`${ano}-06-15`, g)
        expect(r?.kua).not.toBe(5)
        expect(r?.kua).toBeGreaterThanOrEqual(1)
        expect(r?.kua).toBeLessThanOrEqual(9)
      }
    }
  })

  it('dados ausentes/inválidos → null (fail-closed)', () => {
    expect(calcularMingGua(null, 'masculino')).toBeNull()
    expect(calcularMingGua('1990-06-15', null)).toBeNull()
    expect(calcularMingGua('data-inválida', 'feminino')).toBeNull()
    expect(calcularMingGua('1850-06-15', 'feminino')).toBeNull()
  })

  it('grupos Leste/Oeste corretos para todos os Kua', () => {
    const leste = new Set([1, 3, 4, 9])
    for (let ano = 1950; ano <= 1990; ano += 3) {
      for (const g of ['masculino', 'feminino'] as const) {
        const r = calcularMingGua(`${ano}-07-01`, g)!
        expect(r.grupo).toBe(leste.has(r.kua) ? 'leste' : 'oeste')
      }
    }
  })
})
