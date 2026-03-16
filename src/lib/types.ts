// ══════════════════════════════════════════════════════════════════════════════
// SHARED TYPES — FengShui Studio
// ══════════════════════════════════════════════════════════════════════════════

// ─── Utility / Enum Types ────────────────────────────────────────────────────

export type PlanType = 'freemium' | 'free' | 'simples' | 'pro' | 'profissional'

export type ConsultaStatus = 'rascunho' | 'em_andamento' | 'finalizada' | 'arquivada'

export type PagamentoStatus = 'pendente' | 'pago' | 'atrasado' | 'cancelado'

export type TipoUsuario =
  | 'pessoal'
  | 'consultor'
  | 'arquiteto'
  | 'feng_shui'
  | 'decorador'
  | 'outro_profissional'

export type TipoImovel = 'residencial' | 'comercial' | 'escritorio' | 'outro'

export type MetodoPagamento =
  | 'pix'
  | 'cartao'
  | 'boleto'
  | 'dinheiro'
  | 'transferencia'
  | 'outro'

export type FaseLunar = 'nova' | 'crescente' | 'cheia' | 'minguante'

export type RitualStatus = 'pendente' | 'concluido'

// ─── Domain Interfaces ───────────────────────────────────────────────────────

/** User profile from the 'profiles' table */
export interface Profile {
  id?: string
  nome_completo: string
  plano: PlanType | string
  tipo_usuario: TipoUsuario | string
  role: string
  nome_empresa?: string | null
  telefone?: string | null
  cidade?: string | null
  estado?: string | null
  bio?: string | null
  site?: string | null
  profissao?: string | null
  area_atuacao?: string | null
  registro_profissional?: string | null
  linkedin?: string | null
  instagram?: string | null
  parceiro_visivel?: boolean
  criado_em?: string
  atualizado_em?: string
}

/** Client from the 'clientes' table */
export interface Cliente {
  id: string
  consultor_id: string
  nome_completo: string
  email?: string | null
  telefone?: string | null
  cep?: string | null
  rua?: string | null
  numero?: string | null
  complemento?: string | null
  bairro?: string | null
  cidade?: string | null
  estado?: string | null
  pais?: string | null
  notas?: string | null
  foto_url?: string | null
  ativo: boolean
  criado_em: string
  atualizado_em?: string
}

/** Photo group for a room in the property */
export interface FotoComodo {
  comodo: string
  fotos: string[]
  ordem: number
}

/** Consultation from the 'consultas' table */
export interface Consulta {
  id: string
  consultor_id: string
  cliente_id: string
  nome_imovel?: string | null
  tipo_imovel?: TipoImovel | string | null
  area_total_m2?: number | null
  endereco_imovel?: string | null
  porta_posicao?: string | null
  bagua_imagem?: string | null
  foto_geral_url?: string | null
  fotos_comodos?: FotoComodo[] | null
  bagua_entrada?: { x: number; y: number; lado: string } | null
  status: ConsultaStatus
  roda_da_vida?: Record<string, number> | null
  checklist_chi?: string[] | null
  posicao_comando?: Record<string, string[]> | null
  criado_em: string
  atualizado_em?: string
  /** Joined relation */
  clientes?: { nome_completo: string } | null
}

/** Ba Gua sector from the 'setores_bagua' table */
export interface SetorBagua {
  id: string
  consulta_id: string
  nome: string
  numero: number
  elemento?: string
  cor_associada?: string
  posicao_grid?: string
  score_percentual?: number | null
  recomendacoes_custom?: RecomendacaoCustom[] | null
  comodo_tipo?: string | null
  criado_em?: string
  /** Joined relation */
  diagnostico_criterios?: DiagnosticoCriterio[]
}

/** Diagnostic criterion from the 'diagnostico_criterios' table */
export interface DiagnosticoCriterio {
  id?: string
  setor_id: string
  criterio: string
  score: number
  notas?: string | null
}

/** Custom recommendation attached to a setor_bagua (stored as JSONB) */
export interface RecomendacaoCustom {
  tipo: 'urgente' | 'melhoria' | 'manutencao'
  texto: string
  produtos: string[]
}

/** Payment from the 'pagamentos' table */
export interface Pagamento {
  id: string
  consultor_id: string
  cliente_id?: string | null
  consulta_id?: string | null
  descricao: string
  valor: number
  status: PagamentoStatus
  data_vencimento: string
  data_pagamento?: string | null
  metodo_pagamento?: MetodoPagamento | string | null
  observacoes?: string | null
  criado_em?: string
  atualizado_em?: string
  /** Joined relations */
  clientes?: { nome_completo: string } | null
  consultas?: { nome_imovel: string } | null
}

/** Ritual from the 'rituais' table */
export interface Ritual {
  id: string
  consultor_id: string
  cliente_id?: string | null
  titulo: string
  descricao?: string | null
  fase_lunar: FaseLunar
  data_ritual: string
  horario?: string | null
  tipo: string
  status: RitualStatus
  criado_em?: string
  /** Joined relation */
  clientes?: { nome_completo: string } | null
}

/** Affiliate product (static data, not a DB table) */
export interface ProdutoAfiliado {
  nome: string
  desc: string
  tag: string
  preco: string
}

// ─── Admin Types ────────────────────────────────────────────────────────────

export type ActivationKeyStatus = 'available' | 'used' | 'expired' | 'cancelled'

export interface ActivationKey {
  id: string
  key: string
  plan_type: string
  status: ActivationKeyStatus
  created_at: string
  expires_at?: string | null
  used_at?: string | null
  used_by?: string | null
  note?: string | null
  created_by?: string | null
  /** Joined relation */
  used_by_profile?: { nome_completo: string; id: string } | null
}

export interface AuditLogEntry {
  id: string
  action: string
  target_type?: string | null
  target_id?: string | null
  details?: Record<string, unknown> | null
  performed_by?: string | null
  performed_at: string
  /** Joined relation */
  performer?: { nome_completo: string } | null
}

// ─── Dashboard Chart Types ───────────────────────────────────────────────────

export interface StatusChartEntry {
  name: string
  value: number
  color: string
}

export interface PagamentoMesChartEntry {
  mes: string
  Recebido: number
  Pendente: number
  Atrasado: number
}

export interface ConsultaMesChartEntry {
  mes: string
  consultas: number
}

export interface ClienteMesChartEntry {
  mes: string
  clientes: number
}

export interface AgendaItem {
  tipo: 'ritual' | 'consulta' | 'pagamento'
  titulo: string
  subtitulo: string
  data: string
  horario: string | null
  icon: string
  cor: string
}
