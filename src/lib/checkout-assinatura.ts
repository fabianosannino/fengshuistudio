import 'server-only'
import type Stripe from 'stripe'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { EscolhaAssinatura } from './catalogo-assinaturas'

// Stripe may prune idempotency keys after 24h. Never retry unknown creates then.
const JANELA_SEGURA_MS = 23 * 60 * 60 * 1000
const OPCOES_STRIPE = { timeout: 20_000, maxNetworkRetries: 1 }
const ESTADOS_TERMINAIS = new Set(['canceled', 'incomplete_expired'])

interface Tentativa {
  id: string; user_id: string; plano: string; ciclo: string; preco_id: string
  live: boolean; origem: string; customer_anterior: string | null
  customer_id: string | null; session_id: string | null; criada_em: string
  customer_criacao_em: string | null; session_criacao_em: string | null
}

export class CheckoutEmAndamento extends Error {
  constructor(public readonly portal = true) {
    super(portal
      ? 'Você já tem uma assinatura em andamento. Use o portal de cobrança para gerenciá-la.'
      : 'Há um pagamento anterior em aberto. Conclua-o ou aguarde sua expiração antes de iniciar outro.')
  }
}

function exigirJanelaSegura(inicio: string) {
  const idade = Date.now() - Date.parse(inicio)
  if (!Number.isFinite(idade) || idade < -60_000 || idade >= JANELA_SEGURA_MS) throw new Error('checkout_requer_reconciliacao')
}

function idDoObjeto(obj: string | { id: string } | null): string | null {
  return typeof obj === 'string' ? obj : obj?.id ?? null
}

function conferirSessao(session: Stripe.Checkout.Session, tentativa: Tentativa, customer: string) {
  if (session.mode !== 'subscription' || session.livemode !== tentativa.live
    || session.client_reference_id !== tentativa.id || idDoObjeto(session.customer) !== customer
    || (tentativa.session_id && session.id !== tentativa.session_id)) throw new Error('checkout_incompativel')
}

/** Owner always comes from the authenticated route; frozen records are service-only. */
export async function prepararCheckoutAssinatura(
  db: SupabaseClient, stripe: Stripe, usuario: string, escolha: EscolhaAssinatura,
  preco: string, live: boolean, origem: string,
): Promise<{ url: string; session_id: string }> {
  async function rpc<T>(nome: string, args: Record<string, unknown>): Promise<T> {
    const { data, error } = await db.rpc(nome, args)
    if (error || data === null || data === false) throw new Error('checkout_persistencia_indisponivel')
    return data as T
  }
  const registrar = (t: Tentativa, customer: string, session: string | null = null) => rpc<boolean>('registrar_checkout_assinatura', {
    p_usuario: usuario, p_tentativa: t.id, p_customer: customer, p_session: session,
  })
  const encerrar = (t: Tentativa, session: string | null) => rpc<boolean>('encerrar_checkout_assinatura', {
    p_usuario: usuario, p_tentativa: t.id, p_session: session,
  })
  async function autorizarCriacao(t: Tentativa, etapa: 'customer' | 'session') {
    const inicio = await rpc<string>('autorizar_criacao_checkout', { p_usuario: usuario, p_tentativa: t.id, p_etapa: etapa })
    exigirJanelaSegura(inicio)
  }

  // At most one retired attempt and one fresh attempt per request. A concurrent
  // change beyond this bound is retryable, never an unbounded provider loop.
  for (let etapa = 0; etapa < 2; etapa++) {
    const t = await rpc<Tentativa>('reservar_checkout_assinatura', {
      p_usuario: usuario, p_plano: escolha.plan_slug, p_ciclo: escolha.billing_cycle,
      p_preco: preco, p_live: live, p_origem: origem,
    })
    if (t.user_id !== usuario || t.live !== live) throw new Error('checkout_incompativel')
    const mudou = t.plano !== escolha.plan_slug || t.ciclo !== escolha.billing_cycle || t.preco_id !== preco
    let customer = t.customer_id
    if (!customer) {
      customer = t.customer_anterior
      if (customer) {
        try {
          const anterior = await stripe.customers.retrieve(customer, {}, OPCOES_STRIPE)
          if (anterior.deleted) customer = null
        } catch (error) {
          const e = error as { code?: string; statusCode?: number }
          if (e.code === 'resource_missing' && e.statusCode === 404) customer = null
          else throw error
        }
      }
      if (!customer) {
        await autorizarCriacao(t, 'customer')
        // No mutable email/name in retry parameters. Checkout collects billing email.
        const created = await stripe.customers.create({ metadata: { supabase_user_id: usuario } }, {
          ...OPCOES_STRIPE, idempotencyKey: `fss-customer-v3-${t.id}`,
        })
        if (created.livemode !== live) throw new Error('customer_incompativel')
        customer = created.id
      }
      await registrar(t, customer)
    }

    const subscriptions = await stripe.subscriptions.list({ customer, status: 'all', limit: 100 }, OPCOES_STRIPE)
    if (subscriptions.has_more || subscriptions.data.some(s => !ESTADOS_TERMINAIS.has(s.status))) throw new CheckoutEmAndamento()

    if (mudou && !t.session_id && !t.session_criacao_em) {
      // Retire only if no worker has been authorized to create a session.
      // The RPC checks this again while locking the owner; stale workers fail.
      await encerrar(t, null)
      continue
    }

    let session: Stripe.Checkout.Session
    if (t.session_id) {
      session = await stripe.checkout.sessions.retrieve(t.session_id, {}, OPCOES_STRIPE)
    } else {
      if (t.session_criacao_em) exigirJanelaSegura(t.session_criacao_em)
      // Sessions issued before this coordination was deployed must not overlap.
      const anteriores = await stripe.checkout.sessions.list({ customer, limit: 100 }, OPCOES_STRIPE)
      // Also see legacy sessions completed AFTER subscriptions.list. Only a
      // subscription already proven terminal permits retiring that history.
      const terminais = new Set(subscriptions.data.filter(s => ESTADOS_TERMINAIS.has(s.status)).map(s => s.id))
      if (anteriores.has_more || anteriores.data.some(s => s.mode === 'subscription' && s.client_reference_id !== t.id
        && s.status !== 'expired' && !(s.status === 'complete' && terminais.has(idDoObjeto(s.subscription) ?? '')))) throw new CheckoutEmAndamento(false)
      await autorizarCriacao(t, 'session')
      session = await stripe.checkout.sessions.create({
        integration_identifier: `fengshui-subscription-${t.id}`,
        customer, mode: 'subscription', client_reference_id: t.id,
        line_items: [{ price: t.preco_id, quantity: 1 }],
        subscription_data: { metadata: { plan_slug: t.plano, billing_cycle: t.ciclo, supabase_user_id: usuario } },
        success_url: `${t.origem}/stripe/success?session_id={CHECKOUT_SESSION_ID}&type=subscription`,
        cancel_url: `${t.origem}/planos?plano=${t.plano}&ciclo=${t.ciclo}`,
        allow_promotion_codes: true,
      }, { ...OPCOES_STRIPE, idempotencyKey: `fss-subscribe-v1-${t.id}` })
    }
    conferirSessao(session, t, customer)
    // A lost DB response does not authorize a new provider create; same intent retries.
    await registrar(t, customer, session.id)
    if (session.status === 'complete') {
      const subscriptionId = idDoObjeto(session.subscription)
      if (!subscriptionId) throw new CheckoutEmAndamento()
      const subscription = await stripe.subscriptions.retrieve(subscriptionId, {}, OPCOES_STRIPE)
      if (idDoObjeto(subscription.customer) !== customer || subscription.livemode !== live) throw new Error('assinatura_incompativel')
      if (!ESTADOS_TERMINAIS.has(subscription.status)) throw new CheckoutEmAndamento()
      await encerrar(t, session.id)
      continue
    }
    if (session.status === 'expired') {
      await encerrar(t, session.id)
      continue
    }
    if (session.status !== 'open') throw new Error('checkout_estado_desconhecido')
    if (mudou) {
      // Failure/timeout/completion race never authorizes retiring the old intent.
      const expirada = await stripe.checkout.sessions.expire(session.id, {}, { ...OPCOES_STRIPE, idempotencyKey: `fss-expire-v1-${t.id}` })
      conferirSessao(expirada, t, customer)
      if (expirada.id !== session.id || expirada.status !== 'expired') throw new Error('checkout_expiracao_nao_confirmada')
      await encerrar(t, session.id)
      continue
    }
    const url = new URL(session.url ?? '')
    if (url.protocol !== 'https:' || url.hostname !== 'checkout.stripe.com' || url.username || url.password) throw new Error('checkout_url_invalida')
    if (!Number.isFinite(session.expires_at) || session.expires_at * 1000 <= Date.now()) throw new Error('checkout_expirado')
    return { url: url.href, session_id: session.id }
  }
  throw new Error('checkout_alterado_simultaneamente')
}
