import { describe, expect, it } from 'vitest'
import { leituraDoSetor, resumoDaCasa } from '../leitura-do-cliente'
import { LIMIAR_SCORE_BOM, LIMIAR_SCORE_CRITICO } from '../constants'

describe('leituraDoSetor', () => {
  it('usa os mesmos limiares do resto do produto', () => {
    // Uma régua só: um segundo conjunto de cortes faria a mesma casa ser «boa»
    // na tela do consultor e «ruim» na do morador.
    expect(leituraDoSetor(LIMIAR_SCORE_BOM).rotulo).toBe('Em harmonia')
    expect(leituraDoSetor(LIMIAR_SCORE_BOM - 1).rotulo).toBe('Pede atenção')
    expect(leituraDoSetor(LIMIAR_SCORE_CRITICO).rotulo).toBe('Pede atenção')
    expect(leituraDoSetor(LIMIAR_SCORE_CRITICO - 1).rotulo).toBe('Precisa de cuidado')
  })

  it('não avaliado é o terceiro estado, não «ruim»', () => {
    for (const vazio of [null, undefined]) {
      expect(leituraDoSetor(vazio).nivel, String(vazio)).toBe('nao_avaliado')
    }
    expect(leituraDoSetor(null).rotulo).toBe('Ainda não avaliado')
  })

  it('zero é avaliação, não ausência', () => {
    expect(leituraDoSetor(0).nivel).toBe('cuidado')
  })
})

describe('resumoDaCasa', () => {
  it('conta os quatro estados', () => {
    const r = resumoDaCasa([90, 85, 60, 30, null])
    expect(r).toMatchObject({ emHarmonia: 2, pedemAtencao: 1, precisamCuidado: 1, naoAvaliados: 1, total: 5 })
  })

  it('com lacuna, o denominador é o que foi avaliado', () => {
    // «7 de 9» com dois setores nunca olhados transformaria ausência em aprovação.
    const r = resumoDaCasa([90, 90, 90, 90, 90, 90, 90, null, null])
    expect(r.titulo).toBe('Sua casa está em harmonia em 7 dos 7 setores já avaliados')
  })

  it('casa completa fala em nove', () => {
    const r = resumoDaCasa([90, 90, 90, 90, 90, 90, 90, 50, 20])
    expect(r.titulo).toBe('Sua casa está em harmonia em 7 dos 9 setores')
  })

  it('tudo em harmonia não vira «9 dos 9»', () => {
    expect(resumoDaCasa(Array(9).fill(95)).titulo).toBe('Sua casa está em harmonia nos 9 setores')
  })

  it('casa intocada diz que não foi avaliada, em vez de dizer «0 de 9»', () => {
    expect(resumoDaCasa(Array(9).fill(null)).titulo).toBe('Sua casa ainda não foi avaliada')
  })
})
