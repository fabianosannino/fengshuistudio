import { describe, it, expect } from 'vitest'
import {
  AREA_META,
  CRITERIOS,
  LOSHU_ORDER,
  RODA_AREAS,
  SETOR_DICAS,
  CRITERIO_DICAS,
} from '../constants'
import type { AreaMetaEntry } from '../constants'

// ─── AREA_META ───────────────────────────────────────────────────────────────

describe('AREA_META', () => {
  const entries = Object.entries(AREA_META)
  const requiredFields: (keyof AreaMetaEntry)[] = [
    'zh',
    'trig',
    'dir',
    'elem',
    'bg',
    'fg',
    'colors',
    'crystals',
    'plants',
    'action',
    'signs',
  ]

  it('has at least 9 sectors', () => {
    // There are some variant keys (e.g. "Fama" and "Fama/Reputacao"),
    // so the total is more than 9, but at least 9 unique sectors must exist.
    expect(entries.length).toBeGreaterThanOrEqual(9)
  })

  it.each(entries)('sector "%s" has all required fields', (_name, meta) => {
    for (const field of requiredFields) {
      expect(meta).toHaveProperty(field)
      expect(typeof meta[field]).toBe('string')
      expect((meta[field] as string).length).toBeGreaterThan(0)
    }
  })

  it('each sector has a valid hex background color', () => {
    for (const [, meta] of entries) {
      expect(meta.bg).toMatch(/^#[0-9A-Fa-f]{6}$/)
    }
  })

  it('each sector has a valid hex foreground color', () => {
    for (const [, meta] of entries) {
      expect(meta.fg).toMatch(/^#[0-9A-Fa-f]{6}$/)
    }
  })

  it('contains core sectors', () => {
    const keys = Object.keys(AREA_META)
    const coreSectors = [
      'Carreira',
      'Conhecimento',
      'Família',
      'Prosperidade',
      'Centro',
      'Fama',
      'Relacionamentos',
      'Criatividade',
      'Pessoas Úteis',
    ]
    for (const sector of coreSectors) {
      expect(keys).toContain(sector)
    }
  })
})

// ─── CRITERIOS ───────────────────────────────────────────────────────────────

describe('CRITERIOS', () => {
  it('is a non-empty array', () => {
    expect(Array.isArray(CRITERIOS)).toBe(true)
    expect(CRITERIOS.length).toBeGreaterThan(0)
  })

  it('has 8 criteria', () => {
    expect(CRITERIOS).toHaveLength(8)
  })

  it('contains expected criteria', () => {
    expect(CRITERIOS).toContain('Limpeza e organizacao')
    expect(CRITERIOS).toContain('Iluminacao adequada')
    expect(CRITERIOS).toContain('Ventilacao e ar fresco')
    expect(CRITERIOS).toContain('Cores harmonicas')
    expect(CRITERIOS).toContain('Mobiliario posicionado')
    expect(CRITERIOS).toContain('Plantas e elementos naturais')
    expect(CRITERIOS).toContain('Ausencia de objetos quebrados')
    expect(CRITERIOS).toContain('Fluxo de energia livre')
  })

  it('each criterion is a non-empty string', () => {
    for (const c of CRITERIOS) {
      expect(typeof c).toBe('string')
      expect(c.length).toBeGreaterThan(0)
    }
  })
})

// ─── LOSHU_ORDER ─────────────────────────────────────────────────────────────

describe('LOSHU_ORDER', () => {
  it('has exactly 9 entries', () => {
    expect(LOSHU_ORDER).toHaveLength(9)
  })

  it('contains all distinct entries', () => {
    const unique = new Set(LOSHU_ORDER)
    expect(unique.size).toBe(9)
  })

  it('each entry is a string that exists in AREA_META', () => {
    for (const entry of LOSHU_ORDER) {
      expect(typeof entry).toBe('string')
      expect(AREA_META).toHaveProperty(entry)
    }
  })

  it('follows the Lo Shu magic square order', () => {
    expect(LOSHU_ORDER[0]).toBe('Prosperidade')
    expect(LOSHU_ORDER[1]).toBe('Fama')
    expect(LOSHU_ORDER[2]).toBe('Relacionamentos')
    expect(LOSHU_ORDER[4]).toBe('Centro')
    expect(LOSHU_ORDER[7]).toBe('Carreira')
  })
})

// ─── RODA_AREAS ──────────────────────────────────────────────────────────────

describe('RODA_AREAS', () => {
  it('has exactly 9 entries', () => {
    expect(RODA_AREAS).toHaveLength(9)
  })

  it('each entry has key, label, and gua fields', () => {
    for (const area of RODA_AREAS) {
      expect(area).toHaveProperty('key')
      expect(area).toHaveProperty('label')
      expect(area).toHaveProperty('gua')
      expect(typeof area.key).toBe('string')
      expect(typeof area.label).toBe('string')
      expect(typeof area.gua).toBe('string')
    }
  })

  it('all keys are unique', () => {
    const keys = RODA_AREAS.map((a) => a.key)
    expect(new Set(keys).size).toBe(9)
  })

  it('each gua references a valid AREA_META sector', () => {
    for (const area of RODA_AREAS) {
      expect(AREA_META).toHaveProperty(area.gua)
    }
  })
})

// ─── SETOR_DICAS / CRITERIO_DICAS ────────────────────────────────────────────
// Fonte única de dicas de Feng Shui. A tela de detalhe da consulta e o PDF do
// relatório consomem exatamente estes objetos — não devem existir cópias locais
// divergentes (bug histórico: tela mostrava 5 dicas e PDF mostrava 3).

describe('SETOR_DICAS', () => {
  const entries = Object.entries(SETOR_DICAS)

  it('cobre os setores do LOSHU_ORDER', () => {
    for (const setor of LOSHU_ORDER) {
      expect(SETOR_DICAS).toHaveProperty(setor)
    }
  })

  it.each(entries)('setor "%s" tem ao menos 3 dicas não-vazias', (_nome, dicas) => {
    expect(Array.isArray(dicas)).toBe(true)
    expect(dicas.length).toBeGreaterThanOrEqual(3)
    for (const dica of dicas) {
      expect(typeof dica).toBe('string')
      expect(dica.length).toBeGreaterThan(0)
    }
  })
})

describe('CRITERIO_DICAS', () => {
  it('tem uma entrada para cada critério físico (índices 0..7)', () => {
    for (let i = 0; i <= 7; i++) {
      expect(CRITERIO_DICAS).toHaveProperty(String(i))
      expect(CRITERIO_DICAS[i].length).toBeGreaterThanOrEqual(1)
    }
  })
})
