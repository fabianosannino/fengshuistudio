import { describe, it, expect } from 'vitest'
import {
  planoEfetivo,
  planoLabel,
  limiteImoveis,
  podeClientes,
  podeCalendario,
  podePDF,
  podeParceiros,
  podeMultiplasAnalises,
  podeHistorico,
} from '../plano-utils'

// ─── planoEfetivo ────────────────────────────────────────────────────────────

describe('planoEfetivo', () => {
  it('normalizes "pro" to "profissional"', () => {
    expect(planoEfetivo('pro')).toBe('profissional')
  })

  it('normalizes "profissional" to "profissional"', () => {
    expect(planoEfetivo('profissional')).toBe('profissional')
  })

  it('normalizes "freemium" to "free"', () => {
    expect(planoEfetivo('freemium')).toBe('free')
  })

  it('returns "free" for null', () => {
    expect(planoEfetivo(null)).toBe('free')
  })

  it('returns "free" for undefined', () => {
    expect(planoEfetivo(undefined)).toBe('free')
  })

  it('returns "free" for empty string', () => {
    expect(planoEfetivo('')).toBe('free')
  })

  it('keeps "simples" as "simples"', () => {
    expect(planoEfetivo('simples')).toBe('simples')
  })

  it('is case-insensitive', () => {
    expect(planoEfetivo('PRO')).toBe('profissional')
    expect(planoEfetivo('Simples')).toBe('simples')
    expect(planoEfetivo('FREEMIUM')).toBe('free')
  })

  it('trims whitespace', () => {
    expect(planoEfetivo('  pro  ')).toBe('profissional')
    expect(planoEfetivo(' simples ')).toBe('simples')
  })

  it('returns "free" for unknown plan names', () => {
    expect(planoEfetivo('enterprise')).toBe('free')
    expect(planoEfetivo('premium')).toBe('free')
  })
})

// ─── planoLabel ──────────────────────────────────────────────────────────────

describe('planoLabel', () => {
  it('returns "Profissional" for profissional plan', () => {
    expect(planoLabel('pro')).toBe('Profissional')
    expect(planoLabel('profissional')).toBe('Profissional')
  })

  it('returns "Simples" for simples plan', () => {
    expect(planoLabel('simples')).toBe('Simples')
  })

  it('returns "Free" for free/null/undefined plans', () => {
    expect(planoLabel('free')).toBe('Free')
    expect(planoLabel('freemium')).toBe('Free')
    expect(planoLabel(null)).toBe('Free')
    expect(planoLabel(undefined)).toBe('Free')
  })
})

// ─── limiteImoveis ───────────────────────────────────────────────────────────

describe('limiteImoveis', () => {
  it('returns 3 for free plan', () => {
    expect(limiteImoveis('free')).toBe(3)
  })

  it('returns 1 for simples plan', () => {
    expect(limiteImoveis('simples')).toBe(1)
  })

  it('returns null (unlimited) for profissional plan', () => {
    expect(limiteImoveis('profissional')).toBeNull()
  })
})

// ─── podeClientes ────────────────────────────────────────────────────────────

describe('podeClientes', () => {
  it('returns true only for profissional', () => {
    expect(podeClientes('profissional')).toBe(true)
    expect(podeClientes('simples')).toBe(false)
    expect(podeClientes('free')).toBe(false)
  })
})

// ─── podeCalendario ──────────────────────────────────────────────────────────

describe('podeCalendario', () => {
  it('returns false for free plan', () => {
    expect(podeCalendario('free')).toBe(false)
  })

  it('returns true for simples and profissional', () => {
    expect(podeCalendario('simples')).toBe(true)
    expect(podeCalendario('profissional')).toBe(true)
  })
})

// ─── podePDF ─────────────────────────────────────────────────────────────────

describe('podePDF', () => {
  it('returns "bloqueado" for free plan', () => {
    expect(podePDF('free')).toBe('bloqueado')
  })

  it('returns "marca_dagua" for simples plan', () => {
    expect(podePDF('simples')).toBe('marca_dagua')
  })

  it('returns "limpo" for profissional plan', () => {
    expect(podePDF('profissional')).toBe('limpo')
  })
})

// ─── podeParceiros ───────────────────────────────────────────────────────────

describe('podeParceiros', () => {
  it('returns "bloqueado" for free plan', () => {
    expect(podeParceiros('free')).toBe('bloqueado')
  })

  it('returns "visualizar" for simples plan', () => {
    expect(podeParceiros('simples')).toBe('visualizar')
  })

  it('returns "completo" for profissional plan', () => {
    expect(podeParceiros('profissional')).toBe('completo')
  })
})

// ─── podeMultiplasAnalises ───────────────────────────────────────────────────

describe('podeMultiplasAnalises', () => {
  it('returns true only for profissional', () => {
    expect(podeMultiplasAnalises('profissional')).toBe(true)
    expect(podeMultiplasAnalises('simples')).toBe(false)
    expect(podeMultiplasAnalises('free')).toBe(false)
  })
})

// ─── podeHistorico ───────────────────────────────────────────────────────────

describe('podeHistorico', () => {
  it('returns true only for profissional', () => {
    expect(podeHistorico('profissional')).toBe(true)
    expect(podeHistorico('simples')).toBe(false)
    expect(podeHistorico('free')).toBe(false)
  })
})
