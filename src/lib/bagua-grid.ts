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
 * BTB (Chapéu Preto / Black Hat): o Ba Guá é **FIXO** e se alinha à parede da
 * ENTRADA, que fica sempre na base da planta. A Carreira fica sempre na
 * parede da entrada, não importa para onde a casa esteja voltada — o BTB não
 * usa bússola nenhuma.
 *
 * Layout canônico (Karen Rauch Carter, *Move Your Stuff, Change Your Life*,
 * Figura 2 — "Simplified bagua showing the associated life situations"):
 *
 *   Prosperidade | Fama         | Relacionamentos     ← fundo
 *   Família      | Saúde/Centro | Criatividade
 *   Conhecimento | Carreira     | Pessoas Úteis       ← PAREDE DA ENTRADA
 *
 * A legenda da figura é categórica: *"THIS SIDE OF THE BAGUA ALWAYS HAS THE
 * MAIN DOOR OF THE HOME OR ROOM LOCATED ON IT."* Sempre esse lado — o mapa
 * **não** se move.
 *
 * ─── POR QUE `lado` É IGNORADO (correção de bug de domínio) ───────────────
 *
 * A versão anterior devolvia `[2,1,0,5,4,3,8,7,6]` quando a porta caía no
 * terço direito. Isso **espelha** cada linha (não gira), e jogava a
 * Prosperidade para o fundo-DIREITO. Contradiz a doutrina em cheio: o mapa é
 * fixo, e a Prosperidade é sempre o canto do fundo à ESQUERDA.
 *
 * Um Ba Guá espelhado é quiralmente invertido — nenhuma escola usa isso. Se a
 * intenção original fosse tratar outra parede de entrada, o correto seria
 * GIRAR a planta (o que a UI já permite: 0/90/180/270 e ângulo livre), não
 * refletir o mapa.
 *
 * O `lado` continua sendo capturado, mas é **diagnóstico**: diz em qual dos
 * três guás frontais a porta caiu (ver `guaDaPorta`), que é informação útil de
 * leitura — não uma transformação da grade.
 */
// O parâmetro segue na assinatura para não quebrar os call sites, e o
// eslint-disable é o marcador de que ignorá-lo é a CORREÇÃO, não um descuido.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function gridOrderBTB(_lado?: string): number[] {
  return [0, 1, 2, 3, 4, 5, 6, 7, 8]
}

/** Guás da parede da entrada, da esquerda para a direita (linha de baixo). */
const GUA_DA_PORTA: Record<string, string> = {
  esquerda: 'Conhecimento',
  centro: 'Carreira',
  direita: 'Pessoas Úteis',
}

/**
 * Em qual guá frontal a porta de entrada caiu — leitura clássica do BTB
 * ("a porta está no guá da Carreira"). Substitui o uso indevido de `lado`
 * como transformação da grade.
 */
export function guaDaPorta(lado: string): string {
  return GUA_DA_PORTA[lado] ?? GUA_DA_PORTA.centro
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
