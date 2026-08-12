/**
 * Reconciliação das assinaturas — o Stripe contra o banco.
 *
 * `GET`  → só relata o que diverge, sem tocar em nada.
 * `POST` → relata e corrige o que é mecânico.
 *
 * ## Por que existe
 *
 * Webhook é entrega best-effort. Em 12/08/2026 uma compra real foi paga e o
 * app não soube: o endpoint ainda não existia, o evento nunca foi entregue, e
 * nada percebeu. O dinheiro entrou, o plano não mudou.
 *
 * A idempotência (`eventos-stripe`) impede processar duas vezes. Ela não
 * recupera o que nunca chegou — é o que esta rota faz.
 *
 * ## Quem pode chamar
 *
 * Admin autenticado, ou um agendador com `CRON_SECRET`. A rota lê a conta
 * Stripe inteira e corrige linhas de assinatura; não é coisa para usuário.
 *
 * ## Sobre correção automática
 *
 * Só corrige o que é cópia de valor: status, valor pago, ciclo, cancelamento
 * agendado. Os dois casos de ausência ficam **de fora** e são relatados:
 *
 * - `ausente_no_banco` exige criar a linha, o que envolve resolver perfil e
 *   plano — lógica que o webhook já tem. Reescrever aqui criaria uma segunda
 *   verdade sobre como uma assinatura nasce, que é justamente o defeito que
 *   este projeto vem perseguindo. Extrair aquele caminho para um módulo comum
 *   é o passo seguinte, e merece o próprio PR.
 * - `ausente_no_stripe` não é dado velho, é dado inventado. Apagar em silêncio
 *   esconderia a pergunta de onde a linha veio.
 */

import { NextResponse } from 'next/server'
import type Stripe from 'stripe'
import stripeClient from '../../../../src/lib/stripe'
import { createRouteHandlerClient } from '../../../../src/lib/supabase-route'
import { createSupabaseAdminClient } from '../../../../src/lib/supabase-admin'
import { rateLimit, ipDaRequisicao } from '../../../../src/lib/rate-limit'
import { logger } from '../../../../src/lib/logger'
import {
  compararAssinaturas, resumirDivergencias,
  type AssinaturaNoStripe, type AssinaturaNoBanco, type Divergencia,
} from '../../../../src/lib/reconciliacao'

const ROUTE = '/api/admin/reconciliacao'

/** Teto de assinaturas lidas por execução. Acima disso, o relatório declara. */
const LIMITE_DE_ASSINATURAS = 1000

async function autorizado(request: Request): Promise<boolean> {
  // Agendador: cabeçalho com o segredo. Comparação de tamanho fixo não importa
  // aqui porque o segredo não é derivado de entrada do usuário.
  const segredo = process.env.CRON_SECRET
  const cabecalho = request.headers.get('authorization')
  if (segredo && cabecalho === `Bearer ${segredo}`) return true

  const supabase = await createRouteHandlerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  return profile?.role === 'admin'
}

/** Lê a conta inteira, paginando. O Stripe devolve 100 por página. */
async function assinaturasDoStripe(): Promise<{ lista: AssinaturaNoStripe[]; truncado: boolean }> {
  const lista: AssinaturaNoStripe[] = []
  let cursor: string | undefined

  while (lista.length < LIMITE_DE_ASSINATURAS) {
    const pagina: Stripe.ApiList<Stripe.Subscription> = await stripeClient.subscriptions.list({
      limit: 100,
      status: 'all',
      starting_after: cursor,
    })

    for (const s of pagina.data) {
      const item = s.items?.data?.[0]
      lista.push({
        id: s.id,
        status: s.status,
        valor: typeof item?.price?.unit_amount === 'number' ? item.price.unit_amount / 100 : null,
        intervalo: item?.price?.recurring?.interval === 'year' ? 'year'
          : item?.price?.recurring?.interval === 'month' ? 'month' : null,
        customerId: typeof s.customer === 'string' ? s.customer : s.customer?.id ?? null,
        cancelaNoFim: Boolean(s.cancel_at_period_end),
        fimDoPeriodo: null,
      })
    }

    if (!pagina.has_more || pagina.data.length === 0) return { lista, truncado: false }
    cursor = pagina.data[pagina.data.length - 1].id
  }

  return { lista, truncado: true }
}

/** Aplica no banco o que o Stripe diz. Devolve quantas linhas mudaram. */
async function corrigir(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  divergencias: Divergencia[]
): Promise<{ corrigidas: number; falhas: number }> {
  const porLinha = new Map<string, Record<string, unknown>>()

  for (const d of divergencias) {
    if (!d.corrigivel || !d.linhaId) continue
    const campos = porLinha.get(d.linhaId) ?? {}

    if (d.tipo === 'status_diferente') campos.status = d.noStripe
    if (d.tipo === 'valor_diferente') campos.price_paid = d.noStripe
    if (d.tipo === 'ciclo_diferente') campos.billing_cycle = d.noStripe
    if (d.tipo === 'cancelamento_diferente') campos.cancel_at_period_end = d.noStripe

    porLinha.set(d.linhaId, campos)
  }

  let corrigidas = 0
  let falhas = 0

  for (const [linhaId, campos] of porLinha) {
    if (Object.keys(campos).length === 0) continue
    const { error } = await admin.from('subscriptions').update(campos).eq('id', linhaId)
    if (error) {
      falhas++
      logger.error('Reconciliação não conseguiu corrigir a assinatura', {
        route: ROUTE, linhaId, error: error.message,
      })
      continue
    }
    corrigidas++
    // A correção é registrada uma a uma: uma linha de dinheiro que muda sem
    // deixar rastro é indistinguível de uma que mudou sozinha.
    logger.info('Assinatura reconciliada com o Stripe', { route: ROUTE, linhaId, campos })
  }

  return { corrigidas, falhas }
}

async function executar(request: Request, aplicar: boolean) {
  const ip = ipDaRequisicao(request)
  const { success } = await rateLimit(ip, { limit: 5, windowMs: 60_000 })
  if (!success) {
    return NextResponse.json(
      { error: 'Muitas requisições. Tente novamente em alguns instantes.' },
      { status: 429, headers: { 'Retry-After': '60' } }
    )
  }

  if (!await autorizado(request)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
  }

  const admin = createSupabaseAdminClient()

  let doStripe: { lista: AssinaturaNoStripe[]; truncado: boolean }
  try {
    doStripe = await assinaturasDoStripe()
  } catch (err) {
    logger.error('Reconciliação não conseguiu ler o Stripe', { route: ROUTE, error: String(err) })
    return NextResponse.json({ error: 'Não foi possível consultar o Stripe.' }, { status: 502 })
  }

  const { data: doBanco, error } = await admin
    .from('subscriptions')
    .select('id, gateway_subscription_id, status, price_paid, billing_cycle, cancel_at_period_end, current_period_end')
    .not('gateway_subscription_id', 'is', null)

  if (error) {
    logger.error('Reconciliação não conseguiu ler as assinaturas', { route: ROUTE, error: error.message })
    return NextResponse.json({ error: 'Não foi possível consultar as assinaturas.' }, { status: 500 })
  }

  const divergencias = compararAssinaturas(doStripe.lista, (doBanco ?? []) as AssinaturaNoBanco[])
  const resumo = resumirDivergencias(divergencias)

  if (divergencias.length > 0) {
    // Nível de erro de propósito: divergência entre o que foi cobrado e o que
    // o app acredita é a classe de problema que ninguém deve descobrir pelo
    // cliente.
    logger.error('Reconciliação encontrou divergências', {
      route: ROUTE, total: divergencias.length, resumo,
    })
  }

  const correcao = aplicar
    ? await corrigir(admin, divergencias)
    : { corrigidas: 0, falhas: 0 }

  return NextResponse.json({
    aplicado: aplicar,
    assinaturas_no_stripe: doStripe.lista.length,
    assinaturas_no_banco: doBanco?.length ?? 0,
    // Declarado, não escondido: acima do teto a comparação está incompleta, e
    // um relatório que não diz isso passaria por completo.
    leitura_truncada: doStripe.truncado,
    total_de_divergencias: divergencias.length,
    resumo,
    corrigidas: correcao.corrigidas,
    falhas_ao_corrigir: correcao.falhas,
    // As não corrigíveis vão inteiras: são as que exigem decisão humana.
    exigem_analise: divergencias.filter(d => !d.corrigivel),
    divergencias,
  })
}

export async function GET(request: Request) {
  return executar(request, false)
}

export async function POST(request: Request) {
  return executar(request, true)
}
