/**
 * Idempotência e ordenação dos webhooks do Stripe.
 *
 * ## As duas garantias que faltavam
 *
 * O Stripe reentrega eventos e não garante ordem. O webhook deduplicava por
 * `gateway_subscription_id` — «já existe assinatura com este id, pulo» —, o
 * que evita criar duas linhas e nada mais. Uma reentrega de `updated`
 * reprocessava; uma entrega fora de ordem sobrescrevia o estado novo com o
 * velho.
 *
 * Aqui ficam as duas perguntas que faltavam, uma por função:
 *
 * - `reivindicarEvento` — «este evento já foi feito?»
 * - `houveEventoMaisNovo` — «já apliquei algo mais recente a este objeto?»
 *
 * ## Por que reivindicar antes de processar
 *
 * Marcar depois seria mais simples e estaria errado: entre o processamento e a
 * marca cabe uma reentrega, e o trabalho aconteceria duas vezes. Reivindicar
 * antes fecha essa janela — o `insert` com chave primária é atômico, então
 * duas entregas simultâneas do mesmo evento disputam a linha e só uma vence.
 *
 * O custo é o caso da falha no meio: a linha existe, o trabalho não terminou.
 * É para isso que serve `processado_em` nulo — a próxima entrega vê uma
 * reivindicação inacabada e refaz, em vez de descartar.
 *
 * ## O que isto não resolve
 *
 * Não torna o processamento em si atômico. Se o handler escreve em três
 * tabelas e morre na segunda, a reentrega refaz da primeira. As escritas
 * precisam tolerar repetição — `upsert` em vez de `insert`, soma derivada em
 * vez de incremento. A idempotência do evento evita o trabalho repetido no
 * caso normal; ela não substitui escrita idempotente.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { logger } from './logger'

const TABELA = 'eventos_stripe'

export type ResultadoDaReivindicacao =
  /** Ninguém processou antes. Siga. */
  | { situacao: 'reivindicado' }
  /** Já foi processado por inteiro. Descarte e responda 200. */
  | { situacao: 'repetido' }
  /** Uma tentativa anterior morreu no meio. Refaça. */
  | { situacao: 'retomado' }
  /**
   * Não deu para consultar o registro. **Siga assim mesmo.**
   *
   * Recusar o evento por causa da tabela de controle faria o Stripe reentregar
   * e trocaria um risco pequeno — processar duas vezes — por um grande: perder
   * o evento se a indisponibilidade durar mais que a janela de reentrega.
   * Processar sem a garantia é uma degradação declarada, e vai para o log.
   */
  | { situacao: 'sem_garantia' }

export interface EventoParaRegistrar {
  id: string
  type: string
  /** `event.created`, em segundos — é o relógio do Stripe que ordena. */
  created: number
  /** Rota que recebeu; os dois webhooks compartilham a tabela. */
  endpoint: string
  /** `sub_...`, `ch_...`, `in_...` — o objeto que o evento descreve. */
  objetoId?: string | null
}

/** Código do Postgres para violação de unicidade. */
const VIOLACAO_DE_UNICIDADE = '23505'

/**
 * `event.created` (segundos) → ISO.
 *
 * Cai para «agora» quando o valor não é utilizável. O Stripe sempre manda
 * `created`, mas um `new Date(NaN).toISOString()` lança — e derrubar o webhook
 * inteiro a partir da camada que existe para dar robustez seria trocar um
 * problema pequeno por um grande. A ordenação fica imprecisa nesse caso; a
 * entrega, não.
 */
function instanteDoEvento(segundos: number | null | undefined): string {
  if (typeof segundos !== 'number' || !Number.isFinite(segundos) || segundos <= 0) {
    return new Date().toISOString()
  }
  return new Date(segundos * 1000).toISOString()
}

export async function reivindicarEvento(
  supabase: SupabaseClient,
  evento: EventoParaRegistrar
): Promise<ResultadoDaReivindicacao> {
  const { error } = await supabase.from(TABELA).insert({
    event_id: evento.id,
    tipo: evento.type,
    endpoint: evento.endpoint,
    objeto_id: evento.objetoId ?? null,
    criado_em_stripe: instanteDoEvento(evento.created),
  })

  if (!error) return { situacao: 'reivindicado' }

  if (error.code !== VIOLACAO_DE_UNICIDADE) {
    logger.error('Não foi possível registrar o evento do Stripe', {
      route: evento.endpoint, eventId: evento.id, error: error.message,
    })
    return { situacao: 'sem_garantia' }
  }

  // A linha já existe. Só o `processado_em` distingue «pronto» de «pela
  // metade», e a diferença decide entre descartar e refazer.
  const { data, error: erroDeLeitura } = await supabase
    .from(TABELA)
    .select('processado_em')
    .eq('event_id', evento.id)
    .single()

  if (erroDeLeitura) {
    logger.error('Não foi possível ler o evento já registrado', {
      route: evento.endpoint, eventId: evento.id, error: erroDeLeitura.message,
    })
    return { situacao: 'sem_garantia' }
  }

  if (data?.processado_em) return { situacao: 'repetido' }

  logger.warn('Evento reivindicado e não concluído — refazendo', {
    route: evento.endpoint, eventId: evento.id, tipo: evento.type,
  })
  return { situacao: 'retomado' }
}

/** Fecha a reivindicação. Só depois disso uma reentrega é descartada. */
export async function marcarProcessado(
  supabase: SupabaseClient,
  eventId: string,
  endpoint: string
): Promise<void> {
  const { error } = await supabase
    .from(TABELA)
    .update({ processado_em: new Date().toISOString(), erro: null })
    .eq('event_id', eventId)

  if (error) {
    // Não é fatal: o pior efeito é a próxima reentrega refazer o trabalho.
    logger.error('Não foi possível marcar o evento como processado', {
      route: endpoint, eventId, error: error.message,
    })
  }
}

/** Guarda o motivo da falha na própria linha, para investigação. */
export async function marcarFalha(
  supabase: SupabaseClient,
  eventId: string,
  endpoint: string,
  motivo: string
): Promise<void> {
  const { error } = await supabase
    .from(TABELA)
    .update({ erro: motivo.slice(0, 2000) })
    .eq('event_id', eventId)

  if (error) {
    logger.error('Não foi possível registrar a falha do evento', {
      route: endpoint, eventId, error: error.message,
    })
  }
}

/**
 * `true` quando já foi processado um evento **mais novo** sobre o mesmo objeto.
 *
 * O Stripe não garante ordem. Sem esta checagem, um `subscription.updated` de
 * dez minutos atrás, reentregue agora, sobrescreveria o cancelamento que veio
 * depois — e a assinatura voltaria a «ativa» sozinha.
 *
 * Compara pelo `created` do Stripe, não pelo horário em que chegou aqui: o
 * relógio que importa é o de quem gerou o fato.
 *
 * Devolve `false` quando não dá para consultar. É a mesma escolha de
 * `sem_garantia`: entre não aplicar um evento legítimo e aplicar um antigo,
 * o primeiro erro é o mais caro.
 */
export async function houveEventoMaisNovo(
  supabase: SupabaseClient,
  objetoId: string,
  criadoEmStripe: number,
  eventId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from(TABELA)
    .select('event_id, criado_em_stripe')
    .eq('objeto_id', objetoId)
    .not('processado_em', 'is', null)
    .gt('criado_em_stripe', instanteDoEvento(criadoEmStripe))
    .limit(1)

  if (error) {
    logger.error('Não foi possível conferir a ordem dos eventos', {
      objetoId, eventId, error: error.message,
    })
    return false
  }

  return (data?.length ?? 0) > 0
}

/**
 * O id do objeto que o evento descreve.
 *
 * É o que liga eventos do mesmo assunto para a checagem de ordem. Um evento
 * cujo `data.object` não traga `id` devolve `null` — e aí a ordenação não se
 * aplica, o que é diferente de estar em ordem.
 */
export function objetoDoEvento(evento: { data?: { object?: unknown } }): string | null {
  const objeto = evento.data?.object
  if (objeto && typeof objeto === 'object' && 'id' in objeto) {
    const id = (objeto as { id?: unknown }).id
    if (typeof id === 'string' && id !== '') return id
  }
  return null
}
