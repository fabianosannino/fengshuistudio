/**
 * O razão do pedido — quem pagou o quê, para quem.
 *
 * ## Por que não bastam colunas
 *
 * Frete de ida, frete de volta, comissão, estorno de comissão e tarifa do
 * gateway têm regras de reversão e partes diferentes. Somados em
 * `total_centavos`, viram um número do qual não se extrai nenhum deles.
 *
 * A pergunta que este módulo existe para responder é **«quem ficou com o
 * prejuízo desta devolução?»**. Com `pagador` e `recebedor`, ela é uma soma.
 * Com um campo de sinal, seria interpretação — e interpretação diverge entre a
 * tela do consultor e a do admin.
 *
 * ## As quatro partes
 *
 * `comprador`, `consultor`, `plataforma` e `gateway`. A quarta é a que torna o
 * modelo honesto: a tarifa do Stripe **não volta** no reembolso, e numa
 * cobrança direta ela saiu do saldo do consultor. Sem essa parte, o dinheiro
 * não fecharia, e alguém acabaria tapando a diferença com um ajuste sem
 * procedência — que é o defeito que este projeto vem desfazendo o dia inteiro.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { logger } from './logger'

export type ParteDoPedido = 'comprador' | 'consultor' | 'plataforma' | 'gateway'

export type TipoDeLancamento =
  | 'produto' | 'frete' | 'comissao_plataforma' | 'tarifa_gateway'
  | 'reembolso' | 'frete_devolucao' | 'estorno_comissao'

export interface Lancamento {
  tipo: TipoDeLancamento | string
  valor_centavos: number
  pagador: ParteDoPedido | string
  recebedor: ParteDoPedido | string
  ocorrido_em?: string | null
  referencia?: string | null
  motivo?: string | null
}

/**
 * Quanto cada parte ganhou (positivo) ou perdeu (negativo) no pedido.
 *
 * A soma de todos os saldos é sempre zero — é a checagem que denuncia
 * lançamento faltando. Se não fechar, falta um fato, e o certo é acrescentá-lo,
 * nunca ajustar um valor existente.
 */
export function saldoPorParte(lancamentos: Lancamento[]): Record<ParteDoPedido, number> {
  const saldo: Record<ParteDoPedido, number> = {
    comprador: 0, consultor: 0, plataforma: 0, gateway: 0,
  }

  for (const l of lancamentos) {
    if (!Number.isFinite(l.valor_centavos)) continue
    if (l.pagador in saldo) saldo[l.pagador as ParteDoPedido] -= l.valor_centavos
    if (l.recebedor in saldo) saldo[l.recebedor as ParteDoPedido] += l.valor_centavos
  }

  return saldo
}

/**
 * O total que saiu do bolso do comprador.
 *
 * ## Aqui existiu uma função inútil
 *
 * A primeira versão deste módulo tinha um `razaoFecha`, que somava os saldos
 * das quatro partes e conferia se dava zero. **Dava sempre.** Todo lançamento
 * tira de uma parte conhecida e entrega a outra, então a soma é zero por
 * construção — inclusive com um lançamento faltando. Era uma verificação que
 * não podia falhar, o que é o mesmo que não verificar.
 *
 * O teste que a derrubou continua no arquivo, agora medindo o que presta.
 *
 * **Lançamento faltando não é detectável só com o razão.** Descobrir que a
 * tarifa do gateway não foi registrada exige comparar o líquido do consultor
 * com o saldo real no Stripe — o que é reconciliação, e é trabalho de outro
 * módulo. Este aqui compara com o que sabemos: o total do pedido.
 */
export function totalPagoPeloComprador(lancamentos: Lancamento[]): number {
  return lancamentos
    .filter(l => l.pagador === 'comprador' && Number.isFinite(l.valor_centavos))
    .reduce((soma, l) => soma + l.valor_centavos, 0)
}

/**
 * `true` quando o que o comprador pagou no razão bate com o total do pedido.
 *
 * É a checagem que pega frete cobrado e não lançado — o caso que vai aparecer
 * na fase 3, quando o pedido passar a ter frete de verdade.
 */
export function razaoConfereComOTotal(
  lancamentos: Lancamento[],
  totalCentavos: number
): boolean {
  return totalPagoPeloComprador(lancamentos) === totalCentavos
}

/**
 * O que o consultor efetivamente embolsou (ou perdeu) neste pedido.
 *
 * É o número que precisa aparecer na tela **antes** de ele vender: num pedido
 * de R$ 5 devolvido, ele fica negativo em R$ 0,59 de tarifa — mesmo com a
 * plataforma devolvendo a comissão inteira. Em item barato com frete, uma
 * devolução custa mais do que a venda rendia.
 */
export function liquidoDoConsultor(lancamentos: Lancamento[]): number {
  return saldoPorParte(lancamentos).consultor
}

// ── Escrita ──────────────────────────────────────────────────────────────────

const TABELA = 'pedido_lancamentos'
const VIOLACAO_DE_UNICIDADE = '23505'

export interface LancamentoParaRegistrar {
  pedidoId: string
  tipo: TipoDeLancamento
  valorCentavos: number
  pagador: ParteDoPedido
  recebedor: ParteDoPedido
  origem: 'webhook_stripe' | 'vendedor' | 'comprador' | 'admin' | 'sistema'
  referencia?: string | null
  ocorridoEm?: string | null
  motivo?: string | null
}

/**
 * Acrescenta um lançamento. Nunca atualiza — a tabela tem trigger que recusa.
 *
 * Idempotente por `referencia` dentro do tipo: a mesma cobrança não gera dois
 * lançamentos de produto, mesmo quando o webhook roda de novo de propósito.
 * Sem isso, uma reentrega inventaria dinheiro que não existiu.
 *
 * Valor zero é **descartado em silêncio**, e isso é deliberado: pedido sem
 * frete não tem lançamento de frete. Registrar zero encheria o razão de linhas
 * que não aconteceram, e «ausência ≠ zero» vale aqui como vale no resto.
 */
export async function registrarLancamento(
  supabase: SupabaseClient,
  lancamento: LancamentoParaRegistrar,
  origemDoLog: string
): Promise<boolean> {
  if (!Number.isFinite(lancamento.valorCentavos) || lancamento.valorCentavos <= 0) return true

  const { error } = await supabase.from(TABELA).insert({
    pedido_id: lancamento.pedidoId,
    tipo: lancamento.tipo,
    valor_centavos: Math.round(lancamento.valorCentavos),
    pagador: lancamento.pagador,
    recebedor: lancamento.recebedor,
    origem: lancamento.origem,
    referencia: lancamento.referencia ?? null,
    ocorrido_em: lancamento.ocorridoEm ?? new Date().toISOString(),
    motivo: lancamento.motivo ?? null,
  })

  if (!error) return true

  if (error.code === VIOLACAO_DE_UNICIDADE) {
    logger.info('Lançamento já registrado — reentrega descartada', {
      origem: origemDoLog, pedidoId: lancamento.pedidoId, tipo: lancamento.tipo,
    })
    return true
  }

  logger.error('Não foi possível registrar o lançamento', {
    origem: origemDoLog, pedidoId: lancamento.pedidoId, tipo: lancamento.tipo,
    error: error.message,
  })
  return false
}

/** Todos os lançamentos de um pedido, para somar. */
export async function lancamentosDoPedido(
  supabase: SupabaseClient,
  pedidoId: string,
  origemDoLog: string
): Promise<Lancamento[]> {
  const { data, error } = await supabase
    .from(TABELA)
    .select('tipo, valor_centavos, pagador, recebedor, ocorrido_em, referencia, motivo')
    .eq('pedido_id', pedidoId)
    .order('ocorrido_em')

  if (error) {
    logger.error('Não foi possível ler os lançamentos do pedido', {
      origem: origemDoLog, pedidoId, error: error.message,
    })
    return []
  }

  return data ?? []
}
