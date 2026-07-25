/**
 * Lo Shu (洛書) — o quadrado mágico de 9 casas e sua trajetória de voo fixa,
 * base de todo método que "voa" números por um grid de 9 palácios (Estrelas
 * Voadoras, estrelas anuais/mensais, e no futuro San He/Liu Fa).
 *
 * Trajetória conforme docs/domain/fengshui-metodos-referencia.md §1.3:
 * Centro → NO → O → NE → S → N → SO → E → SE → (volta ao Centro).
 * Reconstruída à mão contra a carta do Período 8 amplamente publicada
 * (4-9-2/3-5-7/8-1-6) antes de virar código — ver estrelas-voadoras.test.ts.
 *
 * Local canônico desta lógica: `estrelas-voadoras.ts` importa daqui em vez
 * de reimplementar (era duplicado antes desta extração).
 */

import type { Setor } from './trigramas'

export type Palacio = Setor | 'C'

/** Caminho físico fixo por onde os números voam (sempre nesta ordem, cíclica). */
export const CAMINHO_VOO: readonly Palacio[] = ['C', 'NW', 'W', 'NE', 'S', 'N', 'SW', 'E', 'SE']

/** Normaliza qualquer inteiro para o intervalo cíclico 1–9 (0→9, 10→1, etc.). */
export function normalizar1a9(v: number): number {
  return (((v - 1) % 9 + 9) % 9) + 1
}

/**
 * Constrói uma grade de 9 palácios "voando" a partir de um valor semente num
 * palácio inicial, no sentido informado, seguindo o caminho de voo fixo.
 */
export function construirGridVoo(
  palacioSemente: Palacio,
  valorSemente: number,
  sentido: 'frente' | 'verso'
): Record<Palacio, number> {
  const idxSemente = CAMINHO_VOO.indexOf(palacioSemente)
  const delta = sentido === 'frente' ? 1 : -1
  const grid = {} as Record<Palacio, number>
  for (let passo = 0; passo < 9; passo++) {
    const palacio = CAMINHO_VOO[(idxSemente + passo) % 9]
    grid[palacio] = normalizar1a9(valorSemente + passo * delta)
  }
  return grid
}
