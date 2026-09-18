/**
 * Durable claims for Stripe retries. A missing completion is not proof that
 * the previous worker died. PostgreSQL serializes admission and issues a token
 * that only its current worker can finish/release. Busy/unavailable means 503.
 *
 * This is not an exactly-once transaction across Stripe and all local writes.
 * Effects must remain idempotent. The five-minute lease exceeds the deployed
 * webhook's 60-second execution budget; expired workers cannot acknowledge.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { logger } from './logger'

export type ResultadoDaReivindicacao =
  | { situacao: 'reivindicado' | 'retomado'; token: string }
  | { situacao: 'repetido' | 'ocupado' | 'sem_garantia' }

export interface EventoParaRegistrar {
  id: string
  type: string
  created: number
  endpoint: string
  objetoId?: string | null
}

function instanteDoEvento(segundos: number): string {
  if (!Number.isFinite(segundos) || segundos <= 0) throw new Error('Instante do evento inválido')
  return new Date(segundos * 1000).toISOString()
}

export async function reivindicarEvento(supabase: SupabaseClient, evento: EventoParaRegistrar): Promise<ResultadoDaReivindicacao> {
  try {
    const { data, error } = await supabase.rpc('reivindicar_evento_stripe', {
      p_event_id: evento.id, p_tipo: evento.type, p_endpoint: evento.endpoint,
      p_objeto_id: evento.objetoId ?? null, p_criado_em: instanteDoEvento(evento.created),
    })
    if (error) throw new Error('Controle indisponível')
    if (data?.situacao === 'repetido' || data?.situacao === 'ocupado') return { situacao: data.situacao }
    if ((data?.situacao === 'reivindicado' || data?.situacao === 'retomado') && typeof data.token === 'string' && data.token.length > 0) {
      return { situacao: data.situacao, token: data.token }
    }
  } catch { /* No payload or database error text in logs. */ }
  logger.error('Controle de eventos Stripe indisponível', { route: evento.endpoint, eventId: evento.id })
  return { situacao: 'sem_garantia' }
}

/** A successful HTTP acknowledgment requires a persisted completion. */
export async function marcarProcessado(supabase: SupabaseClient, eventId: string, endpoint: string, token: string): Promise<void> {
  const { data, error } = await supabase.rpc('finalizar_evento_stripe', { p_event_id: eventId, p_token: token, p_sucesso: true })
  if (error || data !== true) {
    logger.error('Conclusão do evento Stripe não confirmada', { route: endpoint, eventId })
    throw new Error('Conclusão do evento não confirmada')
  }
}

/** Release only our own attempt. Failure remains retryable even if this fails. */
export async function marcarFalha(supabase: SupabaseClient, eventId: string, endpoint: string, token: string): Promise<void> {
  try {
    const { data, error } = await supabase.rpc('finalizar_evento_stripe', { p_event_id: eventId, p_token: token, p_sucesso: false })
    if (!error && data === true) return
  } catch { /* A crashed worker will eventually expire. */ }
  logger.error('Liberação do evento Stripe não confirmada', { route: endpoint, eventId })
}

/** Read errors never mean the event is in order. Current resource reads are preferred. */
export async function houveEventoMaisNovo(supabase: SupabaseClient, objetoId: string, criadoEmStripe: number, eventId: string): Promise<boolean> {
  const { data, error } = await supabase.from('eventos_stripe').select('event_id')
    .eq('objeto_id', objetoId).not('processado_em', 'is', null)
    .gt('criado_em_stripe', instanteDoEvento(criadoEmStripe)).limit(1)
  if (error) {
    logger.error('Ordem dos eventos indisponível', { objetoId, eventId })
    throw new Error('Ordem dos eventos indisponível')
  }
  return (data?.length ?? 0) > 0
}

export function objetoDoEvento(evento: { data?: { object?: unknown } }): string | null {
  const objeto = evento.data?.object
  if (objeto && typeof objeto === 'object' && 'id' in objeto) {
    const id = (objeto as { id?: unknown }).id
    if (typeof id === 'string' && id !== '') return id
  }
  return null
}
