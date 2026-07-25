/**
 * Geometria de polígono — centro (Tai Ji) real de um imóvel, conforme
 * docs/domain/fengshui-metodos-referencia.md §1.7:
 *
 *   "Centro = centróide geométrico do polígono (não o centro do bounding
 *   box). Para plantas em L, U ou T o centróide pode cair fora da área
 *   construída — isso é diagnóstico em si."
 *
 * Hoje o app usa o centro do retângulo delimitador (bounding box) — correto
 * só para plantas retangulares. Este módulo implementa a matemática real
 * (fórmula padrão do centroide de polígono por decomposição em triângulos
 * com o teorema do sapateiro/shoelace — geometria de livro-texto, sem
 * ambiguidade de interpretação) para plantas de qualquer forma.
 *
 * ESCOPO: só a geometria. A "regra do terço" (setor ausente vs. extensão)
 * e a ferramenta de desenho de polígono na UI ficam fora deste corte — ver
 * ADR 0009.
 */

export interface Ponto {
  x: number
  y: number
}

/**
 * Área do polígono pela fórmula do sapateiro (shoelace). Sempre positiva,
 * independente da polígono estar em sentido horário ou anti-horário.
 * Devolve 0 para menos de 3 pontos.
 */
export function areaPoligono(pontos: Ponto[]): number {
  return Math.abs(areaComSinal(pontos))
}

function areaComSinal(pontos: Ponto[]): number {
  if (pontos.length < 3) return 0
  let soma = 0
  for (let i = 0; i < pontos.length; i++) {
    const atual = pontos[i]
    const proximo = pontos[(i + 1) % pontos.length]
    soma += atual.x * proximo.y - proximo.x * atual.y
  }
  return soma / 2
}

/**
 * Centróide geométrico (ponderado pela área) do polígono — NÃO é a média
 * aritmética dos vértices, que erra para polígonos não uniformes (ex.: um
 * "L" tem mais vértices do lado estreito, puxando a média para lá sem
 * justificativa geométrica). Devolve null para polígono degenerado (menos
 * de 3 pontos ou área zero).
 */
export function centroidePoligono(pontos: Ponto[]): Ponto | null {
  const a = areaComSinal(pontos)
  if (pontos.length < 3 || a === 0) return null

  let cx = 0
  let cy = 0
  for (let i = 0; i < pontos.length; i++) {
    const atual = pontos[i]
    const proximo = pontos[(i + 1) % pontos.length]
    const fator = atual.x * proximo.y - proximo.x * atual.y
    cx += (atual.x + proximo.x) * fator
    cy += (atual.y + proximo.y) * fator
  }
  return { x: cx / (6 * a), y: cy / (6 * a) }
}

/**
 * Teste ponto-em-polígono por ray casting (par/ímpar de cruzamentos).
 * Funciona para polígonos simples (sem auto-interseção), convexos ou
 * côncavos — exatamente o caso de plantas em L/U/T que este módulo precisa
 * cobrir.
 */
export function pontoDentroDoPoligono(ponto: Ponto, pontos: Ponto[]): boolean {
  let dentro = false
  for (let i = 0, j = pontos.length - 1; i < pontos.length; j = i++) {
    const pi = pontos[i]
    const pj = pontos[j]
    const cruza =
      pi.y > ponto.y !== pj.y > ponto.y &&
      ponto.x < ((pj.x - pi.x) * (ponto.y - pi.y)) / (pj.y - pi.y) + pi.x
    if (cruza) dentro = !dentro
  }
  return dentro
}

export interface DiagnosticoTaiJi {
  centro: Ponto
  /** true quando o centróide geométrico cai FORA da área construída — diagnóstico em si (plantas em L/U/T). */
  centroForaDaArea: boolean
}

/**
 * Calcula o Tai Ji (centro) de um polígono e sinaliza quando ele cai fora
 * da área construída. Devolve null para polígono degenerado.
 */
export function calcularTaiJi(pontos: Ponto[]): DiagnosticoTaiJi | null {
  const centro = centroidePoligono(pontos)
  if (!centro) return null
  return { centro, centroForaDaArea: !pontoDentroDoPoligono(centro, pontos) }
}
