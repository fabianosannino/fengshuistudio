/**
 * Estrela Anual (年紫白 Nian Zi Bai) — sobreposição temporal das Estrelas
 * Voadoras: um número (1-9) "voa" para o Centro a cada ano e sempre para a
 * frente pela trajetória do Lo Shu, sobrepondo a carta natal de
 * `estrelas-voadoras.ts`.
 *
 * Fórmula (docs/domain/fengshui-metodos-referencia.md, Método 3):
 *   estrela = normaliza1a9(constante − raiz_digital(ano_solar))
 *   constante = 11 para anos ≥ 2000, 10 para anos < 2000.
 *
 * Verificado com as 4 âncoras exigidas pelo documento (2024→3, 2025→2,
 * 2026→1, 2027→9) — conferidas independentemente: a raiz digital de um ano
 * é equivalente a (ano−1) mod 9 + 1, então ela sempre avança 1 por ano sem
 * exceção; a estrela, por consequência, sempre recua 1 por ano — exceto
 * exatamente na virada do século (1999→2000), onde a troca de constante
 * (10→11) cancela esse recuo e repete o valor. Essa descontinuidade está no
 * texto de origem, não foi inventada aqui, mas **não foi cross-validada por
 * mim contra uma segunda fonte** — como é irrelevante para o uso prático
 * atual (Período 9, 2024-2043), documento a ressalva em vez de assumir.
 */

import { normalizar1a9, construirGridVoo, type Palacio } from './lo-shu'
import { reduzirA1Digito } from './numerologia'
import { dataSolar } from './data-solar'

const CONSTANTE_SECULO_XX = 10
const CONSTANTE_SECULO_XXI = 11
const LIMITE_SECULO_XXI = 2000

function constanteDoSeculo(anoSolar: number): number {
  return anoSolar < LIMITE_SECULO_XXI ? CONSTANTE_SECULO_XX : CONSTANTE_SECULO_XXI
}

/** Número (1-9) da Estrela Anual para um ano solar já calculado. */
export function calcularEstrelaAnual(anoSolar: number): number {
  return normalizar1a9(constanteDoSeculo(anoSolar) - reduzirA1Digito(anoSolar))
}

/** Grade completa de 9 palácios da sobreposição anual — sempre voa para frente a partir do Centro. */
export function calcularGradeAnual(anoSolar: number): Record<Palacio, number> {
  return construirGridVoo('C', calcularEstrelaAnual(anoSolar), 'frente')
}

/**
 * Estrela Anual a partir de uma data (ISO 'yyyy-mm-dd' ou `Date`), aplicando
 * o ajuste de ano solar (Li Chun aproximado — mesma fonte de todo o resto do
 * sistema, ver data-solar.ts). Devolve null para data ausente/inválida.
 */
export function estrelaAnualDaData(data: string | Date | null | undefined): number | null {
  const info = dataSolar(data)
  return info ? calcularEstrelaAnual(info.anoSolar) : null
}
