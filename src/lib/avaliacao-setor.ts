/**
 * Ponte entre os métodos já calculados e o motor de síntese
 * (`sintese-metodos.ts`). É aqui que os veredictos concretos por setor são
 * derivados dos dados reais de cada escola, para então passarem pela
 * hierarquia de precedência da ADR 0013.
 *
 * Escopo deliberado dos veredictos, alinhado ao que cada método já sabe
 * calcular hoje (não ao que seria desejável):
 *
 * - **Estrelas Voadoras**: só a Estrela 5 (Wu Huang) gera veredicto negativo.
 *   Isso é consistente com o escopo já documentado do módulo — `temEstrela5`
 *   é descrito como "cautela universal, sem exceção entre escolas", enquanto
 *   as demais combinações seguem explicitamente não implementadas. Ausência
 *   de Estrela 5 devolve `neutro`, **nunca `favoravel`**: o app ainda não
 *   classifica combinações auspiciosas, e afirmar "favorável" só porque não
 *   há Estrela 5 seria inventar um veredicto que nenhum cálculo sustenta.
 * - **Ba Zhai**: veredicto completo (favorável/desfavorável), porque a
 *   divisão entre as 4 direções favoráveis e as 4 desfavoráveis do Ming Gua
 *   é bem definida e já está implementada e testada.
 * - **Liu Fa, Formas, BaZi, Da Gua/San He**: ainda não têm ponte aqui. O
 *   motor de síntese já os conhece (`PERFIS_METODOS`) e passa a considerá-los
 *   assim que alguém produzir `AvaliacaoMetodo` para eles — nada no motor
 *   precisa mudar. Para Formas e BaZi isso depende de dados que o app não
 *   captura de forma estruturada ainda.
 */

import type { Palacio3Estrelas } from './estrelas-voadoras'
import { resolverConflito, type AvaliacaoMetodo, type ResolucaoConflito } from './sintese-metodos'
import type { Setor } from './trigramas'

/** A Estrela 5 (五黄 Wu Huang) é a única cuja gravidade não tem divergência entre escolas. */
const ESTRELA_WU_HUANG = 5

/**
 * Veredicto das Estrelas Voadoras para um palácio. Considera as 3 estrelas
 * natais e, opcionalmente, a estrela anual (Zi Bai) daquele mesmo palácio.
 */
export function avaliarSetorFeiXing(
  estrelas: Palacio3Estrelas | null | undefined,
  estrelaAnual?: number | null,
): AvaliacaoMetodo {
  const anualEhWuHuang = estrelaAnual === ESTRELA_WU_HUANG
  const natalEhWuHuang = estrelas?.temEstrela5 === true

  if (natalEhWuHuang && anualEhWuHuang) {
    return {
      metodo: 'fei-xing',
      veredicto: 'perigoso',
      motivo: 'Estrela 5 (Wu Huang) na carta natal E também como estrela anual — sobreposição agravada neste setor.',
    }
  }
  if (natalEhWuHuang) {
    return {
      metodo: 'fei-xing',
      veredicto: 'perigoso',
      motivo: 'Estrela 5 (Wu Huang) na carta natal deste setor.',
    }
  }
  if (anualEhWuHuang) {
    return {
      metodo: 'fei-xing',
      veredicto: 'perigoso',
      motivo: 'Estrela 5 (Wu Huang) como estrela anual deste setor — condição temporária, muda no próximo ano solar.',
    }
  }
  return {
    metodo: 'fei-xing',
    veredicto: 'neutro',
    motivo: 'Sem Estrela 5 neste setor. As demais combinações de estrelas ainda não são classificadas pelo sistema.',
  }
}

/** Veredicto do Ba Zhai para um setor, dadas as direções favoráveis de UMA pessoa. */
export function avaliarSetorBaZhai(favoraveis: Set<Setor>, setor: Setor): AvaliacaoMetodo {
  const favoravel = favoraveis.has(setor)
  return {
    metodo: 'ba-zhai',
    veredicto: favoravel ? 'favoravel' : 'desfavoravel',
    motivo: favoravel
      ? `Setor ${setor} é uma das 4 direções favoráveis do Ming Gua considerado.`
      : `Setor ${setor} é uma das 4 direções desfavoráveis do Ming Gua considerado.`,
  }
}

export interface EntradaSinteseSetor {
  setor: Setor
  estrelasNatais?: Palacio3Estrelas | null
  estrelaAnual?: number | null
  /** Direções favoráveis do morador relevante. Omitir quando não há Ming Gua informado. */
  baZhaiFavoraveis?: Set<Setor> | null
}

/**
 * Sintetiza os métodos disponíveis para um setor e aplica a hierarquia de
 * precedência. Métodos sem dado são simplesmente omitidos — não entram como
 * "neutro forçado" nem como suposição.
 */
export function sintetizarSetor(entrada: EntradaSinteseSetor): ResolucaoConflito {
  const avaliacoes: AvaliacaoMetodo[] = []

  if (entrada.estrelasNatais != null || entrada.estrelaAnual != null) {
    avaliacoes.push(avaliarSetorFeiXing(entrada.estrelasNatais, entrada.estrelaAnual))
  }
  if (entrada.baZhaiFavoraveis != null) {
    avaliacoes.push(avaliarSetorBaZhai(entrada.baZhaiFavoraveis, entrada.setor))
  }

  return resolverConflito(avaliacoes)
}
