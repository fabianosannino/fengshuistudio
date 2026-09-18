import { normalizarGraus } from './graus'

export const ORIGENS_ORIENTACAO = ['manual', 'tres_leituras', 'sensor', 'mapa', 'questionario', 'legado_confirmado'] as const
export type OrigemOrientacao = typeof ORIGENS_ORIENTACAO[number]
export type ReferenciaOrientacao = 'magnetico' | 'verdadeiro'
export interface DadosOrientacao {
  orientacao_graus?: number | null
  orientacao_referencia?: string
  orientacao_estado?: 'ausente' | 'nao_confirmada' | 'confirmada'
  orientacao_origem?: string
  orientacao_confirmada_em?: string | null
}
export interface Orientacao {
  estado: 'ausente' | 'nao_confirmada' | 'confirmada'
  graus: number | null
  referencia: ReferenciaOrientacao | null
  origem: OrigemOrientacao | 'nao_registrada'
  confirmadaEm: string | null
}

/** Legado conserva o número, mas não ganha uma medição confirmada retroativa. */
export function lerOrientacao(dados?: DadosOrientacao | null): Orientacao {
  const graus = typeof dados?.orientacao_graus === 'number' && Number.isFinite(dados.orientacao_graus)
    ? normalizarGraus(dados.orientacao_graus) : null
  const referencia = dados?.orientacao_referencia === 'magnetico' || dados?.orientacao_referencia === 'verdadeiro'
    ? dados.orientacao_referencia : null
  const origem = ORIGENS_ORIENTACAO.includes(dados?.orientacao_origem as OrigemOrientacao)
    ? dados!.orientacao_origem as OrigemOrientacao : 'nao_registrada'
  const instante = dados?.orientacao_confirmada_em
  const confirmadaEm = typeof instante === 'string' && Number.isFinite(Date.parse(instante)) ? instante : null
  const confirmada = dados?.orientacao_estado === 'confirmada' && graus !== null && referencia !== null
    && origem !== 'nao_registrada' && confirmadaEm !== null
  return { estado: graus === null ? 'ausente' : confirmada ? 'confirmada' : 'nao_confirmada', graus, referencia, origem, confirmadaEm: confirmada ? confirmadaEm : null }
}

export function grausConfirmados(dados?: DadosOrientacao | null): number | null {
  const leitura = lerOrientacao(dados)
  return leitura.estado === 'confirmada' ? leitura.graus : null
}

export const AVISO_ORIENTACAO = 'Confirme a direção da fachada e a referência de Norte para usar os cálculos de bússola. O BTB não exige essa leitura.'
