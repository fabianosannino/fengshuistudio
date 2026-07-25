/**
 * Os 8 Trigramas (Bagua) no arranjo do Céu Posterior (Hou Tian 後天) —
 * fundamento comum a Ba Zhai, Estrelas Voadoras e Xuan Kong Da Gua.
 *
 * Tabela e codificação de bits conforme
 * docs/domain/fengshui-metodos-referencia.md §1.2. Linhas de baixo para
 * cima; 1 = yang (linha inteira), 0 = yin (linha quebrada).
 *
 * Cross-validado: o número Lo Shu de cada trigrama aqui bate exatamente
 * com `LO_SHU_POR_OCTANTE` de src/lib/oito-mansoes.ts (ver teste) — duas
 * fontes independentes (a tabela clássica dos trigramas e o quadrado
 * mágico já implementado) concordam.
 */

import type { Elemento } from './cinco-elementos'

export type Trigrama = 'Qian' | 'Dui' | 'Li' | 'Zhen' | 'Xun' | 'Kan' | 'Gen' | 'Kun'

export type Setor = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW'

/** Linha [inferior, média, superior]; 1=yang(inteira), 0=yin(quebrada). */
export type BitsTrigrama = readonly [number, number, number]

export interface InfoTrigrama {
  trigrama: Trigrama
  bits: BitsTrigrama
  numeroLoShu: number
  elemento: Elemento
  direcao: Setor
  familia: string
}

export const TRIGRAMAS: Record<Trigrama, InfoTrigrama> = {
  Qian: { trigrama: 'Qian', bits: [1, 1, 1], numeroLoShu: 6, elemento: 'metal', direcao: 'NW', familia: 'pai' },
  Dui: { trigrama: 'Dui', bits: [1, 1, 0], numeroLoShu: 7, elemento: 'metal', direcao: 'W', familia: 'filha caçula' },
  Li: { trigrama: 'Li', bits: [1, 0, 1], numeroLoShu: 9, elemento: 'fogo', direcao: 'S', familia: 'filha do meio' },
  Zhen: { trigrama: 'Zhen', bits: [1, 0, 0], numeroLoShu: 3, elemento: 'madeira', direcao: 'E', familia: 'filho mais velho' },
  Xun: { trigrama: 'Xun', bits: [0, 1, 1], numeroLoShu: 4, elemento: 'madeira', direcao: 'SE', familia: 'filha mais velha' },
  Kan: { trigrama: 'Kan', bits: [0, 1, 0], numeroLoShu: 1, elemento: 'agua', direcao: 'N', familia: 'filho do meio' },
  Gen: { trigrama: 'Gen', bits: [0, 0, 1], numeroLoShu: 8, elemento: 'terra', direcao: 'NE', familia: 'filho caçula' },
  Kun: { trigrama: 'Kun', bits: [0, 0, 0], numeroLoShu: 2, elemento: 'terra', direcao: 'SW', familia: 'mãe' },
}

const TRIGRAMA_POR_SETOR: Record<Setor, Trigrama> = Object.fromEntries(
  Object.values(TRIGRAMAS).map(info => [info.direcao, info.trigrama])
) as Record<Setor, Trigrama>

/** Trigrama cuja direção clássica é o setor dado (N/NE/E/SE/S/SW/W/NW). */
export function trigramaDoSetor(setor: Setor): Trigrama {
  return TRIGRAMA_POR_SETOR[setor]
}

const CHAVE_POR_BITS = new Map<string, Trigrama>(
  Object.values(TRIGRAMAS).map(info => [info.bits.join(''), info.trigrama])
)

/** Trigrama correspondente a uma tripla de bits [inferior, média, superior]. */
export function trigramaDosBits(bits: BitsTrigrama): Trigrama | null {
  return CHAVE_POR_BITS.get(bits.join('')) ?? null
}
