/**
 * Diagnóstico de exemplo — o produto funcionando, sem gravar nada.
 *
 * ## Por que não é um seed
 *
 * A alternativa óbvia seria criar uma consulta de verdade na conta do usuário.
 * Isso obrigaria a inventar um cliente, ocuparia uma vaga do plano, apareceria
 * nas contagens e nos relatórios do mês, e alguém teria que se lembrar de
 * apagá-la. «Sem afetar seus dados» tem que ser literal, e a única forma de ser
 * literal é o exemplo não existir no banco.
 *
 * ## Por que os números não são escritos à mão
 *
 * Os scores por critério são fixos; **os resultados não**. Score do setor,
 * recomendações, montanha da fachada e carta de Estrelas Voadoras saem dos
 * mesmos módulos que a tela real usa. Se um limiar mudar, a demonstração muda
 * junto — um exemplo com números digitados vira mentira na primeira alteração
 * do motor, e mentira numa tela chamada «demonstração» é a pior espécie.
 *
 * Nomes e endereço são fictícios e declarados como tal na tela.
 */

import { CRITERIOS, LOSHU_ORDER } from './constants'

/** Fachada da casa de exemplo, em graus (referência verdadeira). */
export const FACHADA_GRAUS_EXEMPLO = 42.5

/** Ano de construção do imóvel de exemplo — Período 8 (2004–2023). */
export const ANO_CONSTRUCAO_EXEMPLO = 2011

export const IMOVEL_EXEMPLO = {
  nome: 'Casa Granja Viana',
  cliente: 'Ana Prado',
  cidade: 'Cotia · SP',
  tipo: 'Residencial · 148 m²',
}

/**
 * Notas de 1 a 5 por critério, na ordem de `CRITERIOS`, para cada setor do
 * Ba Guá. São o **insumo**: tudo o mais é calculado.
 *
 * `null` onde o consultor do exemplo não avaliou — a demonstração mostra também
 * o que o produto faz com a lacuna, que é declará-la em vez de preenchê-la.
 */
export const NOTAS_POR_SETOR: Record<string, (number | null)[]> = {
  'Prosperidade':    [4, 5, 4, 3, 4, 5, 5, 4],
  'Fama':            [3, 2, 3, 2, 3, 2, 4, 3],
  'Relacionamentos': [2, 2, 1, 2, 2, 1, 3, 2],
  'Família':         [5, 4, 5, 4, 5, 5, 5, 4],
  'Centro':          [4, 4, 3, 4, 4, 3, 4, 4],
  'Criatividade':    [3, 3, 4, 3, 3, 4, 4, 3],
  'Conhecimento':    [4, 5, 4, 5, 4, 4, 5, 5],
  'Carreira':        [2, 3, 2, 3, 2, 3, 3, 2],
  'Pessoas Úteis':   [null, null, null, null, null, null, null, null],
}

/**
 * Score percentual de um setor a partir das notas.
 *
 * Média das notas preenchidas, em escala de 1–5, convertida para 0–100. `null`
 * quando nenhuma nota foi dada — e `null` não é 0: é «não avaliado», a mesma
 * distinção da Roda da Vida e do Fluxo de Chi.
 */
export function scoreDoSetorExemplo(notas: (number | null)[]): number | null {
  const dadas = notas.filter((n): n is number => typeof n === 'number')
  if (dadas.length === 0) return null
  const media = dadas.reduce((s, n) => s + n, 0) / dadas.length
  return Math.round(((media - 1) / 4) * 100)
}

export interface SetorDaDemonstracao {
  nome: string
  score: number | null
  criterios: Record<string, number>
}

/** Os nove setores na ordem do Lo Shu, prontos para a grade 3×3. */
export function setoresDaDemonstracao(): SetorDaDemonstracao[] {
  return LOSHU_ORDER.map(nome => {
    const notas = NOTAS_POR_SETOR[nome] ?? []
    const criterios: Record<string, number> = {}
    CRITERIOS.forEach((criterio, i) => {
      const nota = notas[i]
      if (typeof nota === 'number') criterios[criterio] = nota
    })
    return { nome, score: scoreDoSetorExemplo(notas), criterios }
  })
}
