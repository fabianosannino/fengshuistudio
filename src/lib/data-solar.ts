/** Shared solar-year adapter. Invalid or ambiguous dates never get a guessed year. */
import { avaliarAnoSolar, type DataSolar } from './ano-solar'
export type { DataSolar } from './ano-solar'

export function dataSolar(data: string | Date | null | undefined, fuso?: string): DataSolar | null {
  const resultado = avaliarAnoSolar(data, fuso)
  return resultado.estado === 'determinado' ? resultado.data : null
}
