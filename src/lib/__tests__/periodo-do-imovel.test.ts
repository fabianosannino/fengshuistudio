import { describe, expect, it } from 'vitest'
import {
  periodoDoAno, periodoDoImovel, reformaIncoerente, faixaDoPeriodo,
  ANO_MINIMO_CONSTRUCAO,
} from '../periodo-do-imovel'

describe('periodoDoAno', () => {
  it('reproduz as âncoras publicadas', () => {
    expect(periodoDoAno(2004)?.periodo).toBe(8)
    expect(periodoDoAno(2023)?.periodo).toBe(8)
    expect(periodoDoAno(2024)?.periodo).toBe(9)
    expect(periodoDoAno(2043)?.periodo).toBe(9)
    expect(periodoDoAno(2044)?.periodo).toBe(1) // ciclo reinicia
  })

  it('declara a ambiguidade da virada em vez de escolher em silêncio', () => {
    // Uma obra concluída em janeiro de 2024 é ano solar 2023 → Período 8. Em
    // março de 2024, Período 9. O ano sozinho não distingue os dois — e era
    // exatamente isso que o `<input type="date">` resolvia inventando 01/01.
    const virada = periodoDoAno(2024)
    expect(virada).toMatchObject({ periodo: 9, ambiguo: true, periodoAnterior: 8 })
  })

  it('ano no meio do período não é ambíguo', () => {
    expect(periodoDoAno(2030)).toMatchObject({ ambiguo: false, periodoAnterior: null })
  })

  it('fail-closed para ano ausente, quebrado ou anterior ao ciclo conhecido', () => {
    for (const invalido of [null, undefined, NaN, 1863, 2024.5]) {
      expect(periodoDoAno(invalido as number), String(invalido)).toBeNull()
    }
    expect(periodoDoAno(ANO_MINIMO_CONSTRUCAO)?.periodo).toBe(1)
  })
})

describe('periodoDoImovel', () => {
  it('a reforma estrutural posterior substitui o período da construção', () => {
    // §1.5 do documento-mestre: a carta natal usa a última reforma estrutural
    // relevante quando houve uma.
    const r = periodoDoImovel({ anoConstrucao: 1995, anoReformaEstrutural: 2010 })
    expect(r).toMatchObject({ periodo: 8, anoUsado: 2010, daReforma: true })
  })

  it('sem reforma, vale a construção', () => {
    expect(periodoDoImovel({ anoConstrucao: 1995 }))
      .toMatchObject({ periodo: 7, anoUsado: 1995, daReforma: false })
  })

  it('reforma anterior à construção é ignorada, não corrigida', () => {
    // Dado incoerente: alguém trocou os campos. Escolher o maior «consertaria»
    // o erro e o esconderia; `reformaIncoerente` existe para a tela cobrar.
    const r = periodoDoImovel({ anoConstrucao: 2010, anoReformaEstrutural: 1995 })
    expect(r).toMatchObject({ anoUsado: 2010, daReforma: false })
    expect(reformaIncoerente({ anoConstrucao: 2010, anoReformaEstrutural: 1995 })).toBe(true)
    expect(reformaIncoerente({ anoConstrucao: 1995, anoReformaEstrutural: 2010 })).toBe(false)
  })

  it('reforma no mesmo ano da construção vale como reforma', () => {
    expect(periodoDoImovel({ anoConstrucao: 2010, anoReformaEstrutural: 2010 })?.daReforma).toBe(true)
  })

  it('só reforma informada ainda dá período', () => {
    expect(periodoDoImovel({ anoReformaEstrutural: 2024 }))
      .toMatchObject({ periodo: 9, daReforma: true })
  })

  it('sem nenhum ano não há período — a carta não é montada sem isso', () => {
    expect(periodoDoImovel({})).toBeNull()
    expect(periodoDoImovel({ anoConstrucao: null, anoReformaEstrutural: null })).toBeNull()
  })
})

describe('faixaDoPeriodo', () => {
  it('devolve a volta do ciclo em que o ano está, não a primeira', () => {
    // O ciclo tem 180 anos: Período 1 é 1864-1883 e também 2044-2063.
    expect(faixaDoPeriodo(2030)).toEqual({ inicio: 2024, fim: 2043 })
    expect(faixaDoPeriodo(2050)).toEqual({ inicio: 2044, fim: 2063 })
    expect(faixaDoPeriodo(1870)).toEqual({ inicio: 1864, fim: 1883 })
  })
})
