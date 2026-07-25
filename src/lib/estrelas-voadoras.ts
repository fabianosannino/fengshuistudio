/**
 * Estrelas Voadoras (Xuan Kong Fei Xing, 玄空飛星) — mapa natal base do imóvel.
 *
 * ESCOPO DESTE MÓDULO (deliberadamente limitado ao núcleo consensual do
 * método San Yuan Xuan Kong):
 *   1. Período de construção (元運) — de 1 a 9, ciclos de 20 anos.
 *   2. Grade do Período — os 9 números do Lo Shu "voando" a partir do centro.
 *   3. Estrela da Montanha (山星) e Estrela da Fachada (向星) — derivadas da
 *      grade do período pela regra padrão de voo par/ímpar.
 *
 * FORA DE ESCOPO — não implementado, de propósito:
 *   - Estrela de substituição (替卦/Xuan Kong Da Gua) para fachadas muito
 *     próximas do limite de um setor de 45°; aqui a fachada é sempre
 *     arredondada para o octante mais próximo (mesma granularidade da
 *     Bússola/Oito Mansões).
 *   - Estrelas anuais/mensais (sobreposição temporal).
 *   - Teoria de combinações de estrelas (interpretação além do básico
 *     universalmente aceito, como a cautela com a Estrela 5).
 *   - Ajuste de declinação magnética.
 *   Essas peças têm variação real entre escolas/autores; strongly recomenda-se
 *   validação por um consultor com formação em Xuan Kong antes de uso
 *   comercial com clientes.
 *
 * Base matemática (não-controversa, mesmo quadrado Lo Shu de oito-mansoes.ts):
 * o "caminho de voo" é uma sequência fixa de 9 posições (Centro, depois as 8
 * direções em ordem específica) por onde os números 1-9 sempre circulam.
 * Verificado por reconstrução manual contra a carta do Período 8 amplamente
 * publicada (ver testes) — bate exatamente.
 */

import { NOME_ELEMENTO, type Elemento } from './cinco-elementos'

export type Palacio = 'C' | 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW'

/** Caminho físico fixo por onde os números voam (sempre nesta ordem, cíclica). */
const CAMINHO_VOO: Palacio[] = ['C', 'NW', 'W', 'NE', 'S', 'N', 'SW', 'E', 'SE']

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

function normalizar1a9(v: number): number {
  return (((v - 1) % 9 + 9) % 9) + 1
}

function octanteDaOrientacao(graus: number): number {
  const normalizado = ((graus % 360) + 360) % 360
  return Math.round(normalizado / 45) % 8
}

/**
 * Constrói uma grade de 9 palácios "voando" a partir de um valor semente num
 * palácio inicial, no sentido informado, seguindo o caminho de voo fixo.
 */
function construirGrid(palacioSemente: Palacio, valorSemente: number, sentido: 'frente' | 'verso'): Record<Palacio, number> {
  const idxSemente = CAMINHO_VOO.indexOf(palacioSemente)
  const delta = sentido === 'frente' ? 1 : -1
  const grid = {} as Record<Palacio, number>
  for (let passo = 0; passo < 9; passo++) {
    const palacio = CAMINHO_VOO[(idxSemente + passo) % 9]
    grid[palacio] = normalizar1a9(valorSemente + passo * delta)
  }
  return grid
}

/**
 * Período de construção (1-9) a partir da data (ISO 'yyyy-mm-dd' ou Date).
 * Ano SOLAR chinês: antes do Li Chun (~4 de fevereiro) conta o ano anterior
 * (mesma regra do Ming Gua). Fórmula cíclica (não tabela hardcoded) — âncora
 * verificável: Período 8 começou em 2004, Período 9 em 2024.
 */
export function periodoDaConstrucao(data: string | Date | null | undefined): number | null {
  if (!data) return null
  let ano: number, mes: number, dia: number
  if (typeof data === 'string') {
    const m = data.match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (!m) return null
    ano = Number(m[1]); mes = Number(m[2]); dia = Number(m[3])
  } else {
    if (isNaN(data.getTime())) return null
    ano = data.getFullYear(); mes = data.getMonth() + 1; dia = data.getDate()
  }
  if (ano < 1864) return null // início do ciclo de referência usado pelo método

  const anoSolar = mes < 2 || (mes === 2 && dia < 4) ? ano - 1 : ano
  const anosDesde1864 = anoSolar - 1864
  return (Math.floor(anosDesde1864 / 20) % 9) + 1
}

export interface Palacio3Estrelas {
  palacio: Palacio
  /** Estrela da Montanha (山星) — energia das pessoas/saúde. */
  montanha: number
  /** Estrela do Período (運星) — contexto temporal fixo do período. */
  periodo: number
  /** Estrela da Fachada (向星) — energia de recursos/oportunidades. */
  fachada: number
  /** true quando alguma das 3 estrelas é o número 5 (Wu Huang) — cautela universal, sem exceção entre escolas. */
  temEstrela5: boolean
}

export interface MapaEstrelasVoadoras {
  periodo: number
  facingOctante: number
  palacios: Palacio3Estrelas[]
}

/**
 * Mapa natal completo. Precisa da orientação da fachada (0-359°, mesma
 * captura da Bússola) e do período (derive com `periodoDaConstrucao` ou
 * informe direto). Devolve null se faltar dado — fail-closed.
 */
export function calcularEstrelasVoadoras(opcoes: { facingGraus: number; periodo: number | null }): MapaEstrelasVoadoras | null {
  const { facingGraus, periodo } = opcoes
  if (periodo == null || periodo < 1 || periodo > 9) return null

  const facingOctante = octanteDaOrientacao(facingGraus)
  const palacioFachada = PALACIO_POR_OCTANTE[facingOctante]
  const palacioMontanha = PALACIO_OPOSTO[palacioFachada]

  const gridPeriodo = construirGrid('C', periodo, 'frente')

  const seedFachada = gridPeriodo[palacioFachada]
  const seedMontanha = gridPeriodo[palacioMontanha]
  const gridFachada = construirGrid(palacioFachada, seedFachada, seedFachada % 2 === 1 ? 'frente' : 'verso')
  const gridMontanha = construirGrid(palacioMontanha, seedMontanha, seedMontanha % 2 === 1 ? 'frente' : 'verso')

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
