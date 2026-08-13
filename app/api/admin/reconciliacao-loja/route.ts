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
 * - **reembolso não registrado** → acrescenta `reembolsado`.
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
import { createSupabaseAdminClient } from '../../../../src/lib/supabase-admin'
import { rateLimit, ipDaRequisicao } from '../../../../src/lib/rate-limit'
import { logger } from '../../../../src/lib/logger'
import { estadoDoPedido, registrarEvento } from '../../../../src/lib/pedidos-da-loja'
import {
  compararVendas, resumirDivergenciasDaLoja,
  type CobrancaNoStripe, type PedidoNoBanco, type DivergenciaDaLoja,
} from '../../../../src/lib/reconciliacao-loja'

const ROUTE = '/api/admin/reconciliacao-loja'

/** Teto por conta conectada. Acima disso, o relatório declara a truncagem. */
const LIMITE_POR_CONTA = 200
/** Teto de contas conectadas lidas por execução. */
const LIMITE_DE_CONTAS = 200

async function autorizado(request: Request): Promise<boolean> {
  const segredo = process.env.CRON_SECRET
  const cabecalho = request.headers.get('authorization')
  if (segredo && cabecalho === `Bearer ${segredo}`) return true

  const supabase = await createRouteHandlerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  return profile?.role === 'admin'
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

  for (const conta of contas) {
    let cursor: string | undefined
    let lidas = 0

    while (lidas < LIMITE_POR_CONTA) {
      const pagina: Stripe.ApiList<Stripe.Charge> = await stripeClient.charges.list(
        { limit: 100, starting_after: cursor },
        { stripeAccount: conta }
      )

      for (const c of pagina.data) {
        lidas++
        // Cobrança não capturada ou falha não é venda. Incluí-las encheria o
        // relatório de «ausente no banco» que nunca foram vendas de verdade.
        if (!c.paid || c.status !== 'succeeded') continue

        const intent = typeof c.payment_intent === 'string' ? c.payment_intent : c.payment_intent?.id
        if (!intent) continue

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

/** Os pedidos do banco, com o estado já derivado dos eventos. */
async function pedidosDoBanco(): Promise<PedidoNoBanco[]> {
  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase
    .from('pedidos')
    .select('id, numero, stripe_payment_intent, total_centavos, pedido_eventos(evento, ocorrido_em)')
    .not('stripe_payment_intent', 'is', null)
    .limit(1000)

  if (error) {
    logger.error('Falha ao ler pedidos para reconciliação', { route: ROUTE, error: error.message })
    return []
  }

  return (data ?? []).map(p => ({
    id: p.id,
    numero: p.numero,
    stripe_payment_intent: p.stripe_payment_intent,
    total_centavos: p.total_centavos,
    estado: estadoDoPedido(p.pedido_eventos ?? []),
  }))
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
  })

  return NextResponse.json({ aplicado: true, ...relatorio, corrigidas })
}
