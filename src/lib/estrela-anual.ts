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
import { normalizarSetor, PALACIO_DO_SETOR } from './comodo-setor'
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

// ── Cruzamento com os remédios: onde a Estrela 5 cai ESTE ANO ───────────────

/** Estrela 5 (五黃 Wu Huang) — a "Amarela Fatal", a mais nociva da grade. */
export const ESTRELA_WU_HUANG = 5

/**
 * Em qual palácio a Estrela 5 anual está num dado ano solar.
 * Sempre existe exatamente um — a grade é uma permutação de 1..9.
 */
export function palacioDaEstrela5(anoSolar: number): Palacio {
  const grade = calcularGradeAnual(anoSolar)
  const achado = (Object.entries(grade) as [Palacio, number][])
    .find(([, estrela]) => estrela === ESTRELA_WU_HUANG)
  // Não pode faltar: `construirGridVoo` devolve os 9 números sem repetir.
  return achado![0]
}

/**
 * A Estrela 5 anual está NESTE setor, neste ano?
 *
 * Devolve `null` quando não dá para saber — e é isso que torna a função
 * honesta em vez de conveniente:
 *
 * - **Fora da Escola da Bússola**: no BTB o Ba Guá se alinha à porta e os
 *   setores não têm direção cardinal (ADR 0018), enquanto a Estrela 5 é
 *   calculada por direção. Cruzar os dois ali seria acertar em ~1/8 dos casos
 *   e errar com ar de cálculo. O aviso genérico da contraindicação continua
 *   valendo lá — só não ganha precisão que o método não coletou.
 * - **Setor irreconhecível**: nome que `normalizarSetor` não mapeia.
 *
 * `null` significa "não sei", nunca "não está".
 */
export function estrela5NoSetor(
  nomeSetor: string,
  anoSolar: number,
  escola: string,
): boolean | null {
  if (escola !== 'bussola') return null
  const canonico = normalizarSetor(nomeSetor)
  if (!canonico) return null
  return PALACIO_DO_SETOR[canonico] === palacioDaEstrela5(anoSolar)
}

/** Nome legível do palácio, para o texto do alerta. */
const NOME_PALACIO: Record<Palacio, string> = {
  N: 'Norte', NE: 'Nordeste', E: 'Leste', SE: 'Sudeste',
  S: 'Sul', SW: 'Sudoeste', W: 'Oeste', NW: 'Noroeste', C: 'Centro',
}

/**
 * Texto do alerta específico quando a Estrela 5 cai no setor. Devolve null
 * quando não se aplica (ou não dá para saber) — quem chama mantém o aviso
 * genérico nesse caso.
 *
 * Sem referência a arquivo de código: este texto é IMPRESSO no relatório do
 * cliente (mesma regra da ADR 0017).
 */
export function alertaEstrela5(
  nomeSetor: string,
  anoSolar: number,
  escola: string,
): string | null {
  if (estrela5NoSetor(nomeSetor, anoSolar, escola) !== true) return null
  const palacio = NOME_PALACIO[palacioDaEstrela5(anoSolar)]
  return `Este ano (${anoSolar}) a Estrela 5 anual (Wu Huang) está no ${palacio}, `
    + `que é justamente este setor. Adie ativações de Fogo aqui — velas, luz `
    + `vermelha, objetos triangulares — e prefira Metal para drenar.`
}
