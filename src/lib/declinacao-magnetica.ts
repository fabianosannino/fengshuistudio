/**
 * Referência de Norte (magnético vs. verdadeiro) e conversão entre as duas.
 *
 * Por que isto existe: o Luo Pan é um instrumento magnético e a tradição
 * clássica lê **Norte magnético**. Leituras derivadas de mapa/satélite são
 * **Norte verdadeiro** (Web Mercator). No Brasil a declinação vai de ~−23°
 * (RS) a ~−8° (NE) — diferença de **1 a 2 Montanhas das 24**. Misturar as
 * duas referências sem declarar qual é qual invalida a carta silenciosamente.
 *
 * Convenção de sinal (padrão internacional, IGRF/WMM): declinação é
 * **positiva para Leste**. No Brasil ela é negativa (Oeste).
 *
 *   verdadeiro = magnético + declinação
 *   magnético  = verdadeiro − declinação
 *
 * ─── O QUE ESTE MÓDULO DELIBERADAMENTE **NÃO** FAZ ───────────────────────
 *
 * Não calcula a declinação a partir de lat/long/data. Isso exigiria o modelo
 * WMM ou IGRF, cujo núcleo é uma tabela oficial de ~90 coeficientes
 * harmônicos esféricos de Gauss, revisada a cada 5 anos. Essa tabela não foi
 * obtida de fonte primária (ver ADR 0014) e reproduzi-la de memória seria o
 * mesmo erro que o documento de referência alerta para as tabelas de San He e
 * Xuan Kong Da Gua — com um agravante: um coeficiente errado não falha de
 * forma visível, só devolve um número plausível e errado.
 *
 * Em vez disso, a declinação é um **dado informado** pelo consultor (obtido
 * na calculadora oficial do NOAA/IGRF para o endereço do imóvel). A
 * conversão em si — que é aritmética trivial e inequívoca — mora aqui.
 */

import { normalizarGraus } from './graus'

/** Referência de Norte de uma leitura de orientação. */
export type ReferenciaNorte = 'magnetico' | 'verdadeiro'

/** Calculadora oficial de declinação — mostrada na UI para o consultor obter o valor. */
export const URL_CALCULADORA_DECLINACAO = 'https://www.ngdc.noaa.gov/geomag/calculators/magcalc.shtml'

/**
 * Faixa plausível de declinação no mundo (graus). Fora disso é quase certo
 * erro de digitação (ex.: informar 180 em vez de −18), e vale barrar em vez
 * de deslocar a carta em meio círculo silenciosamente.
 *
 * O limite real do modelo é ±180° perto dos polos magnéticos, mas para uso
 * em imóveis habitados ±60° já é folgadíssimo — o Brasil inteiro cabe em
 * −23°..−8°.
 */
export const DECLINACAO_MIN = -60
export const DECLINACAO_MAX = 60

export function declinacaoPlausivel(declinacao: number): boolean {
  return Number.isFinite(declinacao) && declinacao >= DECLINACAO_MIN && declinacao <= DECLINACAO_MAX
}

/** Converte uma leitura magnética para Norte verdadeiro. */
export function magneticoParaVerdadeiro(grausMagneticos: number, declinacao: number): number {
  return normalizarGraus(grausMagneticos + declinacao)
}

/** Converte uma leitura de Norte verdadeiro para magnética (a referência clássica do Luo Pan). */
export function verdadeiroParaMagnetico(grausVerdadeiros: number, declinacao: number): number {
  return normalizarGraus(grausVerdadeiros - declinacao)
}

/**
 * Uma leitura de orientação com sua proveniência. É este objeto que resolve o
 * problema real: sem `referencia`, um número solto de graus é ambíguo.
 */
export interface LeituraOrientacao {
  graus: number
  referencia: ReferenciaNorte
  /** Declinação usada/aplicável, em graus (E positivo). null = desconhecida. */
  declinacao: number | null
}

/**
 * Converte uma leitura para a referência desejada.
 *
 * Fail-closed e explícito: se a conversão exigir declinação e ela não for
 * conhecida (ou for implausível), devolve `null` em vez de assumir zero.
 * Assumir declinação zero é o erro exato que este módulo existe para
 * impedir — no Brasil equivaleria a errar de 1 a 2 Montanhas.
 */
export function converterLeitura(
  leitura: LeituraOrientacao,
  destino: ReferenciaNorte,
): LeituraOrientacao | null {
  if (leitura.referencia === destino) return leitura

  const { declinacao } = leitura
  if (declinacao == null || !declinacaoPlausivel(declinacao)) return null

  const graus = destino === 'verdadeiro'
    ? magneticoParaVerdadeiro(leitura.graus, declinacao)
    : verdadeiroParaMagnetico(leitura.graus, declinacao)

  return { graus, referencia: destino, declinacao }
}

const ROTULO_REFERENCIA: Record<ReferenciaNorte, string> = {
  magnetico: 'magnético',
  verdadeiro: 'verdadeiro',
}

export function rotuloReferencia(referencia: ReferenciaNorte): string {
  return ROTULO_REFERENCIA[referencia]
}

/**
 * Texto de exibição de uma leitura, sempre declarando a referência — para a
 * UI nunca mostrar um grau "pelado" e ambíguo.
 */
export function descreverLeitura(leitura: LeituraOrientacao): string {
  return `${leitura.graus.toFixed(1)}° (Norte ${rotuloReferencia(leitura.referencia)})`
}
