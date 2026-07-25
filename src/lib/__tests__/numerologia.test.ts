import { describe, it, expect } from 'vitest'
import { reduzirA1Digito } from '../numerologia'

describe('reduzirA1Digito', () => {
  it('mantém dígitos únicos', () => {
    expect(reduzirA1Digito(0)).toBe(0)
    expect(reduzirA1Digito(9)).toBe(9)
  })

  it('reduz números de múltiplos dígitos somando repetidamente', () => {
    expect(reduzirA1Digito(17)).toBe(8) // 1+7=8
    expect(reduzirA1Digito(2024)).toBe(8) // 2+0+2+4=8
    expect(reduzirA1Digito(1999)).toBe(1) // 1+9+9+9=28 → 2+8=10 → 1+0=1
  })
})
