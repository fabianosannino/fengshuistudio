/**
 * Ming Gua (número Kua) — o trigrama pessoal de cada morador.
 *
 * Cálculo clássico a partir do ano de nascimento SOLAR (quem nasce antes de
 * ~4 de fevereiro, o Li Chun, pertence ao ano anterior) e do gênero:
 *
 *   X = soma dos dois últimos dígitos do ano, reduzida a 1 dígito
 *   Masculino: nascido antes de 2000 → 10 − X; em/apos 2000 → 9 − X
 *   Feminino:  nascida antes de 2000 → X + 5;  em/apos 2000 → X + 6
 *   Resultado reduzido a 1 dígito; Kua 5 não existe → vira 2 (masc.) / 8 (fem.)
 *
 * O Kua define o grupo (Leste {1,3,4,9} / Oeste {2,6,7,8}) e as quatro
 * direções favoráveis: Sheng Chi (prosperidade), Tien Yi (saúde),
 * Yen Nien (relacionamentos) e Fu Wei (estabilidade/crescimento pessoal).
 *
 * Função pura e fail-closed: dados ausentes/ inválidos → null (nunca chuta).
 */

import { dataSolar } from './data-solar'

export type Genero = 'masculino' | 'feminino'
export type GrupoKua = 'leste' | 'oeste'

export interface DirecoesFavoraveis {
  /** Sheng Chi — prosperidade e sucesso. */
  shengChi: string
  /** Tien Yi — saúde e vitalidade. */
  tienYi: string
  /** Yen Nien — relacionamentos e harmonia. */
  yenNien: string
  /** Fu Wei — estabilidade e crescimento pessoal. */
  fuWei: string
}

export interface MingGua {
  kua: number
  grupo: GrupoKua
  direcoes: DirecoesFavoraveis
}

/**
 * Tabela clássica das quatro direções favoráveis por número Kua.
 * Exportada: reaproveitada por src/lib/oito-mansoes.ts para o Kua da CASA
 * (mesma tabela, o Kua é que muda de fonte — pessoa vs. fachada do imóvel).
 */
export const DIRECOES_POR_KUA: Record<number, DirecoesFavoraveis> = {
  1: { shengChi: 'Sudeste', tienYi: 'Leste', yenNien: 'Sul', fuWei: 'Norte' },
  2: { shengChi: 'Nordeste', tienYi: 'Oeste', yenNien: 'Noroeste', fuWei: 'Sudoeste' },
  3: { shengChi: 'Sul', tienYi: 'Norte', yenNien: 'Sudeste', fuWei: 'Leste' },
  4: { shengChi: 'Norte', tienYi: 'Sul', yenNien: 'Leste', fuWei: 'Sudeste' },
  6: { shengChi: 'Oeste', tienYi: 'Nordeste', yenNien: 'Sudoeste', fuWei: 'Noroeste' },
  7: { shengChi: 'Noroeste', tienYi: 'Sudoeste', yenNien: 'Nordeste', fuWei: 'Oeste' },
  8: { shengChi: 'Sudoeste', tienYi: 'Noroeste', yenNien: 'Oeste', fuWei: 'Nordeste' },
  9: { shengChi: 'Leste', tienYi: 'Sudeste', yenNien: 'Norte', fuWei: 'Sul' },
}

/** Grupo Leste do Ba Zhai (Oito Mansões) — exportado pelo mesmo motivo acima. */
export const GRUPO_LESTE = new Set([1, 3, 4, 9])

function reduzirA1Digito(n: number): number {
  while (n > 9) n = String(n).split('').reduce((s, d) => s + Number(d), 0)
  return n
}

/** Normaliza o gênero como pode vir do banco. Desconhecido → null. */
export function normalizarGenero(valor: string | null | undefined): Genero | null {
  const limpo = (valor ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase()
  if (limpo === 'masculino' || limpo === 'm') return 'masculino'
  if (limpo === 'feminino' || limpo === 'f') return 'feminino'
  return null
}

/**
 * Calcula o Ming Gua a partir da data de nascimento (ISO 'yyyy-mm-dd' ou
 * Date) e do gênero. Devolve null se qualquer dado faltar ou for inválido.
 */
export function calcularMingGua(
  dataNascimento: string | Date | null | undefined,
  genero: string | null | undefined
): MingGua | null {
  const g = normalizarGenero(genero)
  const info = dataSolar(dataNascimento)
  if (!g || !info) return null
  if (info.anoCivil < 1900 || info.anoCivil > 2099) return null

  const anoSolar = info.anoSolar
  // X = soma dos dois últimos dígitos do ano solar, reduzida a 1 dígito.
  const x = reduzirA1Digito(Math.floor((anoSolar % 100) / 10) + (anoSolar % 10))

  let kua: number
  if (g === 'masculino') {
    kua = reduzirA1Digito((anoSolar < 2000 ? 10 : 9) - x)
  } else {
    kua = reduzirA1Digito(x + (anoSolar < 2000 ? 5 : 6))
  }
  // Aritmética mod 9: resultado 0 equivale a 9 (ex.: masculino 2018 → 9−9=0 → Kua 9).
  if (kua === 0) kua = 9
  // Kua 5 não existe (é o centro): masculino → 2, feminino → 8.
  if (kua === 5) kua = g === 'masculino' ? 2 : 8

  return {
    kua,
    grupo: GRUPO_LESTE.has(kua) ? 'leste' : 'oeste',
    direcoes: DIRECOES_POR_KUA[kua],
  }
}
