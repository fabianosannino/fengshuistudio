/**
 * GET /api/pedidos/minhas-compras — as compras de quem está logado.
 *
 * ## Por que casar por e-mail é seguro aqui, e não era na página pública
 *
 * Recusei «digite seu e-mail para ver seu pedido» porque saber um e-mail não
 * prova ser dono dele. Aqui é outra coisa: o e-mail vem do **usuário
 * autenticado**, confirmado pelo Supabase. A prova não é o e-mail digitado, é
 * a sessão.
 *
 * E por isso a checagem de `email_confirmed_at` não é detalhe: sem ela,
 * bastaria cadastrar-se com o endereço de outra pessoa e nunca confirmar para
 * ver as compras dela. É o furo inteiro num campo só.
 *
 * ## O que devolve
 *
 * A mesma projeção da página pública (`pedido-publico.ts`), mais o token —
 * porque o detalhe e a devolução acontecem em `/pedido/[token]`, e ter duas
 * implementações da mesma tela criaria duas verdades sobre o que o comprador
 * pode fazer.
 */

import { NextResponse } from 'next/server'
import { logger } from '../../../../src/lib/logger'
import { rateLimit, ipDaRequisicao } from '../../../../src/lib/rate-limit'
import { createRouteHandlerClient } from '../../../../src/lib/supabase-route'
import { createSupabaseAdminClient } from '../../../../src/lib/supabase-admin'
import { pedidoParaOComprador } from '../../../../src/lib/pedido-publico'

const ROUTE = '/api/pedidos/minhas-compras'

export async function GET(request: Request) {
  const { success } = await rateLimit(ipDaRequisicao(request), { limit: 30, windowMs: 60_000 })
  if (!success) {
    return NextResponse.json({ error: 'Muitas requisições.' }, { status: 429 })
  }

  const supabase = await createRouteHandlerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  if (!user.email || !user.email_confirmed_at) {
    // Devolve lista vazia em vez de erro: para quem ainda não confirmou, a
    // resposta honesta é «não há compras suas aqui», não uma explicação de
    // como o casamento por e-mail funciona.
    logger.info('Compras pedidas por conta sem e-mail confirmado', { route: ROUTE })
    return NextResponse.json({ compras: [] })
  }

  const admin = createSupabaseAdminClient()
  const { data, error } = await admin
    .from('pedidos')
    .select(`
      numero, tipo, criado_em, total_centavos, comprador_email, token_publico,
      pedido_itens(nome, quantidade, preco_unitario_centavos),
      pedido_eventos(evento, ocorrido_em),
      pedido_lancamentos(tipo, valor_centavos, pagador, recebedor)
    `)
    .eq('comprador_email', user.email)
    .order('criado_em', { ascending: false })
    .limit(100)

  if (error) {
    logger.error('Falha ao ler as compras do usuário', { route: ROUTE, error: error.message })
    return NextResponse.json({ error: 'Não foi possível carregar suas compras.' }, { status: 503 })
  }

  const compras = (data ?? []).map(pedido => ({
    ...pedidoParaOComprador(pedido),
    token: pedido.token_publico,
  }))

  return NextResponse.json({ compras })
}
