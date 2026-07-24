/**
 * Conflitos clássicos entre o TIPO DE CÔMODO e o SETOR do Ba Guá em que ele
 * cai (Escola BTB). O dado `comodo_tipo`/`comodos` já existia no banco mas
 * nunca alimentava as recomendações — este módulo fecha essa lacuna.
 *
 * A lógica das curas segue o motor dos Cinco Elementos: ex., banheiro
 * (Água escoando) no setor da Fama (Fogo) pede uma PONTE de Madeira,
 * porque no ciclo Sheng a Água nutre a Madeira, que alimenta o Fogo.
 *
 * Função pura, fail-closed: setor ou cômodo desconhecido → nenhum conflito.
 */

import type { Elemento } from './cinco-elementos'

export type SetorCanonico =
  | 'carreira' | 'conhecimento' | 'familia' | 'prosperidade' | 'fama'
  | 'relacionamentos' | 'criatividade' | 'pessoas_uteis' | 'centro'

/**
 * Normaliza o nome de setor como aparece nas telas/banco para o id canônico.
 * Aliases reais do app: 'Centro/Saúde'→centro, 'Fama/Reputação'→fama,
 * 'Filhos'→criatividade, 'Espiritualidade'→conhecimento (mesmo trigrama Gen).
 */
export function normalizarSetor(nome: string | null | undefined): SetorCanonico | null {
  if (!nome) return null
  const limpo = nome.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase()
  const mapa: Record<string, SetorCanonico> = {
    'carreira': 'carreira',
    'conhecimento': 'conhecimento',
    'espiritualidade': 'conhecimento',
    'familia': 'familia',
    'prosperidade': 'prosperidade',
    'fama': 'fama',
    'fama/reputacao': 'fama',
    'relacionamentos': 'relacionamentos',
    'criatividade': 'criatividade',
    'filhos': 'criatividade',
    'pessoas uteis': 'pessoas_uteis',
    'centro': 'centro',
    'centro/saude': 'centro',
  }
  return mapa[limpo] ?? null
}

/** Elemento clássico de cada setor do Ba Guá (fallback quando o banco não traz). */
export const ELEMENTO_DO_SETOR: Record<SetorCanonico, Elemento> = {
  carreira: 'agua',
  conhecimento: 'terra',
  familia: 'madeira',
  prosperidade: 'madeira',
  fama: 'fogo',
  relacionamentos: 'terra',
  criatividade: 'metal',
  pessoas_uteis: 'metal',
  centro: 'terra',
}

export interface ConflitoComodoSetor {
  nivel: 'urgente' | 'melhoria'
  problema: string
  cura: string
}

/** Cômodos com escoamento de água (o caso clássico de drenagem de energia). */
const COMODOS_DE_AGUA = ['banheiro', 'lavabo', 'area_servico'] as const

const CONFLITOS: Partial<Record<SetorCanonico, Partial<Record<string, ConflitoComodoSetor>>>> = {
  prosperidade: {
    banheiro: {
      nivel: 'urgente',
      problema: 'Banheiro no setor da Prosperidade — no Feng Shui clássico, a água que escoa simboliza recursos indo embora.',
      cura: 'Mantenha tampa do vaso, ralos e porta sempre fechados, e adicione uma planta viva e saudável (Madeira) para converter a Água que escoa em crescimento.',
    },
    lavabo: {
      nivel: 'urgente',
      problema: 'Lavabo no setor da Prosperidade — a água que escoa simboliza recursos indo embora.',
      cura: 'Mantenha ralos e porta fechados e adicione uma planta viva (Madeira) para reciclar a energia da Água em crescimento.',
    },
    area_servico: {
      nivel: 'melhoria',
      problema: 'Área de serviço no setor da Prosperidade — saída constante de água no setor da riqueza.',
      cura: 'Mantenha o ambiente impecável e organizado, ralos fechados, e um toque de verde (planta) para transformar a drenagem em nutrição.',
    },
    cozinha: {
      nivel: 'melhoria',
      problema: 'Cozinha no setor da Prosperidade — fogão (Fogo) e pia (Água) em conflito direto no setor da riqueza.',
      cura: 'Coloque um elemento de Madeira entre pia e fogão (tábua de madeira, vaso de erva viva): no ciclo Sheng, a Madeira faz a ponte Água→Fogo.',
    },
  },
  centro: {
    banheiro: {
      nivel: 'urgente',
      problema: 'Banheiro no Centro (Tai Chi) — o coração energético da casa, ligado à saúde, drenado pela água que escoa.',
      cura: 'Porta sempre fechada, tampa e ralos fechados; reforce o elemento Terra (cerâmica, tons terrosos) para estabilizar o centro.',
    },
    lavabo: {
      nivel: 'urgente',
      problema: 'Lavabo no Centro (Tai Chi) — o coração energético da casa drenado pela água que escoa.',
      cura: 'Porta sempre fechada, ralos fechados; reforce o elemento Terra (cerâmica, tons terrosos) para estabilizar o centro.',
    },
    cozinha: {
      nivel: 'melhoria',
      problema: 'Cozinha no Centro (Tai Chi) — Fogo intenso no coração da casa pode sobrecarregar a energia da saúde.',
      cura: 'Equilibre com o elemento Terra (cerâmica, tons terrosos e amarelos): no ciclo Sheng, a Terra escoa o excesso do Fogo.',
    },
  },
  fama: {
    banheiro: {
      nivel: 'urgente',
      problema: 'Banheiro no setor da Fama (Fogo) — no ciclo de controle, a Água apaga o Fogo da reputação.',
      cura: 'Tampa, ralos e porta fechados; adicione plantas verdes altas (Madeira): a Água nutre a Madeira, que volta a alimentar o Fogo.',
    },
    lavabo: {
      nivel: 'urgente',
      problema: 'Lavabo no setor da Fama (Fogo) — a Água apaga o Fogo da reputação.',
      cura: 'Ralos e porta fechados; plantas verdes (Madeira) fazem a ponte Água→Fogo no ciclo de geração.',
    },
  },
  relacionamentos: {
    banheiro: {
      nivel: 'melhoria',
      problema: 'Banheiro no setor dos Relacionamentos — a água que escoa pode levar junto a energia do par.',
      cura: 'Tampa e porta fechadas; reforce o elemento Terra do setor com pares de objetos em tons terrosos/rosados fora do banheiro.',
    },
    lavabo: {
      nivel: 'melhoria',
      problema: 'Lavabo no setor dos Relacionamentos — escoamento de água na área do par.',
      cura: 'Ralos e porta fechados; reforce o elemento Terra com tons terrosos/rosados e objetos em pares no entorno.',
    },
  },
  carreira: {
    banheiro: {
      nivel: 'melhoria',
      problema: 'Banheiro no setor da Carreira (Água) — a água que ESCOA drena o próprio elemento do setor.',
      cura: 'Tampa e ralos fechados; reforce com o elemento Metal (objetos metálicos, tons brancos): no ciclo Sheng, o Metal gera Água.',
    },
    lavabo: {
      nivel: 'melhoria',
      problema: 'Lavabo no setor da Carreira (Água) — escoamento drenando o elemento do setor.',
      cura: 'Ralos fechados; reforce com Metal (que gera Água no ciclo Sheng).',
    },
  },
}

/**
 * Conflitos do setor dados os cômodos que caem nele.
 * Aceita a lista `comodos` (novo) ou um único `comodo_tipo` legado.
 */
export function conflitosComodoSetor(
  nomeSetor: string,
  comodos: Array<string | null | undefined>
): ConflitoComodoSetor[] {
  const setor = normalizarSetor(nomeSetor)
  if (!setor) return []
  const tabela = CONFLITOS[setor]
  if (!tabela) return []
  const vistos = new Set<string>()
  const resultado: ConflitoComodoSetor[] = []
  for (const c of comodos) {
    if (!c || vistos.has(c)) continue
    vistos.add(c)
    const conflito = tabela[c]
    if (conflito) resultado.push(conflito)
  }
  return resultado
}

/**
 * Extrai a lista de cômodos de uma linha de `setores_bagua` — aceita a
 * coluna nova `comodos` (array) ou a legada `comodo_tipo` (único).
 */
export function comodosDeSetorRow(setor: { comodos?: unknown; comodo_tipo?: string | null }): string[] {
  if (Array.isArray(setor.comodos)) {
    return setor.comodos.filter((c): c is string => typeof c === 'string')
  }
  return setor.comodo_tipo ? [setor.comodo_tipo] : []
}

export { COMODOS_DE_AGUA }
