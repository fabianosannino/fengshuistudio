import type { Bounds, Marcacao } from './geometria-bagua'

export type ModoEdicaoPlanta = 'nenhum' | 'bordas' | 'marcarFalta' | 'marcarExcesso' | 'editarMarcacao'
export type CantoMarcacao = 'tl' | 'tr' | 'bl' | 'br'
export type ArrastePlanta = { tipo: 'borda'; lado: 'top' | 'bottom' | 'left' | 'right' }
  | { tipo: 'marcacao-mover'; id: string; offX: number; offY: number }
  | { tipo: 'marcacao-resize'; id: string; canto: CantoMarcacao }
type Ponto = { x: number; y: number }
export const DIMENSAO_MINIMA_MARCACAO = 4

function contemPonto(m: Marcacao, ponto: Ponto): boolean {
  return ponto.x >= m.x && ponto.x <= m.x + m.w && ponto.y >= m.y && ponto.y <= m.y + m.h
}

export function retanguloEntrePontos(a: Ponto, b: Ponto): Bounds {
  return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) }
}

/** O canto oposto fica fixo, inclusive ao cruzá-lo; não cria largura negativa. */
export function redimensionarMarcacao(m: Marcacao, canto: CantoMarcacao, ponto: Ponto): Marcacao {
  const ancora = { x: canto.includes('l') ? m.x + m.w : m.x, y: canto.includes('t') ? m.y + m.h : m.y }
  const novo = retanguloEntrePontos(ancora, ponto)
  return novo.w >= DIMENSAO_MINIMA_MARCACAO && novo.h >= DIMENSAO_MINIMA_MARCACAO ? { ...m, ...novo } : m
}

/** Só o modo editar usa hit testing. Desenhar nunca captura uma marcação antiga. */
export function encontrarMarcacao(
  marcacoes: Marcacao[], ponto: Ponto, tolerancia: Ponto, selecionada: string | null,
): ArrastePlanta | null {
  const atual = marcacoes.find(m => m.id === selecionada)
  if (atual) {
    const cantos: [number, number, CantoMarcacao][] = [
      [atual.x, atual.y, 'tl'], [atual.x + atual.w, atual.y, 'tr'],
      [atual.x, atual.y + atual.h, 'bl'], [atual.x + atual.w, atual.y + atual.h, 'br'],
    ]
    for (const [x, y, canto] of cantos) {
      if (Math.abs(ponto.x - x) <= tolerancia.x && Math.abs(ponto.y - y) <= tolerancia.y) {
        return { tipo: 'marcacao-resize', id: atual.id, canto }
      }
    }
    if (contemPonto(atual, ponto)) return { tipo: 'marcacao-mover', id: atual.id, offX: ponto.x - atual.x, offY: ponto.y - atual.y }
  }
  // A marca desenhada por último está por cima. O seletor permite acessar as demais.
  const m = [...marcacoes].reverse().find(m => contemPonto(m, ponto))
  return m ? { tipo: 'marcacao-mover', id: m.id, offX: ponto.x - m.x, offY: ponto.y - m.y } : null
}
