import { describe, it, expect } from 'vitest'
import { montarSnapshot, snapshotsIguais, compararSnapshots } from '../reavaliacao'

const INICIAL = [
  { numero: 1, nome: 'Prosperidade', score: 30 },
  { numero: 2, nome: 'Fama/Reputação', score: 55 },
  { numero: 3, nome: 'Relacionamentos', score: 80 },
  { numero: 4, nome: 'Família', score: null },
]

describe('montarSnapshot', () => {
  it('ordena por número do setor', () => {
    const snap = montarSnapshot([
      { numero: 3, nome: 'C', score: 10 },
      { numero: 1, nome: 'A', score: 20 },
    ])
    expect(snap.map(s => s.numero)).toEqual([1, 3])
  })
})

describe('snapshotsIguais', () => {
  it('detecta snapshots idênticos independente da ordem', () => {
    const a = montarSnapshot([{ numero: 1, nome: 'A', score: 50 }, { numero: 2, nome: 'B', score: 60 }])
    const b = montarSnapshot([{ numero: 2, nome: 'B', score: 60 }, { numero: 1, nome: 'A', score: 50 }])
    expect(snapshotsIguais(a, b)).toBe(true)
  })

  it('detecta diferença de score e de tamanho', () => {
    const a = [{ numero: 1, nome: 'A', score: 50 }]
    expect(snapshotsIguais(a, [{ numero: 1, nome: 'A', score: 51 }])).toBe(false)
    expect(snapshotsIguais(a, [])).toBe(false)
  })
})

describe('compararSnapshots', () => {
  const ATUAL = [
    { numero: 1, nome: 'Prosperidade', score: 65 },  // +35
    { numero: 2, nome: 'Fama/Reputação', score: 50 }, // -5
    { numero: 3, nome: 'Relacionamentos', score: 80 }, // 0
    { numero: 4, nome: 'Família', score: 70 },         // antes null
  ]

  it('calcula o delta por setor', () => {
    const ev = compararSnapshots(INICIAL, ATUAL)
    expect(ev.setores[0].delta).toBe(35)
    expect(ev.setores[1].delta).toBe(-5)
    expect(ev.setores[2].delta).toBe(0)
    expect(ev.setores[3].delta).toBeNull() // não avaliado antes → sem delta
  })

  it('resume melhoraram/pioraram/estáveis (só setores com delta)', () => {
    const ev = compararSnapshots(INICIAL, ATUAL)
    expect(ev.melhoraram).toBe(1)
    expect(ev.pioraram).toBe(1)
    expect(ev.estaveis).toBe(1)
  })

  it('médias antes/depois ignoram setores não avaliados', () => {
    const ev = compararSnapshots(INICIAL, ATUAL)
    expect(ev.mediaAntes).toBe(55)   // (30+55+80)/3
    expect(ev.mediaDepois).toBe(66)  // (65+50+80+70)/4 = 66.25 → 66
  })

  it('setor removido na reavaliação fica com depois/delta null', () => {
    const ev = compararSnapshots(INICIAL, ATUAL.slice(0, 2))
    expect(ev.setores[2].depois).toBeNull()
    expect(ev.setores[2].delta).toBeNull()
  })

  it('snapshots vazios não quebram', () => {
    const ev = compararSnapshots([], [])
    expect(ev.setores).toEqual([])
    expect(ev.mediaAntes).toBeNull()
    expect(ev.melhoraram).toBe(0)
  })
})
