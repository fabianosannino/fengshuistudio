import { describe, it, expect } from 'vitest'
import {
  CICLO_GERACAO,
  CICLO_CONTROLE,
  elementoQueNutre,
  elementoQueControla,
  elementoQueExaure,
  normalizarElemento,
  estrategiaElemental,
  NOME_ELEMENTO,
  type Elemento,
} from '../cinco-elementos'

const ELEMENTOS: Elemento[] = ['agua', 'madeira', 'fogo', 'terra', 'metal']

describe('ciclos Wu Xing', () => {
  it('geração (Sheng) segue a sequência clássica', () => {
    expect(CICLO_GERACAO.agua).toBe('madeira')
    expect(CICLO_GERACAO.madeira).toBe('fogo')
    expect(CICLO_GERACAO.fogo).toBe('terra')
    expect(CICLO_GERACAO.terra).toBe('metal')
    expect(CICLO_GERACAO.metal).toBe('agua')
  })

  it('controle (Ke) segue a sequência clássica', () => {
    expect(CICLO_CONTROLE.agua).toBe('fogo')
    expect(CICLO_CONTROLE.fogo).toBe('metal')
    expect(CICLO_CONTROLE.metal).toBe('madeira')
    expect(CICLO_CONTROLE.madeira).toBe('terra')
    expect(CICLO_CONTROLE.terra).toBe('agua')
  })

  it('cada ciclo é uma permutação completa dos 5 elementos (sem buracos)', () => {
    for (const ciclo of [CICLO_GERACAO, CICLO_CONTROLE]) {
      expect(new Set(Object.values(ciclo)).size).toBe(5)
    }
  })

  it('elementoQueNutre é o inverso do ciclo de geração', () => {
    for (const e of ELEMENTOS) {
      expect(CICLO_GERACAO[elementoQueNutre(e)]).toBe(e)
    }
  })

  it('elementoQueControla é o inverso do ciclo de controle', () => {
    for (const e of ELEMENTOS) {
      expect(CICLO_CONTROLE[elementoQueControla(e)]).toBe(e)
    }
  })

  it('elementoQueExaure é o ciclo de Geração no sentido direto (o "filho" drena a "mãe")', () => {
    expect(elementoQueExaure('terra')).toBe('metal') // regra de ouro: 5 Amarelo/2 Negro (Terra) → Metal
    for (const e of ELEMENTOS) {
      expect(elementoQueExaure(e)).toBe(CICLO_GERACAO[e])
    }
  })

  it('elementoQueExaure e elementoQueNutre são inversos entre si', () => {
    for (const e of ELEMENTOS) {
      expect(elementoQueNutre(elementoQueExaure(e))).toBe(e)
    }
  })
})

describe('normalizarElemento', () => {
  it('aceita os nomes como estão no banco/constants (com acento e maiúscula)', () => {
    expect(normalizarElemento('Água')).toBe('agua')
    expect(normalizarElemento('Madeira')).toBe('madeira')
    expect(normalizarElemento('FOGO')).toBe('fogo')
    expect(normalizarElemento(' terra ')).toBe('terra')
    expect(normalizarElemento('Metal')).toBe('metal')
  })

  it('devolve null para desconhecidos — nunca chuta', () => {
    expect(normalizarElemento('Ar')).toBeNull()
    expect(normalizarElemento('')).toBeNull()
    expect(normalizarElemento(null)).toBeNull()
    expect(normalizarElemento(undefined)).toBeNull()
  })
})

describe('estrategiaElemental', () => {
  it('setor crítico: fortalece o próprio elemento + a mãe, evita o controlador', () => {
    // Madeira fraca → fortalecer Madeira e Água (mãe); evitar Metal (corta Madeira)
    const e = estrategiaElemental('madeira', 20)
    expect(e.fortalecer).toEqual(['madeira', 'agua'])
    expect(e.evitar).toBe('metal')
    expect(e.recomendacoes).toHaveLength(3)
    expect(e.recomendacoes[1]).toContain('Água')
    expect(e.recomendacoes[2]).toContain('Metal')
  })

  it('setor em atenção: reforço leve só com o próprio elemento', () => {
    const e = estrategiaElemental('fogo', 55)
    expect(e.fortalecer).toEqual(['fogo'])
    expect(e.evitar).toBe('agua') // Água apaga Fogo
    expect(e.recomendacoes).toHaveLength(2)
  })

  it('setor bom: nenhuma intervenção elemental (não gera ruído)', () => {
    const e = estrategiaElemental('terra', 85)
    expect(e.fortalecer).toEqual([])
    expect(e.recomendacoes).toEqual([])
  })

  it('limiares alinhados ao motor de recomendações (40/70)', () => {
    expect(estrategiaElemental('agua', 39).fortalecer).toHaveLength(2)
    expect(estrategiaElemental('agua', 40).fortalecer).toHaveLength(1)
    expect(estrategiaElemental('agua', 69).fortalecer).toHaveLength(1)
    expect(estrategiaElemental('agua', 70).fortalecer).toHaveLength(0)
  })

  it('as frases citam os nomes de exibição corretos', () => {
    for (const el of ELEMENTOS) {
      const e = estrategiaElemental(el, 10)
      expect(e.recomendacoes[0]).toContain(NOME_ELEMENTO[el])
    }
  })
})
