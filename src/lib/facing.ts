/**
 * Determinação de Facing (向 Xiang) — §2.5 do documento de referência, que a
 * chama de "a decisão que mais gera erro".
 *
 * O par Sitting/Facing (坐/向) é sempre oposto exato (180°), mas decidir QUAL
 * face é a frente **não é uma medição — é um julgamento**. O app até aqui
 * assumia que a orientação informada já ERA o facing. Este módulo torna o
 * julgamento explícito, pontuado e, quando o caso é ambíguo, declaradamente
 * ambíguo.
 *
 * Hierarquia de critérios conforme §2.5, do mais forte ao mais fraco:
 *   1. Lado mais Yang (movimento, ruído, luz, vista aberta, rua principal)
 *   2. Fachada arquitetônica principal / maior área envidraçada
 *   3. Face voltada para água ou espaço vazio
 *   4. Porta principal — **último** critério, não o primeiro
 *   5. Em apartamentos: sacada / face de maior abertura
 *
 * **Os PESOS numéricos são escolha própria declarada**, não citação: o
 * documento dá a ordem, não os números. A escolha preserva duas propriedades
 * que a ordem sozinha não garante:
 *   - A porta principal (peso 1) vale menos que qualquer outro critério
 *     isolado, porque tratá-la como critério forte é justamente o erro que
 *     §2.5 alerta ("porta lateral ou de fundos é comum").
 *   - Nenhum critério isolado vence dois critérios mais fortes somados —
 *     evita que um único sinal domine o julgamento.
 */

import { normalizarGraus } from './graus'

export type CriterioFacing =
  | 'yang'
  | 'fachada-arquitetonica'
  | 'agua-ou-vazio'
  | 'porta-principal'
  | 'sacada-maior-abertura'

interface InfoCriterio {
  peso: number
  rotulo: string
  pergunta: string
}

export const CRITERIOS_FACING: Record<CriterioFacing, InfoCriterio> = {
  'yang': {
    peso: 5,
    rotulo: 'Lado mais Yang',
    pergunta: 'É o lado com mais movimento, ruído, luz e vista aberta (rua principal)?',
  },
  'fachada-arquitetonica': {
    peso: 4,
    rotulo: 'Fachada arquitetônica principal',
    pergunta: 'É a fachada principal do projeto, ou a face com maior área envidraçada?',
  },
  'sacada-maior-abertura': {
    peso: 4,
    rotulo: 'Sacada / maior abertura (apartamento)',
    pergunta: 'Em apartamento: é a sacada ou a face de maior abertura?',
  },
  'agua-ou-vazio': {
    peso: 3,
    rotulo: 'Voltada para água ou vazio',
    pergunta: 'Está voltada para água, praça, campo, mar ou outro espaço aberto?',
  },
  'porta-principal': {
    peso: 1,
    rotulo: 'Porta principal',
    pergunta: 'É onde fica a porta principal? (critério mais fraco — porta lateral/fundos é comum)',
  },
}

/** Ordem de exibição do questionário: do critério mais forte ao mais fraco. */
export const ORDEM_CRITERIOS: readonly CriterioFacing[] = [
  'yang', 'fachada-arquitetonica', 'sacada-maior-abertura', 'agua-ou-vazio', 'porta-principal',
]

export interface FaceCandidata {
  /** Rótulo livre para o consultor identificar a face (ex.: 'Frente para a rua'). */
  id: string
  /** Orientação desta face em graus. */
  graus: number
  criterios: CriterioFacing[]
}

export interface HipoteseFacing {
  face: FaceCandidata
  score: number
  criteriosAtendidos: CriterioFacing[]
}

export interface ResultadoFacing {
  /** Hipótese vencedora, ou null se nenhuma face teve qualquer critério marcado. */
  principal: HipoteseFacing | null
  /** Segunda hipótese — preenchida SÓ quando o caso é ambíguo. */
  concorrente: HipoteseFacing | null
  ambiguo: boolean
  /** Todas as hipóteses com score > 0, da maior para a menor. */
  todas: HipoteseFacing[]
  facingGraus: number | null
  /** Sitting é sempre o oposto exato do facing (180°). */
  sittingGraus: number | null
  avisos: string[]
}

/**
 * Diferença de score até a qual duas hipóteses são consideradas empatadas.
 * Escolha própria declarada: 2 é menor que o peso de qualquer critério
 * isolado exceto a porta principal — ou seja, duas faces só "empatam" quando
 * a diferença entre elas é fraca o bastante para caber num único sinal
 * secundário. Não é um número citado do documento.
 */
export const LIMIAR_AMBIGUIDADE = 2

function pontuar(face: FaceCandidata): HipoteseFacing {
  const unicos = [...new Set(face.criterios)]
  return {
    face,
    score: unicos.reduce((soma, c) => soma + CRITERIOS_FACING[c].peso, 0),
    criteriosAtendidos: unicos,
  }
}

/**
 * Avalia as faces candidatas e devolve a hipótese de facing — mais a
 * concorrente, quando o julgamento é ambíguo.
 *
 * Fail-closed: sem nenhum critério marcado em nenhuma face, devolve
 * `principal: null` em vez de eleger a primeira face por padrão. "Não sei"
 * é uma resposta melhor que um chute com cara de resultado.
 */
export function determinarFacing(faces: FaceCandidata[]): ResultadoFacing {
  const avisos: string[] = []
  const todas = faces.map(pontuar).filter(h => h.score > 0).sort((a, b) => b.score - a.score)

  if (todas.length === 0) {
    return {
      principal: null, concorrente: null, ambiguo: false, todas: [],
      facingGraus: null, sittingGraus: null,
      avisos: ['Nenhum critério foi marcado — não é possível determinar o facing. Responda ao questionário para pelo menos uma face.'],
    }
  }

  const principal = todas[0]
  const segunda = todas[1] ?? null
  const ambiguo = segunda != null && principal.score - segunda.score <= LIMIAR_AMBIGUIDADE

  if (ambiguo && segunda) {
    avisos.push(
      `Julgamento ambíguo: "${principal.face.id}" (${principal.score} pts) e "${segunda.face.id}" ` +
      `(${segunda.score} pts) estão tecnicamente empatados. Praticantes divergem em casos assim — ` +
      'gere as duas cartas e compare antes de fechar o diagnóstico.',
    )
  }

  // O alerta mais importante do §2.5: a porta principal é o critério MAIS FRACO,
  // e tratá-la como decisivo é o erro clássico.
  if (principal.criteriosAtendidos.length === 1 && principal.criteriosAtendidos[0] === 'porta-principal') {
    avisos.push(
      'A face vencedora foi escolhida APENAS por ter a porta principal — o critério mais fraco da ' +
      'hierarquia. Porta lateral ou de fundos é comum, e em apartamentos a porta do corredor ' +
      'raramente é o facing. Reveja os critérios mais fortes (lado Yang, fachada, vista aberta).',
    )
  }

  return {
    principal,
    concorrente: ambiguo ? segunda : null,
    ambiguo,
    todas,
    facingGraus: normalizarGraus(principal.face.graus),
    sittingGraus: normalizarGraus(principal.face.graus + 180),
    avisos,
  }
}
