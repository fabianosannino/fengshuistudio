/**
 * Processamento de amostras da bússola virtual (Modo B de orientação,
 * fengshui-metodos-referencia.md §2.3 — magnetômetro do dispositivo via
 * `DeviceOrientationEvent`).
 *
 * Este módulo é puro (sem DOM/browser APIs) — quem lê o sensor (componente
 * React) só entrega um array de graus brutos; toda a matemática de
 * rejeição de outlier e classificação de confiança mora aqui, testável
 * sem simular eventos de dispositivo.
 *
 * Escopo deliberadamente EXCLUÍDO deste módulo (documentado, não omitido
 * por descuido): detecção de interferência magnética por magnitude do
 * campo (µT). Isso exigiria a Generic Sensor API `Magnetometer`, que tem
 * suporte de navegador extremamente limitado/inconsistente (praticamente
 * só Chrome/Android atrás de Permissions-Policy, ausente em Safari/
 * Firefox) — implementar hoje seria uma feature que não funciona na
 * maioria dos aparelhos reais dos usuários. Ver ADR 0011.
 */

import { mediaCircular, desvioCircular, distanciaCircular } from './graus'

export type ConfiancaBussola = 'high' | 'medium' | 'low'

export interface ResultadoAmostragemBussola {
  /** Média circular das amostras aceitas (após rejeição de outliers), ou null se não houve nenhuma amostra. */
  media: number | null
  /** Maior distância circular entre uma amostra aceita e a média — usada para classificar a confiança. */
  desvio: number | null
  amostrasTotais: number
  amostrasUsadas: number
  amostrasDescartadas: number
  confianca: ConfiancaBussola | null
}

/** desvio ≤ 2° → confiança alta (fengshui-metodos-referencia.md §2.3). */
const LIMIAR_CONFIANCA_ALTA_GRAUS = 2
/** desvio > 5° → confiança baixa, a UI deve bloquear o uso direto da leitura. */
const LIMIAR_CONFIANCA_BAIXA_GRAUS = 5

/**
 * Detecção de outlier por MAD (Median Absolute Deviation) via z-score
 * modificado (Iglewicz & Hoaglin) — método padrão de estatística robusta,
 * não um ajuste ad-hoc. Aplicado às DISTÂNCIAS CIRCULARES de cada amostra
 * até a média circular do conjunto inteiro (não ao valor bruto em graus),
 * porque distância é sempre um número linear não-negativo — evita
 * qualquer problema de "mediana" perto da descontinuidade 359°/0°.
 *
 * z_i = 0.6745 * |d_i − mediana(d)| / MAD(d); outlier se z_i > 3.5.
 *
 * Limitação documentada: é um único passe em relação à média do conjunto
 * completo (não recentra iterativamente). Com poucas amostras e um
 * outlier muito extremo, a média inicial pode ficar puxada o bastante
 * para mascarar o próprio outlier. Para o uso real (~50 amostras em 5s,
 * poucos outliers de interferência pontual) isso não é um problema
 * prático — testado com essa proporção realista, não só com casos de
 * brinquedo.
 */
function indicesSemOutliers(amostras: number[], media: number): number[] {
  const distancias = amostras.map(a => distanciaCircular(a, media))
  const ordenadas = [...distancias].sort((a, b) => a - b)
  const mediana = ordenadas[Math.floor(ordenadas.length / 2)]
  const desviosAbsolutos = distancias.map(d => Math.abs(d - mediana))
  const mad = [...desviosAbsolutos].sort((a, b) => a - b)[Math.floor(desviosAbsolutos.length / 2)]

  // MAD=0 significa que a MAIORIA das amostras está exatamente no valor
  // mediano (comum na prática: eventos consecutivos do sensor repetindo o
  // mesmo grau por throttling) — não que "não há outlier". Qualquer
  // amostra que desvie desse valor exato É o outlier; dividir por MAD=0
  // daria infinito, então esse caso precisa de uma regra própria.
  if (mad === 0) {
    return desviosAbsolutos.map((d, i) => (d === 0 ? i : -1)).filter(i => i !== -1)
  }

  const FATOR_MAD = 0.6745
  const LIMIAR_Z_MODIFICADO = 3.5
  return distancias
    .map((_, i) => i)
    .filter(i => (FATOR_MAD * Math.abs(distancias[i] - mediana)) / mad <= LIMIAR_Z_MODIFICADO)
}

function classificarConfianca(desvio: number): ConfiancaBussola {
  if (desvio <= LIMIAR_CONFIANCA_ALTA_GRAUS) return 'high'
  if (desvio <= LIMIAR_CONFIANCA_BAIXA_GRAUS) return 'medium'
  return 'low'
}

/**
 * Processa um lote de amostras brutas (graus, 0–360) coletadas do sensor:
 * rejeita outliers, calcula média/desvio circular do restante e classifica
 * a confiança. Fail-closed: array vazio devolve tudo null/0, nunca inventa
 * um resultado.
 */
export function processarAmostrasBussola(amostras: number[]): ResultadoAmostragemBussola {
  if (amostras.length === 0) {
    return { media: null, desvio: null, amostrasTotais: 0, amostrasUsadas: 0, amostrasDescartadas: 0, confianca: null }
  }

  const mediaInicial = mediaCircular(amostras)!
  const indicesAceitos = indicesSemOutliers(amostras, mediaInicial)
  // Nunca deixa a rejeição zerar o conjunto inteiro (caso degenerado com muito poucas amostras).
  const amostrasAceitas = indicesAceitos.length > 0 ? indicesAceitos.map(i => amostras[i]) : amostras

  const media = mediaCircular(amostrasAceitas)!
  const desvio = desvioCircular(amostrasAceitas)!

  return {
    media,
    desvio,
    amostrasTotais: amostras.length,
    amostrasUsadas: amostrasAceitas.length,
    amostrasDescartadas: amostras.length - amostrasAceitas.length,
    confianca: classificarConfianca(desvio),
  }
}
