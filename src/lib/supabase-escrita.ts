/**
 * Escrita no Supabase com checagem obrigatória de erro.
 *
 * O client `@supabase/supabase-js` **resolve** a promise com `{ data, error }`
 * quando o banco recusa a operação — ele não rejeita. Três consequências que já
 * causaram perda de dados neste projeto (ver
 * `docs/auditoria/2026-07-26-escritas-supabase-sem-checagem.md`):
 *
 * 1. `await supabase.from(...).update(...)` sem desestruturar `error` engole a falha;
 * 2. um `try/catch` em volta não ajuda, porque não há rejeição para capturar;
 * 3. `.catch(handler)` também não ajuda, pelo mesmo motivo.
 *
 * O CLAUDE.md já exigia checar `error` em toda escrita, mas o padrão correto era
 * *opcional*: bastava esquecer. Estes helpers invertem isso — quem chama recebe o
 * dado ou uma exceção, e não existe caminho silencioso.
 */

import { logger } from './logger'

export interface ContextoEscrita {
  /** Rota ou módulo de origem, para o log estruturado. */
  rota: string
  /** O que se tentava gravar, em uma expressão curta (`insert-subscription`). */
  operacao: string
  /** Dono do dado, quando houver. Nunca inclua PII aqui — só o id. */
  userId?: string
}

interface RespostaSupabase<T> {
  data: T
  error: { message: string } | null
}

/**
 * Falha de escrita já registrada no logger.
 *
 * A `message` é deliberadamente genérica: ela pode subir até um `catch` de rota
 * que a devolva ao cliente. O detalhe do banco fica em `detalhe`, que só o
 * servidor lê (ADR 0019 — erro genérico ao cliente, detalhe no log).
 */
export class ErroDeEscrita extends Error {
  readonly contexto: ContextoEscrita
  readonly detalhe: string

  constructor(contexto: ContextoEscrita, detalhe: string) {
    super(`Falha ao gravar em ${contexto.operacao}`)
    this.name = 'ErroDeEscrita'
    this.contexto = contexto
    this.detalhe = detalhe
  }
}

/**
 * Executa a escrita e **lança** se o banco recusar. Use quando a falha invalida
 * a operação — ou seja, quando continuar significaria responder "salvo" para
 * algo que não foi salvo.
 */
export async function escreverOuFalhar<T>(
  query: PromiseLike<RespostaSupabase<T>>,
  contexto: ContextoEscrita
): Promise<T> {
  const { data, error } = await query
  if (error) {
    logger.error('Escrita no Supabase falhou', {
      route: contexto.rota,
      action: contexto.operacao,
      userId: contexto.userId,
      error: error.message,
    })
    throw new ErroDeEscrita(contexto, error.message)
  }
  return data
}

/**
 * Executa a escrita, **registra** a falha e devolve se ela ocorreu — sem lançar.
 *
 * Use apenas onde a falha é tolerável mas precisa ser visível (trilha de
 * auditoria, notificação, limpeza de arquivo órfão). O retorno é `boolean` de
 * propósito: quem chama tem que decidir o que dizer ao usuário, em vez de
 * assumir sucesso. Ignorar o retorno é uma decisão explícita, não um descuido.
 */
export async function escreverBestEffort(
  query: PromiseLike<{ error: { message: string } | null }>,
  contexto: ContextoEscrita
): Promise<boolean> {
  const { error } = await query
  if (error) {
    logger.warn('Escrita best-effort no Supabase falhou', {
      route: contexto.rota,
      action: contexto.operacao,
      userId: contexto.userId,
      error: error.message,
    })
    return false
  }
  return true
}
