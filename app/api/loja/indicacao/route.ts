/**
 * GET /api/loja/indicacao?produto=… — o clique que vai para a loja do parceiro.
 *
 * ## Por que passar por aqui em vez de linkar direto
 *
 * Porque a comissão da indicação é cobrada sobre o que encaminhamos, e sem
 * medida «quanto você nos deve» vira negociação sobre memória. O `<a>` direto
 * seria mais simples e não deixaria número nenhum.
 *
 * O que se mede é **volume**, não pessoa: `cliques_de_indicacao` guarda o
 * produto e a hora, e nada mais. Identificar o visitante seria coletar dado
 * pessoal para responder uma pergunta que ninguém faz.
 *
 * ## O destino nunca vem do cliente
 *
 * O parâmetro é o **id do produto**; a URL sai do nosso cadastro. Aceitar a URL
 * na query transformaria esta rota num redirecionador aberto — o presente que
 * um phisher pede: um link que começa no nosso domínio, com o nosso HTTPS, e
 * termina onde ele quiser.
 *
 * Mesmo vindo do cadastro, o link é conferido antes (`ehLinkDeIndicacaoSeguro`):
 * só `https`, sem usuário embutido. Cadastro é digitado, e digitação erra.
 */

import { NextResponse } from 'next/server'
import { logger } from '../../../../src/lib/logger'
import { rateLimit, ipDaRequisicao } from '../../../../src/lib/rate-limit'
import { validateUUID } from '../../../../src/lib/validation'
import { createSupabaseAdminClient } from '../../../../src/lib/supabase-admin'
import {
  produtoParaVenda, ehIndicacao, ehLinkDeIndicacaoSeguro,
} from '../../../../src/lib/produtos-da-plataforma'

const ROUTE = '/api/loja/indicacao'

/** Recusa única: o visitante volta para a loja em vez de ver um erro cru. */
function paraALoja(request: Request) {
  return NextResponse.redirect(new URL('/produtos', request.url), 302)
}

export async function GET(request: Request) {
  const { success } = await rateLimit(ipDaRequisicao(request), { limit: 60, windowMs: 60_000 })
  if (!success) {
    return NextResponse.json(
      { error: 'Muitas requisições. Tente novamente em alguns instantes.' },
      { status: 429, headers: { 'Retry-After': '60' } }
    )
  }

  const produtoId = new URL(request.url).searchParams.get('produto')
  if (!produtoId || !validateUUID(produtoId)) return paraALoja(request)

  const supabase = createSupabaseAdminClient()
  const produto = await produtoParaVenda(supabase, produtoId, ROUTE)

  // Inativo, inexistente ou vendido por nós: nenhum deles tem para onde
  // encaminhar. Voltar para a loja é mais útil do que um 404 seco.
  if (!produto || !ehIndicacao(produto)) return paraALoja(request)

  if (!ehLinkDeIndicacaoSeguro(produto.link_externo)) {
    // O produto está publicado com um link que não dá para encaminhar. É erro
    // de cadastro, e precisa aparecer no log em vez de virar redirecionamento
    // para lugar nenhum.
    logger.error('Produto de indicação com link inválido', {
      route: ROUTE, produtoId: produto.id,
    })
    return paraALoja(request)
  }

  /*
   * A medição é best-effort e vem **antes** do encaminhamento, mas não o
   * bloqueia: se a escrita falhar, o visitante ainda vai para a loja do
   * parceiro. Perder um clique da contagem é barato; travar a compra dele
   * porque o nosso contador falhou, não.
   */
  const { error } = await supabase
    .from('cliques_de_indicacao')
    .insert({ produto_id: produto.id })

  if (error) {
    logger.warn('Não foi possível registrar o clique de indicação', {
      route: ROUTE, produtoId: produto.id, error: error.message,
    })
  }

  return NextResponse.redirect(produto.link_externo!, 302)
}
