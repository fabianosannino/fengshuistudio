import { describe, expect, it } from 'vitest'
import { avaliarAnoSolar, instanteLiChun } from '../ano-solar'
import { dataSolar } from '../data-solar'

describe('ano solar por efeméride versionada', () => {
  // Independent observed tables, in Hong Kong time (UTC+08), not computed expectations.
  // https://www.hko.gov.hk/en/gts/astron2015/Solar_Term_2015.htm
  // https://www.hko.gov.hk/en/gts/astron2016/Solar_Term_2016.htm
  // https://www.hko.gov.hk/en/gts/astron2025/files/HKO_almanac_2025.pdf
  // https://www.hko.gov.hk/en/gts/astron2026/files/2026cal02.pdf
  it.each([
    [2015, '2015-02-04T11:58:00+08:00'],
    [2016, '2016-02-04T17:46:00+08:00'],
    [2025, '2025-02-03T22:10:00+08:00'],
    [2026, '2026-02-04T04:02:00+08:00'],
  ] as const)('confere âncora HKO %s dentro de um minuto', (ano, iso) => {
    expect(Math.abs(instanteLiChun(ano)!.getTime() - Date.parse(iso))).toBeLessThan(60_000)
  })
  it.each(['2026-02-31', '2025-02-29', '1900-02-29', '2026-00-01', '2026-13-01', '2026-01-00', '2026-04-31', '2026-02-04texto', '2026-02-04T12:00:00', '2026-02-04T25:00:00Z', '2026-02-04T12:60:00Z', '2026-02-04T12:00:00+14:01'])('recusa data impossível ou ambígua de formato: %s', data => {
    expect(avaliarAnoSolar(data)).toEqual({ estado: 'invalido' })
  })
  it('regra de bissextos inclui 2000 e exclui 1900/2100', () => {
    expect(dataSolar('2000-02-29')?.anoSolar).toBe(2000)
    expect(dataSolar('2024-02-29')?.anoSolar).toBe(2024)
    expect(dataSolar('2100-02-29')).toBeNull()
  })
  it('não transforma data sem hora em meia-noite na fronteira', () => {
    expect(avaliarAnoSolar('2026-02-03')).toEqual({ estado: 'indeterminado' })
    expect(avaliarAnoSolar('2026-02-04')).toEqual({ estado: 'indeterminado' })
    expect(dataSolar('2026-02-02')?.anoSolar).toBe(2025)
    expect(dataSolar('2026-02-05')?.anoSolar).toBe(2026)
  })
  it('fuso IANA explícito muda o dia civil da fronteira', () => {
    expect(dataSolar('2026-02-04', 'America/Sao_Paulo')?.anoSolar).toBe(2026)
    expect(dataSolar('2026-02-04', 'Asia/Hong_Kong')).toBeNull()
    expect(dataSolar('2026-02-03', 'Asia/Hong_Kong')?.anoSolar).toBe(2025)
    expect(avaliarAnoSolar('2026-02-05', 'Fuso/Inventado')).toEqual({ estado: 'invalido' })
  })
  it('instantes equivalentes dão o mesmo resultado, sem usar o fuso do processo', () => {
    expect(dataSolar('2026-02-03T18:00:00Z')?.anoSolar).toBe(2025)
    expect(dataSolar('2026-02-03T18:00:00-03:00')?.anoSolar).toBe(2026)
    expect(dataSolar(new Date('2026-02-03T21:00:00Z'))).toEqual(dataSolar('2026-02-03T18:00:00-03:00'))
  })
  it('faixa de incerteza do modelo não produz certeza de minuto', () => {
    const cut = instanteLiChun(2026)!.getTime()
    expect(avaliarAnoSolar(new Date(cut - 60_000))).toEqual({ estado: 'indeterminado' })
    expect(avaliarAnoSolar(new Date(cut + 60_000))).toEqual({ estado: 'indeterminado' })
    expect(dataSolar(new Date(cut - 3_600_000))?.anoSolar).toBe(2025)
    expect(dataSolar(new Date(cut + 3_600_000))?.anoSolar).toBe(2026)
  })
  it('datas fora da tabela permanecem sem resultado', () => {
    expect(avaliarAnoSolar('1800-06-01')).toEqual({ estado: 'fora_da_cobertura' })
    expect(avaliarAnoSolar('2101-06-01')).toEqual({ estado: 'fora_da_cobertura' })
  })
})
