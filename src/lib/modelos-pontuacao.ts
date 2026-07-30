/**
 * Modelos de pontuação de setor — escolhidos pelo consultor, declarados no
 * relatório.
 *
 * ## Por que isto existe
 *
 * A fórmula anterior era `geo + Σ(critérios em −2..+2)`: somava um **desvio**
 * (−16 a +16) a um **nível** já completo (`geo = 100 − faltaPct − excessoPct`,
 * ver `bagua-planta`). Erro de categoria, como somar «+3 °C» a «72%». Efeitos:
 *
 * - imóvel inteiramente neutro saía **100%**;
 * - acima do neutro passava de 100 (medido: 102%);
 * - o valor ficava preso entre ~84 e ~116, então as faixas de «urgente» e
 *   «atenção» eram inalcançáveis — nem com os oito critérios em «Crítico».
 *
 * ## O que a prática de medição pede
 *
 * Normalizar cada dimensão para 0–100 antes de agregar (POMP — *percent of
 * maximum possible*), e não deixar uma dimensão compensar totalmente a outra
 * quando isso esconde problema. Daí os quatro modelos abaixo.
 *
 * ## O que NÃO vem da tradição
 *
 * Nenhuma escola de Feng Shui quantifica setor em percentual. Este número é
 * instrumento do produto, não leitura clássica — e o relatório diz isso.
 */

/** Índice do botão na UI: 0='Crítico' … 4='Ótimo'. `null` = não avaliado. */
export type NotaCriterio = 0 | 1 | 2 | 3 | 4
export const NOTA_MAXIMA = 4
export const NOTA_NEUTRA = 2

export type IdModeloPontuacao =
  | 'fisico-puro'
  | 'geometrico-puro'
  | 'composto-ponderado'
  | 'composto-conservador'

export const MODELO_PADRAO: IdModeloPontuacao = 'composto-conservador'

/** Peso da geometria no composto ponderado. */
export const PESO_GEO_PADRAO = 0.5

export type IdFaixa = 'urgente' | 'atencao' | 'manter'

/**
 * Cortes de classificação.
 *
 * Herdados do código existente (`relatorio/page.tsx`, filtro de `urgentes`:
 * `< 40`, `atencao`: `40–70`, `manter`: `>= 70`). São **parâmetro de produto**,
 * não constante do domínio — foram mantidos em vez de inventar números novos.
 * Havia um segundo conjunto contraditório na mesma tela (60/80); este unifica.
 */
export const CORTE_URGENTE = 40
export const CORTE_ATENCAO = 70

export interface EntradaPontuacao {
  /** Uma posição por critério, na ordem de `CRITERIOS`. `null` = não avaliado. */
  criterios: readonly (NotaCriterio | null)[]
  /** `100 − faltaPct − excessoPct`. Já é 0–100; pode vir negativo. */
  geo: number
  /** Peso da geometria no composto ponderado (0–1). */
  pesoGeo?: number
}

export interface Pontuacao {
  /** `null` significa «não sei» — nunca 0 nem 100 por omissão. */
  valor: number | null
  /** Estado físico normalizado 0–100. `null` se nada foi avaliado. */
  fisico: number | null
  /** Geometria normalizada 0–100. `null` se a medição não é utilizável. */
  geometria: number | null
  criteriosAvaliados: number
  criteriosTotal: number
  faixa: IdFaixa | null
  /** Linha de procedência para o relatório do cliente. */
  procedencia: string
}

export interface ModeloPontuacao {
  id: IdModeloPontuacao
  nome: string
  /** Mostrado ao consultor na escolha. */
  descricao: string
  /** Impressa no relatório, ao lado do número. */
  formula: string
  /** `null` quando o modelo não tem como responder com o que foi coletado. */
  calcular: (e: EntradaPontuacao) => number | null
}

const limitar = (v: number) => Math.max(0, Math.min(100, v))

/**
 * Estado físico como POMP: média dos critérios avaliados, reescalada a 0–100.
 *
 * Só os avaliados entram. Tudo «Neutro» dá **50**, não 100 — é o ponto médio de
 * uma escala bipolar, e chamar isso de perfeito era o defeito original.
 */
export function pontuacaoFisica(criterios: readonly (NotaCriterio | null)[]): number | null {
  const notas = criterios.filter((n): n is NotaCriterio => n !== null)
  if (notas.length === 0) return null
  const soma = notas.reduce<number>((a, n) => a + n, 0)
  return Math.round((soma / (notas.length * NOTA_MAXIMA)) * 100)
}

/**
 * Geometria já vem 0–100; só limita a faixa (falta+excesso pode passar de 100%).
 *
 * Valor não finito devolve `null`, não 0: `NaN` ou `Infinity` não são medições,
 * e responder 0 afirmaria «urgente» a partir de lixo. Aqui, como no resto do
 * módulo, `null` é «não sei».
 */
export function pontuacaoGeometrica(geo: number): number | null {
  return Number.isFinite(geo) ? limitar(Math.round(geo)) : null
}

export const MODELOS: Record<IdModeloPontuacao, ModeloPontuacao> = {
  'fisico-puro': {
    id: 'fisico-puro',
    nome: 'Estado físico',
    descricao: 'Só o que foi observado no ambiente. A planta serve de referência, não entra na nota.',
    formula: 'média dos critérios avaliados',
    calcular: e => pontuacaoFisica(e.criterios),
  },
  'geometrico-puro': {
    id: 'geometrico-puro',
    nome: 'Geométrico',
    descricao: 'Só falta e excesso de área do setor. Use quando o estado físico é tratado fora do sistema.',
    formula: '100 − falta% − excesso%',
    calcular: e => pontuacaoGeometrica(e.geo),
  },
  'composto-ponderado': {
    id: 'composto-ponderado',
    nome: 'Composto ponderado',
    descricao: 'Combina geometria e estado físico com o peso que você definir (padrão 50/50).',
    formula: 'peso × geometria + (1 − peso) × estado físico',
    calcular: e => {
      const fis = pontuacaoFisica(e.criterios)
      const geo = pontuacaoGeometrica(e.geo)
      if (fis === null || geo === null) return null
      const w = Math.max(0, Math.min(1, e.pesoGeo ?? PESO_GEO_PADRAO))
      return Math.round(w * geo + (1 - w) * fis)
    },
  },
  'composto-conservador': {
    id: 'composto-conservador',
    nome: 'Composto conservador',
    descricao: 'Média geométrica: geometria boa não mascara conservação ruim, e vice-versa.',
    formula: '√(geometria × estado físico)',
    calcular: e => {
      const fis = pontuacaoFisica(e.criterios)
      const geo = pontuacaoGeometrica(e.geo)
      if (fis === null || geo === null) return null
      return Math.round(Math.sqrt(geo * fis))
    },
  },
}

export function faixaDe(valor: number | null): IdFaixa | null {
  if (valor === null) return null
  if (valor < CORTE_URGENTE) return 'urgente'
  if (valor < CORTE_ATENCAO) return 'atencao'
  return 'manter'
}

export const ROTULO_FAIXA: Record<IdFaixa, string> = {
  urgente: 'Urgente',
  atencao: 'Atenção',
  manter: 'Manter',
}

export function modeloValido(id: string | null | undefined): IdModeloPontuacao {
  return id && id in MODELOS ? (id as IdModeloPontuacao) : MODELO_PADRAO
}

/**
 * Calcula e monta a procedência.
 *
 * A linha de procedência é o que torna a escolha de modelo aceitável: sem ela,
 * dois consultores publicam números diferentes para o mesmo imóvel e ninguém
 * sabe por quê. Vai impressa no relatório do cliente, então não cita arquivo de
 * código nem jargão interno.
 */
export function calcularPontuacao(
  idModelo: IdModeloPontuacao,
  entrada: EntradaPontuacao,
): Pontuacao {
  const modelo = MODELOS[modeloValido(idModelo)]
  const fisico = pontuacaoFisica(entrada.criterios)
  const geometria = pontuacaoGeometrica(entrada.geo)
  const valor = modelo.calcular(entrada)
  const avaliados = entrada.criterios.filter(n => n !== null).length
  const total = entrada.criterios.length

  const partes = [`${modelo.nome} — ${modelo.formula}`]
  if (modelo.id !== 'fisico-puro') {
    partes.push(geometria === null
      ? 'geometria não determinada'
      : `geometria ${geometria}%`)
  }
  if (modelo.id !== 'geometrico-puro') {
    partes.push(fisico === null
      ? 'estado físico não avaliado'
      : `estado físico ${fisico}%`)
  }
  if (modelo.id === 'composto-ponderado') {
    const w = Math.max(0, Math.min(1, entrada.pesoGeo ?? PESO_GEO_PADRAO))
    partes.push(`peso da geometria ${Math.round(w * 100)}%`)
  }
  if (modelo.id !== 'geometrico-puro') {
    partes.push(`${avaliados} de ${total} critérios avaliados`)
  }

  return {
    valor,
    fisico,
    geometria,
    criteriosAvaliados: avaliados,
    criteriosTotal: total,
    faixa: faixaDe(valor),
    procedencia: partes.join(' · '),
  }
}
