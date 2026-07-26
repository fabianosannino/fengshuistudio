import { describe, it, expect } from 'vitest'
import { gridOrderBTB, gridOrderBussola, calcularGridOrder, guaDaPorta } from '../bagua-grid'

// Rótulos de direção por célula, na mesma disposição row-major usada pelo grid.
// Serve só para os testes lerem a saída de forma legível — não duplica a
// lógica de bagua-grid.ts (que trabalha só com índices).
const DIRECAO_DA_CELULA = ['SE', 'S', 'SW', 'E', 'C', 'W', 'NE', 'N', 'NW']

describe('gridOrderBTB — o Ba Guá do BTB é FIXO à parede da entrada', () => {
  it('a grade é a mesma para qualquer posição da porta', () => {
    // Doutrina (Carter, Move Your Stuff Change Your Life, Fig. 2): "THIS SIDE
    // OF THE BAGUA ALWAYS HAS THE MAIN DOOR ... LOCATED ON IT". A porta define
    // QUAL parede vai para a base (girando a planta), não como o mapa se
    // arranja. Onde a porta cai nessa parede é diagnóstico, não transformação.
    const identidade = [0, 1, 2, 3, 4, 5, 6, 7, 8]
    for (const lado of ['centro', 'esquerda', 'direita', 'qualquer-coisa', '']) {
      expect(gridOrderBTB(lado), lado).toEqual(identidade)
    }
    expect(gridOrderBTB()).toEqual(identidade)
  })

  it('REGRESSÃO: a porta à direita não espelha mais o mapa', () => {
    // Bug corrigido: devolvia [2,1,0,5,4,3,8,7,6], que inverte cada linha e
    // jogava a Prosperidade para o fundo-DIREITO. A doutrina diz que o canto
    // da prosperidade é SEMPRE o fundo-esquerdo, em toda planta.
    expect(gridOrderBTB('direita')).not.toEqual([2, 1, 0, 5, 4, 3, 8, 7, 6])
  })

  it('o layout canônico da figura de Carter é reproduzido célula a célula', () => {
    // Trava o mapa contra a fonte, em vez de contra um array de índices.
    const SETORES = [
      'Prosperidade', 'Fama', 'Relacionamentos',
      'Família', 'Centro', 'Criatividade',
      'Conhecimento', 'Carreira', 'Pessoas Úteis',
    ]
    const grade = gridOrderBTB('centro').map(i => SETORES[i])
    expect(grade.slice(0, 3)).toEqual(['Prosperidade', 'Fama', 'Relacionamentos'])
    expect(grade.slice(3, 6)).toEqual(['Família', 'Centro', 'Criatividade'])
    // A linha da ENTRADA: Conhecimento / Carreira / Pessoas Úteis.
    expect(grade.slice(6, 9)).toEqual(['Conhecimento', 'Carreira', 'Pessoas Úteis'])
  })
})

describe('guaDaPorta — o `lado` virou leitura, não transformação', () => {
  it('mapeia o terço da parede da entrada para o guá correspondente', () => {
    expect(guaDaPorta('esquerda')).toBe('Conhecimento')
    expect(guaDaPorta('centro')).toBe('Carreira')
    expect(guaDaPorta('direita')).toBe('Pessoas Úteis')
  })

  it('valor desconhecido cai no centro, sem estourar', () => {
    expect(guaDaPorta('x')).toBe('Carreira')
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
  it('metodologia "btb" ignora a orientação — e agora também o lado', () => {
    // O BTB não usa bússola: mesmo recebendo graus, a grade não muda.
    expect(calcularGridOrder('btb', { lado: 'direita', orientacaoGraus: 90 }))
      .toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8])
    expect(calcularGridOrder('btb', { lado: 'esquerda', orientacaoGraus: 270 }))
      .toEqual(calcularGridOrder('btb', { lado: 'direita' }))
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
