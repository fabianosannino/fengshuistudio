/**
 * Catálogo de classificação das dicas de texto livre (`SETOR_DICAS` e
 * `CRITERIO_DICAS` em constants.ts) — a instrumentação que permite curá-las
 * incrementalmente sem que o software invente proveniência.
 *
 * ─── POR QUE ESTE ARQUIVO NASCE VAZIO ────────────────────────────────────
 *
 * São 94 dicas (70 por setor + 24 por critério). A ADR 0015 registra que o
 * sistema **não** as classifica por conta própria: decidir se "adicione
 * cristais negros como obsidiana" é consenso clássico, variante de escola ou
 * tradição popular é julgamento de literatura clássica por afirmação, e
 * rotular errado poria selo de autoridade clássica em conselho possivelmente
 * moderno — num relatório que vai para cliente pagante.
 *
 * Este catálogo é o encaixe para essa curadoria ser feita por quem tem a
 * formação, uma dica por vez. Enquanto uma dica não estiver aqui, ela
 * continua aparecendo no relatório como texto (comportamento de hoje,
 * inalterado) — apenas sem selo de evidência, que é honesto.
 *
 * ─── COMO PREENCHER ──────────────────────────────────────────────────────
 *
 * A planilha de trabalho com as 94 dicas está em
 * `docs/domain/curadoria-dicas.md`. Para cada dica classificada, acrescente
 * uma entrada aqui usando **o texto exato** da dica como chave:
 *
 *     'Mantenha o caminho até a porta livre': {
 *       custo: 'zero', reversibilidade: 'instantanea',
 *       forcaEvidencia: 'consenso-classico', mecanismo: 'layout',
 *     },
 *
 * A dica classificada passa automaticamente a aparecer na seção "Plano de
 * Ação" do relatório, ordenada por custo/reversibilidade junto das demais.
 *
 * ─── FRAGILIDADE CONHECIDA ───────────────────────────────────────────────
 *
 * A chave é o texto exato. Se alguém editar a redação de uma dica em
 * constants.ts, a classificação se **desliga em silêncio**. O teste
 * `dicas-classificadas.test.ts` existe para impedir isso: ele falha se
 * qualquer chave deste catálogo não existir mais no conteúdo de origem.
 * Optei por chave-de-texto em vez de introduzir ids porque não exige tocar
 * `constants.ts` nem os consumidores existentes — o custo é essa fragilidade,
 * e ela está coberta por teste.
 */

import type {
  CustoRemedio, ForcaEvidencia, MecanismoRemedio, Reversibilidade,
} from './sintese-metodos'

export interface ClassificacaoDica {
  custo: CustoRemedio
  reversibilidade: Reversibilidade
  /** Sem valor padrão de propósito: é o campo que exige julgamento humano. */
  forcaEvidencia: ForcaEvidencia
  mecanismo: MecanismoRemedio
}

/**
 * Dicas já curadas, indexadas pelo texto exato.
 *
 * Nasce vazio — ver o cabeçalho. Preencher NÃO é tarefa de engenharia.
 */
export const CATALOGO_DICAS: Record<string, ClassificacaoDica> = {}

/** Classificação de uma dica, ou null se ela ainda não foi curada. */
export function classificacaoDaDica(dica: string): ClassificacaoDica | null {
  return CATALOGO_DICAS[dica] ?? null
}

/** Quantas dicas já foram curadas — usado para relatar progresso. */
export function totalDicasCuradas(): number {
  return Object.keys(CATALOGO_DICAS).length
}
