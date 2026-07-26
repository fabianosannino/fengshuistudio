import { describe, expect, it } from 'vitest'
import { calcularFacingVerdadeiro } from '../orientacao-mapa'

describe('calcularFacingVerdadeiro', () => {
  it('sem rotação, cada aresta aponta seu ângulo-base', () => {
    expect(calcularFacingVerdadeiro('topo', 0)).toBe(0)
    expect(calcularFacingVerdadeiro('direita', 0)).toBe(90)
    expect(calcularFacingVerdadeiro('baixo', 0)).toBe(180)
    expect(calcularFacingVerdadeiro('esquerda', 0)).toBe(270)
  })

  it('rotacionar 90° no sentido horário gira o facing na mesma direção', () => {
    // Foto tirada com a fachada no topo; usuário gira a foto 90° para alinhar
    // com o satélite → a fachada (que era "topo") agora aponta para Leste.
    expect(calcularFacingVerdadeiro('topo', 90)).toBe(90)
  })

  it('rotação de 180° inverte esquerda↔direita (Oeste↔Leste)', () => {
    expect(calcularFacingVerdadeiro('esquerda', 180)).toBe(90)
    expect(calcularFacingVerdadeiro('direita', 180)).toBe(270)
  })

  it('dá a volta completa (360°) sem alterar o resultado', () => {
    expect(calcularFacingVerdadeiro('baixo', 360)).toBe(180)
  })

  it('aceita rotação negativa (anti-horária) normalizando para [0,360)', () => {
    expect(calcularFacingVerdadeiro('topo', -90)).toBe(270)
  })

  it('aceita rotação fracionária', () => {
    expect(calcularFacingVerdadeiro('baixo', 45.5)).toBeCloseTo(225.5, 5)
  })
})
