/**
 * POST /api/loja/checkout — compra de bem próprio da plataforma (fase 2).
 *   Body: `{ produto_id, quantidade? }`
 *
 * Rota pública: o comprador não tem conta, como no resto da loja.
 *
 * ## Por que não é a mesma rota do checkout do consultor
 *
 * Porque o vendedor é outro, e quase tudo muda com ele:
 *
 * | | consultor | plataforma |
 * |---|---|---|
 * | cobrança | direct charge na conta conectada | na nossa conta |
 * | comissão | 10% retidos por nós | não existe |
 * | catálogo | `price_id` do Stripe da conta | `produtos`, aqui |
 * | entrega | com o consultor | conosco |
 *
 * Unificar as duas num `if` daria uma rota em que metade dos parâmetros está
 * sempre inerte — que é o mesmo defeito que o modelo da loja recusa no
 * `pedidos` com um `tipo` e tudo anulável (seção 1).
 *
 * ## O preço
 *
 * Não vem do cliente, e aqui também não vem do Stripe. No catálogo do
 * consultor, buscar o `price_id` na conta conectada prova de uma vez que o
 * preço é real e que pertence àquela conta. No nosso catálogo o dono do dado é
 * este banco: o valor sai de `produtos`, e o corpo da requisição só escolhe
 * **qual** produto.
 */

import { NextResponse } from 'next/server'
import stripeClient from '../../../../src/lib/stripe'
import { logger } from '../../../../src/lib/logger'
import { rateLimit, ipDaRequisicao } from '../../../../src/lib/rate-limit'
import { origemDaAplicacao } from '../../../../src/lib/auth-rotas'
import { validateUUID } from '../../../../src/lib/validation'
import { createSupabaseAdminClient } from '../../../../src/lib/supabase-admin'
import { criarPedidoIniciado, anotarSessaoDoPedido } from '../../../../src/lib/pedidos-da-loja'
import { produtoParaVenda, ehDigital } from '../../../../src/lib/produtos-da-plataforma'
import { precoVigente } from '../../../../src/lib/promocao-do-produto'
import {
  COOKIE_DO_VISITANTE, hashDoVisitante, indicacaoQueAtribui, atribuicaoValida,
} from '../../../../src/lib/atribuicao-de-afiliado'

const ROUTE = '/api/loja/checkout'

const MAX_QUANTIDADE = 20

/** Digital não tem por que ser comprado em lote: o mesmo arquivo, n vezes. */
const QUANTIDADE_DE_DIGITAL = 1

export async function POST(request: Request) {
  const { success } = await rateLimit(ipDaRequisicao(request), { limit: 15, windowMs: 60_000 })
  if (!success) {
    return NextResponse.json(
      { error: 'Muitas requisições. Tente novamente em alguns instantes.' },
      { status: 429, headers: { 'Retry-After': '60' } }
    )
  }

  let body: { produto_id?: string; quantidade?: number }
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }

  if (!body.produto_id || !validateUUID(body.produto_id)) {
    return NextResponse.json({ error: 'Produto inválido.' }, { status: 400 })
  }

  const supabase = createSupabaseAdminClient()
  const produto = await produtoParaVenda(supabase, body.produto_id, ROUTE)

  // Inexistente e inativo respondem igual: distinguir contaria a quem sonda
  // quais ids existem. Mesma escolha do 404 idêntico no pedido por token.
  if (!produto) {
    return NextResponse.json({ error: 'Produto indisponível para compra.' }, { status: 404 })
  }

  /*
   * A fase 2 vende **só digital**.
   *
   * O físico está no schema porque as fases seguintes vão usá-lo, e recusar
   * aqui é o que impede que um produto físico cadastrado cedo demais seja
   * comprado sem que exista frete, endereço, estoque ou nota fiscal. O banco
   * aceitaria a linha; esta rota é onde a fase termina.
   */
  if (!ehDigital(produto.tipo)) {
    logger.warn('Tentativa de comprar produto não-digital no checkout da fase 2', {
      route: ROUTE, produtoId: produto.id, tipo: produto.tipo,
    })
    return NextResponse.json({ error: 'Produto indisponível para compra.' }, { status: 404 })
  }

  const quantidade = ehDigital(produto.tipo)
    ? QUANTIDADE_DE_DIGITAL
    : Math.min(Math.max(1, Math.trunc(body.quantidade ?? 1)), MAX_QUANTIDADE)

  /*
   * O preço sai de `precoVigente`, no instante do clique.
   *
   * A **mesma** função que a vitrine usa, e não uma leitura paralela: fosse
   * calculado aqui de novo, a divergência apareceria na única fronteira em que
   * ninguém olha — a campanha que termina entre carregar a página e clicar em
   * «Comprar». Com uma função só, o servidor decide por último e o cobrado é o
   * do instante em que o dinheiro se move, que é o certo.
   *
   * `new Date()` fica aqui, no ponto de I/O, e não dentro da função: é aqui que
   * «agora» significa alguma coisa.
   */
  const vigente = precoVigente(produto, new Date())
  const total = vigente.centavos * quantidade
  const origin = origemDaAplicacao(request)
  const indicacaoId = await indicacaoDoComprador(supabase, request)

  try {
    /*
     * O pedido nasce antes do redirecionamento, e o checkout **falha** se não
     * der para gravá-lo — a mesma regra da venda do consultor, pela mesma
     * razão: sem pedido, o webhook não tem onde escrever, e a venda voltaria a
     * acontecer sem registro deste lado.
     *
     * `taxaPlataformaCentavos: 0` não é «não sei»: numa venda nossa não existe
     * comissão a reter de ninguém. O razão do pedido vai mostrar produto e
     * tarifa do gateway, e nenhuma linha de comissão — porque não houve.
     */
    const pedido = await criarPedidoIniciado(supabase, {
      tipo: produto.tipo,
      vendedorTipo: 'plataforma',
      vendedorPerfilId: null,
      stripeAccountId: null,
      totalCentavos: total,
      taxaPlataformaCentavos: 0,
      indicacaoId,
      item: {
        nome: produto.nome,
        descricao: produto.descricao,
        /*
         * O item guarda o preço **vigente**, não o cheio. `pedido_itens` é
         * fotografia do instante da compra: quando a campanha acabar, o recibo
         * tem que continuar dizendo o que a pessoa pagou.
         */
        precoUnitarioCentavos: vigente.centavos,
        quantidade,
        produtoId: produto.id,
      },
    }, ROUTE)

    if (!pedido) {
      return NextResponse.json(
        { error: 'Não foi possível iniciar a compra. Tente novamente.' },
        { status: 503 }
      )
    }

    /*
     * `price_data` em vez de `price`: o catálogo é nosso, e espelhar cada
     * produto como um `price` no Stripe criaria uma segunda cópia do preço que
     * envelheceria em silêncio. O valor cobrado é o que está no banco no
     * instante do clique, e o item do pedido guarda a fotografia dele.
     *
     * Sem `stripeAccount`: a cobrança acontece na conta da plataforma. É a
     * diferença que faz esta venda ser nossa.
     *
     * E sem `payment_method_types`: na nossa conta o Stripe usa o que está
     * habilitado no painel. Declarar a lista aqui faria ativar o Pix exigir um
     * deploy — ver a nota em `metodos-de-pagamento.ts` sobre por que na conta
     * conectada a lista **precisa** ser consultada.
     */
    const session = await stripeClient.checkout.sessions.create({
      mode: 'payment',
      line_items: [{
        quantity: quantidade,
        price_data: {
          currency: 'brl',
          unit_amount: vigente.centavos,
          product_data: {
            name: produto.nome,
            ...(produto.descricao ? { description: produto.descricao } : {}),
          },
        },
      }],
      metadata: { pedido_id: pedido.id },
      /*
       * O mesmo `pedido_id`, agora **na cobrança**.
       *
       * O `metadata` da sessão some da vista quando se olha o dinheiro: a
       * reconciliação varre cobranças, e na conta da plataforma cai muito mais
       * do que loja — assinatura, link de pagamento, cobrança avulsa. Sem este
       * carimbo, cada uma delas viraria «venda ausente no banco» todo dia, e um
       * relatório que acusa o que não é problema ensina a ser ignorado.
       */
      payment_intent_data: { metadata: { pedido_id: pedido.id } },
      success_url: `${origin}/pedido/${pedido.tokenPublico}`,
      cancel_url: `${origin}/produtos`,
    })

    await anotarSessaoDoPedido(supabase, pedido.id, session.id, ROUTE)

    logger.info('Checkout de bem próprio iniciado', {
      route: ROUTE, pedidoId: pedido.id, produtoId: produto.id,
    })

    return NextResponse.json({ url: session.url })
  } catch (err) {
    logger.error('Falha ao criar a sessão de checkout do bem próprio', {
      route: ROUTE, produtoId: produto.id, error: String(err),
    })
    return NextResponse.json({ error: 'Erro ao criar sessão de pagamento.' }, { status: 500 })
  }
}

/**
 * De qual indicação de afiliado veio quem está comprando.
 *
 * Resolvida **aqui**, no início do checkout, e não no webhook: a janela de 30
 * dias vale no instante em que a pessoa decide comprar. Entre a decisão e a
 * confirmação do cartão pode passar tempo, e num pagamento assíncrono passam
 * dias — resolver depois faria uma indicação viva vencer no meio do caminho e
 * a atribuição sumir por atraso de infraestrutura.
 *
 * Best-effort declarado: falha aqui devolve `null` e a venda segue sem
 * afiliado. Derrubar uma compra paga porque não deu para creditar quem indicou
 * seria trocar receita certa por comissão incerta.
 */
async function indicacaoDoComprador(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  request: Request
): Promise<string | null> {
  const identidade = request.headers.get('cookie')
    ?.split(';')
    .map(p => p.trim())
    .find(p => p.startsWith(`${COOKIE_DO_VISITANTE}=`))
    ?.split('=')[1]

  if (!identidade) return null

  const { data, error } = await supabase
    .from('indicacoes')
    .select('id, afiliado_perfil_id, criada_em, expira_em')
    .eq('visitante_hash', hashDoVisitante(identidade))
    // Teto: mesmo visitante clicando muito não vira consulta sem fim. Trinta
    // é folgado para uma janela de trinta dias, e `indicacaoQueAtribui`
    // escolhe pela mais recente de qualquer forma.
    .order('criada_em', { ascending: false })
    .limit(30)

  if (error) {
    logger.warn('Não foi possível ler a indicação do comprador', {
      route: ROUTE, error: error.message,
    })
    return null
  }

  const indicacao = indicacaoQueAtribui(data ?? [], new Date())

  /*
   * O comprador da loja não tem conta, então não há perfil para comparar e a
   * regra do autoafiliado não tem o que checar aqui. A chamada fica mesmo
   * assim, com `null` explícito: quando a loja passar a reconhecer comprador
   * logado, o lugar de aplicar a regra já existe — e a alternativa seria
   * descobrir a ausência dela no dia em que alguém comprar com o próprio
   * código.
   */
  return atribuicaoValida(indicacao, null) ? indicacao!.id : null
}
