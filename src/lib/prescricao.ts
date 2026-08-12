/**
 * Curas como prescrição — da biblioteca para o plano do cliente.
 *
 * ## O que muda
 *
 * `/curas` era um catálogo organizado por elemento: cinco abas, dezenas de
 * cristais, plantas e objetos, sem nenhuma ligação com o diagnóstico. O
 * consultor lia a biblioteca inteira e copiava à mão o que fazia sentido para
 * aquele imóvel. Nada do que ele escolhia ficava gravado, então o relatório, o
 * ritual e a loja não sabiam de nada disso.
 *
 * Prescrever grava uma linha em `prescricoes` — a tabela existe desde a
 * restauração de constraints e nunca tinha sido escrita por ninguém. É ela que
 * liga o diagnóstico ao entregável.
 *
 * ## A ordem
 *
 * Os setores entram ordenados **pelo score do diagnóstico**, pior primeiro.
 * Setor não avaliado vai para o fim: sem score não há como afirmar que ele
 * precisa de alguma coisa, e colocá-lo no topo faria o consultor prescrever
 * para um ambiente que ninguém olhou.
 */

import { ELEMENTOS, type ElementData } from './curas'
import { LIMIAR_SCORE_BOM, LIMIAR_SCORE_CRITICO } from './constants'
import { setorCanonico } from './nome-do-setor'

/**
 * Nome canônico do setor → como aparece em `ELEMENTOS.gua`.
 *
 * A chave é sempre o nome de `LOSHU_ORDER`; quem chama passa o valor do banco
 * por `setorCanonico` antes, porque lá existem quinze grafias para nove setores.
 */
const GUA_POR_SETOR: Record<string, string> = {
  'Carreira': 'Carreira',
  'Família': 'Família / Saúde',
  'Prosperidade': 'Prosperidade',
  'Fama': 'Fama / Reputação',
  'Relacionamentos': 'Relacionamentos',
  'Criatividade': 'Criatividade / Filhos',
  'Pessoas Úteis': 'Pessoas Úteis',
  'Conhecimento': 'Espiritualidade',
  'Centro': 'Saúde / Centro',
}

export function elementoDoSetor(nomeSetor: string): ElementData | null {
  const canonico = setorCanonico(nomeSetor)
  const gua = canonico ? GUA_POR_SETOR[canonico] : undefined
  if (!gua) return null
  return ELEMENTOS.find(e => e.gua === gua) ?? null
}

export type TipoDeCura = 'cristal' | 'planta' | 'objeto' | 'pratica'

export interface CuraDisponivel {
  /**
   * Chave estável dentro do setor. É o que permite saber se uma cura já está
   * prescrita sem comparar títulos, que mudam quando o texto é revisado.
   */
  chave: string
  tipo: TipoDeCura
  titulo: string
  descricao: string
  /** Elemento do Guá — vai para a coluna `elemento` de `prescricoes`. */
  elemento: string
  /** `true` quando não custa nada aplicar. Ordena o plano. */
  semCusto: boolean
}

/**
 * As curas que a biblioteca oferece para um setor.
 *
 * Práticas (mudra, meditação, mantra) entram como `semCusto`, porque são: o
 * documento-mestre pede «custo zero e reversível primeiro», e um mantra é as
 * duas coisas.
 */
export function curasDoSetor(nomeSetor: string): CuraDisponivel[] {
  const elemento = elementoDoSetor(nomeSetor)
  if (!elemento) return []

  const curas: CuraDisponivel[] = []

  elemento.cristais.forEach((c, i) => curas.push({
    chave: `cristal:${i}`, tipo: 'cristal', titulo: c.nome,
    descricao: c.propriedade, elemento: elemento.elemento, semCusto: false,
  }))

  elemento.plantas.forEach((p, i) => curas.push({
    chave: `planta:${i}`, tipo: 'planta', titulo: p.nome,
    descricao: [p.dica, p.posicao].filter(Boolean).join(' · '),
    elemento: elemento.elemento, semCusto: false,
  }))

  elemento.objetos.forEach((o, i) => curas.push({
    chave: `objeto:${i}`, tipo: 'objeto', titulo: o.nome,
    descricao: o.posicao, elemento: elemento.elemento, semCusto: false,
  }))

  curas.push({
    chave: 'pratica:mudra', tipo: 'pratica', titulo: elemento.mudra.nome,
    descricao: elemento.mudra.descricao, elemento: elemento.elemento, semCusto: true,
  })
  curas.push({
    chave: 'pratica:meditacao', tipo: 'pratica', titulo: elemento.meditacao.nome,
    descricao: `${elemento.meditacao.duracao} · ${elemento.meditacao.descricao}`,
    elemento: elemento.elemento, semCusto: true,
  })
  const mantra = elemento.mantras[0]
  if (mantra) {
    curas.push({
      chave: 'pratica:mantra', tipo: 'pratica', titulo: `Mantra ${mantra.romanizacao}`,
      descricao: mantra.significado, elemento: elemento.elemento, semCusto: true,
    })
  }

  // Custo zero primeiro — ordenação do documento-mestre, Parte IV.
  return curas.sort((a, b) => Number(b.semCusto) - Number(a.semCusto))
}

export type UrgenciaDoSetor = 'prioridade' | 'atencao' | 'equilibrado' | 'nao_avaliado'

export interface SetorPrescricao {
  nome: string
  score: number | null
  urgencia: UrgenciaDoSetor
  rotulo: string
  /** Menor = mais urgente. É o valor gravado em `prescricoes.prioridade`. */
  prioridade: number
}

const ROTULO_DA_URGENCIA: Record<UrgenciaDoSetor, string> = {
  prioridade: 'prioridade',
  atencao: 'atenção',
  equilibrado: 'equilibrado',
  nao_avaliado: 'não avaliado',
}

export function urgenciaDoScore(score: number | null | undefined): UrgenciaDoSetor {
  if (typeof score !== 'number') return 'nao_avaliado'
  if (score < LIMIAR_SCORE_CRITICO) return 'prioridade'
  if (score < LIMIAR_SCORE_BOM) return 'atencao'
  return 'equilibrado'
}

/**
 * Ordena os setores para a tela de prescrição.
 *
 * Não avaliado vai para o fim, não para o topo: sem score não dá para afirmar
 * que o setor precisa de alguma coisa, e prescrever para um ambiente que
 * ninguém olhou é inventar diagnóstico.
 */
export function setoresParaPrescrever(
  setores: { nome: string; score_percentual?: number | null }[]
): SetorPrescricao[] {
  return setores
    // Linha com nome irreconhecível sai: prescrever para um setor que não dá
    // para identificar é prescrever no escuro.
    .filter(s => setorCanonico(s.nome) !== null)
    .map(s => {
      const score = typeof s.score_percentual === 'number' ? s.score_percentual : null
      const urgencia = urgenciaDoScore(score)
      return {
        nome: setorCanonico(s.nome)!,
        score,
        urgencia,
        rotulo: ROTULO_DA_URGENCIA[urgencia],
        // Prioridade 1 é o pior setor avaliado. Não avaliado recebe 99 — fica no
        // fim de qualquer ordenação sem competir com o que foi medido.
        prioridade: score === null ? 99 : Math.max(1, Math.ceil(score / 10)),
      }
    })
    .sort((a, b) => {
      if ((a.score === null) !== (b.score === null)) return a.score === null ? 1 : -1
      return (a.score ?? 0) - (b.score ?? 0)
    })
}

/** A linha que vai para `prescricoes`. */
export interface LinhaDePrescricao {
  consulta_id: string
  setor_id: string | null
  titulo: string
  descricao: string
  elemento: string
  objeto: string
  prioridade: number
}

/**
 * `objeto` guarda a chave da cura na biblioteca, não o nome do item.
 *
 * O nome muda quando alguém revisa o texto da biblioteca; a chave não. Sem ela,
 * a tela perderia a ligação entre o que está prescrito e o que está listado, e
 * o botão «Prescrever» reapareceria em curas que já estão no plano.
 */
export function montarPrescricao(
  consultaId: string,
  setorId: string | null,
  setor: SetorPrescricao,
  cura: CuraDisponivel
): LinhaDePrescricao {
  return {
    consulta_id: consultaId,
    setor_id: setorId,
    titulo: cura.titulo,
    descricao: cura.descricao,
    elemento: cura.elemento,
    objeto: `${setor.nome}|${cura.chave}`,
    prioridade: setor.prioridade,
  }
}

/** Lê de volta o que `montarPrescricao` gravou em `objeto`. */
export function chaveDaPrescricao(objeto: string | null | undefined): { setor: string; chave: string } | null {
  if (typeof objeto !== 'string') return null
  const [setor, chave] = objeto.split('|')
  if (!setor || !chave) return null
  return { setor, chave }
}
