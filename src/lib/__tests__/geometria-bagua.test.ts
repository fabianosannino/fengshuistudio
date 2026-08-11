import { describe, expect, it } from 'vitest'
import {
  areaSobreposta,
  calcularSetores,
  excessoAreaExterna,
  SETORES_NO_GRID,
  type Bounds,
  type Marcacao,
} from '../geometria-bagua'

/** Contorno 300×300: cada setor do grid em terços tem 100×100 = 10.000 px². */
const CONTORNO: Bounds = { x: 0, y: 0, w: 300, h: 300 }
const TERCOS = [1 / 3, 2 / 3]

function marcacao(parcial: Partial<Marcacao> & Pick<Marcacao, 'tipo' | 'x' | 'y' | 'w' | 'h'>): Marcacao {
  return { id: 'm1', ...parcial }
}

describe('areaSobreposta', () => {
  it('devolve a interseção de dois retângulos', () => {
    expect(areaSobreposta({ x: 0, y: 0, w: 10, h: 10 }, 5, 5, 10, 10)).toBe(25)
  })

  it('devolve zero quando não se tocam', () => {
    expect(areaSobreposta({ x: 0, y: 0, w: 10, h: 10 }, 20, 20, 5, 5)).toBe(0)
  })

  it('não devolve área negativa para retângulos apenas encostados', () => {
    expect(areaSobreposta({ x: 0, y: 0, w: 10, h: 10 }, 10, 0, 10, 10)).toBe(0)
  })
})

describe('excessoAreaExterna', () => {
  it('conta só a parte de fora do contorno', () => {
    // Metade dentro, metade fora: 50×100 = 5.000 px² contam como excesso.
    const m = marcacao({ tipo: 'excesso', x: 250, y: 0, w: 100, h: 100 })
    expect(excessoAreaExterna(m, CONTORNO)).toBe(5000)
  })

  it('não conta nada quando a marcação está inteira dentro', () => {
    // Somar a parte interna puniria o setor duas vezes: ela já é área normal.
    const m = marcacao({ tipo: 'excesso', x: 10, y: 10, w: 50, h: 50 })
    expect(excessoAreaExterna(m, CONTORNO)).toBe(0)
  })
})

describe('calcularSetores', () => {
  it('devolve os nove setores do grid', () => {
    const setores = calcularSetores(CONTORNO, TERCOS, TERCOS, [])
    expect(setores).toHaveLength(SETORES_NO_GRID)
  })

  it('sem marcação, todo setor está geometricamente íntegro', () => {
    for (const setor of calcularSetores(CONTORNO, TERCOS, TERCOS, [])) {
      expect(setor.geo).toBeCloseTo(100)
      expect(setor.faltaPct).toBe(0)
      expect(setor.excessoPct).toBe(0)
    }
  })

  it('nasce sem critério avaliado — null, não «Neutro»', () => {
    // A distinção existe para o setor não avaliado não ser lido como avaliado
    // e mediano.
    const [primeiro] = calcularSetores(CONTORNO, TERCOS, TERCOS, [])
    expect(primeiro.criterios.every(c => c === null)).toBe(true)
  })

  it('uma falta que cobre um setor inteiro zera o geo daquele setor', () => {
    // Canto superior esquerdo = setor 0.
    const setores = calcularSetores(CONTORNO, TERCOS, TERCOS, [
      marcacao({ tipo: 'falta', x: 0, y: 0, w: 100, h: 100 }),
    ])
    expect(setores[0].faltaPct).toBeCloseTo(100)
    expect(setores[0].geo).toBeCloseTo(0)
    // Os vizinhos não são afetados.
    expect(setores[1].geo).toBeCloseTo(100)
    expect(setores[4].geo).toBeCloseTo(100)
  })

  it('uma falta parcial reduz o geo em proporção à área', () => {
    // Metade do setor 0: 50×100 de 100×100.
    const setores = calcularSetores(CONTORNO, TERCOS, TERCOS, [
      marcacao({ tipo: 'falta', x: 0, y: 0, w: 50, h: 100 }),
    ])
    expect(setores[0].faltaPct).toBeCloseTo(50)
    expect(setores[0].geo).toBeCloseTo(50)
  })

  it('a falta se divide entre os setores que a marcação atravessa', () => {
    // 100×100 centrado na divisa dos setores 0 e 1: 50% para cada um.
    const setores = calcularSetores(CONTORNO, TERCOS, TERCOS, [
      marcacao({ tipo: 'falta', x: 50, y: 0, w: 100, h: 100 }),
    ])
    expect(setores[0].faltaPct).toBeCloseTo(50)
    expect(setores[1].faltaPct).toBeCloseTo(50)
    expect(setores[2].faltaPct).toBe(0)
  })

  it('excesso inteiramente dentro do contorno não penaliza ninguém', () => {
    const setores = calcularSetores(CONTORNO, TERCOS, TERCOS, [
      marcacao({ tipo: 'excesso', x: 110, y: 110, w: 80, h: 80 }),
    ])
    expect(setores.every(s => s.excessoPct === 0)).toBe(true)
  })

  it('excesso projetado para fora vai para os setores daquela borda', () => {
    // Projeção acima do topo, alinhada à coluna do meio: setor 1.
    const setores = calcularSetores(CONTORNO, TERCOS, TERCOS, [
      marcacao({ tipo: 'excesso', x: 100, y: -50, w: 100, h: 50 }),
    ])
    expect(setores[1].excessoArea).toBeGreaterThan(0)
    expect(setores[1].geo).toBeLessThan(100)
    // A borda oposta não recebe nada.
    expect(setores[7].excessoArea).toBe(0)
  })

  it('conserva a área externa ao distribuí-la entre os setores', () => {
    // Distribuir não pode criar nem sumir com área: o total tem que bater.
    const m = marcacao({ tipo: 'excesso', x: 100, y: -50, w: 100, h: 50 })
    const setores = calcularSetores(CONTORNO, TERCOS, TERCOS, [m])
    const distribuido = setores.reduce((soma, s) => soma + s.excessoArea, 0)
    expect(distribuido).toBeCloseTo(excessoAreaExterna(m, CONTORNO))
  })

  it('respeita divisórias fora dos terços', () => {
    // Coluna esquerda com 20% da largura: 60px. Uma falta de 60×100 no canto
    // cobre o setor 0 inteiro justamente porque ele encolheu.
    const setores = calcularSetores(CONTORNO, TERCOS, [0.2, 0.6], [
      marcacao({ tipo: 'falta', x: 0, y: 0, w: 60, h: 100 }),
    ])
    // O setor 0 mede 60×100 = 6.000 px², mas a referência de área é o nono do
    // contorno (10.000) — a nota é relativa ao setor médio, não ao próprio.
    expect(setores[0].faltaArea).toBeCloseTo(6000)
  })

  it('não divide por zero quando o contorno é degenerado', () => {
    const setores = calcularSetores({ x: 0, y: 0, w: 0, h: 0 }, TERCOS, TERCOS, [])
    expect(setores).toHaveLength(SETORES_NO_GRID)
    expect(setores.every(s => Number.isFinite(s.geo))).toBe(true)
  })
})
