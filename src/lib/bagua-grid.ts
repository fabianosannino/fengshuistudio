/**
 * Grid do Ba Guá — qual setor ocupa qual célula da grade 3x3, conforme a
 * metodologia escolhida (BTB ou Bússola).
 *
 * A grade é sempre lida em ordem row-major (0=topo-esquerda ... 8=baixo-
 * direita), com a célula 4 sempre no Centro:
 *   0(SE) 1(S)  2(SW)
 *   3(E)  4(C)  5(W)
 *   6(NE) 7(N)  8(NW)
 *
 * INVARIANTE — a ordem padrão [0,1,2,...,8] já É o layout compass-fixo com
 * Sul no topo (convenção clássica chinesa). O array SETORES (definido em
 * app/bagua-planta/page.tsx) segue essa mesma ordem por posição (índice 7 =
 * Carreira/Norte, a parede inferior-central) — qualquer mudança na ordem de
 * SETORES quebra silenciosamente o cálculo da Bússola abaixo.
 */

/** Células, em ordem horária a partir do Norte (posição inferior-central). */
export const CELULAS_HORARIO_DESDE_NORTE = [7, 6, 3, 0, 1, 2, 5, 8] as const

/**
 * BTB (Chapéu Preto): o grid gira com a PORTA — a Carreira fica sempre na
 * parede da entrada, não importa para onde a casa realmente esteja voltada.
 * Comportamento preservado igual ao histórico (só 'direita' é tratado; ver
 * débito técnico documentado no PR — 'esquerda' cai no caso padrão).
 */
export function gridOrderBTB(lado: string): number[] {
  if (lado === 'direita') return [2, 1, 0, 5, 4, 3, 8, 7, 6]
  return [0, 1, 2, 3, 4, 5, 6, 7, 8]
}

/**
 * Escola da Bússola (Clássica): os setores são FIXOS à direção cardinal real
 * — Carreira é sempre Norte, Fama é sempre Sul, etc. — não importa onde fica
 * a porta. `facingGraus` é a orientação magnética (0–359°, 0=Norte) da
 * parede/fachada desenhada na base da planta (o mesmo conceito de "parede
 * de referência" que `lado` representa no BTB, mas com bússola real).
 *
 * Arredonda para o octante mais próximo (45°) — a grade 3x3 só comporta 8
 * direções cardinais/intercardinais; graus intermediários não mudam qual
 * setor cai em qual célula (o valor bruto continua salvo, para uso futuro
 * por metodologias mais granulares como Estrelas Voadoras).
 */
export function gridOrderBussola(facingGraus: number): number[] {
  const normalizado = ((facingGraus % 360) + 360) % 360
  const octante = Math.round(normalizado / 45) % 8
  const anel = CELULAS_HORARIO_DESDE_NORTE
  const order = new Array(9).fill(4)
  for (let k = 0; k < 8; k++) {
    order[anel[k]] = anel[(octante + k) % 8]
  }
  return order
}

export interface OpcoesGrid {
  lado?: string
  orientacaoGraus?: number
}

/** Dispatcher usado pela tela do Ba Guá — decide o cálculo pela metodologia ativa. */
export function calcularGridOrder(metodologia: string, opcoes: OpcoesGrid): number[] {
  if (metodologia === 'bussola' && opcoes.orientacaoGraus != null) {
    return gridOrderBussola(opcoes.orientacaoGraus)
  }
  return gridOrderBTB(opcoes.lado ?? 'centro')
}
