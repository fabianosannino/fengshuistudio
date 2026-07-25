import { describe, it, expect } from 'vitest'
import { MONTANHAS, montanhaDoGrau } from '../montanhas'

describe('MONTANHAS — integridade da tabela', () => {
  it('tem exatamente 24 montanhas', () => {
    expect(MONTANHAS).toHaveLength(24)
  })

  it('cada trigrama de 45° (8 setores) contém exatamente 3 montanhas de 15°', () => {
    const porSetor = new Map<string, number>()
    for (const m of MONTANHAS) porSetor.set(m.setor, (porSetor.get(m.setor) ?? 0) + 1)
    expect(porSetor.size).toBe(8)
    for (const count of porSetor.values()) expect(count).toBe(3)
  })

  it('cada trio de montanhas de um setor tem um Yuan Long de cada (Terra, Céu, Humano)', () => {
    const porSetor = new Map<string, Set<string>>()
    for (const m of MONTANHAS) {
      if (!porSetor.has(m.setor)) porSetor.set(m.setor, new Set())
      porSetor.get(m.setor)!.add(m.yuanLong)
    }
    for (const yuanLongs of porSetor.values()) {
      expect(yuanLongs).toEqual(new Set(['terra', 'ceu', 'humano']))
    }
  })
})

describe('montanhaDoGrau', () => {
  it('classifica o limite inferior de cada faixa (inclusivo)', () => {
    expect(montanhaDoGrau(337.5).numero).toBe(1) // Ren
    expect(montanhaDoGrau(22.5).numero).toBe(4) // Chou
    expect(montanhaDoGrau(0).numero).toBe(2) // Zi (352.5–7.5, contém o 0°)
  })

  it('classifica o centro de cada faixa', () => {
    expect(montanhaDoGrau(345).numero).toBe(1) // Ren: 337.5–352.5
    expect(montanhaDoGrau(45).numero).toBe(5) // Gen: 37.5–52.5
  })

  it('o limite superior de uma faixa já pertence à próxima (exclusivo)', () => {
    expect(montanhaDoGrau(352.5).numero).toBe(2) // não mais Ren (1), já Zi (2)
    expect(montanhaDoGrau(37.5).numero).toBe(5) // não mais Chou (4), já Gen (5)
  })

  it('faixa da montanha Zi "dá a volta" pelo 0° (352,5–7,5) corretamente', () => {
    expect(montanhaDoGrau(355).numero).toBe(2)
    expect(montanhaDoGrau(5).numero).toBe(2)
    expect(montanhaDoGrau(7.5).numero).toBe(3) // já Gui
  })

  it('normaliza graus fora de [0,360) antes de classificar', () => {
    expect(montanhaDoGrau(360).numero).toBe(montanhaDoGrau(0).numero)
    expect(montanhaDoGrau(-7.5).numero).toBe(montanhaDoGrau(352.5).numero)
  })

  it('as 24 faixas cobrem o círculo inteiro sem buracos (todo grau em passos de 0,1° tem montanha)', () => {
    for (let g = 0; g < 360; g += 0.5) {
      expect(() => montanhaDoGrau(g)).not.toThrow()
      expect(montanhaDoGrau(g)).toBeDefined()
    }
  })
})
