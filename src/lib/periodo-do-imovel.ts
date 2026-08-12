/**
 * Período (Yun 運) do imóvel a partir do **ano**, não da data.
 *
 * ## Por que o ano, e não a data
 *
 * A carta natal de Estrelas Voadoras usa o período da construção — ou o da
 * última reforma estrutural relevante (troca de telhado, remoção ou adição de
 * paredes estruturais, mudança da fachada), conforme
 * `docs/domain/fengshui-metodos-referencia.md` §1.5.
 *
 * O campo que existia era um `<input type="date">`. Um consultor sabe que o
 * prédio é «de 2024»; quase nunca sabe o dia. Preencher 01/01 para satisfazer o
 * campo não é um detalhe cosmético: o período usa o **ano solar**, que começa
 * no Li Chun (≈4 de fevereiro), então 2024-01-01 é ano solar 2023 e cai no
 * Período **8** — enquanto o imóvel «de 2024» que o consultor tinha em mente é
 * Período **9**. O campo obrigava a inventar um dado e o dado inventado mudava
 * a carta inteira.
 *
 * Aqui o ano é o que se pergunta, e a ambiguidade da virada é **declarada**,
 * não resolvida em silêncio: quando o ano informado é o primeiro de um período,
 * uma obra concluída em janeiro pertence ao período anterior, e só o consultor
 * sabe qual é o caso.
 */

import { INICIO_CICLO_SAN_YUAN, periodoDoAnoSolar } from './periodo-sanyuan'

/** Ninguém constrói antes do início do ciclo de referência que sabemos calcular. */
export const ANO_MINIMO_CONSTRUCAO = INICIO_CICLO_SAN_YUAN

/**
 * Teto folgado de propósito. Obra em andamento com entrega prevista é caso
 * real, e um limite colado no ano corrente viraria bug sozinho. Precisa casar
 * com o CHECK da migration 20260812140000.
 */
export const ANO_MAXIMO_CONSTRUCAO = 2200

const ANOS_POR_PERIODO = 20

export interface PeriodoDoAno {
  /** Período (1-9) para uma obra concluída a partir do Li Chun daquele ano. */
  periodo: number
  /**
   * `true` quando o ano informado é o primeiro de um período. Nesse caso uma
   * obra concluída antes do Li Chun (≈4 de fevereiro) pertence ao período
   * anterior, e o ano sozinho não distingue os dois casos.
   */
  ambiguo: boolean
  /** O período anterior, quando `ambiguo`. `null` fora da virada. */
  periodoAnterior: number | null
}

/**
 * Período do ciclo San Yuan a partir de um ano civil informado.
 *
 * Devolve `null` para ano ausente, não inteiro ou anterior a
 * `ANO_MINIMO_CONSTRUCAO` — fail-closed, como `periodoDaData`. Um ano no futuro
 * não é rejeitado aqui: obra em andamento com entrega prevista é caso real, e a
 * validação de intervalo é da tela.
 */
export function periodoDoAno(ano: number | null | undefined): PeriodoDoAno | null {
  if (typeof ano !== 'number' || !Number.isInteger(ano) || ano < ANO_MINIMO_CONSTRUCAO) return null

  const periodo = periodoDoAnoSolar(ano)
  const ambiguo = (ano - INICIO_CICLO_SAN_YUAN) % ANOS_POR_PERIODO === 0

  return {
    periodo,
    ambiguo,
    periodoAnterior: ambiguo ? periodoDoAnoSolar(ano - 1) : null,
  }
}

export interface PeriodoDoImovel extends PeriodoDoAno {
  /** Ano que determinou o período — o da reforma, quando há uma posterior. */
  anoUsado: number
  /** `true` quando o período veio da reforma estrutural, não da construção. */
  daReforma: boolean
}

/**
 * Período efetivo do imóvel: a reforma estrutural **posterior** à construção
 * substitui o período da construção (§1.5 do documento-mestre).
 *
 * Uma reforma anterior ao ano de construção é dado incoerente e é ignorada — o
 * período fica sendo o da construção. Não inventa correção nem falha em
 * silêncio: `periodoDoImovel` devolve o que dá para afirmar, e a tela cobra a
 * incoerência com `reformaIncoerente`.
 */
export function periodoDoImovel(dados: {
  anoConstrucao?: number | null
  anoReformaEstrutural?: number | null
}): PeriodoDoImovel | null {
  const { anoConstrucao, anoReformaEstrutural } = dados

  const construcao = periodoDoAno(anoConstrucao)
  const reforma = periodoDoAno(anoReformaEstrutural)

  const reformaVale = reforma !== null
    && typeof anoReformaEstrutural === 'number'
    && (anoConstrucao == null || anoReformaEstrutural >= anoConstrucao)

  if (reformaVale) {
    return { ...reforma, anoUsado: anoReformaEstrutural as number, daReforma: true }
  }
  if (construcao) {
    return { ...construcao, anoUsado: anoConstrucao as number, daReforma: false }
  }
  return null
}

/**
 * Período de uma consulta, preferindo as colunas ao campo legado.
 *
 * `bagua_entrada.data_construcao` continua sendo a única fonte das consultas
 * anteriores à migration 20260812140000, então o fallback fica. Dele só se
 * aproveita o **ano**: o dia costuma ser o 01/01 que o campo de data obrigava a
 * inventar, e usá-lo jogaria o imóvel para o período anterior na virada.
 */
export function periodoDaConsulta(consulta: {
  ano_construcao?: number | null
  ano_reforma_estrutural?: number | null
  bagua_entrada?: { data_construcao?: string } | null
}): PeriodoDoImovel | null {
  const dasColunas = periodoDoImovel({
    anoConstrucao: consulta.ano_construcao,
    anoReformaEstrutural: consulta.ano_reforma_estrutural,
  })
  if (dasColunas) return dasColunas

  const legado = consulta.bagua_entrada?.data_construcao
  if (typeof legado !== 'string') return null

  const ano = Number(legado.slice(0, 4))
  const doLegado = periodoDoAno(ano)
  return doLegado ? { ...doLegado, anoUsado: ano, daReforma: false } : null
}

/** `true` quando a reforma informada é anterior à construção — dado impossível. */
export function reformaIncoerente(dados: {
  anoConstrucao?: number | null
  anoReformaEstrutural?: number | null
}): boolean {
  const { anoConstrucao, anoReformaEstrutural } = dados
  return typeof anoConstrucao === 'number'
    && typeof anoReformaEstrutural === 'number'
    && anoReformaEstrutural < anoConstrucao
}

/**
 * «Período 9 (2024–2043)» — o intervalo é o que torna o número conferível.
 *
 * Recebe o **ano**, não o período: o ciclo tem 180 anos e se repete, então o
 * Período 1 é tanto 1864–1883 quanto 2044–2063. Só o ano diz qual das voltas.
 */
export function faixaDoPeriodo(ano: number): { inicio: number; fim: number } {
  const voltas = Math.floor((ano - INICIO_CICLO_SAN_YUAN) / ANOS_POR_PERIODO)
  const inicio = INICIO_CICLO_SAN_YUAN + voltas * ANOS_POR_PERIODO
  return { inicio, fim: inicio + ANOS_POR_PERIODO - 1 }
}
