import { describe, it, expect } from 'vitest'
import { setoresFavoraveis, avaliarPosicionamento } from '../posicionamento-mobiliario'
import { DIRECOES_POR_KUA } from '../ming-gua'

describe('setoresFavoraveis', () => {
  it('converte os 4 nomes de direção do Kua 1 para os setores corretos', () => {
    // Kua 1: shengChi Sudeste, tienYi Leste, yenNien Sul, fuWei Norte
    expect(setoresFavoraveis(DIRECOES_POR_KUA[1])).toEqual(new Set(['SE', 'E', 'S', 'N']))
  })

  it('sempre devolve exatamente 4 setores distintos, para todos os Kua', () => {
    for (const kua of [1, 2, 3, 4, 6, 7, 8, 9]) {
      expect(setoresFavoraveis(DIRECOES_POR_KUA[kua]).size).toBe(4)
    }
  })
})

describe('avaliarPosicionamento — regra 坐凶向吉 (sentar no mal, olhar para o bem)', () => {
  const direcoesKua1 = DIRECOES_POR_KUA[1] // favoráveis: SE, E, S, N

  it('fogão bem posicionado: corpo em setor desfavorável, boca para direção favorável', () => {
    const r = avaliarPosicionamento(direcoesKua1, 'W', 'SE') // W é desfavorável p/ Kua 1, SE é Sheng Chi
    expect(r.localizacaoFavoravel).toBe(false)
    expect(r.direcaoFavoravel).toBe(true)
  })

  it('cama mal posicionada: direção (para onde a cabeça aponta) é desfavorável', () => {
    const r = avaliarPosicionamento(direcoesKua1, 'N', 'W') // N favorável, mas a DIREÇÃO é o que importa
    expect(r.direcaoFavoravel).toBe(false)
  })

  it('localização favorável não é exigida — é só informativa', () => {
    const r = avaliarPosicionamento(direcoesKua1, 'N', 'E') // ambos favoráveis: também é um resultado válido
    expect(r.localizacaoFavoravel).toBe(true)
    expect(r.direcaoFavoravel).toBe(true)
  })

  it('cross-validação: para todos os Kua, toda direção favorável do próprio Kua nunca é avaliada como desfavorável', () => {
    for (const kua of [1, 2, 3, 4, 6, 7, 8, 9]) {
      const direcoes = DIRECOES_POR_KUA[kua]
      const favoraveis = setoresFavoraveis(direcoes)
      for (const setor of favoraveis) {
        expect(avaliarPosicionamento(direcoes, 'N', setor).direcaoFavoravel).toBe(true)
      }
    }
  })
})
