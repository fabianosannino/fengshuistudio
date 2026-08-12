import { describe, expect, it } from 'vitest'
import { faseLunar } from '../lunar'

describe('faseLunar', () => {
  it('a âncora é lua nova', () => {
    expect(faseLunar(new Date(Date.UTC(2000, 0, 6, 18, 14))).nome).toBe('Nova')
  })

  it('meia lunação depois é cheia', () => {
    const meia = Date.UTC(2000, 0, 6, 18, 14) + 14.77 * 86_400_000
    expect(faseLunar(new Date(meia)).nome).toBe('Cheia')
  })

  it('percorre o ciclo e volta a Nova', () => {
    const inicio = Date.UTC(2000, 0, 6, 18, 14)
    expect(faseLunar(new Date(inicio + 29.5 * 86_400_000)).nome).toBe('Nova')
  })

  it('funciona antes da âncora — o resto negativo de `%` não escapa', () => {
    // Era o jeito de o cálculo devolver percentual negativo para datas de 1999.
    const antes = faseLunar(new Date(Date.UTC(1999, 5, 15)))
    expect(antes.percentual).toBeGreaterThanOrEqual(0)
    expect(antes.percentual).toBeLessThanOrEqual(100)
  })

  it('reduz as oito subdivisões às quatro dos rituais', () => {
    const inicio = Date.UTC(2000, 0, 6, 18, 14)
    const simples = (dias: number) => faseLunar(new Date(inicio + dias * 86_400_000)).simples
    expect(simples(0)).toBe('nova')
    expect(simples(5)).toBe('crescente')
    expect(simples(8)).toBe('crescente')   // Quarto Crescente
    expect(simples(12)).toBe('crescente')  // Gibosa Crescente
    expect(simples(15)).toBe('cheia')
    expect(simples(18)).toBe('minguante')  // Gibosa Minguante
    expect(simples(26)).toBe('minguante')
  })

  it('data inválida não quebra a tela', () => {
    expect(faseLunar(new Date('não é data')).nome).toBe('Nova')
  })
})
