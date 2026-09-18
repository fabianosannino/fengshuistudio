import polygonClipping, { type MultiPolygon, type Polygon } from 'polygon-clipping'
import type { Bounds, Marcacao } from './geometria-bagua'
import { areaPoligono, type Ponto } from './poligono'

export const MAX_VERTICES_MARCACAO = 100
const MAX_VERTICES_TOTAL = 2000
const EPS = 1e-7
const LIMITE_COORDENADA = 100_000

export function cantos(b: Bounds): Ponto[] {
  return [{ x: b.x, y: b.y }, { x: b.x + b.w, y: b.y }, { x: b.x + b.w, y: b.y + b.h }, { x: b.x, y: b.y + b.h }]
}
export function pontosDaMarcacao(m: Marcacao): Ponto[] { return m.pontos ?? cantos(m) }
export function limitesDosPontos(p: Ponto[]): Bounds {
  const xs = p.map(v => v.x), ys = p.map(v => v.y)
  const x = Math.min(...xs), y = Math.min(...ys)
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y }
}
function poligono(p: Ponto[]): Polygon { return [p.map(v => [v.x, v.y])] }
export function areaMultipoligono(mp: MultiPolygon): number {
  return mp.reduce((s, p) => s + p.reduce((a, anel, i) => a + (i === 0 ? 1 : -1) * areaPoligono(anel.map(([x, y]) => ({ x, y }))), 0), 0)
}
const cruz = (a: Ponto, b: Ponto, c: Ponto) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)
function sobre(a: Ponto, b: Ponto, p: Ponto): boolean {
  return Math.abs(cruz(a, b, p)) < EPS && p.x >= Math.min(a.x, b.x) - EPS && p.x <= Math.max(a.x, b.x) + EPS && p.y >= Math.min(a.y, b.y) - EPS && p.y <= Math.max(a.y, b.y) + EPS
}
function intersecta(a: Ponto, b: Ponto, c: Ponto, d: Ponto): boolean {
  return (cruz(a, b, c) * cruz(a, b, d) < 0 && cruz(c, d, a) * cruz(c, d, b) < 0) || sobre(a, b, c) || sobre(a, b, d) || sobre(c, d, a) || sobre(c, d, b)
}
export function erroPoligono(p: Ponto[]): string | null {
  if (p.length < 3 || p.length > MAX_VERTICES_MARCACAO) return `Use de 3 a ${MAX_VERTICES_MARCACAO} pontos.`
  if (p.some(v => !Number.isFinite(v.x) || !Number.isFinite(v.y) || Math.abs(v.x) > LIMITE_COORDENADA || Math.abs(v.y) > LIMITE_COORDENADA)) return 'Coordenadas inválidas.'
  for (let i = 0; i < p.length; i++) {
    const a = p[i], b = p[(i + 1) % p.length]
    if (Math.hypot(a.x - b.x, a.y - b.y) < EPS) return 'Remova pontos repetidos.'
    const anterior = p[(i + p.length - 1) % p.length]
    if (Math.abs(cruz(anterior, a, b)) < EPS && (anterior.x - a.x) * (b.x - a.x) + (anterior.y - a.y) * (b.y - a.y) > 0) return 'As linhas voltam sobre si mesmas. Corrija os pontos do polígono.'
    for (let j = i + 1; j < p.length; j++) {
      if (j === i + 1 || (i === 0 && j === p.length - 1)) continue
      if (intersecta(a, b, p[j], p[(j + 1) % p.length])) return 'As linhas se cruzam. Corrija os pontos do polígono.'
    }
  }
  return areaPoligono(p) < 1 ? 'Marque uma área maior, com pontos que não estejam na mesma linha.' : null
}
function partilhaBorda(mp: MultiPolygon, b: Bounds): boolean {
  return mp.every(p => p.some(r => r.some(([x, y], i) => {
    if (i === 0) return false
    const [ax, ay] = r[i - 1]
    if (Math.hypot(x - ax, y - ay) < EPS) return false
    return [b.x, b.x + b.w].some(v => Math.abs(x - v) < EPS && Math.abs(ax - v) < EPS && Math.min(y, ay) < b.y + b.h && Math.max(y, ay) > b.y)
      || [b.y, b.y + b.h].some(v => Math.abs(y - v) < EPS && Math.abs(ay - v) < EPS && Math.min(x, ax) < b.x + b.w && Math.max(x, ax) > b.x)
  })))
}
/** A área efetiva deve compartilhar um trecho da borda; tocar só um canto não basta. */
export function erroMarcacao(p: Ponto[], tipo: Marcacao['tipo'], b: Bounds): string | null {
  const erro = erroPoligono(p)
  if (erro) return erro
  const forma = poligono(p), base = poligono(cantos(b))
  const parte = tipo === 'falta' ? polygonClipping.intersection(forma, base) : polygonClipping.difference(forma, base)
  if (areaMultipoligono(parte) < 1) return tipo === 'falta' ? 'A falta precisa ter área dentro das bordas.' : 'O excesso precisa ter área fora das bordas.'
  if (!partilhaBorda(parte, b)) return 'Conecte a marcação a um trecho das bordas. Uma área isolada ou o contato apenas em um ponto não é aceito.'
  return null
}
/** União por tipo evita duplicar sobreposições; o recorte externo nunca amplia a grade. */
export function areasPoligonaisPorSetor(marcacoes: Marcacao[], b: Bounds, lh: number[], lv: number[]) {
  if (marcacoes.reduce((s, m) => s + pontosDaMarcacao(m).length, 0) > MAX_VERTICES_TOTAL) throw new Error('Simplifique as marcações: limite total de pontos excedido.')
  for (const m of marcacoes) { const erro = erroPoligono(pontosDaMarcacao(m)); if (erro) throw new Error(erro) }
  const uniao = (tipo: Marcacao['tipo']): MultiPolygon => {
    const polys = marcacoes.filter(m => m.tipo === tipo).map(m => poligono(pontosDaMarcacao(m)))
    return polys.length ? polygonClipping.union(polys[0], ...polys.slice(1)) : []
  }
  const faltas = uniao('falta'), excessos = polygonClipping.difference(uniao('excesso'), poligono(cantos(b)))
  const todos = [...cantos(b), ...marcacoes.flatMap(pontosDaMarcacao)], total = limitesDosPontos(todos)
  const xs = [b.x, b.x + b.w * lv[0], b.x + b.w * lv[1], b.x + b.w]
  const ys = [b.y, b.y + b.h * lh[0], b.y + b.h * lh[1], b.y + b.h]
  return Array.from({ length: 9 }, (_, i) => {
    const c = i % 3, r = Math.floor(i / 3)
    const setor = poligono(cantos({ x: xs[c], y: ys[r], w: xs[c + 1] - xs[c], h: ys[r + 1] - ys[r] }))
    const x = c === 0 ? total.x : xs[c], y = r === 0 ? total.y : ys[r]
    const fimX = c === 2 ? total.x + total.w : xs[c + 1], fimY = r === 2 ? total.y + total.h : ys[r + 1]
    return { faltaArea: areaMultipoligono(polygonClipping.intersection(faltas, setor)), excessoArea: areaMultipoligono(polygonClipping.intersection(excessos, poligono(cantos({ x, y, w: fimX - x, h: fimY - y })))) }
  })
}
