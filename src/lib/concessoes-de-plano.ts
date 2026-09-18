/**
 * De onde vem o plano de cada usuário.
 *
 * ## O defeito que originou este módulo
 *
 * Em 13/08/2026, cancelar uma assinatura do Simples rebaixou para o gratuito
 * um perfil que tinha Profissional por **chave de ativação**. A regra
 * «assinatura cancelada rebaixa» estava certa; faltava saber que aquele
 * Profissional não vinha daquela assinatura.
 *
 * `profiles.plano` guarda **o quê** sem guardar **de onde**. Com uma fonte só,
 * funciona. Com quatro — assinatura, chave, cortesia, ajuste manual — cada uma
 * encerra a outra, e a coluna não tem como recusar.
 *
 * ## O plano é resultado, não campo
 *
 * Cada concessão é um fato com origem e prazo. O plano efetivo é a **maior
 * concessão viva neste instante**. É o ADR 0027 aplicado ao plano: estado que
 * muda com o tempo é derivado.
 *
 * `profiles.plano` continua existindo como projeção, mantida por
 * `recalcularPlanoDoPerfil` — dezenas de telas leem aquela coluna. A verdade
 * mudou de lugar; a coluna virou cache.
 *
 * ## A parte pura fica aqui
 *
 * `planoDasConcessoes` e `concessaoViva` não tocam o banco. É o que permite
 * testar o que importa — concessão vencida, revogada, duas fontes ao mesmo
 * tempo — sem precisar de assinatura de verdade.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { logger } from './logger'
import { type PlanoEfetivo } from './plano-utils'

export type OrigemDaConcessao = 'assinatura' | 'chave' | 'cortesia' | 'migracao'

export interface Concessao {
  id?: string
  user_id?: string
  plano: string
  origem?: OrigemDaConcessao | string
  referencia?: string | null
  valido_de?: string | null
  valido_ate?: string | null
  encerrada_em?: string | null
}

/**
 * A ordem entre planos. Maior número ganha quando há mais de uma concessão.
 *
 * Concessões coexistem de propósito: alguém com chave de Profissional que
 * compra o Simples fica com Profissional enquanto a chave valer. Rebaixar
 * porque a compra foi menor tiraria o que já era dele.
 */
const FORCA: Record<PlanoEfetivo, number> = { free: 0, simples: 1, profissional: 2 }

function forcaDe(plano: string): number {
  return FORCA[plano as PlanoEfetivo] ?? -1
}

/**
 * `true` quando a concessão vale no instante dado.
 *
 * Três formas de não valer, e as três são diferentes:
 *
 * - **ainda não começou** (`valido_de` no futuro) — cortesia agendada;
 * - **venceu** (`valido_ate` no passado) — chave com prazo;
 * - **foi encerrada** (`encerrada_em`) — assinatura cancelada, estorno.
 *
 * `valido_ate` nulo é «sem prazo», não «vencida». É a distinção que faz uma
 * concessão de chave sobreviver ao cancelamento de uma assinatura.
 */
export function concessaoViva(concessao: Concessao, agora: Date = new Date()): boolean {
  if (concessao.encerrada_em) return false

  const instante = agora.getTime()
  if (!Number.isFinite(instante)) return false

  if (concessao.valido_de) {
    const inicio = Date.parse(concessao.valido_de)
    if (!Number.isFinite(inicio) || inicio > instante) return false
  }

  if (concessao.valido_ate) {
    const fim = Date.parse(concessao.valido_ate)
    if (!Number.isFinite(fim) || fim <= instante) return false
  }

  return true
}

/**
 * O plano efetivo: a maior concessão viva.
 *
 * Sem concessão viva o resultado é `free` — e aqui isso é correto, não
 * omissão: gratuito **é** a ausência de concessão, não uma concessão de nada.
 * Por isso o backfill não cria linha para quem já era gratuito.
 */
export function planoDasConcessoes(
  concessoes: Concessao[],
  agora: Date = new Date()
): PlanoEfetivo {
  let melhor: PlanoEfetivo = 'free'

  for (const concessao of concessoes) {
    if (!concessaoViva(concessao, agora)) continue
    if (forcaDe(concessao.plano) > forcaDe(melhor)) melhor = concessao.plano as PlanoEfetivo
  }

  return melhor
}

/** Só as vivas, para exibir «por que eu tenho este plano». */
export function concessoesVivas(concessoes: Concessao[], agora: Date = new Date()): Concessao[] {
  return concessoes.filter(c => concessaoViva(c, agora))
}

// ── Escrita ──────────────────────────────────────────────────────────────────

/**
 * Recalcula `profiles.plano` a partir das concessões e grava a projeção.
 *
 * É o **único** lugar que deve escrever naquela coluna. Um `update` solto em
 * qualquer outro ponto recria o defeito de origem: um valor sem procedência,
 * que a próxima mudança de qualquer fonte apaga sem saber o que apagou.
 *
 * Devolve o plano efetivo, ou `null` quando não deu para calcular — e nesse
 * caso **não escreve**. Rebaixar por causa de uma consulta que falhou tiraria
 * acesso de quem paga, que é o pior desfecho possível aqui.
 */
export async function recalcularPlanoDoPerfil(
  supabase: SupabaseClient,
  userId: string,
  origem: string
): Promise<PlanoEfetivo | null> {
  const { data, error } = await supabase.rpc('recalcular_plano_do_perfil', { p_usuario: userId })
  if (error || !['free', 'simples', 'profissional'].includes(data)) {
    logger.error('Falha ao recalcular plano', { origem, code: error?.code })
    return null
  }
  return data as PlanoEfetivo
}

/**
 * Registra uma concessão e recalcula o plano.
 *
 * Idempotente por `referencia` dentro da origem: chamar duas vezes para a
 * mesma assinatura atualiza a linha existente em vez de empilhar concessões.
 * Sem isso, um webhook reentregue daria dois direitos pelo mesmo pagamento — e
 * o segundo sobreviveria ao cancelamento do primeiro.
 */
export async function conceder(
  supabase: SupabaseClient,
  concessao: {
    userId: string
    plano: PlanoEfetivo
    origem: OrigemDaConcessao
    referencia?: string | null
    validoAte?: string | null
    motivo?: string | null
    criadaPor?: string | null
  },
  origemDoLog: string
): Promise<boolean> {
  const { error } = await supabase.rpc('alterar_concessao_de_plano', {
    p_usuario: concessao.userId, p_operacao: 'conceder',
    p_plano: concessao.plano, p_origem: concessao.origem,
    p_referencia: concessao.referencia ?? null, p_valido_ate: concessao.validoAte ?? null,
    p_motivo: concessao.motivo ?? null, p_criada_por: concessao.criadaPor ?? null,
  })
  if (error) logger.error('Falha ao conceder plano', { origem: origemDoLog, code: error.code })
  return !error
}

/**
 * Encerra a concessão de uma referência específica e recalcula.
 *
 * É o oposto exato do defeito de origem: encerra **aquela** concessão, e o que
 * vier de outra fonte permanece. Cancelar a assinatura não mexe na chave.
 */
export async function encerrarConcessao(
  supabase: SupabaseClient,
  parametros: { userId: string; origem: OrigemDaConcessao; referencia: string; motivo?: string },
  origemDoLog: string
): Promise<boolean> {
  const { error } = await supabase.rpc('alterar_concessao_de_plano', {
    p_usuario: parametros.userId, p_operacao: 'encerrar',
    p_origem: parametros.origem, p_referencia: parametros.referencia,
    p_motivo: parametros.motivo ?? null,
  })
  if (error) logger.error('Falha ao encerrar concessão', { origem: origemDoLog, code: error.code })
  return !error
}
