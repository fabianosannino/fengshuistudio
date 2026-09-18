import type { FonteRelatorio } from './relatorio-emissao'
import type { ExecucoesMetodos } from './execucao-metodos'
import type { Orientacao } from './orientacao'

export const TABELA_ANALISES = 'analises_execucoes'
export const VERSAO_MOTOR_ANALISE = 'fengshui-2026.09-historico-1'
export const LIMITE_ANALISES = 100
export const PAGINA_ANALISES = 20
export const CAMPOS_ANALISE =
  'id,consulta_id,criado_em,metodo,variante,versao_motor,fonte_sha256'

export interface ResultadoAnalise {
  orientacao: Orientacao
  metodos: ExecucoesMetodos
  setores: {
    numero: number
    nome: string
    falta: number
    excesso: number
    saldo: number
    geometria: number
    nota: number | null
  }[]
}
export interface ResumoAnalise {
  id: string
  consulta_id: string
  criado_em: string
  metodo: 'btb' | 'bussola'
  variante: 'btb-porta' | 'bussola-octantes'
  versao_motor: string
  fonte_sha256: string
}
export interface AnaliseSalva extends ResumoAnalise {
  fonte: FonteRelatorio
  resultado: ResultadoAnalise
}

export function estadoDoRegistro(r: ResumoAnalise, hashAtual: string): string {
  if (r.versao_motor !== VERSAO_MOTOR_ANALISE) return 'Versão anterior do motor'
  return r.fonte_sha256 === hashAtual
    ? 'Corresponde aos dados atuais'
    : 'Dados ou método diferentes dos atuais'
}

export function comparacaoPermitida(a: AnaliseSalva, b: AnaliseSalva): string {
  if (a.metodo !== b.metodo)
    return 'Métodos diferentes: compare as leituras lado a lado. As notas não definem qual escola é melhor.'
  return 'Compare os dados, os setores e a orientação de cada versão. Alterações posteriores não modificam os resultados salvos.'
}
