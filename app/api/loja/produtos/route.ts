/**
 * GET /api/loja/produtos — a vitrine do catálogo próprio da plataforma.
 *
 * Rota pública: quem compra bem próprio não precisa ter conta, do mesmo jeito
 * que quem compra na loja de um consultor.
 *
 * A leitura usa `service_role` porque `produtos` tem RLS ligado e **nenhuma
 * policy** — ver a migration. O que sai daqui é `produtoParaVitrine`, lista
 * branca de campos, e é isso que mantém `arquivo_path` fora da resposta.
 */

import { NextResponse } from 'next/server'
import { rateLimit, ipDaRequisicao } from '../../../../src/lib/rate-limit'
import { createSupabaseAdminClient } from '../../../../src/lib/supabase-admin'
import { listarProdutosDaVitrine } from '../../../../src/lib/produtos-da-plataforma'

const ROUTE = '/api/loja/produtos'

export async function GET(request: Request) {
  const { success } = await rateLimit(ipDaRequisicao(request), { limit: 60, windowMs: 60_000 })
  if (!success) {
    return NextResponse.json(
      { error: 'Muitas requisições. Tente novamente em alguns instantes.' },
      { status: 429, headers: { 'Retry-After': '60' } }
    )
  }

  const produtos = await listarProdutosDaVitrine(createSupabaseAdminClient(), ROUTE)

  if (!produtos) {
    return NextResponse.json({ error: 'Não foi possível carregar o catálogo.' }, { status: 503 })
  }

  return NextResponse.json({ produtos })
}
