import { describe, it, expect } from 'vitest'
import { normalizarGraus, distanciaCircular, mediaCircular, desvioCircular } from '../graus'

describe('normalizarGraus', () => {
  it('mantém valores já no intervalo [0, 360)', () => {
    expect(normalizarGraus(0)).toBe(0)
    expect(normalizarGraus(359.9)).toBeCloseTo(359.9)
  })

  it('normaliza 360 para 0 e valores maiores por wrap', () => {
    expect(normalizarGraus(360)).toBe(0)
    expect(normalizarGraus(370)).toBe(10)
  })

  it('normaliza negativos', () => {
    expect(normalizarGraus(-1)).toBe(359)
    expect(normalizarGraus(-370)).toBeCloseTo(350)
  })
})

describe('distanciaCircular', () => {
  it('é 0 para o mesmo ângulo', () => {
    expect(distanciaCircular(10, 10)).toBe(0)
  })

  it('atravessa o 0°/360° pelo caminho curto (359° e 1° estão a 2°, não a 358°)', () => {
    expect(distanciaCircular(359, 1)).toBe(2)
    expect(distanciaCircular(1, 359)).toBe(2)
  })

  it('nunca excede 180° (o máximo possível num círculo)', () => {
    expect(distanciaCircular(0, 180)).toBe(180)
    expect(distanciaCircular(10, 200)).toBe(170)
  })
})

describe('mediaCircular', () => {
  it('lista vazia → null (fail-closed)', () => {
    expect(mediaCircular([])).toBeNull()
  })

  it('média de valores próximos sem atravessar o 0° é a média aritmética', () => {
    expect(mediaCircular([10, 20, 30])).toBeCloseTo(20, 5)
  })

  it('359° e 1° têm média circular 0°, não 180° (o erro da média aritmética)', () => {
    expect(mediaCircular([359, 1])).toBeCloseTo(0, 5)
  })

  it('três leituras em torno do Norte (bússola) convergem para perto de 0°', () => {
    const media = mediaCircular([358, 0, 2])!
    expect(distanciaCircular(media, 0)).toBeLessThan(0.5)
  })
})

describe('desvioCircular', () => {
  it('lista vazia → null', () => {
    expect(desvioCircular([])).toBeNull()
  })

  it('amostras idênticas → desvio 0', () => {
    expect(desvioCircular([45, 45, 45])).toBe(0)
  })

  it('calcula a maior distância de qualquer amostra até a média circular', () => {
    // amostras em 358/0/2: média ~0, maior distância ~2°
    expect(desvioCircular([358, 0, 2])).toBeCloseTo(2, 1)
  })
})
