import { describe, expect, it } from 'vitest'
import {
  normalizarChecklist, resumirChi, proximoEstado, definirEstado,
  itensComProblema, itensNaoVerificados,
} from '../fluxo-chi'

const IDS = ['porta', 'corredor', 'escada', 'espelho']

describe('normalizarChecklist', () => {
  it('lê o formato antigo como «verifiquei e está conforme»', () => {
    // É a leitura fiel do que o consultor fez. Ler como «problema» inventaria
    // defeito onde havia silêncio.
    expect(normalizarChecklist(['porta', 'escada'])).toEqual({
      porta: 'conforme', escada: 'conforme',
    })
  })

  it('lê o formato novo preservando os dois estados', () => {
    expect(normalizarChecklist({ porta: 'conforme', escada: 'problema' })).toEqual({
      porta: 'conforme', escada: 'problema',
    })
  })

  it('descarta valor que não é estado válido', () => {
    expect(normalizarChecklist({ porta: 'talvez', escada: 'problema' })).toEqual({
      escada: 'problema',
    })
  })

  it('trata nulo, indefinido e lixo como checklist vazio', () => {
    for (const vazio of [null, undefined, 42, 'texto']) {
      expect(normalizarChecklist(vazio), String(vazio)).toEqual({})
    }
  })
})

describe('resumirChi', () => {
  it('não confunde imóvel não avaliado com imóvel problemático', () => {
    // Era o defeito: com `marcados / total`, os dois davam 0%.
    const naoAvaliado = resumirChi({}, IDS)
    const problematico = resumirChi(
      { porta: 'problema', corredor: 'problema', escada: 'problema', espelho: 'problema' },
      IDS
    )

    expect(naoAvaliado.score).toBeNull()   // «não sei»
    expect(problematico.score).toBe(0)     // «olhei tudo e tudo está errado»
    expect(naoAvaliado.score).not.toBe(problematico.score)
  })

  it('o score é sobre o que foi verificado, não sobre o total', () => {
    // 2 olhados, ambos conformes: 100% do que se olhou.
    const r = resumirChi({ porta: 'conforme', corredor: 'conforme' }, IDS)
    expect(r.score).toBe(100)
    expect(r.naoVerificado).toBe(2)
    expect(r.completo).toBe(false)
  })

  it('o texto qualifica o score, para 100% não ser lido como diagnóstico pronto', () => {
    expect(resumirChi({ porta: 'conforme', corredor: 'conforme' }, IDS).texto)
      .toBe('2 de 4 pontos verificados')
    expect(resumirChi({}, IDS).texto).toBe('Nenhum dos 4 pontos verificado')
  })

  it('conta os três estados', () => {
    const r = resumirChi({ porta: 'conforme', corredor: 'problema' }, IDS)
    expect(r).toMatchObject({ conforme: 1, problema: 1, naoVerificado: 2, total: 4 })
  })

  it('marca como completo quando todo item tem estado', () => {
    const r = resumirChi(
      { porta: 'conforme', corredor: 'conforme', escada: 'problema', espelho: 'conforme' },
      IDS
    )
    expect(r.completo).toBe(true)
    expect(r.score).toBe(75)
  })

  it('ignora estado de item que não está no checklist', () => {
    // Item personalizado removido não deve continuar pontuando.
    const r = resumirChi({ porta: 'conforme', removido: 'problema' }, IDS)
    expect(r.conforme).toBe(1)
    expect(r.problema).toBe(0)
  })
})

describe('proximoEstado', () => {
  it('cicla não verificado → conforme → problema → não verificado', () => {
    // Começa em «conforme» porque é o caso comum: percorrer a lista
    // confirmando o que está certo e parar nos que não estão.
    expect(proximoEstado(undefined)).toBe('conforme')
    expect(proximoEstado('conforme')).toBe('problema')
    expect(proximoEstado('problema')).toBeUndefined()
  })
})

describe('definirEstado', () => {
  it('remove a chave ao voltar para não verificado', () => {
    // A ausência é o terceiro estado; deixar a chave com valor vazio criaria
    // um quarto estado sem significado.
    const antes = { porta: 'conforme' as const }
    expect(definirEstado(antes, 'porta', undefined)).toEqual({})
  })

  it('não altera o objeto recebido', () => {
    const antes = { porta: 'conforme' as const }
    definirEstado(antes, 'escada', 'problema')
    expect(antes).toEqual({ porta: 'conforme' })
  })
})

describe('itensComProblema e itensNaoVerificados', () => {
  it('separam o que virou pauta do que virou lacuna', () => {
    const checklist = { porta: 'conforme' as const, corredor: 'problema' as const }
    expect(itensComProblema(checklist, IDS)).toEqual(['corredor'])
    expect(itensNaoVerificados(checklist, IDS)).toEqual(['escada', 'espelho'])
  })
})
