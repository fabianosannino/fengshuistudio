import { SECOES, type Secao } from './formato-do-relatorio'
import type { Consulta, Profile, SetorBagua } from './types'
import type { SnapshotScore } from './reavaliacao'
import { lerOrientacao, type Orientacao } from './orientacao'

/** C1/C2: solar-year ephemeris, continuous annual cycle and geometric unions. */
export const VERSOES_RELATORIO = {
  entrada: '2', motor: 'fengshui-2026.09-c1c2', template: 'relatorio-2.2.0',
} as const
// Vercel aceita 4,5 MB por request; 4 MiB deixam margem para multipart.
// O bucket mantém 20 MiB para preservar arquivos legados maiores.
export const MAX_PDF_RELATORIO = 4 * 1024 * 1024
export const AVISO_PDF_EXCESSIVO = 'O PDF ultrapassou 4 MB. Escolha menos seções ou o formato Resumo e tente novamente.'
export const MAX_ENTRADA_RELATORIO = 2 * 1024 * 1024
export const BUCKET_RELATORIO = 'relatorios'
export const TABELA_EMISSOES = 'relatorio_emissoes'
export const CAMPOS_HISTORICO_RELATORIO = 'id,consulta_id,estado,revisao_de,criado_em,concluido_em,versao_motor,versao_template,entrada_sha256,pdf_sha256'
export const PRAZO_PREPARACAO_MS = 15 * 60 * 1000
export const ESPERA_EXCLUSAO_PREPARADA_MS = 30 * 60 * 1000

export interface FonteRelatorio {
  consulta: Consulta
  perfil: Profile
  setores: SetorBagua[]
  evolucao: { tipo: string; scores: SnapshotScore[]; criado_em: string }[]
  chi_custom: { id: string; label: string }[]
}
export interface EdicaoRelatorio {
  secoes: Record<Secao, boolean>
  textos: { introducao: string; curas: string; chi: string; conclusao: string }
  recomendacoes: Record<string, string>
}
export interface EntradaRelatorio {
  versoes: typeof VERSOES_RELATORIO
  fonte: FonteRelatorio
  edicao: EdicaoRelatorio
  referencia_temporal: string
  fuso: string
  metodo: string
  variante: 'btb-porta' | 'ba-zhai-assento-octantes' | 'nao_informada'
  orientacao: Orientacao
}
export interface EmissaoRelatorio {
  id: string
  consulta_id: string
  estado: 'preparada' | 'concluida' | 'legado'
  revisao_de: string | null
  criado_em: string
  concluido_em: string | null
  versao_motor: string | null
  versao_template: string | null
  entrada_sha256: string | null
  pdf_sha256: string | null
}

export function objeto(valor: unknown): valor is Record<string, unknown> {
  return !!valor && typeof valor === 'object' && !Array.isArray(valor)
}
export function idValido(valor: unknown): valor is string {
  return typeof valor === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(valor)
}
export function hashValido(valor: unknown): valor is string {
  return typeof valor === 'string' && /^[a-f0-9]{64}$/.test(valor)
}

/** Canonicalização compartilhada por hashes: objetos ordenados, arrays preservados. */
export function jsonCanonico(valor: unknown): string {
  if (valor === null || typeof valor === 'string' || typeof valor === 'boolean') return JSON.stringify(valor)
  if (typeof valor === 'number' && Number.isFinite(valor)) return JSON.stringify(valor)
  if (Array.isArray(valor)) return `[${valor.map(jsonCanonico).join(',')}]`
  if (objeto(valor)) {
    return `{${Object.keys(valor).sort().map(k => `${JSON.stringify(k)}:${jsonCanonico(valor[k])}`).join(',')}}`
  }
  throw new Error('Entrada não serializável')
}

export function validarEdicao(valor: unknown, setores: readonly string[]): EdicaoRelatorio | null {
  if (!objeto(valor) || Object.keys(valor).some(k => !['secoes', 'textos', 'recomendacoes'].includes(k))) return null
  const { secoes, textos, recomendacoes } = valor
  if (!objeto(secoes) || Object.keys(secoes).length !== SECOES.length || SECOES.some(s => typeof secoes[s] !== 'boolean')) return null
  if (!SECOES.some(s => secoes[s])) return null
  const nomes = ['introducao', 'curas', 'chi', 'conclusao']
  if (!objeto(textos) || Object.keys(textos).length !== nomes.length || nomes.some(k => typeof textos[k] !== 'string' || textos[k].length > 10000)) return null
  if (!objeto(recomendacoes) || Object.entries(recomendacoes).some(([id, texto]) => !setores.includes(id) || typeof texto !== 'string' || texto.length > 5000)) return null
  return JSON.parse(JSON.stringify(valor)) as EdicaoRelatorio
}

export function referenciaValida(iso: unknown, fuso: unknown, agora: Date): boolean {
  if (typeof iso !== 'string' || typeof fuso !== 'string' || fuso.length > 100) return false
  const data = new Date(iso)
  if (!Number.isFinite(data.getTime()) || data.toISOString() !== iso) return false
  // Uma página antiga precisa recarregar suas entradas antes de emitir.
  if (data.getTime() > agora.getTime() || agora.getTime() - data.getTime() > 24 * 3600 * 1000) return false
  try { new Intl.DateTimeFormat('pt-BR', { timeZone: fuso }); return true } catch { return false }
}

export function criarEntradaRelatorio(fonte: FonteRelatorio, edicao: EdicaoRelatorio, referencia: string, fuso: string): EntradaRelatorio {
  const bagua = fonte.consulta.bagua_entrada
  return {
    versoes: { ...VERSOES_RELATORIO }, fonte, edicao, referencia_temporal: referencia, fuso,
    metodo: bagua?.escola || 'nao_informado',
    variante: bagua?.escola === 'bussola' ? 'ba-zhai-assento-octantes' : bagua?.escola === 'btb' ? 'btb-porta' : 'nao_informada',
    orientacao: lerOrientacao(bagua),
  }
}

export function pdfTemAssinatura(bytes: Uint8Array): boolean {
  const decoder = new TextDecoder('ascii')
  return bytes.length > 12 && bytes.length <= MAX_PDF_RELATORIO
    && /^%PDF-\d\.\d/.test(decoder.decode(bytes.subarray(0, 8)))
    && /%%EOF\s*$/.test(decoder.decode(bytes.subarray(Math.max(0, bytes.length - 1024))))
}
