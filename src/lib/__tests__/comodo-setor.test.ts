import { describe, it, expect } from 'vitest'
import {
  normalizarSetor,
  conflitosComodoSetor,
  comodosDeSetorRow,
  ELEMENTO_DO_SETOR,
} from '../comodo-setor'

describe('normalizarSetor', () => {
  it('aceita os nomes reais do app (com acentos e aliases)', () => {
    expect(normalizarSetor('Prosperidade')).toBe('prosperidade')
    expect(normalizarSetor('Centro/Saúde')).toBe('centro')
    expect(normalizarSetor('Centro')).toBe('centro')
    expect(normalizarSetor('Fama/Reputação')).toBe('fama')
    expect(normalizarSetor('Espiritualidade')).toBe('conhecimento')
    expect(normalizarSetor('Filhos')).toBe('criatividade')
    expect(normalizarSetor('Pessoas Úteis')).toBe('pessoas_uteis')
    expect(normalizarSetor('Família')).toBe('familia')
  })

  it('devolve null para desconhecidos (fail-closed)', () => {
    expect(normalizarSetor('Setor Fantasma')).toBeNull()
    expect(normalizarSetor(null)).toBeNull()
  })
})

describe('conflitosComodoSetor', () => {
  it('banheiro na Prosperidade é o conflito clássico (urgente, cura com Madeira)', () => {
    const conflitos = conflitosComodoSetor('Prosperidade', ['banheiro'])
    expect(conflitos).toHaveLength(1)
    expect(conflitos[0].nivel).toBe('urgente')
    expect(conflitos[0].cura).toContain('Madeira')
  })

  it('banheiro na Fama usa a ponte de Madeira (Água→Madeira→Fogo)', () => {
    const conflitos = conflitosComodoSetor('Fama/Reputação', ['banheiro'])
    expect(conflitos).toHaveLength(1)
    expect(conflitos[0].nivel).toBe('urgente')
    expect(conflitos[0].cura).toContain('Madeira')
  })

  it('banheiro no Centro (Tai Chi) é urgente e estabiliza com Terra', () => {
    const conflitos = conflitosComodoSetor('Centro/Saúde', ['banheiro'])
    expect(conflitos[0].nivel).toBe('urgente')
    expect(conflitos[0].cura).toContain('Terra')
  })

  it('banheiro na Carreira reforça com Metal (que gera Água no Sheng)', () => {
    const conflitos = conflitosComodoSetor('Carreira', ['banheiro'])
    expect(conflitos[0].nivel).toBe('melhoria')
    expect(conflitos[0].cura).toContain('Metal')
  })

  it('cômodos repetidos não duplicam o conflito', () => {
    const conflitos = conflitosComodoSetor('Prosperidade', ['banheiro', 'banheiro'])
    expect(conflitos).toHaveLength(1)
  })

  it('setor ou cômodo desconhecido → nenhum conflito (fail-closed)', () => {
    expect(conflitosComodoSetor('Setor Fantasma', ['banheiro'])).toHaveLength(0)
    expect(conflitosComodoSetor('Prosperidade', ['sala'])).toHaveLength(0)
    expect(conflitosComodoSetor('Prosperidade', [null, undefined])).toHaveLength(0)
  })
})

describe('comodosDeSetorRow', () => {
  it('prefere a coluna nova comodos (array)', () => {
    expect(comodosDeSetorRow({ comodos: ['banheiro', 'sala'], comodo_tipo: 'cozinha' })).toEqual(['banheiro', 'sala'])
  })

  it('cai para o legado comodo_tipo quando não há array', () => {
    expect(comodosDeSetorRow({ comodo_tipo: 'banheiro' })).toEqual(['banheiro'])
    expect(comodosDeSetorRow({})).toEqual([])
  })
})

describe('ELEMENTO_DO_SETOR', () => {
  it('mapeia os elementos clássicos do Ba Guá', () => {
    expect(ELEMENTO_DO_SETOR.carreira).toBe('agua')
    expect(ELEMENTO_DO_SETOR.fama).toBe('fogo')
    expect(ELEMENTO_DO_SETOR.prosperidade).toBe('madeira')
    expect(ELEMENTO_DO_SETOR.relacionamentos).toBe('terra')
    expect(ELEMENTO_DO_SETOR.pessoas_uteis).toBe('metal')
  })
})
