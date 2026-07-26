/**
 * Geometria do Modo C de orientação (fengshui-metodos-referencia.md §2.4 —
 * alinhamento da planta sobre mapa/satélite). Módulo puro: só aritmética de
 * ângulo, sem nada de mapa/DOM — testável sem qualquer API externa.
 *
 * O mapa é renderizado forçando `heading:0`/`tilt:0` (ver
 * `app/components/MapaAlinhamento.tsx`), o que garante que "para cima" na
 * tela é Norte verdadeiro (projeção Web Mercator padrão). O usuário
 * rotaciona a foto da planta (como uma camada CSS, `transform: rotate()`)
 * até o contorno coincidir com o imóvel na imagem de satélite, e marca qual
 * aresta da foto ORIGINAL (antes de girar) é a fachada.
 *
 * A conta é só uma soma de ângulos porque `rotate()` do CSS já usa sentido
 * horário para graus positivos (eixo Y cresce para baixo no navegador) —
 * a mesma convenção de bússola. Não há troca de sinal/eixo aqui: o ângulo
 * que a aresta apontava no referencial da foto, mais a rotação aplicada,
 * é o rumo verdadeiro que ela aponta no mapa.
 */

import { normalizarGraus } from './graus'

export type ArestaImagem = 'topo' | 'direita' | 'baixo' | 'esquerda'

const ANGULO_BASE_ARESTA: Record<ArestaImagem, number> = {
  topo: 0,
  direita: 90,
  baixo: 180,
  esquerda: 270,
}

/**
 * Facing VERDADEIRO (não magnético — ver aviso de UI) de uma aresta da foto
 * original, dada a rotação (graus, sentido horário) aplicada para alinhá-la
 * ao mapa.
 */
export function calcularFacingVerdadeiro(aresta: ArestaImagem, rotacaoAplicadaGraus: number): number {
  return normalizarGraus(ANGULO_BASE_ARESTA[aresta] + rotacaoAplicadaGraus)
}
