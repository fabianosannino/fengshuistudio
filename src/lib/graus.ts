/**
 * Aritmética de graus (0–360°) em círculo — base de qualquer leitura de
 * orientação (bússola, mapa) usada pelos métodos de Feng Shui.
 *
 * Graus NUNCA se somam/reduzem como números lineares: 359° e 1° estão a
 * 2° de distância, não a 358°, e a "média" dos dois é 0°, não 180°. Toda
 * essa aritmética precisa passar pelas funções daqui — nunca reimplementar
 * `(a + b) / 2` ou `Math.abs(a - b)` diretamente num cálculo de orientação.
 */

const GRAUS_NO_CIRCULO = 360

/** Normaliza qualquer valor (incluindo negativos) para o intervalo [0, 360). */
export function normalizarGraus(graus: number): number {
  return ((graus % GRAUS_NO_CIRCULO) + GRAUS_NO_CIRCULO) % GRAUS_NO_CIRCULO
}

/** Menor distância angular entre dois graus, sempre em [0, 180]. */
export function distanciaCircular(a: number, b: number): number {
  const diff = Math.abs(normalizarGraus(a) - normalizarGraus(b))
  return diff > GRAUS_NO_CIRCULO / 2 ? GRAUS_NO_CIRCULO - diff : diff
}

/**
 * Média circular de um conjunto de leituras, via atan2(Σsinθ, Σcosθ).
 * Necessária porque a média aritmética falha perto do 0°/360°: a média
 * "ingênua" de 359° e 1° dá 180° (o oposto), quando o correto é 0°.
 * Devolve null para lista vazia — fail-closed, nunca chuta um valor.
 */
export function mediaCircular(amostrasGraus: number[]): number | null {
  if (amostrasGraus.length === 0) return null
  let somaSeno = 0
  let somaCosseno = 0
  for (const graus of amostrasGraus) {
    const rad = (graus * Math.PI) / 180
    somaSeno += Math.sin(rad)
    somaCosseno += Math.cos(rad)
  }
  const mediaRad = Math.atan2(somaSeno, somaCosseno)
  return normalizarGraus((mediaRad * 180) / Math.PI)
}

/**
 * Dispersão das amostras: maior distância circular entre qualquer amostra
 * e a média circular do conjunto. Usada para decidir o nível de confiança
 * de uma leitura (ex.: bússola virtual com várias amostras).
 */
export function desvioCircular(amostrasGraus: number[]): number | null {
  const media = mediaCircular(amostrasGraus)
  if (media === null) return null
  return Math.max(...amostrasGraus.map(g => distanciaCircular(g, media)))
}
