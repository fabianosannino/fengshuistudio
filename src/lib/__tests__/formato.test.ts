import { describe, expect, it } from 'vitest'
import {
  formatarData, formatarDataHora, formatarDataExtensa,
  formatarMoeda, formatarNumero, SEM_DATA,
} from '../formato'

describe('formatarData', () => {
  it('não transforma ausência de valor em 01/01/1970', () => {
    // `new Date(null)` é a época Unix. Sem esta guarda, um campo vazio vira uma
    // data plausível na tela — o mesmo defeito que o ADR 0020 descreve na
    // trilha de auditoria.
    for (const vazio of [null, undefined, '']) {
      expect(formatarData(vazio), String(vazio)).toBe(SEM_DATA)
      expect(formatarData(vazio)).not.toContain('1970')
    }
  })

  it('devolve ausência para data inválida, sem estourar', () => {
    expect(formatarData('não é data')).toBe(SEM_DATA)
  })

  it('formata data real em pt-BR', () => {
    expect(formatarData('2026-08-12T14:30:00.000Z')).toMatch(/^\d{2}\/\d{2}\/\d{4}$/)
  })

  it('aceita Date, string ISO e timestamp', () => {
    const esperado = formatarData('2026-08-12T12:00:00.000Z')
    expect(formatarData(new Date('2026-08-12T12:00:00.000Z'))).toBe(esperado)
    expect(formatarData(Date.parse('2026-08-12T12:00:00.000Z'))).toBe(esperado)
  })

  it('a época Unix explícita continua sendo exibida — é valor, não lacuna', () => {
    expect(formatarData('1970-01-01T00:00:00.000Z')).not.toBe(SEM_DATA)
  })
})

describe('formatarDataHora e formatarDataExtensa', () => {
  it('respeitam a mesma regra de ausência', () => {
    expect(formatarDataHora(null)).toBe(SEM_DATA)
    expect(formatarDataExtensa(null)).toBe(SEM_DATA)
  })

  it('incluem hora e nome do dia, respectivamente', () => {
    expect(formatarDataHora('2026-08-12T14:30:00.000Z')).toMatch(/\d{2}:\d{2}/)
    expect(formatarDataExtensa('2026-08-12T14:30:00.000Z')).toMatch(/-feira|sábado|domingo/)
  })
})

describe('formatarMoeda', () => {
  it('usa símbolo e separadores de pt-BR', () => {
    const saida = formatarMoeda(1234.5)
    expect(saida).toContain('R$')
    expect(saida).toContain('1.234,50')
  })

  it('aceita outra moeda — a loja opera com contas conectadas', () => {
    expect(formatarMoeda(10, 'usd')).toContain('US$')
  })

  it('trata nulo, indefinido e NaN como zero em vez de imprimir lixo', () => {
    for (const vazio of [null, undefined, NaN]) {
      expect(formatarMoeda(vazio), String(vazio)).toContain('0,00')
    }
  })
})

describe('formatarNumero', () => {
  it('agrupa milhar sem símbolo de moeda', () => {
    expect(formatarNumero(1234)).toBe('1.234')
    expect(formatarNumero(null)).toBe('0')
  })
})
