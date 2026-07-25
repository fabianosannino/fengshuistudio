import { describe, it, expect } from 'vitest'
import { calcularKuaDaCasa, compatibilidadeMoradorCasa } from '../oito-mansoes'
import { GRUPO_LESTE } from '../ming-gua'

describe('Lo Shu por octante — verificação do quadrado mágico', () => {
  // Layout row-major (S no topo, convenção clássica — mesma de bagua-grid.ts):
  //   SE  S  SW      octante: SE=3 S=4 SW=5
  //   E   C  W        octante: E=2 C=- W=6
  //   NE  N  NW      octante: NE=1 N=0 NW=7
  const grid = {
    SE: calcularKuaDaCasa(135).kua, S: calcularKuaDaCasa(180).kua, SW: calcularKuaDaCasa(225).kua,
    E: calcularKuaDaCasa(90).kua, C: 5, W: calcularKuaDaCasa(270).kua,
    NE: calcularKuaDaCasa(45).kua, N: calcularKuaDaCasa(0).kua, NW: calcularKuaDaCasa(315).kua,
  }

  it('reproduz o quadrado Lo Shu clássico (4-9-2 / 3-5-7 / 8-1-6)', () => {
    expect(grid).toEqual({ SE: 4, S: 9, SW: 2, E: 3, C: 5, W: 7, NE: 8, N: 1, NW: 6 })
  })

  it('toda linha, coluna e diagonal soma 15 (propriedade do quadrado mágico)', () => {
    const linhas = [
      [grid.SE, grid.S, grid.SW], [grid.E, grid.C, grid.W], [grid.NE, grid.N, grid.NW],
    ]
    const colunas = [
      [grid.SE, grid.E, grid.NE], [grid.S, grid.C, grid.N], [grid.SW, grid.W, grid.NW],
    ]
    const diagonais = [[grid.SE, grid.C, grid.NW], [grid.SW, grid.C, grid.NE]]
    for (const linha of [...linhas, ...colunas, ...diagonais]) {
      expect(linha.reduce((a, b) => a + b, 0)).toBe(15)
    }
  })
})

describe('calcularKuaDaCasa', () => {
  it('360° é equivalente a 0° (Norte)', () => {
    expect(calcularKuaDaCasa(360)).toEqual(calcularKuaDaCasa(0))
  })

  it('nunca devolve Kua 5 (é o centro, não uma fachada)', () => {
    for (let graus = 0; graus < 360; graus += 15) {
      expect(calcularKuaDaCasa(graus).kua).not.toBe(5)
    }
  })

  it('grupo é consistente com GRUPO_LESTE (mesma fonte do Ming Gua pessoal)', () => {
    for (let graus = 0; graus < 360; graus += 45) {
      const { kua, grupo } = calcularKuaDaCasa(graus)
      expect(grupo).toBe(GRUPO_LESTE.has(kua) ? 'leste' : 'oeste')
    }
  })

  it('casa voltada para o Sul (fachada clássica mais auspiciosa) tem Kua 9', () => {
    expect(calcularKuaDaCasa(180).kua).toBe(9)
    expect(calcularKuaDaCasa(180).grupo).toBe('leste')
  })
})

describe('compatibilidadeMoradorCasa', () => {
  it('mesmo grupo → compatível', () => {
    const c = compatibilidadeMoradorCasa(1, 9) // Kua 1 e 9 são ambos grupo Leste
    expect(c.compativel).toBe(true)
    expect(c.grupoMorador).toBe('leste')
    expect(c.grupoCasa).toBe('leste')
  })

  it('grupos diferentes → não compatível, mensagem explica o motivo', () => {
    const c = compatibilidadeMoradorCasa(1, 2) // Kua 1=Leste, Kua 2=Oeste
    expect(c.compativel).toBe(false)
    expect(c.mensagem).toContain('diverge')
  })
})
