/**
 * Como uma assinatura do Stripe vira uma linha em `subscriptions`.
 *
 * ## Por que virou módulo
 *
 * Este caminho vivia dentro do webhook. A reconciliação precisa exatamente
 * dele — quando o Stripe tem uma assinatura que nunca chegou aqui, o conserto
 * é criar a linha do mesmo jeito que o webhook criaria. Copiar aquele trecho
 * produziria duas respostas para «como nasce uma assinatura», e a segunda
 * envelheceria calada. É o defeito que este projeto vem perseguindo desde as
 * quinze grafias de setor e os quatro preços de plano.
 *
 * ## Idempotente por construção
 *
 * Reserva a assinatura antes de consultar o Stripe. Uma transação grava o
 * espelho, a concessão com prazo e a projeção do perfil, consumindo o token.
 * Retry consulta novamente o estado atual; trabalhador vencido não escreve.
 *
 * A idempotência de `eventos-stripe` evita o trabalho repetido; esta evita que
 * o trabalho repetido faça estrago. As duas são necessárias — uma protege o
 * caso normal, a outra o caso em que a proteção falha.
 *
 * ## O que ela não faz
 *
 * Não cria perfil. Assinatura cujo `customer` não corresponde a nenhum perfil
 * mantém a entrega pendente: inventar um usuário a partir de um pagamento seria
 * criar dado sem origem, e o caso real — cliente que pagou antes de o perfil
 * existir — pede decisão humana, não palpite.
 */

import type Stripe from 'stripe'
import stripeClient from './stripe'
import { escolhaPeloPreco, modoStripe } from './catalogo-assinaturas'
import type { SupabaseClient } from '@supabase/supabase-js'
import { logger } from './logger'

/** Status do Stripe → vocabulário da coluna `subscriptions.status`. */
export function statusDaAssinatura(statusDoStripe: string): string {
  switch (statusDoStripe) {
    case 'active': return 'active'
    case 'past_due': return 'past_due'
    case 'canceled': return 'cancelled'
    case 'unpaid': return 'cancelled'
    case 'trialing': return 'trial'
    case 'paused': return 'paused'
    case 'incomplete': return 'past_due'
    case 'incomplete_expired': return 'cancelled'
    // Status desconhecido não pode conceder acesso pago.
    default:
      logger.warn('Status de assinatura desconhecido no Stripe', { statusDoStripe })
      return 'paused'
  }
}

export function cicloDaAssinatura(assinatura: Stripe.Subscription): string {
  return assinatura.items?.data?.[0]?.price?.recurring?.interval === 'year' ? 'yearly' : 'monthly'
}

/** Em reais. `null` quando o Stripe não informou — ausência não é zero. */
export function valorDaAssinatura(assinatura: Stripe.Subscription): number | null {
  const centavos = assinatura.items?.data?.[0]?.price?.unit_amount
  return typeof centavos === 'number' ? centavos / 100 : null
}

/** Resolve pelo Price autenticado. Metadata e valor isolado não concedem direitos. */
export async function planoDaAssinatura(
  assinatura: Stripe.Subscription
): Promise<string | null> {
  if (assinatura.items?.data?.length !== 1 || assinatura.items.data[0].quantity !== 1) return null
  const escolha = escolhaPeloPreco(assinatura.items.data[0].price, process.env)
  return escolha?.plan_slug ?? null
}

export type ResultadoDaSincronizacao =
  | { situacao: 'criada' | 'atualizada'; linhaId: string; cancelamentoAgendado: boolean }
  | { situacao: 'falhou'; motivo: string }

function instante(segundos: number | null | undefined): string | null {
  if (typeof segundos !== 'number' || !Number.isFinite(segundos) || segundos <= 0) return null
  return new Date(segundos * 1000).toISOString()
}

/**
 * Grava no banco o que o Stripe diz sobre esta assinatura.
 *
 * Chamada pelo webhook e pela reconciliação. O `origem` entra no log para que
 * a linha diga de onde veio a escrita — uma correção de reconciliação e uma
 * entrega de webhook produzem o mesmo estado, e distinguir as duas é o que
 * permite responder «por que isto mudou às 6 da manhã?».
 */
export async function sincronizarAssinatura(
  supabase: SupabaseClient, subscriptionId: string, origem: string, customerEsperado?: string,
): Promise<ResultadoDaSincronizacao> {
  let token: string | null = null
  let aplicada = false
  try {
    const reserva = await supabase.rpc('reservar_sincronizacao_assinatura', { p_subscription: subscriptionId })
    if (reserva.error || typeof reserva.data !== 'string') return { situacao: 'falhou', motivo: 'Sincronização ocupada ou indisponível' }
    token = reserva.data
    // Read AFTER claiming this subscription, including for cron/admin callers.
    const assinatura = await stripeClient.subscriptions.retrieve(subscriptionId, {}, { timeout: 20_000, maxNetworkRetries: 1 }) as Stripe.Subscription & {
      start_date?: number; current_period_start?: number; current_period_end?: number
    }
    const customer = typeof assinatura.customer === 'string' ? assinatura.customer : assinatura.customer?.id
    const live = modoStripe(process.env.STRIPE_SECRET_KEY)
    if (!customer || assinatura.id !== subscriptionId || live === null || assinatura.livemode !== live
      || (customerEsperado && customer !== customerEsperado)) throw new Error('Assinatura incompatível')
    const slug = await planoDaAssinatura(assinatura)
    if (!['active','trialing','past_due','unpaid','canceled','paused','incomplete','incomplete_expired'].includes(assinatura.status)
      || (!slug && ['active','trialing'].includes(assinatura.status))) throw new Error('Catálogo ou estado não identificado')
    const item = assinatura.items?.data?.[0]
    const { data, error } = await supabase.rpc('aplicar_sincronizacao_assinatura', {
      p_subscription: subscriptionId, p_token: token,
      p_dados: {
        customer, plano: slug, ciclo: cicloDaAssinatura(assinatura), status: assinatura.status,
        valor_centavos: slug ? item?.price?.unit_amount ?? null : null,
        started_at: instante(assinatura.start_date),
        period_start: instante(item?.current_period_start ?? assinatura.current_period_start),
        period_end: instante(item?.current_period_end ?? assinatura.current_period_end),
        trial_end: instante(assinatura.trial_end), cancel_at_period_end: Boolean(assinatura.cancel_at_period_end),
      },
    })
    if (error || !data || !['criada','atualizada'].includes(data.situacao) || typeof data.linhaId !== 'string'
      || typeof data.cancelamentoAgendado !== 'boolean') throw new Error('Persistência indisponível')
    aplicada = true
    return data as ResultadoDaSincronizacao
  } catch {
    logger.error('Sincronização de assinatura não confirmada', { origem, subscriptionId })
    return { situacao: 'falhou', motivo: 'Não foi possível confirmar a sincronização' }
  } finally {
    if (token && !aplicada) {
      try {
        const { error } = await supabase.rpc('liberar_sincronizacao_assinatura', { p_subscription: subscriptionId, p_token: token })
        if (error) logger.warn('Liberação de sincronização não confirmada', { origem, subscriptionId })
      } catch { logger.warn('Liberação de sincronização indisponível', { origem, subscriptionId }) }
    }
  }
}
