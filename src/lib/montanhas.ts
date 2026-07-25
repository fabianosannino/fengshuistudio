/**
 * As 24 Montanhas (24 Shan 二十四山) — cada um dos 8 trigramas de 45° se
 * divide em 3 montanhas de 15°. É a granularidade que todo método de
 * bússola (Estrelas Voadoras completo, Xuan Kong Da Gua, San He) exige;
 * hoje o app opera só na resolução de 8 setores (45°, ver bagua-grid.ts).
 *
 * Tabela conforme docs/domain/fengshui-metodos-referencia.md §1.4.
 *
 * NÃO inclui detecção de Kong Wang (linhas vazias): os graus citados no
 * documento de referência para o Kong Wang maior (45/135/225/315) foram
 * sinalizados lá como pendentes de verificação com fonte primária — essa
 * tabela aqui (faixa/setor/YuanLong/polaridade) é a parte já confirmada;
 * a detecção de Kong Wang fica para quando essa verificação acontecer.
 */

import type { Setor } from './trigramas'

export type YuanLong = 'terra' | 'ceu' | 'humano'
export type Polaridade = 'yin' | 'yang'

export interface Montanha {
  numero: number
  nome: string
  pinyin: string
  /** Início da faixa, em graus [0, 360). Faixa é [faixaInicio, faixaFim) — pode "dar a volta" pelo 0°. */
  faixaInicio: number
  faixaFim: number
  setor: Setor
  yuanLong: YuanLong
  polaridade: Polaridade
}

export const MONTANHAS: readonly Montanha[] = [
  { numero: 1, nome: '壬', pinyin: 'Ren', faixaInicio: 337.5, faixaFim: 352.5, setor: 'N', yuanLong: 'terra', polaridade: 'yang' },
  { numero: 2, nome: '子', pinyin: 'Zi', faixaInicio: 352.5, faixaFim: 7.5, setor: 'N', yuanLong: 'ceu', polaridade: 'yin' },
  { numero: 3, nome: '癸', pinyin: 'Gui', faixaInicio: 7.5, faixaFim: 22.5, setor: 'N', yuanLong: 'humano', polaridade: 'yin' },
  { numero: 4, nome: '丑', pinyin: 'Chou', faixaInicio: 22.5, faixaFim: 37.5, setor: 'NE', yuanLong: 'terra', polaridade: 'yin' },
  { numero: 5, nome: '艮', pinyin: 'Gen', faixaInicio: 37.5, faixaFim: 52.5, setor: 'NE', yuanLong: 'ceu', polaridade: 'yang' },
  { numero: 6, nome: '寅', pinyin: 'Yin', faixaInicio: 52.5, faixaFim: 67.5, setor: 'NE', yuanLong: 'humano', polaridade: 'yang' },
  { numero: 7, nome: '甲', pinyin: 'Jia', faixaInicio: 67.5, faixaFim: 82.5, setor: 'E', yuanLong: 'terra', polaridade: 'yang' },
  { numero: 8, nome: '卯', pinyin: 'Mao', faixaInicio: 82.5, faixaFim: 97.5, setor: 'E', yuanLong: 'ceu', polaridade: 'yin' },
  { numero: 9, nome: '乙', pinyin: 'Yi', faixaInicio: 97.5, faixaFim: 112.5, setor: 'E', yuanLong: 'humano', polaridade: 'yin' },
  { numero: 10, nome: '辰', pinyin: 'Chen', faixaInicio: 112.5, faixaFim: 127.5, setor: 'SE', yuanLong: 'terra', polaridade: 'yin' },
  { numero: 11, nome: '巽', pinyin: 'Xun', faixaInicio: 127.5, faixaFim: 142.5, setor: 'SE', yuanLong: 'ceu', polaridade: 'yang' },
  { numero: 12, nome: '巳', pinyin: 'Si', faixaInicio: 142.5, faixaFim: 157.5, setor: 'SE', yuanLong: 'humano', polaridade: 'yang' },
  { numero: 13, nome: '丙', pinyin: 'Bing', faixaInicio: 157.5, faixaFim: 172.5, setor: 'S', yuanLong: 'terra', polaridade: 'yang' },
  { numero: 14, nome: '午', pinyin: 'Wu', faixaInicio: 172.5, faixaFim: 187.5, setor: 'S', yuanLong: 'ceu', polaridade: 'yin' },
  { numero: 15, nome: '丁', pinyin: 'Ding', faixaInicio: 187.5, faixaFim: 202.5, setor: 'S', yuanLong: 'humano', polaridade: 'yin' },
  { numero: 16, nome: '未', pinyin: 'Wei', faixaInicio: 202.5, faixaFim: 217.5, setor: 'SW', yuanLong: 'terra', polaridade: 'yin' },
  { numero: 17, nome: '坤', pinyin: 'Kun', faixaInicio: 217.5, faixaFim: 232.5, setor: 'SW', yuanLong: 'ceu', polaridade: 'yang' },
  { numero: 18, nome: '申', pinyin: 'Shen', faixaInicio: 232.5, faixaFim: 247.5, setor: 'SW', yuanLong: 'humano', polaridade: 'yang' },
  { numero: 19, nome: '庚', pinyin: 'Geng', faixaInicio: 247.5, faixaFim: 262.5, setor: 'W', yuanLong: 'terra', polaridade: 'yang' },
  { numero: 20, nome: '酉', pinyin: 'You', faixaInicio: 262.5, faixaFim: 277.5, setor: 'W', yuanLong: 'ceu', polaridade: 'yin' },
  { numero: 21, nome: '辛', pinyin: 'Xin', faixaInicio: 277.5, faixaFim: 292.5, setor: 'W', yuanLong: 'humano', polaridade: 'yin' },
  { numero: 22, nome: '戌', pinyin: 'Xu', faixaInicio: 292.5, faixaFim: 307.5, setor: 'NW', yuanLong: 'terra', polaridade: 'yin' },
  { numero: 23, nome: '乾', pinyin: 'Qian', faixaInicio: 307.5, faixaFim: 322.5, setor: 'NW', yuanLong: 'ceu', polaridade: 'yang' },
  { numero: 24, nome: '亥', pinyin: 'Hai', faixaInicio: 322.5, faixaFim: 337.5, setor: 'NW', yuanLong: 'humano', polaridade: 'yang' },
]

function grauNaFaixa(graus: number, montanha: Montanha): boolean {
  const { faixaInicio, faixaFim } = montanha
  if (faixaInicio < faixaFim) return graus >= faixaInicio && graus < faixaFim
  // Faixa "dá a volta" pelo 0° (só a montanha 2, Zi: 352.5–7.5).
  return graus >= faixaInicio || graus < faixaFim
}

/** Montanha das 24 que contém o grau dado (0–359,999...). Nunca falha: as 24 faixas cobrem o círculo inteiro. */
export function montanhaDoGrau(graus: number): Montanha {
  const normalizado = ((graus % 360) + 360) % 360
  return MONTANHAS.find(m => grauNaFaixa(normalizado, m))!
}
