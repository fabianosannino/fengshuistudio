import { describe, expect, it } from 'vitest'
import { encontrarMarcacao, redimensionarMarcacao, retanguloEntrePontos } from '../edicao-marcacoes'
import type { Marcacao } from '../geometria-bagua'

const original: Marcacao = { id: 'base', tipo: 'falta', x: 100, y: 100, w: 200, h: 200 }
const sobreposta: Marcacao = { id: 'por-cima', tipo: 'excesso', x: 50, y: 50, w: 300, h: 300 }
const tolerancia = { x: 12, y: 12 }

describe('E-MARC-04 — geometria e seleção independentes das bordas', () => {
  it.each([
    [{ x: 20, y: 30 }, { x: 60, y: 80 }],
    [{ x: 60, y: 80 }, { x: 20, y: 30 }],
    [{ x: 20, y: 80 }, { x: 60, y: 30 }],
    [{ x: 60, y: 30 }, { x: 20, y: 80 }],
  ])('normaliza um arraste em qualquer direção', (inicio, fim) => {
    expect(retanguloEntrePontos(inicio, fim)).toEqual({ x: 20, y: 30, w: 40, h: 50 })
  })

  it('mantém o canto oposto ao cruzá-lo, sem alterar o registro original', () => {
    const antes = { ...original }
    expect(redimensionarMarcacao(original, 'tl', { x: 350, y: 400 })).toEqual({ ...original, x: 300, y: 300, w: 50, h: 100 })
    expect(original).toEqual(antes)
  })

  it('não deixa a marca colapsar em uma linha', () => {
    expect(redimensionarMarcacao(original, 'br', { x: 102, y: 250 })).toEqual(original)
  })

  it('sem seleção escolhe a última desenhada; selecionar pela lista alcança a marca coberta', () => {
    const marcas = [original, sobreposta]
    expect(encontrarMarcacao(marcas, { x: 200, y: 200 }, tolerancia, null)).toMatchObject({ tipo: 'marcacao-mover', id: 'por-cima' })
    expect(encontrarMarcacao(marcas, { x: 200, y: 200 }, tolerancia, 'base')).toEqual({ tipo: 'marcacao-mover', id: 'base', offX: 100, offY: 100 })
    expect(marcas).toEqual([original, sobreposta])
  })

  it('a alça selecionada tem prioridade sobre o corpo de outra marca', () => {
    expect(encontrarMarcacao([original, sobreposta], { x: 308, y: 95 }, tolerancia, 'base')).toEqual({ tipo: 'marcacao-resize', id: 'base', canto: 'tr' })
    expect(encontrarMarcacao([original], { x: 400, y: 400 }, tolerancia, 'base')).toBeNull()
  })
})
