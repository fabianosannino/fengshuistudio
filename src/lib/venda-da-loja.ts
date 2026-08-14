/**
 * O que acontece quando uma venda da loja é paga — uma vez só, para os dois
 * webhooks.
 *
 * ## Por que virou módulo
 *
 * A partir da fase 2 existem **duas** contas cobrando: a conta conectada do
 * consultor (bem de quem vende serviço) e a nossa (bem próprio). O Stripe
 * entrega esses eventos em endpoints diferentes — «Contas conectadas» e «Sua
 * conta» —, e o escopo do destino não é editável depois de criado.
 *
 * Dois endpoints, o mesmo desfecho: confirmar o pagamento, escrever o razão e
 * mandar ao comprador o link do pedido. Copiar o bloco de um handler para o
 * outro criaria duas versões da mesma regra, e a segunda envelheceria calada —
 * é a forma exata do defeito que este projeto vem desfazendo. Aqui a regra é
 * uma; o que muda entre as duas chamadas é de qual conta veio o evento.
 */

import type Stripe from 'stripe'
import type { SupabaseClient } from '@supabase/supabase-js'
import { logger } from './logger'
import {
  acharPedidoDaSessao, confirmarPagamento, valoresDoPedido,
  pedidoParaConfirmar, marcarConfirmacaoEnviada, prazoDeArrependimento,
} from './pedidos-da-loja'
import { registrarLancamentosDaVenda } from './lancamentos-da-venda'
import { enviarEmail } from './email'
import { emailDeConfirmacao } from './emails-do-pedido'

export interface VendaPaga {
  sessao: Stripe.Checkout.Session
  /** `evt_…` — idempotência dos eventos e dos lançamentos. */
  eventoId: string
  /** Unix seconds do evento: é a hora do **fato**, não a do processamento. */
  eventoEm: number
  /** `acct_…` quando a cobrança foi na conta conectada; `null` quando foi nossa. */
  contaDoEvento: string | null
  /** Origem da aplicação, para montar o link do pedido no e-mail. */
  origemDaApp: string
}

/**
 * Confirma a venda paga: evento `pago`, razão e e-mail ao comprador.
 *
 * Devolve o id do pedido, ou `null` quando não havia pedido correspondente —
 * que é o caso de uma cobrança que não é da loja (assinatura, por exemplo) e
 * não é erro.
 */
export async function confirmarVendaDaLoja(
  supabase: SupabaseClient,
  venda: VendaPaga,
  origemDoLog: string
): Promise<string | null> {
  const pedidoId = await acharPedidoDaSessao(supabase, venda.sessao, origemDoLog)
  if (!pedidoId) return null

  const ocorridoEm = new Date(venda.eventoEm * 1000).toISOString()

  await confirmarPagamento(supabase, {
    pedidoId,
    compradorEmail: venda.sessao.customer_details?.email ?? venda.sessao.customer_email ?? null,
    compradorNome: venda.sessao.customer_details?.name ?? null,
    paymentIntent: typeof venda.sessao.payment_intent === 'string' ? venda.sessao.payment_intent : null,
    totalCentavos: venda.sessao.amount_total ?? null,
    referencia: venda.eventoId,
    ocorridoEm,
  }, origemDoLog)

  // O razão da venda: o que o comprador pagou, o que a plataforma reteve e o
  // que o gateway ficou. Falha aqui não desfaz o `pago` — o pagamento é o fato
  // importante, e o razão é reconstituível.
  const valores = await valoresDoPedido(supabase, pedidoId, origemDoLog)
  if (valores) {
    await registrarLancamentosDaVenda(supabase, {
      pedidoId,
      totalCentavos: venda.sessao.amount_total ?? valores.total,
      freteCentavos: valores.frete,
      taxaPlataformaCentavos: valores.taxa,
      paymentIntent: typeof venda.sessao.payment_intent === 'string' ? venda.sessao.payment_intent : null,
      contaConectada: venda.contaDoEvento ?? valores.contaConectada,
      vendedor: valores.vendedor,
      referencia: venda.eventoId,
      ocorridoEm,
    }, origemDoLog)
  }

  await enviarConfirmacao(supabase, pedidoId, venda.origemDaApp, origemDoLog)

  logger.info('Venda da loja registrada', {
    origem: origemDoLog, pedidoId, contaConectada: venda.contaDoEvento,
  })

  return pedidoId
}

/**
 * A confirmação por e-mail — o **único** link que o comprador tem para o
 * pedido, porque ele não tem conta.
 *
 * Best-effort declarado: falha aqui não desfaz a venda nem devolve erro.
 * Responder 500 faria o Stripe reentregar e reprocessar o que já estava certo
 * — trocaríamos um aviso perdido por trabalho refeito.
 */
async function enviarConfirmacao(
  supabase: SupabaseClient,
  pedidoId: string,
  origemDaApp: string,
  origemDoLog: string
): Promise<void> {
  const paraConfirmar = await pedidoParaConfirmar(supabase, pedidoId, origemDoLog)
  if (!paraConfirmar?.compradorEmail) return

  const prazo = prazoDeArrependimento(paraConfirmar.tipo, paraConfirmar.eventos)
  const { assunto, html, texto } = emailDeConfirmacao({
    numero: paraConfirmar.numero,
    itens: paraConfirmar.itens,
    totalCentavos: paraConfirmar.totalCentavos,
    arrependimentoAte: prazo ? prazo.toISOString() : null,
    linkDoPedido: `${origemDaApp}/pedido/${paraConfirmar.tokenPublico}`,
  })

  const enviado = await enviarEmail(
    { para: paraConfirmar.compradorEmail, assunto, html, texto }, origemDoLog
  )

  // Só marca depois de sair. Marcar antes trocaria «pode ter chegado duas
  // vezes» por «pode não ter chegado nenhuma».
  if (enviado) await marcarConfirmacaoEnviada(supabase, pedidoId, origemDoLog)
}
