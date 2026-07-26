/**
 * Síntese do imóvel inteiro — agrega `sintetizarSetor` (avaliacao-setor.ts)
 * sobre os 8 setores e destaca onde as escolas divergem.
 *
 * É a peça que o relatório consome para produzir a seção "onde as escolas
 * divergem neste imóvel", que a Parte IV do documento de referência chama de
 * **invariante de honestidade**: um produto que esconde divergência mente por
 * omissão, e num campo sem falseabilidade experimental a transparência
 * metodológica é o único diferencial defensável.
 *
 * Puro: recebe os dados já calculados e não fala com Supabase nem com o DOM.
 */

import { sintetizarSetor, type EntradaSinteseSetor } from './avaliacao-setor'
import type { Palacio, Palacio3Estrelas, MapaEstrelasVoadoras } from './estrelas-voadoras'
import type { ResolucaoConflito, Veredicto } from './sintese-metodos'
import type { Setor } from './trigramas'

/** Os 8 setores, na ordem cardeal convencional. O Centro (Tai Ji) fica fora: não é setor do Ba Zhai. */
export const SETORES_ORDEM: readonly Setor[] = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']

export interface SetorSintetizado {
  setor: Setor
  resolucao: ResolucaoConflito
}

export interface SinteseImovel {
  setores: SetorSintetizado[]
  /** Só os setores onde houve divergência real entre escolas. */
  divergentes: SetorSintetizado[]
  /** Setores cujo veredicto final é 'perigoso' — o que o relatório precisa destacar primeiro. */
  perigosos: SetorSintetizado[]
  /** true se algum setor teve conflito — dispara a seção de divergência no relatório. */
  temDivergencia: boolean
  /** Avisos estruturais deduplicados (ex.: BTB misturado com bússola). */
  avisos: string[]
}

export interface EntradaSinteseImovel {
  /** Mapa natal das Estrelas Voadoras, se houver (precisa de facing + período). */
  mapaEstrelas?: MapaEstrelasVoadoras | null
  /** Grade da estrela anual por palácio, se houver. */
  gradeAnual?: Record<Palacio, number> | null
  /** Direções favoráveis do morador de referência, se o Ming Gua for conhecido. */
  baZhaiFavoraveis?: Set<Setor> | null
}

const ORDEM_GRAVIDADE: Record<Veredicto, number> = {
  perigoso: 0, desfavoravel: 1, favoravel: 2, neutro: 3,
}

/**
 * Sintetiza os 8 setores. Métodos sem dado simplesmente não participam —
 * nenhuma suposição é feita para preencher lacuna (ver `sintetizarSetor`).
 */
export function sintetizarImovel(entrada: EntradaSinteseImovel): SinteseImovel {
  const porPalacio = new Map<Palacio, Palacio3Estrelas>()
  for (const p of entrada.mapaEstrelas?.palacios ?? []) porPalacio.set(p.palacio, p)

  const setores: SetorSintetizado[] = SETORES_ORDEM.map(setor => {
    const dados: EntradaSinteseSetor = {
      setor,
      // Setor e Palacio compartilham os 8 nomes cardeais; o Palacio 'C' (Centro) não é setor.
      estrelasNatais: porPalacio.get(setor as Palacio) ?? null,
      estrelaAnual: entrada.gradeAnual ? entrada.gradeAnual[setor as Palacio] : null,
      baZhaiFavoraveis: entrada.baZhaiFavoraveis ?? null,
    }
    return { setor, resolucao: sintetizarSetor(dados) }
  })

  const divergentes = setores.filter(s => s.resolucao.houveConflito)
  const perigosos = setores
    .filter(s => s.resolucao.veredictoFinal === 'perigoso')
    .sort((a, b) => ORDEM_GRAVIDADE[a.resolucao.veredictoFinal] - ORDEM_GRAVIDADE[b.resolucao.veredictoFinal])

  const avisos = [...new Set(setores.flatMap(s => s.resolucao.avisos))]

  return { setores, divergentes, perigosos, temDivergencia: divergentes.length > 0, avisos }
}
