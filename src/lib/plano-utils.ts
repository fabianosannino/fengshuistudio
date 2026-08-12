// ══════════════════════════════════════════════════════════════════════════════
// PLAN UTILITIES — FengShui Studio
// Canonical source for plan rules. All plan checks should use these helpers.
// ══════════════════════════════════════════════════════════════════════════════

export type PlanoEfetivo = 'free' | 'simples' | 'profissional'

/** Professional user types — used across all pages for consistent detection */
export const PROF_TYPES = ['consultor', 'arquiteto', 'feng_shui', 'decorador', 'outro_profissional'] as const

/**
 * Determine if a user profile represents a professional user.
 * Only the stored plan (from payment or activation key) grants professional access.
 * tipo_usuario and role are informational only — they do NOT grant paid features.
 */
export function isProfissional(profile?: { plano?: string | null; tipo_usuario?: string | null; role?: string | null } | null): boolean {
  if (!profile) return false
  return planoEfetivo(profile.plano) === 'profissional'
}

/**
 * Resolve the effective plan considering the user's professional status.
 * Professional users always get 'profissional' features regardless of DB plan field.
 */
export function planoUsuario(profile?: { plano?: string | null; tipo_usuario?: string | null; role?: string | null } | null): PlanoEfetivo {
  if (isProfissional(profile)) return 'profissional'
  return planoEfetivo(profile?.plano)
}

/**
 * O vocabulário do banco não é o do app.
 *
 * A coluna `profiles.plano` é do enum `plano_tipo`, cujos valores são
 * `freemium | starter | pro | agencia` — nomes de uma versão anterior do
 * produto. O app fala `free | simples | profissional`. Os dois precisam se
 * encontrar em algum lugar, e é aqui.
 *
 * Escrever no banco um valor do vocabulário do app derruba a transação:
 * `invalid input value for enum plano_tipo: "free"`. Use `enumDoPlano`.
 */
const ENUM_PARA_PLANO: Record<string, PlanoEfetivo> = {
  freemium: 'free',
  free: 'free',
  starter: 'simples',
  simples: 'simples',
  pro: 'profissional',
  profissional: 'profissional',
  // `agencia` não tem correspondente no app. Vira 'profissional' porque é o
  // teto: quem paga por agência não pode acordar com menos do que já tinha.
  agencia: 'profissional',
}

/**
 * Resolve o plano efetivo a partir do valor gravado.
 *
 * `starter` mapeava para 'free' por omissão — o usuário pagava o Simples e o
 * app lhe entregava o gratuito. `agencia` tinha o mesmo destino.
 */
export function planoEfetivo(plano?: string | null): PlanoEfetivo {
  if (!plano) return 'free'
  return ENUM_PARA_PLANO[plano.toLowerCase().trim()] ?? 'free'
}

/**
 * O valor do enum que a coluna `profiles.plano` aceita.
 *
 * Sem esta tradução, `update({ plano: 'free' })` falha e a troca de plano
 * inteira volta 500 — foi o que aconteceu com todo clique em «mudar plano»,
 * porque a tela manda o vocabulário do app e a rota gravava o valor cru.
 */
export function enumDoPlano(plano: PlanoEfetivo): 'freemium' | 'starter' | 'pro' {
  if (plano === 'profissional') return 'pro'
  if (plano === 'simples') return 'starter'
  return 'freemium'
}

/**
 * Plan display label
 */
export function planoLabel(plano?: string | null): string {
  const p = planoEfetivo(plano)
  if (p === 'profissional') return 'Profissional'
  if (p === 'simples') return 'Simples'
  return 'Free'
}

// ─── LIMITES E MENSAGENS — fonte única ─────────────────────────────────────────
//
// Antes desta seção a mesma regra existia em três lugares com três respostas.
// Para clientes: `podeClientes()` dizia "não" a qualquer plano fora do
// Profissional, `/api/clientes` permitia 5, e a tela dizia "disponível no plano
// Profissional". Para PDF: a página de preços prometia marca d'água ao Free e
// `podePDF('free')` devolvia 'bloqueado'. E o plano Simples, pago, permitia
// MENOS imóveis (1) que o Free (3).
//
// ## Decisões de produto tomadas aqui (12/08/2026)
//
// 1. **O Simples passa a permitir 10 imóveis ativos.** Um plano pago mais
//    restrito que o gratuito não se sustenta. 10 mantém o "ilimitado" como
//    diferencial real do Profissional.
// 2. **O Free gera PDF com marca d'água.** É o que a página de preços promete e
//    o que foi vendido; o código é que estava mais restrito que o contrato.
// 3. **O Free não cadastra cliente externo.** Aqui vale o inverso: é o que a
//    página de preços vende (clientes só aparecem no Profissional) e o que
//    `podeClientes()` e a tela já diziam. Os 5 da API eram o ponto fora da
//    curva. Free é o plano "para minha casa".
// 4. **A cota conta imóveis ATIVOS, para todos os planos.** Antes o Free
//    contava total e o Simples contava ativos — duas semânticas na mesma regra.
//    Consulta arquivada ou deletada não ocupa vaga em nenhum plano.

/**
 * Status que ocupam vaga na cota de imóveis.
 *
 * Arquivada e deletada não entram. Isto também corrige um bug real: a rota
 * filtrava `status != 'arquivado'`, no masculino, e o enum é `'arquivada'` — o
 * filtro nunca casava, então arquivar não liberava vaga nenhuma e a mensagem
 * "arquive o atual ou faça upgrade" mandava o usuário para um beco sem saída.
 */
export const STATUS_OCUPAM_VAGA = ['rascunho', 'em_andamento', 'finalizada', 'sem_analise'] as const

/** Status que NÃO ocupam vaga — use com `.not('status','in',...)` no Supabase. */
export const STATUS_LIBERAM_VAGA = ['arquivada', 'deletada'] as const

export interface RegraDePlano {
  /** Imóveis ativos simultâneos. `null` = ilimitado. */
  imoveis: number | null
  /** Clientes externos ativos. `null` = ilimitado, `0` = recurso não incluído. */
  clientes: number | null
  pdf: 'bloqueado' | 'marca_dagua' | 'limpo'
  calendario: boolean
  parceiros: 'bloqueado' | 'visualizar' | 'completo'
  multiplasAnalises: boolean
  historico: boolean
}

export const REGRAS_DE_PLANO: Record<PlanoEfetivo, RegraDePlano> = {
  free: {
    imoveis: 3,
    clientes: 0,
    pdf: 'marca_dagua',
    calendario: false,
    parceiros: 'bloqueado',
    multiplasAnalises: false,
    historico: false,
  },
  simples: {
    imoveis: 10,
    clientes: 25,
    pdf: 'marca_dagua',
    calendario: true,
    parceiros: 'visualizar',
    multiplasAnalises: false,
    historico: false,
  },
  profissional: {
    imoveis: null,
    clientes: null,
    pdf: 'limpo',
    calendario: true,
    parceiros: 'completo',
    multiplasAnalises: true,
    historico: true,
  },
}

/** Max simultaneous properties (consultas). `null` = ilimitado. */
export function limiteImoveis(plano: PlanoEfetivo): number | null {
  return REGRAS_DE_PLANO[plano].imoveis
}

/** Max active external clients. `null` = ilimitado, `0` = não incluído. */
export function limiteClientes(plano: PlanoEfetivo): number | null {
  return REGRAS_DE_PLANO[plano].clientes
}

/** Can register external clients at all? */
export function podeClientes(plano: PlanoEfetivo): boolean {
  const limite = REGRAS_DE_PLANO[plano].clientes
  return limite === null || limite > 0
}

/** Can access calendar? */
export function podeCalendario(plano: PlanoEfetivo): boolean {
  return REGRAS_DE_PLANO[plano].calendario
}

/** Can generate PDF? */
export function podePDF(plano: PlanoEfetivo): 'bloqueado' | 'marca_dagua' | 'limpo' {
  return REGRAS_DE_PLANO[plano].pdf
}

/** Can access partner network? */
export function podeParceiros(plano: PlanoEfetivo): 'bloqueado' | 'visualizar' | 'completo' {
  return REGRAS_DE_PLANO[plano].parceiros
}

// ─── MENSAGENS ─────────────────────────────────────────────────────────────────
//
// Ficam aqui, e não em cada tela, porque uma mensagem que contradiz a regra é
// tão ruim quanto uma regra errada: manda o usuário fazer o que não resolve.

/** Mensagem de limite de imóveis atingido. `null` quando não há limite. */
export function mensagemLimiteImoveis(plano: PlanoEfetivo): string | null {
  const limite = REGRAS_DE_PLANO[plano].imoveis
  if (limite === null) return null
  const plural = limite === 1 ? 'imóvel ativo' : 'imóveis ativos'
  return `Você chegou ao limite de ${limite} ${plural} do plano ${planoLabel(plano)}. ` +
    'Arquive um imóvel que já entregou para abrir vaga, ou mude de plano.'
}

/** Mensagem de limite de clientes. `null` quando não há limite. */
export function mensagemLimiteClientes(plano: PlanoEfetivo): string | null {
  const limite = REGRAS_DE_PLANO[plano].clientes
  if (limite === null) return null
  if (limite === 0) {
    return 'O plano Free é para analisar a sua própria casa. Para cadastrar clientes ' +
      'e atendê-los, mude para o plano Simples ou Profissional.'
  }
  return `Você chegou ao limite de ${limite} clientes do plano ${planoLabel(plano)}. ` +
    'Desative um cliente que não atende mais, ou mude de plano.'
}

/** Resumo do que o plano inclui — a página de preços é gerada daqui. */
export function resumoDoPlano(plano: PlanoEfetivo): string[] {
  const r = REGRAS_DE_PLANO[plano]
  const linhas: string[] = []

  linhas.push(r.imoveis === null ? 'Imóveis ilimitados' : `Até ${r.imoveis} imóveis ativos`)

  if (r.clientes === null) linhas.push('Clientes ilimitados')
  else if (r.clientes > 0) linhas.push(`Até ${r.clientes} clientes`)
  else linhas.push('Para a sua própria casa')

  linhas.push('Análise Ba Guá completa')
  linhas.push('Roda da Vida e Fluxo do Chi')
  linhas.push('Curas e ativações')

  if (r.calendario) linhas.push('Calendário lunar')

  if (r.pdf === 'limpo') linhas.push('Relatório PDF com a sua marca')
  else if (r.pdf === 'marca_dagua') linhas.push("Relatório PDF com marca d'água")

  if (r.parceiros === 'completo') linhas.push('Rede de parceiros completa')
  else if (r.parceiros === 'visualizar') linhas.push('Rede de parceiros (visualizar)')

  return linhas
}

/** Can have multiple analyses per property? */
export function podeMultiplasAnalises(plano: PlanoEfetivo): boolean {
  return REGRAS_DE_PLANO[plano].multiplasAnalises
}

/** Can access analysis history? */
export function podeHistorico(plano: PlanoEfetivo): boolean {
  return REGRAS_DE_PLANO[plano].historico
}

// ── Preço ────────────────────────────────────────────────────────────────────

/**
 * O preço de cada plano, em centavos.
 *
 * ## Por que centavos
 *
 * É a unidade do Stripe (`unit_amount`), e é o que evita que R$ 49,90 vire
 * `49.9` e volte a ser exibido como «R$ 49,9» — ou pior, arredondado para 49.
 *
 * ## Por que aqui
 *
 * Estes números estavam escritos à mão em `/precos` e em `/planos`, e as duas
 * páginas discordavam entre si **e** do Stripe. O Profissional mensal era
 * anunciado como «R$ 49» nas duas e o cartão do cliente era debitado em
 * R$ 49,90. A página `/precos` ainda calculava o anual sozinha, assumindo dois
 * meses grátis (`49 × 10 ÷ 12 = 40,83`), enquanto o desconto real é de ~30%.
 *
 * Preço é dinheiro cobrado: não pode ter duas fontes, e a fonte não pode ser a
 * página. Estes valores são os do catálogo de produção do Stripe, que é quem
 * debita — a página anuncia, o Stripe cobra, e quem discorda dele mente ao
 * cliente.
 *
 * ## Ao mudar preço
 *
 * Mude no Stripe primeiro, depois aqui, e confira com:
 *
 *     STRIPE_SECRET_KEY=rk_... npx vite-node scripts/stripe/conferir-precos.mts
 *
 * Os IDs de preço correspondentes vivem nas variáveis `STRIPE_PRICE_*` — este
 * módulo guarda só o valor exibido, nunca o ID, porque ID de preço muda de
 * ambiente e valor não.
 */
export interface PrecoDoPlano {
  /** Cobrança mensal, em centavos. `0` no Free. */
  mensalCentavos: number
  /** Cobrança anual **total**, em centavos. `0` no Free. */
  anualCentavos: number
}

export const PRECOS_DOS_PLANOS: Record<PlanoEfetivo, PrecoDoPlano> = {
  free: { mensalCentavos: 0, anualCentavos: 0 },
  simples: { mensalCentavos: 2000, anualCentavos: 16800 },
  profissional: { mensalCentavos: 4990, anualCentavos: 41160 },
}

/**
 * Quanto sai por mês quem paga o ano inteiro, em centavos.
 *
 * Arredonda para baixo de propósito: exibir um centavo a mais do que o cliente
 * vai pagar por mês é anunciar acima do cobrado, que é justamente o defeito
 * que esta seção corrige.
 */
export function mensalEquivalenteCentavos(plano: PlanoEfetivo): number {
  return Math.floor(PRECOS_DOS_PLANOS[plano].anualCentavos / 12)
}

/**
 * Desconto do plano anual em pontos percentuais inteiros, ou `null` quando não
 * há preço (Free).
 *
 * `null` e não `0`: «sem desconto» e «não se aplica» são coisas diferentes, e
 * um selo de «0% de desconto» no Free seria ruído.
 */
export function descontoAnualPercentual(plano: PlanoEfetivo): number | null {
  const { mensalCentavos, anualCentavos } = PRECOS_DOS_PLANOS[plano]
  if (mensalCentavos === 0) return null
  const cheio = mensalCentavos * 12
  return Math.round((1 - anualCentavos / cheio) * 100)
}

/** `4990` → `'R$ 49,90'`. Centavos sempre com duas casas — preço não abrevia. */
export function formatarCentavos(centavos: number): string {
  return `R$ ${(centavos / 100).toFixed(2).replace('.', ',')}`
}

/**
 * Quanto uma assinatura vale por mês, em reais.
 *
 * ## Por que não sai da tabela `plans`
 *
 * O MRR era somado de `plans.price_monthly`, que é o preço **de tabela** — e a
 * tabela esteve cinco vezes acima do que o Stripe cobrava (R$ 97 contra
 * R$ 20,00). O painel reportou receita que não existia.
 *
 * Mesmo com a tabela corrigida, ela continua sendo a resposta errada: quem
 * assinou por outro valor — preço antigo, cupom, promoção — segue valendo o
 * que pagou, não o que a tabela pede hoje. `price_paid` é gravado do
 * `unit_amount` que o Stripe cobrou, então é o único número que descreve a
 * assinatura em vez do catálogo.
 *
 * `null` quando não há valor gravado: sem saber o que foi cobrado, não dá para
 * afirmar quanto a assinatura vale, e somar zero mentiria para baixo com a
 * mesma confiança com que a tabela mentia para cima. Quem chama decide o que
 * fazer com a ausência — e precisa declarar.
 */
export function mensalidadeDaAssinatura(assinatura: {
  price_paid?: number | null
  billing_cycle?: string | null
}): number | null {
  const pago = assinatura.price_paid
  if (typeof pago !== 'number' || pago < 0) return null
  return assinatura.billing_cycle === 'yearly' ? pago / 12 : pago
}
