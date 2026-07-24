/**
 * Motor dos Cinco Elementos (Wu Xing) — fundamento clássico do Feng Shui.
 *
 * Modela os dois ciclos canônicos entre os elementos e deriva, de forma
 * determinística, a estratégia elemental de cura para um setor do Ba Guá:
 *
 *  - Ciclo de GERAÇÃO (Sheng): Água nutre Madeira → Madeira alimenta Fogo →
 *    Fogo gera Terra (cinzas) → Terra produz Metal → Metal condensa Água.
 *  - Ciclo de CONTROLE (Ke): Água apaga Fogo → Fogo funde Metal → Metal
 *    corta Madeira → Madeira drena Terra → Terra represa Água.
 *
 * Regra de cura usada (Escola BTB, prática consagrada):
 *  - Setor CRÍTICO (score < LIMIAR_SCORE_CRITICO): fortalecer com o PRÓPRIO
 *    elemento e com o elemento que o NUTRE (a "mãe" no ciclo de geração).
 *  - Setor em ATENÇÃO: reforço leve com o próprio elemento.
 *  - Evitar no setor o elemento que o CONTROLA (enfraquece a energia local).
 *
 * Função pura, sem I/O — mesma filosofia de src/lib/recomendacoes.ts.
 */

import { LIMIAR_SCORE_CRITICO, LIMIAR_SCORE_BOM } from './recomendacoes'

export type Elemento = 'agua' | 'madeira' | 'fogo' | 'terra' | 'metal'

/** GERAÇÃO (Sheng): quem cada elemento NUTRE. */
export const CICLO_GERACAO: Record<Elemento, Elemento> = {
  agua: 'madeira',
  madeira: 'fogo',
  fogo: 'terra',
  terra: 'metal',
  metal: 'agua',
}

/** CONTROLE (Ke): quem cada elemento CONTROLA/enfraquece. */
export const CICLO_CONTROLE: Record<Elemento, Elemento> = {
  agua: 'fogo',
  fogo: 'metal',
  metal: 'madeira',
  madeira: 'terra',
  terra: 'agua',
}

/** Elemento que NUTRE o dado ("mãe" no ciclo de geração). */
export function elementoQueNutre(e: Elemento): Elemento {
  return (Object.keys(CICLO_GERACAO) as Elemento[]).find(k => CICLO_GERACAO[k] === e)!
}

/** Elemento que CONTROLA o dado (a evitar quando o setor está fraco). */
export function elementoQueControla(e: Elemento): Elemento {
  return (Object.keys(CICLO_CONTROLE) as Elemento[]).find(k => CICLO_CONTROLE[k] === e)!
}

/** Rótulos de exibição em pt-BR. */
export const NOME_ELEMENTO: Record<Elemento, string> = {
  agua: 'Água',
  madeira: 'Madeira',
  fogo: 'Fogo',
  terra: 'Terra',
  metal: 'Metal',
}

/**
 * Normaliza o nome de elemento como está no banco/constants ("Água",
 * "Madeira", "Terra"…) para o id canônico. Devolve null para valores
 * desconhecidos — nunca chuta.
 */
export function normalizarElemento(nome: string | null | undefined): Elemento | null {
  if (!nome) return null
  const limpo = nome.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase()
  if (limpo === 'agua' || limpo === 'madeira' || limpo === 'fogo' || limpo === 'terra' || limpo === 'metal') {
    return limpo
  }
  return null
}

/** Materiais/formas/cores clássicos que ativam cada elemento no ambiente. */
export const ATIVADORES: Record<Elemento, string> = {
  agua: 'tons de azul/preto, vidro, espelhos, formas onduladas ou uma fonte de água',
  madeira: 'plantas vivas, madeira clara, tons de verde e formas altas/colunares',
  fogo: 'iluminação quente, velas, tons de vermelho/laranja e formas triangulares',
  terra: 'cerâmica, cristais, tons terrosos/amarelos e formas baixas e quadradas',
  metal: 'objetos metálicos, tons de branco/cinza/dourado e formas circulares',
}

export interface EstrategiaElemental {
  /** Elemento do setor. */
  elemento: Elemento
  /** Elementos a ATIVAR no ambiente, em ordem de prioridade. */
  fortalecer: Elemento[]
  /** Elemento a EVITAR/reduzir no ambiente (controla o do setor). */
  evitar: Elemento
  /** Recomendações prontas para exibição (frases completas, pt-BR). */
  recomendacoes: string[]
}

/**
 * Estratégia elemental de cura para um setor, dado seu elemento e score (%).
 * Setor bom (>= LIMIAR_SCORE_BOM) não recebe intervenção elemental — apenas
 * manutenção (não gerar ruído onde a energia já flui).
 */
export function estrategiaElemental(elemento: Elemento, scorePct: number): EstrategiaElemental {
  const mae = elementoQueNutre(elemento)
  const controlador = elementoQueControla(elemento)

  const critico = scorePct < LIMIAR_SCORE_CRITICO
  const atencao = !critico && scorePct < LIMIAR_SCORE_BOM

  const fortalecer: Elemento[] = critico ? [elemento, mae] : atencao ? [elemento] : []

  const recomendacoes: string[] = []
  if (critico) {
    recomendacoes.push(
      `Ative o elemento ${NOME_ELEMENTO[elemento]} do setor com ${ATIVADORES[elemento]}.`,
      `Nutra o setor com o elemento ${NOME_ELEMENTO[mae]} (que gera ${NOME_ELEMENTO[elemento]} no ciclo Sheng): ${ATIVADORES[mae]}.`,
      `Evite ${NOME_ELEMENTO[controlador]} em excesso neste setor — no ciclo de controle, ${NOME_ELEMENTO[controlador]} enfraquece ${NOME_ELEMENTO[elemento]}.`
    )
  } else if (atencao) {
    recomendacoes.push(
      `Reforce suavemente o elemento ${NOME_ELEMENTO[elemento]} com ${ATIVADORES[elemento]}.`,
      `Evite introduzir ${NOME_ELEMENTO[controlador]} em excesso neste setor.`
    )
  }

  return { elemento, fortalecer, evitar: controlador, recomendacoes }
}
