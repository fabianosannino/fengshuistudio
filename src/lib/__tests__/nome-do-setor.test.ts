import { describe, expect, it } from 'vitest'
import { setorCanonico, scorePorSetor } from '../nome-do-setor'
import { LOSHU_ORDER } from '../constants'

/**
 * As quinze grafias que existem em produção hoje, contadas em
 * `select nome, count(*) from setores_bagua group by nome`.
 */
const GRAFIAS_REAIS = [
  'Carreira', 'Centro', 'Centro/Saúde', 'Conhecimento', 'Criatividade',
  'Espiritualidade', 'Fama', 'Fama/Reputação', 'Familia', 'Família',
  'Filhos', 'Pessoas Uteis', 'Pessoas Úteis', 'Prosperidade', 'Relacionamentos',
]

describe('setorCanonico', () => {
  it('reconhece todas as grafias que existem em produção', () => {
    // Comparar `nome` com igualdade exata perdia a maior parte das linhas em
    // silêncio — o setor sumia da tela como se não tivesse sido avaliado.
    for (const grafia of GRAFIAS_REAIS) {
      expect(setorCanonico(grafia), grafia).not.toBeNull()
    }
  })

  it('acento e caixa não separam o que é o mesmo setor', () => {
    expect(setorCanonico('Familia')).toBe('Família')
    expect(setorCanonico('FAMÍLIA')).toBe('Família')
    expect(setorCanonico('  família  ')).toBe('Família')
    expect(setorCanonico('Pessoas Uteis')).toBe('Pessoas Úteis')
  })

  it('as composições caem no mesmo setor da forma curta', () => {
    expect(setorCanonico('Centro/Saúde')).toBe(setorCanonico('Centro'))
    expect(setorCanonico('Fama/Reputação')).toBe(setorCanonico('Fama'))
    expect(setorCanonico('Criatividade / Filhos')).toBe(setorCanonico('Criatividade'))
  })

  it('sinônimos de domínio do mesmo Guá convergem', () => {
    // «Espiritualidade» e «Conhecimento» são o mesmo Guá (NE).
    expect(setorCanonico('Espiritualidade')).toBe(setorCanonico('Conhecimento'))
    expect(setorCanonico('Filhos')).toBe(setorCanonico('Criatividade'))
    expect(setorCanonico('Amor')).toBe(setorCanonico('Relacionamentos'))
  })

  it('o resultado é sempre um nome de LOSHU_ORDER', () => {
    // Se devolvesse um nome fora da lista, quem indexa por LOSHU_ORDER
    // descartaria a linha em silêncio — o defeito que isto corrige.
    for (const grafia of GRAFIAS_REAIS) {
      expect(LOSHU_ORDER, grafia).toContain(setorCanonico(grafia))
    }
  })

  it('nome irreconhecível é null, não um palpite', () => {
    // Atribuir a linha ao setor errado é pior que ignorá-la: o score de um
    // ambiente apareceria sob o nome de outro.
    for (const invalido of [null, undefined, '', '   ', 'Garagem', 'xyz']) {
      expect(setorCanonico(invalido as string), String(invalido)).toBeNull()
    }
  })
})

describe('scorePorSetor', () => {
  it('devolve sempre os nove setores, com null onde não há avaliação', () => {
    const r = scorePorSetor([{ nome: 'Carreira', score_percentual: 40 }])
    expect(Object.keys(r).sort()).toEqual([...LOSHU_ORDER].sort())
    expect(r['Carreira']).toBe(40)
    expect(r['Prosperidade']).toBeNull()
  })

  it('junta as grafias diferentes do mesmo setor', () => {
    const r = scorePorSetor([
      { nome: 'Fama/Reputação', score_percentual: 55 },
      { nome: 'Centro/Saúde', score_percentual: 72 },
      { nome: 'Pessoas Uteis', score_percentual: 61 },
    ])
    expect(r['Fama']).toBe(55)
    expect(r['Centro']).toBe(72)
    expect(r['Pessoas Úteis']).toBe(61)
  })

  it('linha com score vence linha sem score no mesmo setor', () => {
    // A consulta foi refeita por uma tela que grafa diferente. Descartar a que
    // tem score em favor da que não tem apagaria uma avaliação real.
    const r = scorePorSetor([
      { nome: 'Centro/Saúde', score_percentual: 72 },
      { nome: 'Centro', score_percentual: null },
    ])
    expect(r['Centro']).toBe(72)

    const invertido = scorePorSetor([
      { nome: 'Centro', score_percentual: null },
      { nome: 'Centro/Saúde', score_percentual: 72 },
    ])
    expect(invertido['Centro']).toBe(72)
  })

  it('score zero é avaliação, não ausência', () => {
    expect(scorePorSetor([{ nome: 'Carreira', score_percentual: 0 }])['Carreira']).toBe(0)
  })

  it('linha irreconhecível é ignorada sem contaminar outro setor', () => {
    const r = scorePorSetor([
      { nome: 'Garagem', score_percentual: 99 },
      { nome: 'Carreira', score_percentual: 30 },
    ])
    expect(Object.values(r).filter(v => v !== null)).toEqual([30])
  })

  it('lista vazia dá os nove como não avaliados', () => {
    const r = scorePorSetor([])
    expect(Object.values(r).every(v => v === null)).toBe(true)
  })
})
