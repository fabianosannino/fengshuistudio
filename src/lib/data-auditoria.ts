/** Mostrado quando a linha de auditoria não tem carimbo de tempo. */
export const SEM_CARIMBO = 'data não registrada'

/**
 * Formata a data de um registro de auditoria.
 *
 * `new Date(null)` é a época Unix, então linhas sem `performed_at` apareciam
 * como «01/01/1970, 00:00:00» — uma data plausível o bastante para ser lida
 * como verdadeira. A coluna passou a ter default, mas as linhas gravadas antes
 * disso continuam nulas de propósito: numa trilha de auditoria, declarar a
 * lacuna é melhor do que inventar um horário.
 *
 * A época Unix *explícita* continua sendo formatada — `null` é «não sei», um
 * 1970 gravado é um dado.
 */
export function dataDeAuditoria(valor: string | null | undefined): string {
  if (!valor) return SEM_CARIMBO
  const d = new Date(valor)
  return Number.isNaN(d.getTime()) ? SEM_CARIMBO : d.toLocaleString('pt-BR')
}
