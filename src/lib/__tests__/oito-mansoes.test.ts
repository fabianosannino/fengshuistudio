import { describe, it, expect } from 'vitest'
import { calcularKuaDaCasa, compatibilidadeMoradorCasa } from '../oito-mansoes'

// Vetores por ASSENTO, não derivados do algoritmo.
// Fontes: Joey Yap, Location and Direction in Eight Mansions (tid=333):
// fachada Sul → Kan, Oeste → Zhen. Mastery Academy nid=140: tipo pelo assento.
const CASAS = [
  [0, 180, 9, 'leste'], [45, 225, 2, 'oeste'], [90, 270, 7, 'oeste'],
  [135, 315, 6, 'oeste'], [180, 0, 1, 'leste'], [225, 45, 8, 'oeste'],
  [270, 90, 3, 'leste'], [315, 135, 4, 'leste'],
] as const

describe('Ba Zhai: a casa é classificada pelo assento', () => {
  it.each(CASAS)('fachada %s°, assento %s° → Kua %s / %s', (fachada, _assento, kua, grupo) => {
    expect(calcularKuaDaCasa(fachada)).toMatchObject({ kua, grupo })
    expect(calcularKuaDaCasa(fachada + 720)).toEqual(calcularKuaDaCasa(fachada))
    expect(calcularKuaDaCasa(fachada - 720)).toEqual(calcularKuaDaCasa(fachada))
  })
  it.each(CASAS)('fronteira após fachada %s° pertence ao próximo octante', (fachada, _assento, kua) => {
    const proxima = CASAS[(fachada / 45 + 1) % 8][2]
    expect(calcularKuaDaCasa(fachada + 22.5 - 0.0001).kua).toBe(kua)
    expect(calcularKuaDaCasa(fachada + 22.5).kua).toBe(proxima)
    expect(calcularKuaDaCasa(fachada + 22.5 + 0.0001).kua).toBe(proxima)
  })
  it.each([NaN, Infinity, -Infinity])('recusa ângulo não finito %s', graus => {
    expect(() => calcularKuaDaCasa(graus)).toThrow(RangeError)
  })
  it('a casa com fachada Leste pertence ao grupo Oeste', () => {
    const casa = calcularKuaDaCasa(90)
    expect(compatibilidadeMoradorCasa(1, casa.kua).compativel).toBe(false)
    expect(compatibilidadeMoradorCasa(7, casa.kua).compativel).toBe(true)
  })
})

describe('compatibilidadeMoradorCasa', () => {
  it('mesmo grupo → compatível', () => {
    const c = compatibilidadeMoradorCasa(1, 9) // Kua 1 e 9 são ambos grupo Leste
    expect(c.compativel).toBe(true)
    expect(c.grupoMorador).toBe('leste')
    expect(c.grupoCasa).toBe('leste')
  })

  it('grupos diferentes → não compatível, mensagem explica o motivo', () => {
    const c = compatibilidadeMoradorCasa(1, 2) // Kua 1=Leste, Kua 2=Oeste
    expect(c.compativel).toBe(false)
    expect(c.mensagem).toContain('diverge')
  })
})
