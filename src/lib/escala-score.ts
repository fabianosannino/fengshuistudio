/**
 * Escala de leitura das notas de setor: cor e rótulo.
 *
 * Vinha de dentro de `app/bagua-planta/page.tsx`, com os cortes escritos como
 * números soltos numa cadeia de ternários (`t>=95?…:t>=80?…`) — o caso que o
 * CLAUDE.md chama de número mágico, e que a auditoria registra em R8.
 *
 * A regra que a escala carrega, e que é fácil perder de vista ao mexer nela:
 * **ausência de nota não recebe cor de julgamento.** Um setor sem nenhum
 * critério avaliado sai cinza e «Não avaliado», nunca vermelho — vermelho
 * afirmaria que está ruim, quando o que se sabe é que não foi medido
 * (ADR 0019/0020, aplicado à cor em vez do texto).
 */

import { calcularPontuacao, type IdModeloPontuacao, type NotaCriterio } from './modelos-pontuacao'
import type { Setor } from './geometria-bagua'

// ── Cores ────────────────────────────────────────────────────────────────────

export const COR_SEM_NOTA = '#9CA3AF'
export const COR_EXCELENTE = '#15803D'
export const COR_BOM = '#65A30D'
export const COR_REGULAR = '#D97706'
export const COR_RUIM = '#EA580C'
export const COR_CRITICO = '#DC2626'

/** Faixas da nota total, do melhor para o pior. */
const FAIXAS_TOTAL = [
  { minimo: 95, cor: COR_EXCELENTE, rotulo: 'Excelente' },
  { minimo: 80, cor: COR_BOM, rotulo: 'Bom' },
  { minimo: 60, cor: COR_REGULAR, rotulo: 'Regular' },
  { minimo: 40, cor: COR_RUIM, rotulo: 'Ruim' },
  { minimo: -Infinity, cor: COR_CRITICO, rotulo: 'Crítico' },
] as const

export const ROTULO_SEM_NOTA = 'Não avaliado'

/**
 * Tolerância para considerar a geometria equilibrada.
 *
 * A nota geométrica vem de divisão de áreas em ponto flutuante: um setor
 * perfeito raramente dá 100 exato. Sem a folga, um 99.9999 apareceria como
 * desequilíbrio.
 */
const TOLERANCIA_EQUILIBRIO = 0.5

export function corTotal(total: number | null): string {
  if (total === null) return COR_SEM_NOTA
  return (FAIXAS_TOTAL.find(f => total >= f.minimo) ?? FAIXAS_TOTAL[FAIXAS_TOTAL.length - 1]).cor
}

export function rotuloTotal(total: number | null): string {
  if (total === null) return ROTULO_SEM_NOTA
  return (FAIXAS_TOTAL.find(f => total >= f.minimo) ?? FAIXAS_TOTAL[FAIXAS_TOTAL.length - 1]).rotulo
}

// ── Geometria ────────────────────────────────────────────────────────────────

/**
 * Cor da nota geométrica. Falta e excesso são desequilíbrios de natureza
 * diferente e recebem cores diferentes — o remédio para um não serve ao outro.
 */
export function corGeo(geo: number, setor?: Setor): string {
  if (Math.abs(geo - 100) < TOLERANCIA_EQUILIBRIO) return COR_EXCELENTE
  if (setor && setor.excessoPct > setor.faltaPct) return COR_REGULAR
  return COR_CRITICO
}

export function rotuloGeo(geo: number, setor?: Setor): string {
  if (Math.abs(geo - 100) < TOLERANCIA_EQUILIBRIO) return 'Equilibrado'
  if (setor && setor.excessoPct > setor.faltaPct) return 'Excesso'
  if (setor && setor.faltaPct > setor.excessoPct) return 'Falta'
  return 'Desequilíbrio'
}

// ── Notas ────────────────────────────────────────────────────────────────────

/** Geo em vigor: o ajuste manual do consultor prevalece sobre o calculado. */
export function geoEfetivo(setor: Setor): number {
  return setor.ajusteManual !== null ? setor.ajusteManual : setor.geo
}

/**
 * Nota do setor pelo modelo de pontuação escolhido na consulta.
 *
 * Antes era `geoEfetivo + scoreFisico`, somando um desvio de −16..+16 a uma
 * nota que já era 0–100 — daí «tudo neutro = 100%» e valores acima de 100.
 * Ver `modelos-pontuacao.ts` e o ADR 0021.
 */
export function scoreTotal(
  setor: Setor,
  modelo: IdModeloPontuacao,
  pesoGeo: number
): number | null {
  return calcularPontuacao(modelo, {
    criterios: setor.criterios,
    geo: geoEfetivo(setor),
    pesoGeo,
  }).valor
}

/**
 * Se algum critério foi avaliado.
 *
 * Antes era `c.some(v => v !== 2)` — adivinhava «avaliado» por diferença do
 * default, então quem marcasse tudo como «Neutro» de propósito aparecia como
 * não avaliado. Com `null` a pergunta passa a ter resposta exata.
 */
export function criteriosAvaliados(criterios: readonly (NotaCriterio | null)[]): boolean {
  return criterios.some(v => v !== null)
}
