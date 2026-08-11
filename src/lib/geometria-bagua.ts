/**
 * Geometria do grid Ba Guá: quanto de cada setor falta ou sobra.
 *
 * Estava dentro de `app/bagua-planta/page.tsx` — regra de domínio morando num
 * componente de 2.700 linhas, sem teste, exatamente o que a auditoria de
 * 2026-07-18 aponta em R1. É cálculo puro sobre retângulos: não precisa de
 * canvas, de React nem de browser, e por isso pode ser verificado.
 *
 * Todas as medidas são em pixels da imagem da planta. O que importa é a
 * proporção — a conversão para metros acontece na tela, com a escala informada
 * pelo consultor.
 */

import type { NotaCriterio } from './modelos-pontuacao'

/** Retângulo que delimita a planta dentro da imagem. */
export interface Bounds {
  x: number
  y: number
  w: number
  h: number
}

/**
 * Marcação feita pelo consultor sobre a planta.
 *
 * `falta` é um vazio dentro do contorno (um recorte em L, um vão); `excesso` é
 * uma projeção para fora dele (uma varanda avançada).
 */
export interface Marcacao {
  id: string
  tipo: 'falta' | 'excesso'
  x: number
  y: number
  w: number
  h: number
}

export interface Setor {
  /** Uma posição por critério. `null` = não avaliado (≠ «Neutro»). */
  criterios: (NotaCriterio | null)[]
  /** 100 − faltaPct − excessoPct. Já é uma nota 0–100. */
  geo: number
  faltaArea: number
  excessoArea: number
  faltaPct: number
  excessoPct: number
  /** Ajuste fino manual do geo (Avançado). `null` = usar o calculado. */
  ajusteManual: number | null
  ajusteTipo: 'equilibrado' | 'faltante' | 'excedente' | null
  obs: string
}

/** O Ba Guá é sempre 3×3 — nove setores, incluindo o centro (Tai Ji). */
export const SETORES_NO_GRID = 9
const COLUNAS = 3
/** Um critério por item do checklist físico. */
const CRITERIOS_POR_SETOR = 8

/** Área de interseção entre dois retângulos. Zero quando não se tocam. */
export function areaSobreposta(
  r: { x: number; y: number; w: number; h: number },
  sx: number, sy: number, sw: number, sh: number
): number {
  const ox = Math.max(0, Math.min(r.x + r.w, sx + sw) - Math.max(r.x, sx))
  const oy = Math.max(0, Math.min(r.y + r.h, sy + sh) - Math.max(r.y, sy))
  return ox * oy
}

/**
 * Parte da marcação de excesso que fica FORA do contorno.
 *
 * Só isso conta como excesso: o pedaço que cai dentro da planta já é área
 * normal do imóvel, e somá-lo puniria o setor duas vezes.
 */
export function excessoAreaExterna(m: Marcacao, b: Bounds): number {
  const areaTotal = m.w * m.h
  return Math.max(0, areaTotal - areaSobreposta(m, b.x, b.y, b.w, b.h))
}

/** Limites de um setor do grid, em pixels. */
function limitesDoSetor(indice: number, b: Bounds, lh: number[], lv: number[]) {
  const linha = Math.floor(indice / COLUNAS)
  const coluna = indice % COLUNAS
  const x0 = b.x + (coluna === 0 ? 0 : b.w * lv[coluna - 1])
  const x1 = b.x + (coluna === COLUNAS - 1 ? b.w : b.w * lv[coluna])
  const y0 = b.y + (linha === 0 ? 0 : b.h * lh[linha - 1])
  const y1 = b.y + (linha === COLUNAS - 1 ? b.h : b.h * lh[linha])
  return { linha, coluna, x0, x1, y0, y1 }
}

/**
 * Distribui a área externa de um excesso entre os setores da borda.
 *
 * Uma varanda projetada para fora não pertence a um setor só. Cada setor é
 * estendido para fora do contorno e recebe uma fatia proporcional ao quanto
 * dessa extensão a marcação cobre — quem está mais perto recebe mais.
 */
function distribuirExcessoExterno(marcacoes: Marcacao[], b: Bounds, lh: number[], lv: number[]): number[] {
  const porSetor = new Array<number>(SETORES_NO_GRID).fill(0)
  const extensao = Math.max(b.w, b.h) * 2

  for (const m of marcacoes) {
    if (m.tipo !== 'excesso') continue
    const areaExterna = excessoAreaExterna(m, b)
    if (areaExterna <= 0) continue

    const pesos = new Array<number>(SETORES_NO_GRID).fill(0)
    let somaDosPesos = 0

    for (let idx = 0; idx < SETORES_NO_GRID; idx++) {
      const { linha, coluna, x0, x1, y0, y1 } = limitesDoSetor(idx, b, lh, lv)
      const exX0 = coluna === 0 ? x0 - extensao : x0
      const exX1 = coluna === COLUNAS - 1 ? x1 + extensao : x1
      const exY0 = linha === 0 ? y0 - extensao : y0
      const exY1 = linha === COLUNAS - 1 ? y1 + extensao : y1

      const naExtensao = areaSobreposta(m, exX0, exY0, exX1 - exX0, exY1 - exY0)
      const dentroDoSetor = areaSobreposta(m, x0, y0, x1 - x0, y1 - y0)
      const peso = Math.max(0, naExtensao - dentroDoSetor)

      pesos[idx] = peso
      somaDosPesos += peso
    }

    if (somaDosPesos <= 0) continue
    for (let idx = 0; idx < SETORES_NO_GRID; idx++) {
      porSetor[idx] += areaExterna * (pesos[idx] / somaDosPesos)
    }
  }

  return porSetor
}

/**
 * Calcula os nove setores a partir do contorno e das marcações.
 *
 * `lh` e `lv` são as posições relativas (0–1) das duas linhas divisórias
 * horizontais e verticais — o grid não é necessariamente em terços iguais.
 *
 * A nota geométrica sai de área, não de contagem: um vão pequeno num setor
 * grande pesa menos que o mesmo vão num setor pequeno.
 */
export function calcularSetores(
  b: Bounds,
  lh: number[],
  lv: number[],
  marcacoes: Marcacao[]
): Setor[] {
  const areaDoSetor = (b.w * b.h) / SETORES_NO_GRID
  const excessoExterno = distribuirExcessoExterno(marcacoes, b, lh, lv)

  return Array.from({ length: SETORES_NO_GRID }, (_, idx) => {
    const { x0, x1, y0, y1 } = limitesDoSetor(idx, b, lh, lv)

    let faltaArea = 0
    for (const m of marcacoes) {
      if (m.tipo !== 'falta') continue
      faltaArea += areaSobreposta(m, x0, y0, x1 - x0, y1 - y0)
    }

    const excessoArea = excessoExterno[idx]
    const faltaPct = areaDoSetor > 0 ? (faltaArea / areaDoSetor) * 100 : 0
    const excessoPct = areaDoSetor > 0 ? (excessoArea / areaDoSetor) * 100 : 0

    return {
      criterios: new Array<NotaCriterio | null>(CRITERIOS_POR_SETOR).fill(null),
      geo: 100 - faltaPct - excessoPct,
      faltaArea,
      excessoArea,
      faltaPct,
      excessoPct,
      ajusteManual: null,
      ajusteTipo: null,
      obs: '',
    }
  })
}
