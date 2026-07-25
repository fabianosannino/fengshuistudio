import { describe, it, expect } from 'vitest'
import { TRIGRAMAS, trigramaDoSetor, trigramaDosBits, type Trigrama } from '../trigramas'

const LO_SHU_POR_OCTANTE_ESPERADO: Record<Trigrama, number> = {
  Kan: 1, Kun: 2, Zhen: 3, Xun: 4, Qian: 6, Dui: 7, Gen: 8, Li: 9,
}

describe('TRIGRAMAS — cross-validação com o Lo Shu já implementado', () => {
  it('número Lo Shu de cada trigrama bate com LO_SHU_POR_OCTANTE de oito-mansoes.ts (N=1,NE=8,E=3,SE=4,S=9,SW=2,W=7,NW=6)', () => {
    for (const trigrama of Object.keys(TRIGRAMAS) as Trigrama[]) {
      expect(TRIGRAMAS[trigrama].numeroLoShu).toBe(LO_SHU_POR_OCTANTE_ESPERADO[trigrama])
    }
  })

  it('as 8 direções cobrem exatamente N/NE/E/SE/S/SW/W/NW sem repetição', () => {
    const direcoes = Object.values(TRIGRAMAS).map(t => t.direcao)
    expect(new Set(direcoes).size).toBe(8)
  })

  it('os 8 números Lo Shu cobrem 1-9 exceto o 5 (centro)', () => {
    const numeros = Object.values(TRIGRAMAS).map(t => t.numeroLoShu).sort((a, b) => a - b)
    expect(numeros).toEqual([1, 2, 3, 4, 6, 7, 8, 9])
  })
})

describe('trigramaDoSetor', () => {
  it('devolve o trigrama de cada direção cardinal/intercardinal', () => {
    expect(trigramaDoSetor('N')).toBe('Kan')
    expect(trigramaDoSetor('S')).toBe('Li')
    expect(trigramaDoSetor('NW')).toBe('Qian')
    expect(trigramaDoSetor('SW')).toBe('Kun')
  })
})

describe('trigramaDosBits', () => {
  it('reconhece as 8 combinações de bits da tabela clássica', () => {
    expect(trigramaDosBits([1, 1, 1])).toBe('Qian')
    expect(trigramaDosBits([0, 0, 0])).toBe('Kun')
    expect(trigramaDosBits([0, 1, 0])).toBe('Kan')
    expect(trigramaDosBits([1, 0, 1])).toBe('Li')
  })

  it('é o inverso de TRIGRAMAS[x].bits para todos os 8 trigramas', () => {
    for (const info of Object.values(TRIGRAMAS)) {
      expect(trigramaDosBits(info.bits)).toBe(info.trigrama)
    }
  })
})
