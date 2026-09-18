import type Stripe from 'stripe'
import { PRECOS_DOS_PLANOS } from './plano-utils'

export type PlanoPago = 'simples' | 'profissional'
export type CicloCobranca = 'monthly' | 'yearly'
export interface EscolhaAssinatura { plan_slug: PlanoPago; billing_cycle: CicloCobranca }
export const COMBINACOES_ASSINATURA = [
  { plan_slug: 'simples', billing_cycle: 'monthly', variavel: 'STRIPE_PRICE_SIMPLES_MONTHLY' },
  { plan_slug: 'simples', billing_cycle: 'yearly', variavel: 'STRIPE_PRICE_SIMPLES_YEARLY' },
  { plan_slug: 'profissional', billing_cycle: 'monthly', variavel: 'STRIPE_PRICE_PRO_MONTHLY' },
  { plan_slug: 'profissional', billing_cycle: 'yearly', variavel: 'STRIPE_PRICE_PRO_YEARLY' },
] as const

export function escolhaAssinatura(valor: unknown): EscolhaAssinatura | null {
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) return null
  const obj = valor as Record<string, unknown>
  if (Object.keys(obj).some(k => !['plan_slug', 'billing_cycle'].includes(k))) return null
  if (typeof obj.plan_slug !== 'string' || typeof obj.billing_cycle !== 'string'
    || !['simples', 'profissional'].includes(obj.plan_slug) || !['monthly', 'yearly'].includes(obj.billing_cycle)) return null
  return { plan_slug: obj.plan_slug as PlanoPago, billing_cycle: obj.billing_cycle as CicloCobranca }
}

export function idDoPreco(escolha: EscolhaAssinatura, env: Record<string, string | undefined>): string | null {
  const config = COMBINACOES_ASSINATURA.find(c => c.plan_slug === escolha.plan_slug && c.billing_cycle === escolha.billing_cycle)!
  const id = env[config.variavel]
  return id && /^price_[a-zA-Z0-9]+$/.test(id) ? id : null
}

export function modoStripe(chave?: string): boolean | null {
  if (/^[sr]k_live_/.test(chave ?? '')) return true
  if (/^[sr]k_test_/.test(chave ?? '')) return false
  return null
}

/** Mesmo validador no checkout e na conferência das quatro combinações. */
export function problemasDoPreco(preco: Stripe.Price, escolha: EscolhaAssinatura, live: boolean, exigirAtivo = true, exigirProdutoExpandido = true): string[] {
  const problemas: string[] = []
  const valor = PRECOS_DOS_PLANOS[escolha.plan_slug][escolha.billing_cycle === 'monthly' ? 'mensalCentavos' : 'anualCentavos']
  if (exigirAtivo && !preco.active) problemas.push('preco_inativo')
  if (preco.currency !== 'brl' || preco.unit_amount !== valor) problemas.push('valor_ou_moeda')
  if (preco.livemode !== live) problemas.push('ambiente')
  if (preco.type !== 'recurring' || preco.recurring?.interval !== (escolha.billing_cycle === 'monthly' ? 'month' : 'year')
    || preco.recurring?.interval_count !== 1 || preco.recurring?.usage_type !== 'licensed') problemas.push('recorrencia')
  if (preco.billing_scheme !== 'per_unit' || preco.transform_quantity || preco.custom_unit_amount) problemas.push('valor_variavel')
  const produto = preco.product
  if (typeof produto === 'string' && !exigirProdutoExpandido) {
    if (!/^prod_[a-zA-Z0-9]+$/.test(produto)) problemas.push('produto_invalido')
  } else if (typeof produto !== 'object' || !produto || ('deleted' in produto && produto.deleted)) problemas.push('produto_nao_verificado')
  else if (exigirAtivo && !('active' in produto && produto.active)) problemas.push('produto_inativo')
  return problemas
}

/** A assinatura tem de corresponder ao Price configurado, nunca só a metadata ou valor. */
export function escolhaPeloPreco(preco: Stripe.Price, env: Record<string, string | undefined>): EscolhaAssinatura | null {
  const candidatos = COMBINACOES_ASSINATURA.filter(c => idDoPreco(c, env) === preco.id)
  if (candidatos.length !== 1) return null
  const escolha = candidatos[0]
  const modo = modoStripe(env.STRIPE_SECRET_KEY)
  // Eventos não expandem produto. O ID vem do Price autenticado pelo Stripe;
  // a conferência do catálogo no checkout verifica o objeto expandido.
  if (modo === null || problemasDoPreco(preco, escolha, modo, false, false).length) return null
  return { plan_slug: escolha.plan_slug, billing_cycle: escolha.billing_cycle }
}
