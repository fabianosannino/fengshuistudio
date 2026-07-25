/**
 * Registro de metodologias de Feng Shui suportadas pelo diagnóstico Ba Guá.
 *
 * Arquitetura pensada para múltiplas escolas: a tela de seleção (bagua-planta)
 * é gerada a partir deste array — adicionar uma nova metodologia no futuro
 * (Estrelas Voadoras, Oito Mansões da casa…) é acrescentar uma entrada aqui
 * (com `disponivel:false` até o motor de cálculo existir); nenhuma mudança de
 * UI é necessária. `requisitos` documenta o dado extra que cada metodologia
 * precisa capturar, além da planta + setores já comuns a todas.
 */

export type MetodologiaId = 'btb' | 'bussola'

export interface Metodologia {
  id: MetodologiaId
  nome: string
  nomeCurto: string
  icone: string
  descricaoCurta: string
  requisitos: string[]
  /** false = aparece na UI com indicação "em breve", desabilitada. */
  disponivel: boolean
}

export const METODOLOGIAS: Metodologia[] = [
  {
    id: 'btb',
    nome: 'Chapéu Preto (BTB)',
    nomeCurto: 'BTB',
    icone: '🚪',
    descricaoCurta: 'Porta como referência',
    requisitos: ['Posição da porta de entrada'],
    disponivel: true,
  },
  {
    id: 'bussola',
    nome: 'Escola da Bússola (Clássica)',
    nomeCurto: 'Bússola',
    icone: '🧭',
    descricaoCurta: 'Direção cardinal real',
    requisitos: ['Orientação magnética da fachada (graus)'],
    disponivel: true,
  },
]

export const METODOLOGIA_PADRAO: MetodologiaId = 'btb'

export function metodologiaPorId(id: string): Metodologia | undefined {
  return METODOLOGIAS.find(m => m.id === id)
}
