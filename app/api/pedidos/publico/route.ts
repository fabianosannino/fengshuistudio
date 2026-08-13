/**
 * GET  /api/pedidos/publico?token=… — o comprador vê o próprio pedido
 * POST /api/pedidos/publico          — o comprador pede a devolução
 *   Body: { token, motivo? }
 *
 * ## Rota pública, e por quê
 *
 * O comprador da loja não tem conta. Não existe `auth.uid()` para comparar,
 * então RLS não o alcança — a posse do token é o que prova o direito de ver.
 *
 * Por isso o token **nunca** é comparado numa policy: a conferência é aqui,
 * explícita, e o que sai é a projeção de `pedido-publico.ts`, com lista branca
 * de campos. Uma policy para `anon` precisaria comparar o token dentro do
 * banco, e um erro de filtro ali deixaria a tabela inteira legível.
 *
 * ## Enumeração
 *
 * Token errado e token vencido respondem **404 igual**. Distinguir os dois
 * contaria a quem está tentando que aquele token existiu — e o rate limit é o
 * que torna a força bruta contra 24 bytes aleatórios inútil na prática.
 */

import { NextResponse } from 'next/server'
import { logger } from '../../../../src/lib/logger'
import { rateLimit, ipDaRequisicao } from '../../../../src/lib/rate-limit'
import { createSupabaseAdminClient } from '../../../../src/lib/supabase-admin'
import { registrarEvento, dentroDoPrazoDeArrependimento } from '../../../../src/lib/pedidos-da-loja'
import { pedidoParaOComprador, tokenNoPrazo } from '../../../../src/lib/pedido-publico'

const ROUTE = '/api/pedidos/publico'

const CAMPOS = `
  id, numero, tipo, criado_em, total_centavos, comprador_email, token_expira_em,
  pedido_itens(nome, quantidade, preco_unitario_centavos),
  pedido_eventos(evento, ocorrido_em),
  pedido_lancamentos(tipo, valor_centavos, pagador, recebedor)
`

const NAO_ENCONTRADO = { error: 'Pedido não encontrado ou link expirado.' }

async function pedidoDoToken(token: string) {
  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase
    .from('pedidos')
    .select(CAMPOS)
    .eq('token_publico', token)
    .maybeSingle()

  if (error) {
    logger.error('Falha ao ler pedido por token', { route: ROUTE, error: error.message })
    return { supabase, pedido: null, falhou: true }
  }

  return { supabase, pedido: data, falhou: false }
}

export async function GET(request: Request) {
  const ip = ipDaRequisicao(request)
  const { success } = await rateLimit(ip, { limit: 30, windowMs: 60_000 })
  if (!success) {
    return NextResponse.json(
      { error: 'Muitas requisições. Tente novamente em alguns instantes.' },
      { status: 429, headers: { 'Retry-After': '60' } }
    )
  }

  const token = new URL(request.url).searchParams.get('token')
  if (!token) return NextResponse.json(NAO_ENCONTRADO, { status: 404 })

  const { pedido, falhou } = await pedidoDoToken(token)
  if (falhou) {
    return NextResponse.json({ error: 'Não foi possível carregar o pedido.' }, { status: 503 })
  }

  if (!pedido || !tokenNoPrazo(pedido.token_expira_em)) {
    return NextResponse.json(NAO_ENCONTRADO, { status: 404 })
  }

  return NextResponse.json({ pedido: pedidoParaOComprador(pedido) })
}

/**
 * O comprador exerce o arrependimento.
 *
 * Registra o pedido de devolução — **não** estorna. O estorno sai da tela do
 * vendedor, e a razão é que nem toda devolução pedida é devida: serviço já
 * prestado e pedido fora do prazo precisam de gente olhando. O que a lei exige
 * é que o pedido dele fique registrado com data, e é isso que acontece aqui.
 */
export async function POST(request: Request) {
  const ip = ipDaRequisicao(request)
  const { success } = await rateLimit(ip, { limit: 10, windowMs: 60_000 })
  if (!success) {
    return NextResponse.json(
      { error: 'Muitas requisições. Tente novamente em alguns instantes.' },
      { status: 429, headers: { 'Retry-After': '60' } }
    )
  }

  let body: { token?: string; motivo?: string }
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }

  if (!body.token) return NextResponse.json(NAO_ENCONTRADO, { status: 404 })

  const { supabase, pedido, falhou } = await pedidoDoToken(body.token)
  if (falhou) {
    return NextResponse.json({ error: 'Não foi possível registrar o pedido.' }, { status: 503 })
  }

  if (!pedido || !tokenNoPrazo(pedido.token_expira_em)) {
    return NextResponse.json(NAO_ENCONTRADO, { status: 404 })
  }

  const eventos = pedido.pedido_eventos ?? []

  if (!dentroDoPrazoDeArrependimento(pedido.tipo, eventos)) {
    // Fora do prazo do art. 49 não é arrependimento — é reclamação, e segue
    // por outro caminho. Dizer isso é mais útil do que recusar sem explicar.
    return NextResponse.json(
      { error: 'O prazo de arrependimento deste pedido já passou. Fale com o vendedor.' },
      { status: 409 }
    )
  }

  const registrado = await registrarEvento(supabase, {
    pedidoId: pedido.id,
    evento: 'devolucao_solicitada',
    origem: 'comprador',
    // A referência amarra o evento ao pedido, e o índice de unicidade impede
    // que recarregar a página empilhe pedidos de devolução.
    referencia: `comprador:${pedido.id}`,
    motivo: body.motivo ?? null,
  }, ROUTE)

  if (!registrado) {
    return NextResponse.json({ error: 'Não foi possível registrar o pedido.' }, { status: 503 })
  }

  logger.info('Devolução solicitada pelo comprador', { route: ROUTE, pedidoId: pedido.id })
  return NextResponse.json({ registrado: true })
}
