export interface PlantInfo {
  id: string
  nome: string
  nomeCientifico: string
  categoria: string
  icon: string
  phIdeal: string
  tempIdeal: string
  ciclo: string
  nutrientes: { N: string; P: string; K: string }
  descricao: string
}

export interface AduboRecomendado {
  nome: string
  tipo: string
  npk: string
  aplicacao: string
  dosagem: string
  frequencia: string
  icon: string
}

export interface TubeteRecomendado {
  tamanho: string
  volume: string
  substrato: string
  aduboBase: string
  tempoMuda: string
  instrucoes: string[]
}

export interface RegiaoInfo {
  id: string
  nome: string
  estados: string
  clima: string
  soloTipico: string
  caracteristicas: string
}

export interface SoloInfo {
  id: string
  nome: string
  descricao: string
  correcao: string
  icon: string
}

export interface ProducaoInfo {
  id: string
  nome: string
  descricao: string
  icon: string
  escala: string
}

export interface ProblemaInfo {
  id: string
  nome: string
  descricao: string
  icon: string
  categoria: string
}

export interface Resultado {
  planta: PlantInfo
  regiao: RegiaoInfo
  solo: SoloInfo
  producao: ProducaoInfo
  problemas: ProblemaInfo[]
  adubos: AduboRecomendado[]
  tubete: TubeteRecomendado
  correcoesSolo: string[]
  manejo: string[]
}

export interface AIIdentificationResult {
  identified: boolean
  plantId: string | null
  plantName: string
  confidence: number
  description: string
  suggestion: string | null
}
