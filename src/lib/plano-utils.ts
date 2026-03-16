// ══════════════════════════════════════════════════════════════════════════════
// PLAN UTILITIES — FengShui Studio
// Canonical source for plan rules. All plan checks should use these helpers.
// ══════════════════════════════════════════════════════════════════════════════

export type PlanoEfetivo = 'free' | 'simples' | 'profissional'

/**
 * Resolve the effective plan from the stored value.
 * Handles backward compatibility: 'freemium' → 'free', 'pro' → 'profissional'
 */
export function planoEfetivo(plano?: string | null): PlanoEfetivo {
  if (!plano) return 'free'
  const p = plano.toLowerCase().trim()
  if (p === 'pro' || p === 'profissional') return 'profissional'
  if (p === 'simples') return 'simples'
  return 'free' // 'freemium', 'free', or any unknown value
}

/**
 * Plan display label
 */
export function planoLabel(plano?: string | null): string {
  const p = planoEfetivo(plano)
  if (p === 'profissional') return 'Profissional'
  if (p === 'simples') return 'Simples'
  return 'Free'
}

// ─── LIMITS ────────────────────────────────────────────────────────────────────

/** Max simultaneous properties (consultas) */
export function limiteImoveis(plano: PlanoEfetivo): number | null {
  if (plano === 'free') return 3
  if (plano === 'simples') return 1 // 1 active at a time
  return null // profissional: unlimited
}

/** Can register external clients? */
export function podeClientes(plano: PlanoEfetivo): boolean {
  return plano === 'profissional'
}

/** Can access calendar? */
export function podeCalendario(plano: PlanoEfetivo): boolean {
  return plano !== 'free'
}

/** Can generate PDF? */
export function podePDF(plano: PlanoEfetivo): 'bloqueado' | 'marca_dagua' | 'limpo' {
  if (plano === 'free') return 'bloqueado'
  if (plano === 'simples') return 'marca_dagua'
  return 'limpo'
}

/** Can access partner network? */
export function podeParceiros(plano: PlanoEfetivo): 'bloqueado' | 'visualizar' | 'completo' {
  if (plano === 'free') return 'bloqueado'
  if (plano === 'simples') return 'visualizar'
  return 'completo'
}

/** Can have multiple analyses per property? */
export function podeMultiplasAnalises(plano: PlanoEfetivo): boolean {
  return plano === 'profissional'
}

/** Can access analysis history? */
export function podeHistorico(plano: PlanoEfetivo): boolean {
  return plano === 'profissional'
}
