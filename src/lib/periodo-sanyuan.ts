/**
 * Períodos (Yun 運) do ciclo San Yuan — 9 períodos de 20 anos, 180 anos no
 * total, conforme docs/domain/fengshui-metodos-referencia.md §1.5.
 *
 * Fórmula cíclica, não tabela hardcoded — não precisa de atualização manual
 * a cada 20 anos. Âncoras verificadas: 1864→1 (início do ciclo atual de
 * registro), 2004→8, 2024→9, 2044→1 (reinício do ciclo).
 */

import { dataSolar } from './data-solar'

export const INICIO_CICLO_SAN_YUAN = 1864
const PERIODOS_NO_CICLO = 9
const ANOS_POR_PERIODO = 20

/** Período (1-9) do ciclo San Yuan a que pertence um ano solar já calculado. */
export function periodoDoAnoSolar(anoSolar: number): number {
  const anosDesdeInicio = anoSolar - INICIO_CICLO_SAN_YUAN
  return (Math.floor(anosDesdeInicio / ANOS_POR_PERIODO) % PERIODOS_NO_CICLO) + 1
}

/**
 * Período (1-9) a partir de uma data (ISO 'yyyy-mm-dd' ou `Date`), aplicando
 * o ajuste de ano solar (Li Chun). Devolve null para data ausente/inválida
 * ou anterior ao início do ciclo de referência — fail-closed.
 */
export function periodoDaData(data: string | Date | null | undefined): number | null {
  const info = dataSolar(data)
  if (!info || info.anoCivil < INICIO_CICLO_SAN_YUAN) return null
  return periodoDoAnoSolar(info.anoSolar)
}

/** Período (1-9) correspondente a "agora" — aceita uma data de referência para testabilidade. */
export function periodoAtual(agora: Date = new Date()): number {
  return periodoDaData(agora)!
}
