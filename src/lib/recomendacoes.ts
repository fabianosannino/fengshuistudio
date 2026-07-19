// ══════════════════════════════════════════════════════════════════════════════
// MOTOR DE RECOMENDAÇÕES — fonte única de verdade
// ══════════════════════════════════════════════════════════════════════════════
//
// Antes existiam 3 cópias divergentes deste algoritmo (tela de diagnóstico,
// detalhe da consulta e relatório PDF), o que fazia a MESMA casa gerar
// recomendações diferentes conforme a tela. Este módulo unifica tudo:
// mesmas entradas → mesmas recomendações em qualquer lugar.
//
// Conteúdo canônico = src/lib/constants.ts (SETOR_DICAS, CRITERIO_DICAS).

import { CRITERIOS, SETOR_DICAS, CRITERIO_DICAS } from './constants'

/** Notas dos critérios físicos: 0=Crítico, 1=Ruim, 2=Neutro, 3=Bom, 4=Ótimo. */
export const NOTA = {
  CRITICO: 0,
  RUIM: 1,
  NEUTRO: 2,
} as const

/** Score do setor (%) abaixo do qual ele é considerado crítico / bom. */
export const LIMIAR_SCORE_CRITICO = 40
export const LIMIAR_SCORE_BOM = 70

/** Acima deste % de área faltante/excedente, gera recomendação geométrica. */
export const LIMIAR_GEOMETRICO_PCT = 5

/** Limites de itens por bloco (evita relatório sobrecarregado). */
const MAX_URGENTE = 4
const MAX_MELHORIA = 4
const MAX_MANUTENCAO = 3

export interface Recomendacoes {
  urgente: string[]
  melhoria: string[]
  manutencao: string[]
}

export interface RecomendacoesInput {
  /** Nome do setor Ba Guá (ex.: 'Prosperidade'). Deve ser chave de SETOR_DICAS. */
  nomeSetor: string
  /** Score do setor em porcentagem (0–100). */
  scorePct: number
  /**
   * Notas dos 8 critérios físicos, na ordem de `CRITERIOS`.
   * Use `criteriosPorNomeParaArray` para converter de um mapa por nome.
   * Valor ausente/-1 = critério não avaliado (não gera recomendação).
   */
  criterios: number[]
  /**
   * Opcional — só na tela de diagnóstico (dependem de medidas do canvas).
   * % de área faltante / excedente do setor.
   */
  faltaPct?: number
  excessoPct?: number
}

/** Converte notas por nome de critério para o array indexado por `CRITERIOS`. */
export function criteriosPorNomeParaArray(porNome: Record<string, number>): number[] {
  return CRITERIOS.map((criterio) => porNome[criterio] ?? -1)
}

/**
 * Gera as recomendações (urgente / melhoria / manutenção) de um setor.
 * Determinística e pura — mesma entrada, mesma saída, em qualquer tela.
 */
export function gerarRecomendacoes(input: RecomendacoesInput): Recomendacoes {
  const { nomeSetor, scorePct, criterios, faltaPct, excessoPct } = input
  const urgente: string[] = []
  const melhoria: string[] = []
  const manutencao: string[] = []

  // 1. Problemas geométricos (só quando as medidas são fornecidas)
  if (faltaPct != null && faltaPct > LIMIAR_GEOMETRICO_PCT) {
    urgente.push(
      `⚠ Setor com área faltante (${Math.round(faltaPct)}%) — a energia de ${nomeSetor} está enfraquecida`,
      'Compense com ativação energética intensa: mais objetos do elemento, cores e intenção'
    )
  }
  if (excessoPct != null && excessoPct > LIMIAR_GEOMETRICO_PCT) {
    melhoria.push(
      `↑ Setor com excesso (${Math.round(excessoPct)}%) — pode gerar desequilíbrio em ${nomeSetor}`,
      'Use divisórias simbólicas ou espelhos para definir limites energéticos claros'
    )
  }

  // 2. Critérios físicos com nota baixa
  CRITERIOS.forEach((_criterio, ci) => {
    const val = criterios[ci] ?? -1
    const dicas = CRITERIO_DICAS[ci] || []
    if (val === NOTA.CRITICO) urgente.push(...dicas.slice(0, 2))
    else if (val === NOTA.RUIM) melhoria.push(...dicas.slice(0, 2))
    else if (val === NOTA.NEUTRO) melhoria.push(dicas[0] || '')
  })

  // 3. Dicas do setor conforme o score total
  const dicasSetor = SETOR_DICAS[nomeSetor] ?? []
  if (scorePct < LIMIAR_SCORE_CRITICO) urgente.push(...dicasSetor.slice(0, 3))
  else if (scorePct < LIMIAR_SCORE_BOM) melhoria.push(...dicasSetor.slice(0, 2))
  else manutencao.push(...dicasSetor.slice(3, 5))

  return {
    urgente: [...new Set(urgente)].filter(Boolean).slice(0, MAX_URGENTE),
    melhoria: [...new Set(melhoria)].filter(Boolean).slice(0, MAX_MELHORIA),
    manutencao: [...new Set(manutencao)].filter(Boolean).slice(0, MAX_MANUTENCAO),
  }
}
