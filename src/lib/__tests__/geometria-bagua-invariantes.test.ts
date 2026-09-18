import { describe, expect, it } from 'vitest'
import { calcularSetores, type Bounds, type Marcacao } from '../geometria-bagua'
const b: Bounds = { x: 0, y: 0, w: 12, h: 12 }
const lines = [0.25, 0.75]
const falta: Marcacao = { id: 'a', tipo: 'falta', x: 0, y: 0, w: 3, h: 3 }

describe('áreas reais e união das marcações', () => {
  it('sobreposição e duplicatas contam uma vez', () => {
    const outro = { ...falta, id: 'b', x: 1, w: 2 }
    const sectors = calcularSetores(b, lines, lines, [falta, falta, outro])
    expect(sectors[0].faltaArea).toBe(9)
    expect(sectors[0].faltaPct).toBe(100)
    expect(sectors[0].geo).toBe(0)
  })
  it('união em L corresponde a um oráculo independente por células unitárias', () => {
    const marks = [falta, { ...falta, id: 'b', x: 2, y: 1, w: 5, h: 2 }, { ...falta, id: 'c', x: 6, y: 2, w: 2, h: 9 }]
    const result = calcularSetores(b, lines, lines, marks)
    const edge = [0, 3, 9, 12]
    for (let row = 0; row < 3; row++) for (let col = 0; col < 3; col++) {
      let missing = 0
      for (let x = edge[col]; x < edge[col + 1]; x++) for (let y = edge[row]; y < edge[row + 1]; y++) {
        if (marks.some(m => x + 0.5 >= m.x && x + 0.5 < m.x + m.w && y + 0.5 >= m.y && y + 0.5 < m.y + m.h)) missing++
      }
      const s = result[row * 3 + col]
      expect(s.faltaArea).toBe(missing)
      expect(s.faltaPct).toBeCloseTo(100 * missing / ((edge[col + 1] - edge[col]) * (edge[row + 1] - edge[row])))
    }
  })
  it('excesso distante e duplicado conserva a união externa sem renormalizar pesos', () => {
    const m: Marcacao = { id: 'a', tipo: 'excesso', x: 0, y: -100, w: 12, h: 2 }
    const result = calcularSetores(b, lines, lines, [m, m])
    expect(result.map(s => s.excessoArea)).toEqual([6, 12, 6, 0, 0, 0, 0, 0, 0])
    expect(result.reduce((n, s) => n + s.excessoArea, 0)).toBe(24)
  })
  it('excesso parcial sobreposto não duplica área nem conta interior', () => {
    const a: Marcacao = { id: 'a', tipo: 'excesso', x: 10, y: 0, w: 6, h: 3 }
    const c = { ...a, id: 'b', x: 12, w: 6 }
    expect(calcularSetores(b, lines, lines, [a, c])[2].excessoArea).toBe(18)
  })
  it.each([0.01, 0.5, 3, 100])('percentuais são invariantes a escala %s e translação', scale => {
    const marks = [falta, { ...falta, id: 'e', tipo: 'excesso' as const, y: -2 }]
    const move = <T extends Bounds>(r: T): T => ({ ...r, x: r.x * scale + 91, y: r.y * scale - 37, w: r.w * scale, h: r.h * scale })
    const before = calcularSetores(b, lines, lines, marks)
    const after = calcularSetores(move(b), lines, lines, marks.map(move))
    after.forEach((s, i) => {
      expect(s.faltaPct).toBeCloseTo(before[i].faltaPct)
      expect(s.excessoPct).toBeCloseTo(before[i].excessoPct)
      expect(s.geo).toBeCloseTo(before[i].geo)
    })
  })
  it.each([[0, 0.7], [0.7, 0.2], [0.5, 0.5], [0.2, 1], [NaN, 0.8], [0.5]].map(grid => ({ grid })))('recusa divisórias inválidas $grid', ({ grid }) => {
    expect(() => calcularSetores(b, grid, lines, [])).toThrow()
  })
  it.each([{ w: -1 }, { h: 0 }, { x: Infinity }, { y: NaN }, { w: Number.MAX_VALUE, h: 2 }])('recusa geometria inválida %j', delta => {
    expect(() => calcularSetores({ ...b, ...delta }, lines, lines, [])).toThrow()
    expect(() => calcularSetores(b, lines, lines, [{ ...falta, ...delta }])).toThrow()
  })
  it('nota nunca é negativa mesmo com excesso superior à área da célula', () => {
    const m = { ...falta, tipo: 'excesso' as const, y: -30, h: 30 }
    expect(calcularSetores(b, lines, lines, [m])[0].geo).toBe(0)
  })
})
