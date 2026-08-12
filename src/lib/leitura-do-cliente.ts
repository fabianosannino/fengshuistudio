/**
 * A leitura que o cliente final recebe — julgamento, não score.
 *
 * ## A decisão
 *
 * O consultor vê «62%». O cliente vê «pede atenção». São a mesma avaliação lida
 * de duas formas, e a diferença é deliberada:
 *
 * - O score é uma **média de oito notas de 1 a 5** dadas por uma pessoa numa
 *   visita. Exibi-lo com dois dígitos sugere uma precisão que a medida não tem,
 *   e convida a comparações que ela não sustenta («62 contra 64 no mês passado»
 *   pode ser a mesma casa e outro dia).
 * - O cliente age sobre o setor, não sobre o número. «Precisa de cuidado» diz o
 *   que fazer; «41%» não diz.
 * - O consultor precisa do número porque é ele quem calibra e compara entre
 *   imóveis. Por isso o número continua inteiro do lado dele.
 *
 * Os cortes são os **mesmos** `LIMIAR_SCORE_*` do resto do produto — a leitura
 * muda, a régua não. Um segundo conjunto de limiares só para o cliente faria a
 * mesma casa ser «boa» numa tela e «ruim» na outra.
 *
 * A página institucional promete «72% em harmonia». Isso é promessa de
 * percentual ao cliente final e contradiz esta tela — está anotado no PR para
 * o dono decidir; aqui o que vale é a decisão de produto do handoff.
 */

import { LIMIAR_SCORE_BOM, LIMIAR_SCORE_CRITICO } from './constants'

export type NivelDeHarmonia = 'harmonia' | 'atencao' | 'cuidado' | 'nao_avaliado'

export interface LeituraDeSetor {
  nivel: NivelDeHarmonia
  /** O que aparece embaixo do nome do setor. */
  rotulo: string
  fundo: string
  borda: string
  texto: string
}

export const LEITURAS: Record<NivelDeHarmonia, LeituraDeSetor> = {
  harmonia: {
    nivel: 'harmonia', rotulo: 'Em harmonia',
    fundo: '#F0F6F3', borda: '#DCEAE4', texto: '#2E7D6B',
  },
  atencao: {
    nivel: 'atencao', rotulo: 'Pede atenção',
    fundo: '#FAF3E0', borda: '#EEDFB4', texto: '#8A6E2F',
  },
  cuidado: {
    nivel: 'cuidado', rotulo: 'Precisa de cuidado',
    fundo: '#FAEEE9', borda: '#EBD3C7', texto: '#A9613C',
  },
  // Não avaliado não é «ruim». É o terceiro estado, e a casa que ninguém olhou
  // não pode ser apresentada ao morador como casa com problema.
  nao_avaliado: {
    nivel: 'nao_avaliado', rotulo: 'Ainda não avaliado',
    fundo: '#F3EEE4', borda: '#E7E1D6', texto: '#6B7280',
  },
}

export function leituraDoSetor(score: number | null | undefined): LeituraDeSetor {
  if (typeof score !== 'number') return LEITURAS.nao_avaliado
  if (score >= LIMIAR_SCORE_BOM) return LEITURAS.harmonia
  if (score >= LIMIAR_SCORE_CRITICO) return LEITURAS.atencao
  return LEITURAS.cuidado
}

export interface ResumoDaCasa {
  emHarmonia: number
  pedemAtencao: number
  precisamCuidado: number
  naoAvaliados: number
  total: number
  /** A frase do título. */
  titulo: string
}

/**
 * O título da home do cliente.
 *
 * «Sua casa está em harmonia em 7 dos 9 setores» só é dito quando os 9 foram
 * avaliados. Com lacunas, o denominador é o que foi olhado — dizer «7 de 9»
 * quando dois nunca foram avaliados transformaria ausência em aprovação.
 */
export function resumoDaCasa(scores: (number | null | undefined)[]): ResumoDaCasa {
  let emHarmonia = 0, pedemAtencao = 0, precisamCuidado = 0, naoAvaliados = 0

  for (const score of scores) {
    switch (leituraDoSetor(score).nivel) {
      case 'harmonia': emHarmonia++; break
      case 'atencao': pedemAtencao++; break
      case 'cuidado': precisamCuidado++; break
      default: naoAvaliados++
    }
  }

  const total = scores.length
  const avaliados = total - naoAvaliados

  let titulo: string
  if (avaliados === 0) {
    titulo = 'Sua casa ainda não foi avaliada'
  } else if (naoAvaliados > 0) {
    titulo = `Sua casa está em harmonia em ${emHarmonia} dos ${avaliados} setores já avaliados`
  } else if (emHarmonia === total) {
    titulo = `Sua casa está em harmonia nos ${total} setores`
  } else {
    titulo = `Sua casa está em harmonia em ${emHarmonia} dos ${total} setores`
  }

  return { emHarmonia, pedemAtencao, precisamCuidado, naoAvaliados, total, titulo }
}
