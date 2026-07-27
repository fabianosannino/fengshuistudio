import { describe, expect, it } from 'vitest'
import { dataDeAuditoria, SEM_CARIMBO } from '../data-auditoria'

describe('dataDeAuditoria', () => {
  it('não transforma ausência de data em 1970', () => {
    // `new Date(null)` é a época Unix: a tela mostrava «01/01/1970, 00:00:00»,
    // plausível o bastante para ser lida como um horário real.
    for (const vazio of [null, undefined, '']) {
      expect(dataDeAuditoria(vazio), String(vazio)).toBe(SEM_CARIMBO)
      expect(dataDeAuditoria(vazio)).not.toContain('1970')
    }
  })

  it('data inválida também declara a lacuna, sem estourar', () => {
    expect(dataDeAuditoria('nao-e-data')).toBe(SEM_CARIMBO)
  })

  it('formata uma data real em pt-BR', () => {
    const saida = dataDeAuditoria('2026-07-27T13:45:00.000Z')
    expect(saida).not.toBe(SEM_CARIMBO)
    expect(saida).toMatch(/\d{2}\/\d{2}\/\d{4}/)
  })

  it('a época Unix explícita continua sendo exibida — é um valor, não uma lacuna', () => {
    // Distinção deliberada: `null` é «não sei», 1970 gravado de propósito é um
    // dado. Só o primeiro vira SEM_CARIMBO.
    expect(dataDeAuditoria('1970-01-01T00:00:00.000Z')).not.toBe(SEM_CARIMBO)
  })
})
