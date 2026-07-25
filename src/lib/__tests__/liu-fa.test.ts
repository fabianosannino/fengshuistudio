import { describe, it, expect } from 'vitest'
import { zhengShenLingShen } from '../liu-fa'

describe('zhengShenLingShen', () => {
  it('Período 9: Zheng Shen = Sul, Ling Shen = Norte (âncora citada na referência)', () => {
    expect(zhengShenLingShen(9)).toEqual({ zhengShen: 'S', lingShen: 'N' })
  })

  it('Período 8: Zheng Shen = Nordeste (Gen, número 8), Ling Shen = Sudoeste', () => {
    expect(zhengShenLingShen(8)).toEqual({ zhengShen: 'NE', lingShen: 'SW' })
  })

  it('Período 1: Zheng Shen = Norte (Kan, número 1), Ling Shen = Sul', () => {
    expect(zhengShenLingShen(1)).toEqual({ zhengShen: 'N', lingShen: 'S' })
  })

  it('Período 5 não tem setor próprio (Centro) — devolve null', () => {
    expect(zhengShenLingShen(5)).toBeNull()
  })

  it('Zheng Shen e Ling Shen são sempre o par de setores geometricamente opostos', () => {
    const OPOSTO: Record<string, string> = { N: 'S', S: 'N', E: 'W', W: 'E', NE: 'SW', SW: 'NE', SE: 'NW', NW: 'SE' }
    for (let periodo = 1; periodo <= 9; periodo++) {
      if (periodo === 5) continue
      const r = zhengShenLingShen(periodo)!
      expect(r.lingShen).toBe(OPOSTO[r.zhengShen])
    }
  })

  it('os 8 períodos não-5 cobrem os 8 setores distintos como Zheng Shen', () => {
    const setores = [1, 2, 3, 4, 6, 7, 8, 9].map(p => zhengShenLingShen(p)!.zhengShen)
    expect(new Set(setores).size).toBe(8)
  })
})
