import { areaPoligono, recortarPoligono, retanguloDelimitador, type Ponto, type Retangulo } from './poligono'

const TERCOS = [1 / 3, 2 / 3] as const
const DIVISOES = 3
const TOLERANCIA_RELATIVA_AREA = 1e-9
const LIMIAR_COBERTURA_AUSENTE = 2 / 3

export interface CelulaContorno {
  linha: number
  coluna: number
  limites: Retangulo
  cobertura: number
  /** Aproximação por área já usada no editor; não é validação da regra linear de uma escola. */
  ausente: boolean
  excessoArea: number
  poligonosExternos: Ponto[][]
}

/**
 * O contorno muda; a grade pertence à referência escolhida pelo consultor.
 * A área externa é repartida pelo prolongamento das divisórias das células
 * periféricas, sem expandir o retângulo-base nem deslocar os nove setores.
 * O centroide do imóvel é calculado separadamente e não transforma esta grade.
 */
export function analisarContornoNaGrade(
  pontos: Ponto[], referencia: Retangulo, lh: readonly number[] = TERCOS, lv: readonly number[] = TERCOS,
): CelulaContorno[] {
  const { x, y, w, h } = referencia
  if (![x, y, w, h, x + w, y + h, w * h].every(Number.isFinite)
    || w <= 0 || h <= 0 || w * h <= 0 || x + w <= x || y + h <= y) return []
  if ([lh, lv].some(l => l.length !== 2 || !l.every(Number.isFinite) || !(0 < l[0] && l[0] < l[1] && l[1] < 1))) return []
  if (pontos.length < 3 || pontos.some(p => !Number.isFinite(p.x) || !Number.isFinite(p.y))) return []
  const area = areaPoligono(pontos)
  if (!Number.isFinite(area) || area === 0) return []
  const contorno = retanguloDelimitador(pontos)!
  const xs = [x, x + w * lv[0], x + w * lv[1], x + w]
  const ys = [y, y + h * lh[0], y + h * lh[1], y + h]
  if ([xs, ys].some(eixo => eixo.some((v, i) => i > 0 && v <= eixo[i - 1]))) return []

  return Array.from({ length: DIVISOES * DIVISOES }, (_, i) => {
    const linha = Math.floor(i / DIVISOES), coluna = i % DIVISOES
    const x0 = xs[coluna], x1 = xs[coluna + 1], y0 = ys[linha], y1 = ys[linha + 1]
    const limites = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
    const areaCelula = limites.w * limites.h
    const cobertura = Math.max(0, Math.min(1, areaPoligono(recortarPoligono(pontos, limites)) / areaCelula))
    const ex0 = coluna === 0 ? Math.min(contorno.x, x0) : x0
    const ex1 = coluna === 2 ? Math.max(contorno.x + contorno.w, x1) : x1
    const ey0 = linha === 0 ? Math.min(contorno.y, y0) : y0
    const ey1 = linha === 2 ? Math.max(contorno.y + contorno.h, y1) : y1
    // Faixas disjuntas: os cantos pertencem às faixas superior/inferior.
    const faixas = [
      { x: ex0, y: ey0, w: ex1 - ex0, h: y0 - ey0 },
      { x: ex0, y: y1, w: ex1 - ex0, h: ey1 - y1 },
      { x: ex0, y: y0, w: x0 - ex0, h: y1 - y0 },
      { x: x1, y: y0, w: ex1 - x1, h: y1 - y0 },
    ]
    const poligonosExternos = faixas.filter(r => r.w > 0 && r.h > 0)
      .map(r => recortarPoligono(pontos, r))
      .filter(p => areaPoligono(p) > areaCelula * TOLERANCIA_RELATIVA_AREA)
    return {
      linha, coluna, limites, cobertura,
      ausente: !(linha === 1 && coluna === 1) && cobertura < LIMIAR_COBERTURA_AUSENTE,
      excessoArea: poligonosExternos.reduce((total, p) => total + areaPoligono(p), 0),
      poligonosExternos,
    }
  })
}
