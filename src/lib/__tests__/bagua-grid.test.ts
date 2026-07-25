import { describe, it, expect } from 'vitest'
import { gridOrderBTB, gridOrderBussola, calcularGridOrder } from '../bagua-grid'

// Rótulos de direção por célula, na mesma disposição row-major usada pelo grid.
// Serve só para os testes lerem a saída de forma legível — não duplica a
// lógica de bagua-grid.ts (que trabalha só com índices).
const DIRECAO_DA_CELULA = ['SE', 'S', 'SW', 'E', 'C', 'W', 'NE', 'N', 'NW']

describe('gridOrderBTB — comportamento histórico preservado', () => {
  it('ordem padrão (entrada não é "direita") é a identidade', () => {
    expect(gridOrderBTB('centro')).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8])
    expect(gridOrderBTB('esquerda')).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8])
  })

  it('entrada "direita" gira o grid (comportamento existente)', () => {
    expect(gridOrderBTB('direita')).toEqual([2, 1, 0, 5, 4, 3, 8, 7, 6])
  })
})

describe('gridOrderBussola — setores fixos à direção cardinal real', () => {
  it('fachada voltada para o Norte (0°) = grid padrão (Carreira/Norte na base)', () => {
    expect(gridOrderBussola(0)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8])
  })

  it('360° é equivalente a 0° (Norte)', () => {
    expect(gridOrderBussola(360)).toEqual(gridOrderBussola(0))
  })

  it('fachada voltada para o Sul (180°): a célula da base mostra Fama (índice 1, Sul)', () => {
    const order = gridOrderBussola(180)
    // célula 7 = base da grade (onde a parede de referência foi desenhada)
    expect(order[7]).toBe(1)
    expect(DIRECAO_DA_CELULA[order[7]]).toBe('S')
  })

  it('fachada voltada para o Leste (90°): a base mostra Família (índice 3, Leste)', () => {
    const order = gridOrderBussola(90)
    expect(order[7]).toBe(3)
  })

  it('fachada voltada para o Oeste (270°): a base mostra Criatividade (índice 5, Oeste)', () => {
    const order = gridOrderBussola(270)
    expect(order[7]).toBe(5)
  })

  it('o Centro nunca muda de célula, em nenhuma orientação', () => {
    for (let graus = 0; graus < 360; graus += 15) {
      expect(gridOrderBussola(graus)[4]).toBe(4)
    }
  })

  it('graus negativos e >360 são normalizados corretamente', () => {
    expect(gridOrderBussola(-90)).toEqual(gridOrderBussola(270))
    expect(gridOrderBussola(450)).toEqual(gridOrderBussola(90))
  })

  it('arredonda para o octante mais próximo (graus intermediários)', () => {
    // 100° está mais perto de 90°(Leste) que de 135°(Sudeste)
    expect(gridOrderBussola(100)).toEqual(gridOrderBussola(90))
  })

  it('é sempre uma permutação completa dos 9 índices (sem duplicar/faltar setor)', () => {
    for (let graus = 0; graus < 360; graus += 45) {
      const order = gridOrderBussola(graus)
      expect(new Set(order).size).toBe(9)
      expect([...order].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8])
    }
  })

  it('rotaciona de forma consistente entre octantes vizinhos (a base avança na mesma direção da fachada)', () => {
    // A cada +45° na fachada, o índice que aparece na base avança 1 posição
    // no anel horário a partir do Norte.
    const anelEsperado = [7, 6, 3, 0, 1, 2, 5, 8] // direções N,NE,E,SE,S,SW,W,NW nas células
    for (let oct = 0; oct < 8; oct++) {
      const order = gridOrderBussola(oct * 45)
      expect(order[7]).toBe(anelEsperado[oct])
    }
  })
})

describe('calcularGridOrder — dispatcher usado pela tela', () => {
  it('metodologia "btb" usa lado, ignora orientação', () => {
    expect(calcularGridOrder('btb', { lado: 'direita', orientacaoGraus: 90 })).toEqual(gridOrderBTB('direita'))
  })

  it('metodologia "bussola" usa orientação, ignora lado', () => {
    expect(calcularGridOrder('bussola', { lado: 'direita', orientacaoGraus: 180 })).toEqual(gridOrderBussola(180))
  })

  it('metodologia "bussola" sem orientação informada cai para BTB (fail-safe)', () => {
    expect(calcularGridOrder('bussola', { lado: 'centro' })).toEqual(gridOrderBTB('centro'))
  })

  it('metodologia desconhecida cai para BTB padrão', () => {
    expect(calcularGridOrder('outra', {})).toEqual(gridOrderBTB('centro'))
  })
})
