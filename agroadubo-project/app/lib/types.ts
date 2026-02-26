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
  // Campos Yara
  brand?: string
  linha?: string
  sku?: string
  embalagens?: string[]
  diferencial?: string
}

export interface TubeteRecomendado {
  tamanho: string
  volume: string
  substrato: string
  aduboBase: string
  tempoMuda: string
  instrucoes: string[]
  // Campos Tamoios + Yara
  brand?: string
  receitaId?: string
  receitaNome?: string
  tecnologiaPodaAerea?: boolean
  biodegradavel?: boolean
  biomassa?: string
  nutrientesImpregnados?: string[]
  liberacaoGradualDias?: number
  arquiteturaRadicular?: string
}

// --- Produtos e Catalogo Yara/Tamoios ---

export type ProductCategory = 'Fertilizante' | 'Tubete' | 'Bioestimulante' | 'Corretivo'

export interface Product {
  id: string
  brand: 'Yara' | 'Tamoios' | 'Generico'
  linha: string
  nome: string
  category: ProductCategory
  composicao: { N?: number; P?: number; K?: number; [micro: string]: number | undefined }
  embalagens: string[]
  esgScore: number
  diferencial: string
}

// --- Receitas de Tubetes (Fertilizacao On-Delivery) ---

export interface TubeteFormulation {
  id: string
  culturaAlvo: string
  categoriaPlanta: string
  biomassaTipo: string
  nutrientesImpregnados: string[] // IDs de Product
  receitaYara: string
  liberacaoDias: number
  porosidade: string
  tamanhoTubete: string
  volumeTubete: string
}

// --- ESG / Sustentabilidade ---

export interface ESGMetrics {
  plasticoEvitadoKg: number
  reducaoCO2Percent: number
  conformidadeEUDR: boolean
  origemBiomassa: string
  spinoffUSP: boolean
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
  esg?: ESGMetrics
}

export interface AIIdentificationResult {
  identified: boolean
  plantId: string | null
  plantName: string
  confidence: number
  description: string
  suggestion: string | null
}
