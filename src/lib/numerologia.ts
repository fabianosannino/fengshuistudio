/**
 * Redução numérica de dígitos (raiz digital) — usada em vários cálculos
 * clássicos independentes: Ming Gua (ming-gua.ts) e a Estrela Anual/Zi Bai
 * (estrela-anual.ts). Fonte única antes duplicada só em ming-gua.ts.
 */

/** Soma os dígitos de n repetidamente até sobrar um único dígito (1-9). */
export function reduzirA1Digito(n: number): number {
  while (n > 9) n = String(n).split('').reduce((s, d) => s + Number(d), 0)
  return n
}
