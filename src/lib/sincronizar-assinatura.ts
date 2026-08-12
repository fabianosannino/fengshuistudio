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
 * `sincronizarAssinatura` pode rodar quantas vezes for: ela procura a linha
 * pelo `gateway_subscription_id` e atualiza, ou cria se não existir. Isso é o
 * que permite chamá-la de um webhook reentregue e de uma reconciliação diária
 * sem que a segunda desfaça a primeira.
 *
 * A idempotência de `eventos-stripe` evita o trabalho repetido; esta evita que
 * o trabalho repetido faça estrago. As duas são necessárias — uma protege o
 * caso normal, a outra o caso em que a proteção falha.
 *
 * ## O que ela não faz
 *
 * Não cria perfil. Assinatura cujo `customer` não corresponde a nenhum perfil
 * é relatada e ignorada: inventar um usuário a partir de um pagamento seria
 * criar dado sem origem, e o caso real — cliente que pagou antes de o perfil
 * existir — pede decisão humana, não palpite.
 */

import type Stripe from 'stripe'
import type { SupabaseClient } from '@supabase/supabase-js'
import { logger } from './logger'
import { enumDoPlano, planoEfetivo } from './plano-utils'

/** Status do Stripe → vocabulário da coluna `subscriptions.status`. */
export function statusDaAssinatura(statusDoStripe: string): string {
  switch (statusDoStripe) {
    case 'active': return 'active'
    case 'past_due': return 'past_due'
    case 'canceled': return 'cancelled'
    case 'trialing': return 'trial'
    case 'paused': return 'paused'
    case 'incomplete': return 'past_due'
    case 'incomplete_expired': return 'cancelled'
    // Status novo do Stripe cai em 'active' por omissão. É o comportamento
    // anterior, mantido — mas registrado, para não conceder acesso calado.
    default:
      logger.warn('Status de assinatura desconhecido no Stripe', { statusDoStripe })
      return 'active'
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

/**
 * O plano, a partir da assinatura.
 *
 * A metadata vem primeiro: é o que o checkout gravou, e diz o que o usuário
 * escolheu. O casamento por valor é a segunda tentativa, para assinaturas
 * criadas fora do app — pelo painel do Stripe, por exemplo.
 *
 * `null` quando não dá para saber. Nunca conceder plano por omissão: um
 * palpite aqui entrega recurso pago a quem não comprou.
 */
export async function planoDaAssinatura(
  supabase: SupabaseClient,
  assinatura: Stripe.Subscription
): Promise<string | null> {
  const daMetadata = assinatura.metadata?.plan_slug
  if (daMetadata) return daMetadata

  const valor = valorDaAssinatura(assinatura)
  const intervalo = assinatura.items?.data?.[0]?.price?.recurring?.interval

  if (valor !== null) {
    const { data: planos } = await supabase.from('plans').select('slug, price_monthly, price_yearly')
    for (const plano of planos ?? []) {
      const esperado = intervalo === 'year' ? plano.price_yearly : plano.price_monthly
      // Comparação com tolerância: `numeric` volta como string convertida, e
      // igualdade exata em ponto flutuante falharia por um centavo.
      if (typeof esperado === 'number' && Math.abs(esperado - valor) < 0.01) return plano.slug
    }
  }

  logger.error('Não foi possível resolver o plano da assinatura', {
    subscriptionId: assinatura.id, valor, intervalo,
  })
  return null
}

export type ResultadoDaSincronizacao =
  | { situacao: 'criada'; linhaId?: string }
  | { situacao: 'atualizada'; linhaId: string }
  | { situacao: 'sem_perfil'; customerId: string | null }
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
  supabase: SupabaseClient,
  assinatura: Stripe.Subscription & {
    start_date?: number
    current_period_start?: number
    current_period_end?: number
  },
  origem: string
): Promise<ResultadoDaSincronizacao> {
  const customerId = typeof assinatura.customer === 'string'
    ? assinatura.customer
    : assinatura.customer?.id ?? null

  if (!customerId) return { situacao: 'sem_perfil', customerId: null }

  const { data: perfil } = await supabase
    .from('profiles')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .single()

  if (!perfil) {
    logger.warn('Assinatura sem perfil correspondente', { origem, customerId, subscriptionId: assinatura.id })
    return { situacao: 'sem_perfil', customerId }
  }

  const slug = await planoDaAssinatura(supabase, assinatura)
  const { data: plano } = slug
    ? await supabase.from('plans').select('id, slug').eq('slug', slug).single()
    : { data: null }

  const fimDoPeriodo = instante(assinatura.current_period_end)
  const campos = {
    user_id: perfil.id,
    plan_id: plano?.id ?? null,
    billing_cycle: cicloDaAssinatura(assinatura),
    status: statusDaAssinatura(assinatura.status),
    price_paid: valorDaAssinatura(assinatura),
    cancel_at_period_end: Boolean(assinatura.cancel_at_period_end),
    current_period_start: instante(assinatura.current_period_start),
    current_period_end: fimDoPeriodo,
    next_billing_date: fimDoPeriodo,
    gateway_subscription_id: assinatura.id,
  }

  // A linha existente manda: atualizar é o caminho da reentrega e da
  // reconciliação; criar é o da primeira vez.
  const { data: existente } = await supabase
    .from('subscriptions')
    .select('id')
    .eq('gateway_subscription_id', assinatura.id)
    .maybeSingle()

  if (existente) {
    const { error } = await supabase.from('subscriptions').update(campos).eq('id', existente.id)
    if (error) {
      logger.error('Não foi possível atualizar a assinatura', { origem, subscriptionId: assinatura.id, error: error.message })
      return { situacao: 'falhou', motivo: error.message }
    }
    await aplicarPlanoNoPerfil(supabase, perfil.id, slug, origem)
    return { situacao: 'atualizada', linhaId: existente.id }
  }

  // Uma assinatura nova encerra as anteriores do mesmo usuário: duas ativas ao
  // mesmo tempo fariam a leitura de plano depender de qual linha vem primeiro.
  const { error: erroAoEncerrar } = await supabase
    .from('subscriptions')
    .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
    .eq('user_id', perfil.id)
    .in('status', ['active', 'past_due', 'gratuidade'])

  if (erroAoEncerrar) {
    logger.error('Não foi possível encerrar as assinaturas anteriores', {
      origem, userId: perfil.id, error: erroAoEncerrar.message,
    })
  }

  const { data: criada, error } = await supabase
    .from('subscriptions')
    .insert({ ...campos, started_at: instante(assinatura.start_date) ?? new Date().toISOString() })
    .select('id')
    .single()

  if (error) {
    logger.error('Não foi possível criar a assinatura', { origem, subscriptionId: assinatura.id, error: error.message })
    return { situacao: 'falhou', motivo: error.message }
  }

  await aplicarPlanoNoPerfil(supabase, perfil.id, slug, origem)
  logger.info('Assinatura sincronizada', {
    origem, subscriptionId: assinatura.id, linhaId: criada?.id, plano: slug,
  })
  return { situacao: 'criada', linhaId: criada?.id }
}

/**
 * Escreve o plano no perfil, no vocabulário do enum.
 *
 * Sem `slug` o perfil não é tocado: rebaixar por não ter sabido identificar o
 * plano tiraria recurso de quem pagou.
 */
async function aplicarPlanoNoPerfil(
  supabase: SupabaseClient,
  perfilId: string,
  slug: string | null,
  origem: string
): Promise<void> {
  if (!slug) return
  const { error } = await supabase
    .from('profiles')
    .update({ plano: enumDoPlano(planoEfetivo(slug)) })
    .eq('id', perfilId)

  if (error) {
    logger.error('Não foi possível aplicar o plano no perfil', { origem, perfilId, error: error.message })
  }
}
