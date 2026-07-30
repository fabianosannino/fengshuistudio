// ══════════════════════════════════════════════════════════════════════════════
// SHARED TYPES — FengShui Studio
// ══════════════════════════════════════════════════════════════════════════════

// ─── Utility / Enum Types ────────────────────────────────────────────────────

export type PlanType = 'freemium' | 'free' | 'simples' | 'pro' | 'profissional'

export type ConsultaStatus = 'rascunho' | 'em_andamento' | 'finalizada' | 'arquivada' | 'deletada' | 'sem_analise'

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
  /** Opcionais — usados para o cálculo do Ming Gua (número Kua). */
  data_nascimento?: string | null
  genero?: string | null
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

// ─── JSONB shapes (Supabase columns stored as untyped JSON) ──────────────────

/** A marking (falta/excesso) on the Ba Guá plan, persisted inside bagua_entrada */
export interface BaguaMarcacaoJSON {
  id?: string
  tipo?: string
  x?: number
  y?: number
  w?: number
  h?: number
}

/** Per-sector draft data persisted inside bagua_entrada.setores_rascunho */
export interface BaguaSetorRascunho {
  /** `null` numa posição = critério não avaliado (distinto de «Neutro»). */
  criterios?: (number | null)[]
  ajusteManual?: number | null
  ajusteTipo?: string | null
  obs?: string | null
}

/** Content of the consultas.bagua_entrada JSONB column (Ba Guá analysis state) */
export interface BaguaEntrada {
  x?: number
  y?: number
  lado?: string
  /** Metodologia usada no diagnóstico ('btb' | 'bussola') — ver src/lib/metodologias.ts. */
  escola?: string
  /** Orientação da fachada (0–359°, 0=Norte) — só a Escola da Bússola usa. Ver `orientacao_referencia`. */
  orientacao_graus?: number
  /**
   * Referência de Norte de `orientacao_graus` ('magnetico' | 'verdadeiro') —
   * ver `src/lib/declinacao-magnetica.ts`. Sem isto o grau é ambíguo: o Luo Pan
   * lê magnético, o Modo C (satélite) deriva verdadeiro, e a diferença no
   * Brasil chega a 2 Montanhas das 24.
   *
   * Ausente = consultas antigas, anteriores a este campo. Nesse caso assume-se
   * 'magnetico', que era o que a UI declarava na época (o rótulo do campo dizia
   * "direção magnética") — retrocompatibilidade explícita, não suposição nova.
   */
  orientacao_referencia?: string
  /** Declinação magnética do local (graus, Leste positivo) — informada pelo consultor. */
  declinacao_magnetica?: number | null
  /** Data de construção/reforma do imóvel (ISO) — usada por Estrelas Voadoras para o Período. */
  data_construcao?: string
  planta_url?: string
  planta_enviada_em?: string
  finalizada_em?: string
  etapa?: string
  rotacao?: number
  metragem_real?: number
  bordas?: { x: number; y: number; w: number; h: number } | null
  lh?: number[]
  lv?: number[]
  marcacoes?: BaguaMarcacaoJSON[]
  setores_rascunho?: BaguaSetorRascunho[]
  /**
   * Contorno real do imóvel para o Tai Ji (src/lib/poligono.ts), no mesmo
   * espaço de coordenadas de `bordas` (pixels da imagem rotacionada, não da
   * tela). Opcional — quando ausente, o Tai Ji usa os 4 cantos de `bordas`
   * (equivalente ao bounding box, sem ganho sobre o retângulo).
   */
  tai_ji_poligono?: { x: number; y: number }[] | null
}

/** Content of the consultas.roda_da_vida JSONB column */
export type RodaDaVida = Record<string, number | number[]>

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
  fotos_antes?: string[] | null
  fotos_depois?: string[] | null
  bagua_entrada?: BaguaEntrada | null
  num_moradores?: number | null
  historico_imovel?: string | null
  observacoes_topograficas?: string | null
  dados_adicionais?: string | null
  status: ConsultaStatus
  /** Caminho do PDF salvo no bucket privado 'relatorios' (persistência do relatório). */
  relatorio_pdf_path?: string | null
  relatorio_gerado_em?: string | null
  roda_da_vida?: Record<string, unknown> | null
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
  /** Coluna nova: vários cômodos por setor (substitui comodo_tipo). */
  comodos?: string[] | null
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

// ─── Billing / Subscription Types ────────────────────────────────────────────

export type SubscriptionStatus = 'active' | 'past_due' | 'cancelled' | 'trial' | 'paused' | 'gratuidade'
export type InvoiceStatus = 'pending' | 'paid' | 'overdue' | 'cancelled' | 'refunded'
export type BillingCycle = 'monthly' | 'yearly'

export interface Plan {
  id: string
  name: string
  slug: string
  price_monthly: number
  price_yearly: number
  description?: string | null
  features?: Record<string, unknown> | null
  is_active: boolean
  created_at: string
}

export interface Subscription {
  id: string
  user_id: string
  plan_id: string
  billing_cycle: BillingCycle
  status: SubscriptionStatus
  price_paid?: number | null
  started_at: string
  current_period_start?: string | null
  current_period_end?: string | null
  next_billing_date?: string | null
  cancelled_at?: string | null
  cancel_at_period_end?: boolean
  activated_by_key?: string | null
  gratuidade_motivo?: string | null
  created_at: string
  updated_at: string
  /** Joined */
  plans?: Plan | null
  profiles?: Pick<Profile, 'id' | 'nome_completo'> | null
}

export interface Invoice {
  id: string
  user_id: string
  subscription_id?: string | null
  plan_id?: string | null
  amount: number
  discount: number
  amount_paid: number
  status: InvoiceStatus
  billing_cycle?: string | null
  due_date: string
  paid_at?: string | null
  paid_manually?: boolean
  paid_method?: string | null
  paid_by_admin?: string | null
  description?: string | null
  installments: number
  installment_number: number
  notes?: string | null
  refunded_at?: string | null
  refund_amount?: number | null
  created_at: string
  /** Joined */
  plans?: Plan | null
  profiles?: Pick<Profile, 'id' | 'nome_completo'> | null
}

export interface PaymentNotification {
  id: string
  user_id: string
  invoice_id?: string | null
  type: string
  channel: string
  sent_at?: string | null
  read_at?: string | null
  content?: string | null
  created_at: string
}

export interface WeeklyReport {
  id: string
  week_start: string
  week_end: string
  generated_at: string
  data: Record<string, unknown>
  is_manual: boolean
  sent_to?: string[] | null
  created_at: string
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
