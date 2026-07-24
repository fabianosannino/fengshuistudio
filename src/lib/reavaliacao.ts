/**
 * Reavaliação — comparativo antes/depois do diagnóstico Ba Guá.
 *
 * O snapshot 'inicial' nasce na primeira finalização do diagnóstico; cada
 * nova finalização com scores diferentes gera um snapshot 'reavaliacao'.
 * Este módulo compara o primeiro e o mais recente para mostrar a EVOLUÇÃO
 * por setor — a prova de efetividade do trabalho do consultor.
 *
 * Funções puras, sem I/O.
 */

export interface SnapshotScore {
  numero: number
  nome: string
  score: number | null
}

export interface EvolucaoSetor {
  numero: number
  nome: string
  antes: number | null
  depois: number | null
  /** depois − antes; null quando qualquer lado não foi avaliado. */
  delta: number | null
}

export interface Evolucao {
  setores: EvolucaoSetor[]
  mediaAntes: number | null
  mediaDepois: number | null
  melhoraram: number
  pioraram: number
  estaveis: number
}

/** Monta o snapshot a partir dos setores no momento da finalização. */
export function montarSnapshot(
  setores: Array<{ numero: number; nome: string; score: number | null }>
): SnapshotScore[] {
  return setores
    .map(s => ({ numero: s.numero, nome: s.nome, score: s.score }))
    .sort((a, b) => a.numero - b.numero)
}

/** Compara dois snapshots (deduplicação: não gravar histórico repetido). */
export function snapshotsIguais(a: SnapshotScore[], b: SnapshotScore[]): boolean {
  if (a.length !== b.length) return false
  const porNumero = new Map(b.map(s => [s.numero, s]))
  return a.every(s => {
    const outro = porNumero.get(s.numero)
    return outro != null && outro.score === s.score && outro.nome === s.nome
  })
}

function media(valores: number[]): number | null {
  if (valores.length === 0) return null
  return Math.round(valores.reduce((s, v) => s + v, 0) / valores.length)
}

/** Evolução entre o snapshot inicial e o mais recente. */
export function compararSnapshots(inicial: SnapshotScore[], atual: SnapshotScore[]): Evolucao {
  const atuaisPorNumero = new Map(atual.map(s => [s.numero, s]))
  const setores: EvolucaoSetor[] = inicial.map(s => {
    const depois = atuaisPorNumero.get(s.numero)?.score ?? null
    const delta = s.score != null && depois != null ? depois - s.score : null
    return { numero: s.numero, nome: s.nome, antes: s.score, depois, delta }
  })

  const comDelta = setores.filter(s => s.delta != null) as Array<EvolucaoSetor & { delta: number }>
  return {
    setores,
    mediaAntes: media(setores.map(s => s.antes).filter((v): v is number => v != null)),
    mediaDepois: media(setores.map(s => s.depois).filter((v): v is number => v != null)),
    melhoraram: comDelta.filter(s => s.delta > 0).length,
    pioraram: comDelta.filter(s => s.delta < 0).length,
    estaveis: comDelta.filter(s => s.delta === 0).length,
  }
}
