/**
 * Formatação de moeda e data — fonte única.
 *
 * Antes disto, `toLocaleDateString('pt-BR')` e `toLocaleString('pt-BR', …)`
 * apareciam soltos em 23 arquivos, com variações que ninguém decidiu: sete
 * chamadas de moeda sem `style: 'currency'`, datas ora curtas ora por extenso
 * para o mesmo tipo de campo. Era o R4 da auditoria — conhecimento duplicado,
 * divergindo em silêncio.
 *
 * O ponto sensível é o nulo. `new Date(null)` é a época Unix, então
 * `new Date(null).toLocaleDateString('pt-BR')` devolve «01/01/1970» — uma data
 * plausível no lugar de um campo vazio. Foi exatamente esse o defeito do ADR
 * 0020, ali na trilha de auditoria. Aqui a regra é a mesma: ausência de valor
 * vira texto de ausência, nunca uma data inventada.
 */

/** O que se mostra quando não há data. Não é erro — é a ausência declarada. */
export const SEM_DATA = '—'

function paraData(valor: string | number | Date | null | undefined): Date | null {
  if (valor === null || valor === undefined || valor === '') return null
  const d = valor instanceof Date ? valor : new Date(valor)
  return Number.isNaN(d.getTime()) ? null : d
}

/** `12/08/2026`. Devolve `SEM_DATA` para nulo, vazio ou data inválida. */
export function formatarData(valor: string | number | Date | null | undefined): string {
  const d = paraData(valor)
  return d ? d.toLocaleDateString('pt-BR') : SEM_DATA
}

/** `12/08/2026, 14:30`. Mesma regra de ausência. */
export function formatarDataHora(valor: string | number | Date | null | undefined): string {
  const d = paraData(valor)
  if (!d) return SEM_DATA
  return d.toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

/** `quarta-feira, 12 de agosto de 2026` — para cabeçalho de relatório. */
export function formatarDataExtensa(valor: string | number | Date | null | undefined): string {
  const d = paraData(valor)
  if (!d) return SEM_DATA
  return d.toLocaleDateString('pt-BR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}

/**
 * `R$ 1.234,56`.
 *
 * O código da moeda é parâmetro porque a loja opera com contas Stripe
 * conectadas, que podem cobrar em outra moeda — e ali o valor vem do gateway,
 * não do nosso banco.
 */
export function formatarMoeda(
  valor: number | null | undefined,
  moeda: string = 'BRL'
): string {
  const n = typeof valor === 'number' && Number.isFinite(valor) ? valor : 0
  return n.toLocaleString('pt-BR', { style: 'currency', currency: moeda.toUpperCase() })
}

/** `1.234` — número simples, sem símbolo de moeda. */
export function formatarNumero(valor: number | null | undefined): string {
  const n = typeof valor === 'number' && Number.isFinite(valor) ? valor : 0
  return n.toLocaleString('pt-BR')
}
