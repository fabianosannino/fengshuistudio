import { describe, it, expect } from 'vitest'
import { periodoDaConstrucao, calcularEstrelasVoadoras, nomeElementoDoNumero } from '../estrelas-voadoras'

describe('periodoDaConstrucao', () => {
  it('âncoras conhecidas: Período 8 (2004-2023) e Período 9 (2024-2043)', () => {
    expect(periodoDaConstrucao('2004-06-15')).toBe(8)
    expect(periodoDaConstrucao('2023-12-31')).toBe(8)
    expect(periodoDaConstrucao('2024-06-15')).toBe(9)
    expect(periodoDaConstrucao('2043-12-31')).toBe(9)
  })

  it('início do ciclo de referência (1864) é Período 1', () => {
    expect(periodoDaConstrucao('1864-06-01')).toBe(1)
  })

  it('o ciclo de 180 anos repete (2044 volta a ser Período 1)', () => {
    expect(periodoDaConstrucao('2044-06-01')).toBe(1)
  })

  it('ano solar: antes do Li Chun (~4 fev) conta o ano anterior', () => {
    expect(periodoDaConstrucao('2024-01-10')).toBe(8) // ainda 2023 solar
    expect(periodoDaConstrucao('2024-02-04')).toBe(9) // já 2024 solar
  })

  it('dado ausente/inválido/anterior a 1864 → null (fail-closed)', () => {
    expect(periodoDaConstrucao(null)).toBeNull()
    expect(periodoDaConstrucao('data-invalida')).toBeNull()
    expect(periodoDaConstrucao('1800-01-01')).toBeNull()
  })
})

describe('calcularEstrelasVoadoras — grade do Período', () => {
  it('reproduz a carta do Período 8 amplamente publicada (4-9-2/3-5-7/8-1-6 em Sul-no-topo)', () => {
    const mapa = calcularEstrelasVoadoras({ facingGraus: 0, periodo: 8 })! // facingGraus aqui só afeta montanha/fachada, não o período
    const porPalacio = Object.fromEntries(mapa.palacios.map(p => [p.palacio, p.periodo]))
    expect(porPalacio).toEqual({ C: 8, NW: 9, W: 1, NE: 2, S: 3, N: 4, SW: 5, E: 6, SE: 7 })
  })

  it('devolve null sem período válido', () => {
    expect(calcularEstrelasVoadoras({ facingGraus: 0, periodo: null })).toBeNull()
    expect(calcularEstrelasVoadoras({ facingGraus: 0, periodo: 0 })).toBeNull()
    expect(calcularEstrelasVoadoras({ facingGraus: 0, periodo: 10 })).toBeNull()
  })
})

describe('calcularEstrelasVoadoras — Montanha e Fachada (caso clássico: Período 8, sentado Norte, fachada Sul)', () => {
  // Exemplo de livro-texto (坐北向南). Derivação manual conferida linha a
  // linha antes de codificar — ver PR para o passo a passo.
  const mapa = calcularEstrelasVoadoras({ facingGraus: 180, periodo: 8 })!
  const porPalacio = Object.fromEntries(mapa.palacios.map(p => [p.palacio, p]))

  it('semente da fachada é ÍMPAR (3, no Sul) → voa PARA FRENTE → reproduz a grade do período', () => {
    expect(porPalacio.S.fachada).toBe(3)
    expect(Object.fromEntries(mapa.palacios.map(p => [p.palacio, p.fachada])))
      .toEqual({ C: 8, NW: 9, W: 1, NE: 2, S: 3, N: 4, SW: 5, E: 6, SE: 7 })
  })

  it('semente da montanha é PAR (4, no Norte) → voa PARA TRÁS', () => {
    expect(porPalacio.N.montanha).toBe(4)
    expect(Object.fromEntries(mapa.palacios.map(p => [p.palacio, p.montanha])))
      .toEqual({ N: 4, SW: 3, E: 2, SE: 1, C: 9, NW: 8, W: 7, NE: 6, S: 5 })
  })

  it('marca corretamente os palácios com a Estrela 5 (cautela universal)', () => {
    // Estrela 5 aparece: período em SW(5), montanha em C(9)? não — checar cada grade.
    // período: SW=5 → SW.temEstrela5=true
    expect(porPalacio.SW.temEstrela5).toBe(true)
    expect(porPalacio.C.temEstrela5).toBe(false) // C tem periodo=8, montanha=9, fachada=8 — nenhum é 5
  })
})

describe('calcularEstrelasVoadoras — invariantes estruturais', () => {
  it('cada uma das 3 grades é sempre uma permutação completa de 1-9, para qualquer período/fachada', () => {
    for (let periodo = 1; periodo <= 9; periodo++) {
      for (let graus = 0; graus < 360; graus += 45) {
        const mapa = calcularEstrelasVoadoras({ facingGraus: graus, periodo })!
        for (const chave of ['periodo', 'montanha', 'fachada'] as const) {
          const valores = mapa.palacios.map(p => p[chave]).sort((a, b) => a - b)
          expect(valores).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9])
        }
      }
    }
  })

  it('a estrela da fachada no palácio da fachada sempre bate com a estrela do período nesse mesmo palácio (definição do método)', () => {
    for (let periodo = 1; periodo <= 9; periodo++) {
      for (let graus = 0; graus < 360; graus += 45) {
        const mapa = calcularEstrelasVoadoras({ facingGraus: graus, periodo })!
        const palacioFachada = mapa.palacios.find(p =>
          ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][mapa.facingOctante] === p.palacio
        )!
        expect(palacioFachada.fachada).toBe(palacioFachada.periodo)
      }
    }
  })
})

describe('nomeElementoDoNumero', () => {
  it('mapeia os números clássicos (1=Água ... 9=Fogo)', () => {
    expect(nomeElementoDoNumero(1)).toBe('Água')
    expect(nomeElementoDoNumero(9)).toBe('Fogo')
    expect(nomeElementoDoNumero(8)).toBe('Terra')
  })
})
