/**
 * Experimento de Estrelas Voadoras em oito octantes.
 * A regra simplificada de paridade não implementa a carta clássica de
 * 24 montanhas, suas regras de voo e exceções. Não usar isoladamente para
 * prescrições. A grade do período é distinta das hipóteses deste experimento.
 * Nenhuma validação independente da carta completa é alegada aqui.
 */

import { NOME_ELEMENTO, type Elemento } from './cinco-elementos'
import { CAMINHO_VOO, construirGridVoo, type Palacio } from './lo-shu'
import { periodoDaData } from './periodo-sanyuan'

export type { Palacio }

/** Octante (0=N,1=NE,...,7=NW, mesma convenção de bagua-grid.ts/oito-mansoes.ts) → palácio. */
const PALACIO_POR_OCTANTE: Palacio[] = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']

const PALACIO_OPOSTO: Record<Palacio, Palacio> = {
  C: 'C', N: 'S', S: 'N', E: 'W', W: 'E', NE: 'SW', SW: 'NE', SE: 'NW', NW: 'SE',
}

/** Elemento clássico de cada número Lo Shu (1-9) — mesmo mapa usado em todo o sistema. */
const ELEMENTO_DO_NUMERO: Record<number, Elemento> = {
  1: 'agua', 2: 'terra', 3: 'madeira', 4: 'madeira', 5: 'terra',
  6: 'metal', 7: 'metal', 8: 'terra', 9: 'fogo',
}

function octanteDaOrientacao(graus: number): number {
  const normalizado = ((graus % 360) + 360) % 360
  return Math.round(normalizado / 45) % 8
}

/**
 * Período de construção (1-9) a partir da data (ISO 'yyyy-mm-dd' ou Date).
 * Alias de `periodoDaData` (src/lib/periodo-sanyuan.ts), mantido aqui para
 * não quebrar os call sites existentes (app/bagua-planta, relatório).
 */
export const periodoDaConstrucao = periodoDaData

export interface Palacio3Estrelas {
  palacio: Palacio
  /** Estrela da Montanha (山星) — energia das pessoas/saúde. */
  montanha: number
  /** Estrela do Período (運星) — contexto temporal fixo do período. */
  periodo: number
  /** Estrela da Fachada (向星) — energia de recursos/oportunidades. */
  fachada: number
  /** true quando alguma das 3 estrelas é o número 5 (Wu Huang) — sinalização deste experimento, não diagnóstico independente. */
  temEstrela5: boolean
}

export interface MapaEstrelasVoadoras {
  periodo: number
  facingOctante: number
  palacios: Palacio3Estrelas[]
}

/**
 * Mapa simplificado por octantes, não carta clássica completa. Precisa da orientação da fachada (0-359°, mesma
 * captura da Bússola) e do período (derive com `periodoDaConstrucao` ou
 * informe direto). Devolve null se faltar dado — fail-closed.
 */
export function calcularEstrelasVoadoras(opcoes: { facingGraus: number | null | undefined; periodo: number | null }): MapaEstrelasVoadoras | null {
  const { facingGraus, periodo } = opcoes
  if (typeof facingGraus !== 'number' || !Number.isFinite(facingGraus) || periodo == null || !Number.isInteger(periodo) || periodo < 1 || periodo > 9) return null

  const facingOctante = octanteDaOrientacao(facingGraus)
  const palacioFachada = PALACIO_POR_OCTANTE[facingOctante]
  const palacioMontanha = PALACIO_OPOSTO[palacioFachada]

  const gridPeriodo = construirGridVoo('C', periodo, 'frente')

  const seedFachada = gridPeriodo[palacioFachada]
  const seedMontanha = gridPeriodo[palacioMontanha]
  const gridFachada = construirGridVoo(palacioFachada, seedFachada, seedFachada % 2 === 1 ? 'frente' : 'verso')
  const gridMontanha = construirGridVoo(palacioMontanha, seedMontanha, seedMontanha % 2 === 1 ? 'frente' : 'verso')

  const palacios: Palacio3Estrelas[] = CAMINHO_VOO.map(palacio => {
    const montanha = gridMontanha[palacio]
    const periodoP = gridPeriodo[palacio]
    const fachada = gridFachada[palacio]
    return { palacio, montanha, periodo: periodoP, fachada, temEstrela5: montanha === 5 || periodoP === 5 || fachada === 5 }
  })

  return { periodo, facingOctante, palacios }
}

export function nomeElementoDoNumero(n: number): string {
  return NOME_ELEMENTO[ELEMENTO_DO_NUMERO[n]]
}
