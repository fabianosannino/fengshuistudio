import efemerides from './data/li-chun.json'

export const VERSAO_ANO_SOLAR = efemerides.version
export const AVISO_ANO_SOLAR = 'A data está próxima da mudança do ano solar (Li Chun). Sem horário e fuso confirmados, o resultado permanece indeterminado.'
const HORA_MS = 3_600_000
const DIA_MS = 24 * HORA_MS
const MARGEM_MS = efemerides.uncertaintyMinutes * 60_000
const INSTANTES: Record<string, string> = efemerides.events

export interface DataSolar { anoCivil: number; anoSolar: number }
export type ResultadoAnoSolar = { estado: 'determinado'; data: DataSolar }
  | { estado: 'invalido' | 'fora_da_cobertura' | 'indeterminado' }

export function instanteLiChun(ano: number): Date | null {
  const iso = Number.isInteger(ano) ? INSTANTES[String(ano)] : undefined
  return iso ? new Date(iso) : null
}

function camposCivis(ano: number, mes: number, dia: number): boolean {
  if (ano < 1 || ano > 9999 || mes < 1 || mes > 12 || dia < 1) return false
  const bissexto = ano % 4 === 0 && (ano % 100 !== 0 || ano % 400 === 0)
  return dia <= [31, bissexto ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][mes - 1]
}

function dataNoFuso(instant: number, timeZone: string): string {
  const partes = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(instant)
  const valor = (type: string) => partes.find(p => p.type === type)!.value
  return `${valor('year')}-${valor('month')}-${valor('day')}`
}

/** Civil dates do not silently become midnight or inherit the server/browser zone. */
export function avaliarAnoSolar(data: string | Date | null | undefined, fuso?: string): ResultadoAnoSolar {
  if (!data) return { estado: 'invalido' }
  let ano: number, inicio: number, fim: number
  if (fuso !== undefined) {
    try { new Intl.DateTimeFormat('en', { timeZone: fuso }) } catch { return { estado: 'invalido' } }
  }
  if (typeof data === 'string') {
    const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(Z|[+-]\d{2}:\d{2}))?$/.exec(data)
    if (!m) return { estado: 'invalido' }
    ano = Number(m[1])
    if (!camposCivis(ano, Number(m[2]), Number(m[3]))) return { estado: 'invalido' }
    if (m[4] !== undefined) {
      if (Number(m[4]) > 23 || Number(m[5]) > 59 || Number(m[6]) > 59) return { estado: 'invalido' }
      if (m[8] !== 'Z') {
        const [h, min] = m[8].slice(1).split(':').map(Number)
        if (h > 14 || min > 59 || (h === 14 && min !== 0)) return { estado: 'invalido' }
      }
      return avaliarAnoSolar(new Date(data), fuso)
    }
    const corte = instanteLiChun(ano)?.getTime()
    if (corte === undefined) return { estado: 'fora_da_cobertura' }
    if (fuso) {
      const antes = dataNoFuso(corte - MARGEM_MS, fuso)
      const depois = dataNoFuso(corte + MARGEM_MS, fuso)
      if (data >= antes && data <= depois) return { estado: 'indeterminado' }
      return { estado: 'determinado', data: { anoCivil: ano, anoSolar: data < antes ? ano - 1 : ano } }
    }
    // Without location, the same civil day spans UTC+14 through UTC-12.
    const meiaNoiteUTC = Date.parse(`${data}T00:00:00Z`)
    inicio = meiaNoiteUTC - 14 * HORA_MS
    fim = meiaNoiteUTC + DIA_MS + 12 * HORA_MS
  } else {
    if (!(data instanceof Date) || !Number.isFinite(data.getTime())) return { estado: 'invalido' }
    ano = fuso ? Number(dataNoFuso(data.getTime(), fuso).slice(0, 4)) : data.getUTCFullYear()
    inicio = fim = data.getTime()
  }
  const corte = instanteLiChun(ano)?.getTime()
  if (corte === undefined) return { estado: 'fora_da_cobertura' }
  if (fim >= corte - MARGEM_MS && inicio <= corte + MARGEM_MS) return { estado: 'indeterminado' }
  return { estado: 'determinado', data: { anoCivil: ano, anoSolar: fim < corte ? ano - 1 : ano } }
}

export function avisoAnoSolar(data: string | Date | null | undefined): string | null {
  if (!data) return null
  const resultado = avaliarAnoSolar(data)
  if (resultado.estado === 'indeterminado') return AVISO_ANO_SOLAR
  if (resultado.estado === 'invalido') return 'Confira a data informada: ela não corresponde a uma data válida.'
  if (resultado.estado === 'fora_da_cobertura') return 'Esta data está fora do intervalo disponível para o cálculo do ano solar (1864–2100).'
  return null
}
