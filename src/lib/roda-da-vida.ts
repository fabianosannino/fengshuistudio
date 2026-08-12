/**
 * Roda da Vida — a diferença entre «não respondi» e «respondi 5».
 *
 * ## O defeito que isto corrige
 *
 * `areaValue()` e `areaScores()` devolviam `5` (ou `[5,5,5,5,5]`) quando a área
 * não tinha resposta. Consequências, todas observáveis numa roda intocada:
 *
 * - o cabeçalho exibia «Média: 5.0», como se o cliente tivesse respondido;
 * - o polígono desenhava um octógono cheio, sugerindo diagnóstico completo;
 * - o comparativo «percepção do cliente × análise do imóvel» — a ideia mais
 *   original da plataforma — cruzava o Ba Guá com números que ninguém informou.
 *
 * Cinco é o meio da escala, então o erro não parece erro: parece uma vida
 * mediana. É a mesma classe de defeito do ADR 0020, onde `new Date(null)`
 * virava «01/01/1970» — ausência de dado apresentada como dado plausível.
 *
 * ## A regra
 *
 * Área sem resposta é `null`, e `null` não entra em média, não vira vértice e
 * não alimenta comparativo. A tela informa quantas áreas faltam, em vez de
 * preencher o buraco por conta própria.
 */

/** Como uma área chega do banco: array novo, número legado, ou nada. */
export type RespostaDeArea = number[] | number | null | undefined

/** Mapa área → resposta, como está gravado em `consultas.roda_da_vida`. */
export type RespostasDaRoda = Record<string, RespostaDeArea>

/** `true` se a área tem resposta utilizável. Array vazio não conta. */
export function areaRespondida(valor: RespostaDeArea): boolean {
  if (Array.isArray(valor)) return valor.length > 0 && valor.some(n => typeof n === 'number')
  return typeof valor === 'number'
}

/**
 * Média de uma área, ou `null` se não respondida.
 *
 * No formato de array, considera só as posições preenchidas — responder 3 das 5
 * perguntas de uma área dá a média das 3, não das 5 com dois zeros.
 */
export function mediaDaArea(valor: RespostaDeArea): number | null {
  if (typeof valor === 'number') return valor
  if (!Array.isArray(valor)) return null

  const numeros = valor.filter((n): n is number => typeof n === 'number')
  if (numeros.length === 0) return null
  return numeros.reduce((s, n) => s + n, 0) / numeros.length
}

/**
 * Notas de uma área para exibição, com `null` onde não houve resposta.
 *
 * O número legado vira o mesmo valor repetido — é como era gravado antes de a
 * área virar cinco perguntas, e o valor é real, não presumido.
 */
export function notasDaArea(valor: RespostaDeArea, quantidade = 5): (number | null)[] {
  if (Array.isArray(valor)) {
    return Array.from({ length: quantidade }, (_, i) =>
      typeof valor[i] === 'number' ? valor[i] : null
    )
  }
  if (typeof valor === 'number') return Array.from({ length: quantidade }, () => valor)
  return Array.from({ length: quantidade }, () => null)
}

/** Chaves das áreas que têm resposta, na ordem recebida. */
export function areasRespondidas(respostas: RespostasDaRoda, chaves: string[]): string[] {
  return chaves.filter(k => areaRespondida(respostas[k]))
}

/**
 * Média geral, contando **só** as áreas respondidas. `null` quando nenhuma foi.
 */
export function mediaGeral(respostas: RespostasDaRoda, chaves: string[]): number | null {
  const medias = chaves
    .map(k => mediaDaArea(respostas[k]))
    .filter((m): m is number => m !== null)

  if (medias.length === 0) return null
  return medias.reduce((s, m) => s + m, 0) / medias.length
}

/** Média de um subconjunto (uma categoria). Mesma regra da geral. */
export function mediaDaCategoria(respostas: RespostasDaRoda, chaves: string[]): number | null {
  return mediaGeral(respostas, chaves)
}

export interface ProgressoDaRoda {
  respondidas: number
  total: number
  completa: boolean
  /** «7 de 12 áreas respondidas» — o texto que substitui a média falsa. */
  texto: string
}

export function progressoDaRoda(respostas: RespostasDaRoda, chaves: string[]): ProgressoDaRoda {
  const respondidas = areasRespondidas(respostas, chaves).length
  const total = chaves.length
  return {
    respondidas,
    total,
    completa: respondidas === total,
    texto: respondidas === 0
      ? `Nenhuma das ${total} áreas respondida`
      : `${respondidas} de ${total} áreas respondidas`,
  }
}

/**
 * Pares para o comparativo «percepção do cliente × análise do imóvel».
 *
 * Só entram áreas respondidas **e** com score de setor disponível: comparar com
 * um dos dois lados ausente produz divergência inventada, que é pior que
 * divergência nenhuma.
 */
export interface ParComparativo {
  chave: string
  vida: number
  imovel: number
  /** Positivo: o imóvel pontua acima da percepção do cliente. */
  diferenca: number
}

export function paresComparaveis(
  respostas: RespostasDaRoda,
  scoresPorArea: Record<string, number | null | undefined>,
  chaves: string[]
): ParComparativo[] {
  const pares: ParComparativo[] = []

  for (const chave of chaves) {
    const vida = mediaDaArea(respostas[chave])
    const imovelBruto = scoresPorArea[chave]
    if (vida === null || typeof imovelBruto !== 'number') continue

    pares.push({ chave, vida, imovel: imovelBruto, diferenca: imovelBruto - vida })
  }

  return pares
}
