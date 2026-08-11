import { NextResponse } from 'next/server'
import { createRouteHandlerClient } from '../../../../src/lib/supabase-route'
import { rateLimit, ipDaRequisicao } from '../../../../src/lib/rate-limit'
import { logger } from '../../../../src/lib/logger'

async function verifyAdmin(supabase: Awaited<ReturnType<typeof createRouteHandlerClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (!profile || profile.role !== 'admin') return null
  return { user, profile }
}

function getWeekBounds(date: Date): { start: Date; end: Date } {
  const d = new Date(date)
  const day = d.getDay()
  const diffToMonday = day === 0 ? -6 : 1 - day
  const start = new Date(d)
  start.setDate(d.getDate() + diffToMonday)
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  end.setHours(23, 59, 59, 999)
  return { start, end }
}

function formatDate(d: Date): string {
  return d.toISOString().split('T')[0]
}

function getWeekNumber(d: Date): number {
  const start = new Date(d.getFullYear(), 0, 1)
  const diff = d.getTime() - start.getTime()
  return Math.ceil((diff / 86400000 + start.getDay() + 1) / 7)
}

async function generateReportData(supabase: Awaited<ReturnType<typeof createRouteHandlerClient>>, weekStart: Date, weekEnd: Date) {
  const startStr = formatDate(weekStart)
  const endStr = formatDate(weekEnd)

  const [
    { data: allProfiles, count: totalProfiles },
    { data: newProfiles },
    { data: allSubs },
    { data: weekInvoices },
    { data: weekConsultas },
    { data: weekClientes },
    { data: weekAuditLogs },
  ] = await Promise.all([
    supabase.from('profiles').select('id, plano, criado_em', { count: 'exact' }),
    supabase.from('profiles').select('id, plano, criado_em').gte('criado_em', startStr).lte('criado_em', endStr + 'T23:59:59'),
    supabase.from('subscriptions').select('*, plans(slug, price_monthly, price_yearly)'),
    supabase.from('invoices').select('*').gte('created_at', startStr).lte('created_at', endStr + 'T23:59:59'),
    supabase.from('consultas').select('id, status, criado_em').gte('criado_em', startStr).lte('criado_em', endStr + 'T23:59:59'),
    supabase.from('clientes').select('id, criado_em').gte('criado_em', startStr).lte('criado_em', endStr + 'T23:59:59'),
    supabase.from('admin_audit_log').select('action').gte('performed_at', startStr).lte('performed_at', endStr + 'T23:59:59'),
  ])

  // User stats
  const novos = newProfiles || []
  const novosPorDia: { data: string; qtd: number }[] = []
  for (let d = new Date(weekStart); d <= weekEnd; d.setDate(d.getDate() + 1)) {
    const ds = formatDate(d)
    novosPorDia.push({ data: ds, qtd: novos.filter(p => p.criado_em?.startsWith(ds)).length })
  }

  // Cancelled in week
  const cancelledInWeek = (allSubs || []).filter(s =>
    s.status === 'cancelled' && s.cancelled_at && s.cancelled_at >= startStr && s.cancelled_at <= endStr + 'T23:59:59'
  )

  // Plan distribution
  const distribuicao: Record<string, number> = { free: 0, simples: 0, profissional: 0, gratuidade: 0 }
  for (const p of (allProfiles || [])) {
    const plan = p.plano || 'free'
    if (plan === 'pro' || plan === 'profissional') distribuicao.profissional++
    else if (plan === 'simples') distribuicao.simples++
    else distribuicao.free++
  }
  const gratCount = (allSubs || []).filter(s => s.status === 'gratuidade').length
  distribuicao.gratuidade = gratCount

  // MRR
  const activeSubs = (allSubs || []).filter(s => s.status === 'active')
  let mrr = 0
  for (const sub of activeSubs) {
    const plan = sub.plans
    if (!plan) continue
    mrr += sub.billing_cycle === 'yearly' ? (plan.price_yearly || 0) / 12 : (plan.price_monthly || 0)
  }

  // Invoice stats
  const paidInvoices = (weekInvoices || []).filter(i => i.status === 'paid')
  const overdueInvoices = (weekInvoices || []).filter(i => i.status === 'overdue')
  const receitaSemana = paidInvoices.reduce((s, i) => s + i.amount_paid, 0)
  const inadimplencia = overdueInvoices.reduce((s, i) => s + (i.amount - i.amount_paid), 0)

  // Usage
  const analisesRealizadas = (weekConsultas || []).length
  const analisesConcluidas = (weekConsultas || []).filter(c => c.status === 'finalizada').length
  const clientesCadastrados = (weekClientes || []).length

  // Admin actions
  const actionCounts: Record<string, number> = {}
  for (const log of (weekAuditLogs || [])) {
    actionCounts[log.action] = (actionCounts[log.action] || 0) + 1
  }
  const topAcoes = Object.entries(actionCounts).map(([acao, qtd]) => ({ acao, qtd })).sort((a, b) => b.qtd - a.qtd)

  return {
    periodo: { inicio: startStr, fim: endStr, semana: getWeekNumber(weekStart) },
    usuarios: {
      total_acumulado: totalProfiles || 0,
      novos_na_semana: novos.length,
      novos_por_dia: novosPorDia,
      saidas_na_semana: cancelledInWeek.length,
      saldo_semana: novos.length - cancelledInWeek.length,
    },
    planos: { distribuicao_atual: distribuicao },
    financeiro: {
      mrr_atual: Math.round(mrr * 100) / 100,
      arr_atual: Math.round(mrr * 12 * 100) / 100,
      receita_semana: Math.round(receitaSemana * 100) / 100,
      inadimplencia_semana: Math.round(inadimplencia * 100) / 100,
      faturas_pagas: paidInvoices.length,
      faturas_vencidas: overdueInvoices.length,
      ticket_medio: paidInvoices.length > 0 ? Math.round(receitaSemana / paidInvoices.length * 100) / 100 : 0,
    },
    uso_plataforma: {
      analises_realizadas: analisesRealizadas,
      analises_concluidas: analisesConcluidas,
      clientes_cadastrados: clientesCadastrados,
    },
    retencao: {
      churn_rate_semana: totalProfiles && totalProfiles > 0
        ? `${Math.round(cancelledInWeek.length / totalProfiles * 10000) / 100}%`
        : '0%',
    },
    top_acoes_admin: topAcoes,
  }
}

// GET — list reports or get single report
export async function GET(request: Request) {
  const ip = ipDaRequisicao(request)
  const { success } = await rateLimit(ip, { limit: 30, windowMs: 60_000 })
  if (!success) return Response.json({ error: 'Rate limit' }, { status: 429 })

  const supabase = await createRouteHandlerClient()
  const admin = await verifyAdmin(supabase)
  if (!admin) return NextResponse.json({ error: 'Acesso restrito' }, { status: 403 })

  const url = new URL(request.url)
  const reportId = url.searchParams.get('id')

  if (reportId) {
    const { data, error } = await supabase.from('weekly_reports').select('*').eq('id', reportId).single()
    if (error) return NextResponse.json({ error: 'Relatório não encontrado' }, { status: 404 })
    return NextResponse.json(data)
  }

  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'))
  const pageSize = 20

  const { data, count, error } = await supabase
    .from('weekly_reports')
    .select('*', { count: 'exact' })
    .order('week_start', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1)

  if (error) {
    logger.error('Reports list error', { route: '/api/admin/relatorios', error: error.message })
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ reports: data, total: count, page, pageSize })
}

// POST — generate report (manual or on-demand)
export async function POST(request: Request) {
  const ip = ipDaRequisicao(request)
  const { success } = await rateLimit(ip, { limit: 5, windowMs: 60_000 })
  if (!success) return Response.json({ error: 'Rate limit' }, { status: 429 })

  const supabase = await createRouteHandlerClient()
  const admin = await verifyAdmin(supabase)
  if (!admin) return NextResponse.json({ error: 'Acesso restrito' }, { status: 403 })

  let body: { week_start?: string; week_end?: string } = {}
  try { body = await request.json() } catch { /* use defaults */ }

  let weekStart: Date, weekEnd: Date

  if (body.week_start && body.week_end) {
    weekStart = new Date(body.week_start)
    weekEnd = new Date(body.week_end)
  } else {
    // Last week
    const lastWeek = new Date()
    lastWeek.setDate(lastWeek.getDate() - 7)
    const bounds = getWeekBounds(lastWeek)
    weekStart = bounds.start
    weekEnd = bounds.end
  }

  try {
    const reportData = await generateReportData(supabase, weekStart, weekEnd)

    const { data, error } = await supabase.from('weekly_reports').insert({
      week_start: formatDate(weekStart),
      week_end: formatDate(weekEnd),
      data: reportData,
      is_manual: true,
      sent_to: [admin.profile.nome_completo],
    }).select().single()

    if (error) throw error

    return NextResponse.json(data)
  } catch (err) {
    logger.error('Report generation error', { route: '/api/admin/relatorios', error: String(err) })
    return NextResponse.json({ error: 'Erro ao gerar relatório.' }, { status: 500 })
  }
}
