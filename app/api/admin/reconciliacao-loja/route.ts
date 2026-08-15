/**
 * Reconciliação da loja — o Stripe contra o banco, para vendas.
 *
 * `GET`  → relata o que diverge, sem tocar em nada.
 * `POST` → relata e corrige o que é mecânico.
 *
 * ## Por que existe
 *
 * Webhook é entrega best-effort. A assinatura já ensinou isso da pior forma em
 * 12/08: um pagamento real aconteceu e o app não soube. Na loja o efeito é
 * pior, porque o dinheiro é de terceiro — o consultor vende e a plataforma não
 * registra.
 *
 * ## O que destrava
 *
 * Enquanto isto não existia, o checkout **recusava a compra** quando não
 * conseguia gravar o pedido: sem forma de recuperar a venda depois, derrubar
 * era a resposta honesta. Com esta rota no cron diário, a venda passa a ser
 * recuperável.
 *
 * ## O que o POST corrige, e o que ele não toca
 *
 * Corrige por acréscimo de evento — nunca por edição, porque `pedido_eventos`
 * é append-only e essa é a garantia que dá valor à tabela:
 *
 * - **pagamento não registrado** → acrescenta `pago`;
 * - **reembolso não registrado** → acrescenta `reembolsado`;
 * - **sessão paga e pedido em `iniciado`** → confirma pelo mesmo caminho do
 *   webhook (`confirmarVendaDaLoja`), com razão e e-mail.
 *
 * ## O ponto cego que existiu aqui
 *
 * A comparação casa os dois lados pelo `payment_intent`, e o `pi_` é escrito
 * **pelo webhook**. Um pedido que perdeu o webhook não tinha `pi_`, e a
 * consulta ao banco ainda filtrava por `pi_` não nulo: ele não era nem lido.
 * A rota existia para o caso «o webhook não chegou» e era cega para a forma
 * mais comum dele.
 *
 * Aconteceu de verdade em 14/08, na primeira venda de bem próprio: o destino
 * da conta da plataforma não escutava `checkout.session.completed`, o
 * comprador pagou R$ 1,00 e o pedido ficou preso em `iniciado`. E o Stripe não
 * deixa reenviar o que nunca teve entrega — sem esta varredura, não havia
 * caminho de volta que não fosse escrever estado à mão.
 *
 * **`venda_ausente_no_banco` fica de fora do reparo automático.** Recriar o
 * pedido exigiria inventar o que o checkout sabia e o Stripe não guarda: qual
 * item, qual quantidade, qual foi a taxa combinada. Um pedido reconstruído com
 * dados aproximados é pior do que um alerta, porque parece completo. Ele é
 * **relatado**, com o `pi_` para o humano investigar.
 */

import { NextResponse } from 'next/server'
import type Stripe from 'stripe'
import stripeClient from '../../../../src/lib/stripe'
import { createRouteHandlerClient } from '../../../../src/lib/supabase-route'
import { exigirAdmin } from '../../../../src/lib/guarda-admin'
import { createSupabaseAdminClient } from '../../../../src/lib/supabase-admin'
import { rateLimit, ipDaRequisicao } from '../../../../src/lib/rate-limit'
import { logger } from '../../../../src/lib/logger'
import { estadoDoPedido, registrarEvento } from '../../../../src/lib/pedidos-da-loja'
import { confirmarVendaDaLoja } from '../../../../src/lib/venda-da-loja'
import { origemDaAplicacao } from '../../../../src/lib/auth-rotas'
import {
  compararVendas, resumirDivergenciasDaLoja, pedidosParaConferirNoStripe, ehCobrancaDaLoja,
  type CobrancaNoStripe, type PedidoNoBanco, type DivergenciaDaLoja,
} from '../../../../src/lib/reconciliacao-loja'

const ROUTE = '/api/admin/reconciliacao-loja'

/** Teto por conta conectada. Acima disso, o relatório declara a truncagem. */
const LIMITE_POR_CONTA = 200
/** Teto de contas conectadas lidas por execução. */
const LIMITE_DE_CONTAS = 200
/** Teto de sessões conferidas por execução — uma chamada ao Stripe cada. */
const LIMITE_DE_SESSOES = 50

async function autorizado(request: Request): Promise<boolean> {
  const segredo = process.env.CRON_SECRET
  const cabecalho = request.headers.get('authorization')
  if (segredo && cabecalho === `Bearer ${segredo}`) return true

  // Pessoa: sessão + papel + segundo fator. O caminho do agendador acima não
  // passa por aqui de propósito — um cron não tem app autenticador, e exigir
  // `aal2` dele quebraria a reconciliação diária sem tornar nada mais seguro.
  // O que protege aquele caminho é o segredo, e ele é comparado antes.
  const supabase = await createRouteHandlerClient()
  return (await exigirAdmin(supabase)).ok
}

/**
 * As cobranças de todas as contas conectadas.
 *
 * A varredura é por conta porque cobrança direta vive na conta do vendedor —
 * listar na plataforma não as devolveria. É também o motivo de o custo crescer
 * com o número de consultores, e de haver teto declarado.
 */
async function cobrancasDoStripe(contas: string[]): Promise<{
  lista: CobrancaNoStripe[]
  truncado: boolean
}> {
  const lista: CobrancaNoStripe[] = []
  let truncado = false

  /*
   * `null` é a conta da plataforma, e ela entra na varredura desde a fase 2.
   *
   * Antes só as contas conectadas eram lidas, porque só elas vendiam. Com o
   * bem próprio, a cobrança acontece na **nossa** conta — e uma venda nossa
   * que perdesse o webhook não apareceria em relatório nenhum, que é
   * exatamente o defeito que esta rota existe para não deixar acontecer.
   */
  for (const conta of [null, ...contas]) {
    let cursor: string | undefined
    let lidas = 0

    while (lidas < LIMITE_POR_CONTA) {
      const pagina: Stripe.ApiList<Stripe.Charge> = await stripeClient.charges.list(
        // O `payment_intent` vem expandido para ler o carimbo `pedido_id`, que
        // é o que distingue venda da loja de assinatura na **nossa** conta.
        { limit: 100, starting_after: cursor, expand: ['data.payment_intent'] },
        conta ? { stripeAccount: conta } : undefined
      )

      for (const c of pagina.data) {
        lidas++
        // Cobrança não capturada ou falha não é venda. Incluí-las encheria o
        // relatório de «ausente no banco» que nunca foram vendas de verdade.
        if (!c.paid || c.status !== 'succeeded') continue

        const intent = typeof c.payment_intent === 'string' ? c.payment_intent : c.payment_intent?.id
        if (!intent) continue

        // Assinatura, link de pagamento e cobrança manual caem na nossa conta
        // e não são loja. Ver `ehCobrancaDaLoja`.
        const carimbo = typeof c.payment_intent === 'object'
          ? c.payment_intent?.metadata?.pedido_id ?? null
          : null

        if (!ehCobrancaDaLoja({
          pedidoIdNoMetadata: carimbo ?? c.metadata?.pedido_id ?? null,
        }, conta)) continue

        lista.push({
          paymentIntentId: intent,
          contaConectada: conta,
          valorCentavos: c.amount,
          reembolsadoCentavos: c.amount_refunded ?? 0,
          criadoEm: new Date(c.created * 1000).toISOString(),
          compradorEmail: c.billing_details?.email ?? null,
        })
      }

      if (!pagina.has_more) break
      cursor = pagina.data[pagina.data.length - 1]?.id
      if (!cursor) break
    }

    if (lidas >= LIMITE_POR_CONTA) truncado = true
  }

  return { lista, truncado }
}

/**
 * Os pedidos do banco, com o estado já derivado dos eventos.
 *
 * O filtro por `stripe_payment_intent is not null` **saiu**, e essa era a
 * segunda metade do ponto cego: o `pi_` é escrito pelo webhook, então o pedido
 * que perdeu o webhook não tinha `pi_` e não era nem lido. A reconciliação
 * existia para o caso «o webhook não chegou» e era cega para ele.
 */
async function pedidosDoBanco(): Promise<PedidoNoBanco[]> {
  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase
    .from('pedidos')
    .select(`id, numero, stripe_payment_intent, stripe_session_id, stripe_account_id,
             total_centavos, pedido_eventos(evento, ocorrido_em)`)
    .limit(1000)

  if (error) {
    logger.error('Falha ao ler pedidos para reconciliação', { route: ROUTE, error: error.message })
    return []
  }

  return (data ?? []).map(p => ({
    id: p.id,
    numero: p.numero,
    stripe_payment_intent: p.stripe_payment_intent,
    stripe_session_id: p.stripe_session_id,
    stripe_account_id: p.stripe_account_id,
    total_centavos: p.total_centavos,
    estado: estadoDoPedido(p.pedido_eventos ?? []),
  }))
}

/**
 * Pergunta ao Stripe se as sessões presas em `iniciado` foram pagas — e, se
 * foram, confirma o pedido pelo **mesmo caminho do webhook**.
 *
 * `confirmarVendaDaLoja` é a única porta de entrada de uma venda paga: ela
 * grava o `pago`, monta o razão e manda a confirmação ao comprador. Reusá-la
 * aqui é o que impede a reconciliação de virar uma segunda versão da regra,
 * com a diferença aparecendo só depois, num pedido que ficou pela metade.
 *
 * Só o POST chama isto. O GET continua sem escrever nada.
 */
async function confirmarSessoesPagas(
  request: Request,
  pedidos: PedidoNoBanco[]
): Promise<{ verificadas: number; confirmados: string[] }> {
  const supabase = createSupabaseAdminClient()
  const candidatos = pedidosParaConferirNoStripe(pedidos).slice(0, LIMITE_DE_SESSOES)
  const confirmados: string[] = []

  for (const pedido of candidatos) {
    try {
      const sessao = await stripeClient.checkout.sessions.retrieve(
        pedido.stripe_session_id!,
        undefined,
        pedido.stripe_account_id ? { stripeAccount: pedido.stripe_account_id } : undefined
      )

      // Sessão aberta ou expirada sem pagamento é carrinho abandonado — o
      // desfecho mais comum, e não é divergência.
      if (sessao.payment_status !== 'paid') continue

      const id = await confirmarVendaDaLoja(supabase, {
        sessao,
        // A referência de idempotência: sem `evt_`, o id da sessão é o que
        // amarra o conserto à origem e impede que a execução de amanhã
        // empilhe um segundo `pago`.
        eventoId: `reconciliacao:${sessao.id}`,
        eventoEm: sessao.created,
        contaDoEvento: pedido.stripe_account_id ?? null,
        origemDaApp: origemDaAplicacao(request),
      }, ROUTE)

      if (id) confirmados.push(pedido.numero)
    } catch (err) {
      // Sessão que o Stripe não devolve mais não trava a varredura das outras.
      logger.warn('Não foi possível conferir a sessão do pedido', {
        route: ROUTE, pedidoId: pedido.id, error: String(err),
      })
    }
  }

  return { verificadas: candidatos.length, confirmados }
}

async function contasConectadas(): Promise<string[]> {
  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase
    .from('profiles')
    .select('stripe_account_id')
    .not('stripe_account_id', 'is', null)
    .limit(LIMITE_DE_CONTAS)

  if (error) {
    logger.error('Falha ao listar contas conectadas', { route: ROUTE, error: error.message })
    return []
  }

  return (data ?? []).map(p => p.stripe_account_id).filter(Boolean)
}

async function levantar() {
  const contas = await contasConectadas()
  const { lista, truncado } = await cobrancasDoStripe(contas)
  const banco = await pedidosDoBanco()
  const divergencias = compararVendas(lista, banco)

  return {
    contas: contas.length,
    cobrancas_no_stripe: lista.length,
    pedidos_no_banco: banco.length,
    leitura_truncada: truncado,
    divergencias,
    resumo: resumirDivergenciasDaLoja(divergencias),
  }
}

export async function GET(request: Request) {
  const { success } = await rateLimit(ipDaRequisicao(request), { limit: 5, windowMs: 60_000 })
  if (!success) return NextResponse.json({ error: 'Muitas requisições.' }, { status: 429 })

  if (!await autorizado(request)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
  }

  const relatorio = await levantar()
  logger.info('Reconciliação da loja (relatório)', { route: ROUTE, resumo: relatorio.resumo })
  return NextResponse.json({ aplicado: false, ...relatorio })
}

export async function POST(request: Request) {
  const { success } = await rateLimit(ipDaRequisicao(request), { limit: 5, windowMs: 60_000 })
  if (!success) return NextResponse.json({ error: 'Muitas requisições.' }, { status: 429 })

  if (!await autorizado(request)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
  }

  /*
   * A varredura de sessões vem **antes** do relatório, e a ordem é o que faz
   * o número final ser verdade: um pedido confirmado agora não deve aparecer
   * como divergência de si mesmo no mesmo relatório.
   */
  const sessoes = await confirmarSessoesPagas(request, await pedidosDoBanco())

  const relatorio = await levantar()
  const supabase = createSupabaseAdminClient()
  const corrigidas: DivergenciaDaLoja[] = []

  for (const d of relatorio.divergencias) {
    if (!d.corrigivel || !d.pedidoId) continue

    // Corrigir é **acrescentar** o evento que faltava. A referência amarra o
    // conserto à origem, e o índice de idempotência impede que a execução de
    // amanhã empilhe o mesmo evento de novo.
    const evento = d.tipo === 'pagamento_nao_registrado' ? 'pago'
      : d.tipo === 'reembolso_nao_registrado' ? 'reembolsado'
      : null

    if (!evento) continue

    const ok = await registrarEvento(supabase, {
      pedidoId: d.pedidoId,
      evento,
      origem: 'sistema',
      referencia: `reconciliacao:${d.paymentIntentId}:${evento}`,
      motivo: 'Registrado pela reconciliação — o webhook não chegou',
    }, ROUTE)

    if (ok) corrigidas.push(d)
  }

  logger.info('Reconciliação da loja (aplicada)', {
    route: ROUTE, resumo: relatorio.resumo, corrigidas: corrigidas.length,
    sessoesConfirmadas: sessoes.confirmados.length,
  })

  return NextResponse.json({ aplicado: true, ...relatorio, corrigidas, sessoes })
}
