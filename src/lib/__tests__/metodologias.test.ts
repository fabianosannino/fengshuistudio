import { describe, it, expect } from 'vitest'
import { METODOLOGIAS, METODOLOGIA_PADRAO, metodologiaPorId } from '../metodologias'

describe('METODOLOGIAS — registro extensível', () => {
  it('BTB e Bússola estão disponíveis', () => {
    expect(metodologiaPorId('btb')?.disponivel).toBe(true)
    expect(metodologiaPorId('bussola')?.disponivel).toBe(true)
  })

  it('a padrão é BTB e existe no registro', () => {
    expect(METODOLOGIA_PADRAO).toBe('btb')
    expect(metodologiaPorId(METODOLOGIA_PADRAO)).toBeDefined()
  })

  it('id desconhecido devolve undefined (fail-closed)', () => {
    expect(metodologiaPorId('estrelas_voadoras')).toBeUndefined()
  })

  it('todo item tem os campos que a UI da seleção precisa', () => {
    for (const m of METODOLOGIAS) {
      expect(m.id).toBeTruthy()
      expect(m.nomeCurto).toBeTruthy()
      expect(m.icone).toBeTruthy()
      expect(Array.isArray(m.requisitos)).toBe(true)
      expect(typeof m.disponivel).toBe('boolean')
    }
  })
})
