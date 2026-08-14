/**
 * GET /api/pedidos/arquivo?token=…&item=… — o comprador baixa o que comprou.
 *
 * ## O que decide o acesso
 *
 * Não existe flag de «liberado». O direito de baixar é **derivado**, e das
 * mesmas duas coisas que o resto da loja já usa:
 *
 * 1. **posse do token** — o comprador não tem conta, então não há `auth.uid()`
 *    para o RLS comparar (seção 9 do modelo);
 * 2. **o estado do pedido** — `pedidoRendeuReceita`: o dinheiro entrou e não
 *    voltou.
 *
 * Uma coluna `download_liberado` seria a terceira encarnação do defeito que
 * este projeto vem desfazendo desde o dia 13: um fato guardado que envelhece
 * enquanto a verdade muda ao lado. Reembolso, contestação e cancelamento
 * mudariam o direito e não mudariam a coluna.
 *
 * Consequência declarada: **devolução solicitada ainda baixa.** O pedido de
 * devolução é uma pendência do vendedor, não o fim da compra — enquanto o
 * dinheiro não voltou, o comprador continua tendo o que pagou. É o estorno que
 * encerra o acesso, e ele já é o evento que encerra tudo o mais.
 *
 * ## Por que a URL assinada não fica pronta antes
 *
 * Ela é emitida no clique, com validade de minutos, e nunca gravada. Uma URL
 * de longa duração salva em algum lugar viraria o próprio produto distribuível
 * por quem a copiasse — e o que este bucket guarda é a mercadoria, não uma
 * miniatura.
 */

import { NextResponse } from 'next/server'
import { logger } from '../../../../src/lib/logger'
import { rateLimit, ipDaRequisicao } from '../../../../src/lib/rate-limit'
import { createSupabaseAdminClient } from '../../../../src/lib/supabase-admin'
import { pedidoRendeuReceita, registrarEvento } from '../../../../src/lib/pedidos-da-loja'
import { tokenNoPrazo } from '../../../../src/lib/pedido-publico'
import {
  BUCKET_PRODUTOS_DIGITAIS, TTL_DOWNLOAD_SEGUNDOS, ehDigital,
} from '../../../../src/lib/produtos-da-plataforma'

const ROUTE = '/api/pedidos/arquivo'

/** Recusa única para tudo o que não dá acesso. Ver a nota sobre enumeração. */
const SEM_ACESSO = { error: 'Arquivo indisponível para este pedido.' }

export async function GET(request: Request) {
  const { success } = await rateLimit(ipDaRequisicao(request), { limit: 20, windowMs: 60_000 })
  if (!success) {
    return NextResponse.json(
      { error: 'Muitas requisições. Tente novamente em alguns instantes.' },
      { status: 429, headers: { 'Retry-After': '60' } }
    )
  }

  const url = new URL(request.url)
  const token = url.searchParams.get('token')
  const itemId = url.searchParams.get('item')

  if (!token || !itemId) return NextResponse.json(SEM_ACESSO, { status: 404 })

  const supabase = createSupabaseAdminClient()

  /*
   * Uma consulta só, partindo do **item**, e filtrada pelo token do pedido.
   *
   * Partir do item e conferir o token depois deixaria existir um instante em
   * que o item de outro pedido já foi lido. Aqui as duas condições entram
   * juntas: item deste id **e** pedido com este token.
   */
  const { data, error } = await supabase
    .from('pedido_itens')
    .select(`
      id, nome, pedido_id, produto_id,
      pedidos!inner(token_publico, token_expira_em, pedido_eventos(evento, ocorrido_em)),
      produtos(tipo, arquivo_path, arquivo_nome, arquivo_mime)
    `)
    .eq('id', itemId)
    .eq('pedidos.token_publico', token)
    .maybeSingle()

  if (error) {
    logger.error('Falha ao ler o item para download', { route: ROUTE, error: error.message })
    return NextResponse.json({ error: 'Não foi possível preparar o download.' }, { status: 503 })
  }

  // Item inexistente, token errado, token de outro pedido: **a mesma resposta**.
  // Distinguir contaria a quem está tentando qual das duas metades acertou.
  if (!data) return NextResponse.json(SEM_ACESSO, { status: 404 })

  const pedido = data.pedidos as unknown as {
    token_expira_em: string | null
    pedido_eventos: { evento: string; ocorrido_em: string | null }[]
  }
  const produto = data.produtos as unknown as {
    tipo: string; arquivo_path: string | null
    arquivo_nome: string | null; arquivo_mime: string | null
  } | null

  if (!tokenNoPrazo(pedido.token_expira_em)) {
    return NextResponse.json(SEM_ACESSO, { status: 404 })
  }

  if (!produto || !ehDigital(produto.tipo) || !produto.arquivo_path) {
    return NextResponse.json(SEM_ACESSO, { status: 404 })
  }

  const eventos = pedido.pedido_eventos ?? []

  if (!pedidoRendeuReceita(eventos)) {
    // 403, e não 404: aqui o pedido existe e é dele. Esconder isso o deixaria
    // sem entender por que não baixa — e a razão é legítima e explicável.
    return NextResponse.json(
      { error: 'Este pedido não está pago ou já foi devolvido.' },
      { status: 403 }
    )
  }

  const { data: assinada, error: erroDaAssinatura } = await supabase.storage
    .from(BUCKET_PRODUTOS_DIGITAIS)
    .createSignedUrl(produto.arquivo_path, TTL_DOWNLOAD_SEGUNDOS, {
      // O nome que o comprador vê no disco vem do cadastro do produto, não do
      // path — que carrega uuid e extensão derivada do MIME.
      download: produto.arquivo_nome ?? data.nome,
    })

  if (erroDaAssinatura || !assinada?.signedUrl) {
    logger.error('Não foi possível assinar o arquivo do produto', {
      route: ROUTE, itemId, error: erroDaAssinatura?.message,
    })
    return NextResponse.json({ error: 'Não foi possível preparar o download.' }, { status: 503 })
  }

  /*
   * O download registra a entrega — uma vez, pelo índice de idempotência.
   *
   * Para o digital isso **não** mexe no prazo de arrependimento, que conta do
   * pagamento: é registro de que a obrigação foi cumprida, e é o que permite
   * responder «ele baixou?» sem depender de log de servidor.
   *
   * Best-effort: falhar o registro não pode impedir o comprador de receber o
   * que pagou. O erro fica no log, não no caminho dele.
   */
  await registrarEvento(supabase, {
    pedidoId: data.pedido_id,
    evento: 'entregue',
    origem: 'comprador',
    referencia: `download:${data.id}`,
    motivo: 'Arquivo baixado pelo comprador',
  }, ROUTE)

  return NextResponse.json({ url: assinada.signedUrl, nome: produto.arquivo_nome ?? data.nome })
}
