'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { supabase } from '../../src/lib/supabase'
import AppShell from '../components/AppShell'
import Skeleton from '../components/Skeleton'
import type { Profile, BaguaEntrada, StatusChartEntry, PagamentoMesChartEntry, ConsultaMesChartEntry, ClienteMesChartEntry, AgendaItem } from '../../src/lib/types'
import type { User } from '@supabase/supabase-js'
import { planoEfetivo, planoLabel, isProfissional, planoUsuario } from '../../src/lib/plano-utils'

const ChartLoadingSkeleton = () => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <Skeleton variant="chart" />
  </div>
)

const StatusPieChart = dynamic(
  () => import('../components/DashboardCharts').then(mod => mod.StatusPieChart),
  { ssr: false, loading: ChartLoadingSkeleton }
)
const PagamentosBarChart = dynamic(
  () => import('../components/DashboardCharts').then(mod => mod.PagamentosBarChart),
  { ssr: false, loading: ChartLoadingSkeleton }
)
const ConsultasLineChart = dynamic(
  () => import('../components/DashboardCharts').then(mod => mod.ConsultasLineChart),
  { ssr: false, loading: ChartLoadingSkeleton }
)
const ClientesBarChart = dynamic(
  () => import('../components/DashboardCharts').then(mod => mod.ClientesBarChart),
  { ssr: false, loading: ChartLoadingSkeleton }
)

const CORES_STATUS: Record<string, string> = {
  rascunho: '#94A3B8',
  em_andamento: '#F59E0B',
  finalizada: '#15803D',
  arquivada: '#6B7280',
}

const LABELS_STATUS: Record<string, string> = {
  rascunho: 'Rascunho',
  em_andamento: 'Em andamento',
  finalizada: 'Finalizada',
  arquivada: 'Arquivada',
}

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

const COR_PAGO = '#15803D'
const COR_PENDENTE = '#F59E0B'
const COR_ATRASADO = '#DC2626'

const DASHBOARD_MODULES = [
  { key: 'status_consultas', label: 'Status das Consultas' },
  { key: 'pagamentos', label: 'Pagamentos' },
  { key: 'consultas_mes', label: 'Consultas por Mês' },
  { key: 'proximas_atividades', label: 'Próximas Atividades' },
  { key: 'novos_clientes', label: 'Novos Clientes por Mês' },
  { key: 'analises_bagua', label: '☯ Análises Ba Gua Recentes' },
  { key: 'acoes_rapidas', label: 'Ações Rápidas' },
]

export default function Dashboard() {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [totalClientes, setTotalClientes] = useState(0)
  const [totalConsultas, setTotalConsultas] = useState(0)
  const [totalRituais, setTotalRituais] = useState(0)

  // Chart data
  const [statusData, setStatusData] = useState<StatusChartEntry[]>([])
  const [consultasMesData, setConsultasMesData] = useState<ConsultaMesChartEntry[]>([])
  const [clientesMesData, setClientesMesData] = useState<ClienteMesChartEntry[]>([])

  // Pagamentos
  const [pagamentosData, setPagamentosData] = useState<PagamentoMesChartEntry[]>([])
  const [totalRecebido, setTotalRecebido] = useState(0)
  const [totalPendente, setTotalPendente] = useState(0)
  const [totalAtrasado, setTotalAtrasado] = useState(0)

  // Agenda
  const [agenda, setAgenda] = useState<AgendaItem[]>([])

  // Análises Baguá recentes
  const [analisesBagua, setAnalisesBagua] = useState<{id:string;nome_imovel:string;finalizada_em:string;cliente_nome:string;status_bagua:'concluida'|'em_andamento'}[]>([])

  const [visibleModules, setVisibleModules] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('fengshui-dashboard-modules')
      if (saved) return JSON.parse(saved)
    } catch {}
    return Object.fromEntries(DASHBOARD_MODULES.map(m => [m.key, true]))
  })
  const [showSettings, setShowSettings] = useState(false)

  useEffect(() => {
    async function loadAll() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/login'; return }
      setUser(user)

      // Profile (loaded first -- needed for plan checks)
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()
      setProfile(profile)

      // Date constants for agenda queries
      const hoje = new Date().toISOString().split('T')[0]
      const em30dias = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

      // ── Run all independent queries in parallel (with graceful failure handling) ──
      const results = await Promise.allSettled([
        // 0 - KPI: Clientes ativos
        supabase
          .from('clientes')
          .select('*', { count: 'exact', head: true })
          .eq('consultor_id', user.id)
          .eq('ativo', true),
        // 1 - KPI: Total consultas
        supabase
          .from('consultas')
          .select('*', { count: 'exact', head: true })
          .eq('consultor_id', user.id),
        // 2 - KPI: Rituais pendentes
        supabase
          .from('rituais')
          .select('*', { count: 'exact', head: true })
          .eq('consultor_id', user.id)
          .eq('status', 'pendente'),
        // 3 - CHART 1: Status das consultas (Pie)
        supabase
          .from('consultas')
          .select('status')
          .eq('consultor_id', user.id),
        // 4 - CHART 2: Pagamentos por mes (Bar empilhado)
        supabase
          .from('pagamentos')
          .select('*')
          .eq('consultor_id', user.id),
        // 5 - CHART 3: Evolucao de consultas por mes (Line)
        supabase
          .from('consultas')
          .select('criado_em')
          .eq('consultor_id', user.id),
        // 6 - CHART 4: Clientes cadastrados por mes (Bar)
        supabase
          .from('clientes')
          .select('criado_em')
          .eq('consultor_id', user.id),
        // 7 - AGENDA: Rituais pendentes (proximos 30 dias)
        supabase
          .from('rituais')
          .select('*, clientes(nome_completo)')
          .eq('consultor_id', user.id)
          .eq('status', 'pendente')
          .gte('data_ritual', hoje)
          .lte('data_ritual', em30dias)
          .order('data_ritual', { ascending: true })
          .limit(5),
        // 8 - AGENDA: Consultas em andamento
        supabase
          .from('consultas')
          .select('*, clientes(nome_completo)')
          .eq('consultor_id', user.id)
          .eq('status', 'em_andamento')
          .order('criado_em', { ascending: false })
          .limit(5),
        // 9 - AGENDA: Pagamentos pendentes proximos
        supabase
          .from('pagamentos')
          .select('*, clientes(nome_completo)')
          .eq('consultor_id', user.id)
          .in('status', ['pendente', 'atrasado'])
          .order('data_vencimento', { ascending: true })
          .limit(5),
        // 10 - Analises Bagua recentes
        supabase
          .from('consultas')
          .select('id, nome_imovel, bagua_entrada, clientes(nome_completo)')
          .eq('consultor_id', user.id)
          .not('bagua_entrada', 'is', null)
          .order('criado_em', { ascending: false })
          .limit(20),
      ])

      // ── Extract results with graceful fallbacks ──
      const clientesCountRes = results[0].status === 'fulfilled' ? results[0].value : { count: 0, data: null, error: null }
      const consultasCountRes = results[1].status === 'fulfilled' ? results[1].value : { count: 0, data: null, error: null }
      const rituaisCountRes = results[2].status === 'fulfilled' ? results[2].value : { count: 0, data: null, error: null }
      const allConsultasRes = results[3].status === 'fulfilled' ? results[3].value : { data: [], error: null }
      const allPagamentosRes = results[4].status === 'fulfilled' ? results[4].value : { data: [], error: null }
      const consultasComDataRes = results[5].status === 'fulfilled' ? results[5].value : { data: [], error: null }
      const clientesComDataRes = results[6].status === 'fulfilled' ? results[6].value : { data: [], error: null }
      const rituaisAgendaRes = results[7].status === 'fulfilled' ? results[7].value : { data: [], error: null }
      const consultasAndamentoRes = results[8].status === 'fulfilled' ? results[8].value : { data: [], error: null }
      const pagProximosRes = results[9].status === 'fulfilled' ? results[9].value : { data: [], error: null }
      const consultasBaguaRes = results[10].status === 'fulfilled' ? results[10].value : { data: [], error: null }

      // ── Process KPI results ──
      setTotalClientes(clientesCountRes.count || 0)
      setTotalConsultas(consultasCountRes.count || 0)
      setTotalRituais(rituaisCountRes.count || 0)

      // ── CHART 1: Status das consultas (Pie) ──
      const allConsultas = allConsultasRes.data
      if (allConsultas && allConsultas.length > 0) {
        const counts: Record<string, number> = {}
        allConsultas.forEach(c => {
          counts[c.status] = (counts[c.status] || 0) + 1
        })
        const pieData = Object.entries(counts).map(([status, value]) => ({
          name: LABELS_STATUS[status] || status,
          value,
          color: CORES_STATUS[status] || '#94A3B8',
        }))
        setStatusData(pieData)
      }

      // ── CHART 2: Pagamentos por mês (Bar empilhado) ──
      const allPagamentos = allPagamentosRes.data
      if (allPagamentos && allPagamentos.length > 0) {
        // Totais
        let recebido = 0, pendente = 0, atrasado = 0
        allPagamentos.forEach(p => {
          if (p.status === 'pago') recebido += Number(p.valor)
          else if (p.status === 'pendente') pendente += Number(p.valor)
          else if (p.status === 'atrasado') atrasado += Number(p.valor)
        })
        setTotalRecebido(recebido)
        setTotalPendente(pendente)
        setTotalAtrasado(atrasado)

        // Por mês (últimos 6 meses)
        const now = new Date()
        const monthMap: Record<string, { pago: number; pendente: number; atrasado: number }> = {}
        for (let i = 5; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
          monthMap[key] = { pago: 0, pendente: 0, atrasado: 0 }
        }

        allPagamentos.forEach(p => {
          const dateField = p.status === 'pago' ? p.data_pagamento : p.data_vencimento
          if (!dateField) return
          const d = new Date(dateField)
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
          if (key in monthMap) {
            if (p.status === 'pago') monthMap[key].pago += Number(p.valor)
            else if (p.status === 'pendente') monthMap[key].pendente += Number(p.valor)
            else if (p.status === 'atrasado') monthMap[key].atrasado += Number(p.valor)
          }
        })

        const barData = Object.entries(monthMap).map(([key, val]) => {
          const [, m] = key.split('-')
          return { mes: MESES[parseInt(m) - 1], Recebido: val.pago, Pendente: val.pendente, Atrasado: val.atrasado }
        })
        setPagamentosData(barData)
      }

      // ── CHART 3: Evolução de consultas por mês (Line) ──
      const consultasComData = consultasComDataRes.data
      if (consultasComData && consultasComData.length > 0) {
        const now = new Date()
        const monthCounts: Record<string, number> = {}
        for (let i = 5; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
          monthCounts[key] = 0
        }
        consultasComData.forEach(c => {
          const d = new Date(c.criado_em)
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
          if (key in monthCounts) monthCounts[key]++
        })
        const lineData = Object.entries(monthCounts).map(([key, value]) => {
          const [, m] = key.split('-')
          return { mes: MESES[parseInt(m) - 1], consultas: value }
        })
        setConsultasMesData(lineData)
      }

      // ── CHART 4: Clientes cadastrados por mês (Bar) ──
      const clientesComData = clientesComDataRes.data
      if (clientesComData && clientesComData.length > 0) {
        const now = new Date()
        const monthCounts: Record<string, number> = {}
        for (let i = 5; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
          monthCounts[key] = 0
        }
        clientesComData.forEach(c => {
          const d = new Date(c.criado_em)
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
          if (key in monthCounts) monthCounts[key]++
        })
        const barData = Object.entries(monthCounts).map(([key, value]) => {
          const [, m] = key.split('-')
          return { mes: MESES[parseInt(m) - 1], clientes: value }
        })
        setClientesMesData(barData)
      }

      // ── AGENDA: Merge rituais + consultas em andamento + pagamentos ──
      const agendaItems: AgendaItem[] = []

      const rituais = rituaisAgendaRes.data
      rituais?.forEach(r => {
        agendaItems.push({
          tipo: 'ritual',
          titulo: r.titulo,
          subtitulo: r.clientes?.nome_completo || '',
          data: r.data_ritual,
          horario: r.horario,
          icon: '🌙',
          cor: '#7C3AED',
        })
      })

      const consultasAndamento = consultasAndamentoRes.data
      consultasAndamento?.forEach(c => {
        agendaItems.push({
          tipo: 'consulta',
          titulo: c.nome_imovel,
          subtitulo: c.clientes?.nome_completo || '',
          data: c.criado_em?.split('T')[0],
          horario: null,
          icon: '📋',
          cor: '#F59E0B',
        })
      })

      const pagProximos = pagProximosRes.data
      pagProximos?.forEach(p => {
        agendaItems.push({
          tipo: 'pagamento',
          titulo: p.descricao,
          subtitulo: `R$ ${Number(p.valor).toFixed(2)} • ${p.clientes?.nome_completo || ''}`,
          data: p.data_vencimento,
          horario: null,
          icon: p.status === 'atrasado' ? '🔴' : '💰',
          cor: p.status === 'atrasado' ? '#DC2626' : '#15803D',
        })
      })

      // Ordenar por data
      agendaItems.sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime())
      setAgenda(agendaItems.slice(0, 8))

      // Análises Baguá recentes
      const consultasBagua = consultasBaguaRes.data
      const recentes = ((consultasBagua || []) as unknown as { id: string; nome_imovel: string | null; bagua_entrada: BaguaEntrada | null; clientes?: { nome_completo: string } | null }[])
        .filter((c) => c.bagua_entrada?.finalizada_em || c.bagua_entrada?.planta_url)
        .sort((a, b) => {
          const da = a.bagua_entrada?.finalizada_em || a.bagua_entrada?.etapa || ''
          const db = b.bagua_entrada?.finalizada_em || b.bagua_entrada?.etapa || ''
          return new Date(db).getTime() - new Date(da).getTime()
        })
        .slice(0, 5)
        .map((c) => ({
          id: c.id,
          nome_imovel: c.nome_imovel || 'Imóvel',
          finalizada_em: c.bagua_entrada?.finalizada_em || '',
          cliente_nome: c.clientes?.nome_completo || '',
          status_bagua: c.bagua_entrada?.finalizada_em ? 'concluida' as const : 'em_andamento' as const,
        }))
      setAnalisesBagua(recentes)

      setLoading(false)
    }
    loadAll()
  }, [])

  function formatDate(dateStr: string) {
    const d = new Date(dateStr + 'T12:00:00')
    const hoje = new Date()
    const amanha = new Date(hoje)
    amanha.setDate(amanha.getDate() + 1)

    if (d.toDateString() === hoje.toDateString()) return 'Hoje'
    if (d.toDateString() === amanha.toDateString()) return 'Amanhã'
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
  }

  function formatCurrency(value: number) {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  }

  if (loading) {
    return (
      <AppShell currentPage="dashboard">
        {/* Header skeleton */}
        <div style={{ marginBottom: '32px' }}>
          <Skeleton width="280px" height="24px" />
          <div style={{ marginTop: '8px' }}><Skeleton width="320px" height="16px" /></div>
        </div>
        {/* KPI cards skeleton */}
        <Skeleton variant="kpi" />
        {/* Row 1: Two chart skeletons side by side */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '20px' }}>
          <Skeleton variant="chart" />
          <Skeleton variant="chart" />
        </div>
        {/* Row 2: Chart + Agenda skeletons side by side */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '20px' }}>
          <Skeleton variant="chart" />
          <div style={{ background: '#ffffff', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
            <Skeleton width="180px" height="18px" />
            <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {[1, 2, 3, 4].map(i => (
                <Skeleton key={i} width="100%" height="48px" />
              ))}
            </div>
          </div>
        </div>
        {/* Row 3: Full-width chart skeleton */}
        <div style={{ marginTop: '20px' }}><Skeleton variant="chart" /></div>
      </AppShell>
    )
  }

  return (
    <AppShell currentPage="dashboard">
      {/* Header */}
      <div style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ color: '#1E3A5F', fontSize: '24px', fontWeight: 'bold', margin: '0 0 4px 0' }}>
            Bem-vindo ao FengShui Studio
          </h1>
          <p style={{ color: '#6B7280', fontSize: '15px', margin: '0' }}>
            Gerencie seus clientes e consultas de Feng Shui
          </p>
        </div>
        <button onClick={() => setShowSettings(!showSettings)} style={{
          background: 'none', border: '1px solid #D1D5DB', borderRadius: '8px',
          padding: '6px 12px', cursor: 'pointer', fontSize: '13px', color: '#6B7280'
        }}>⚙️ Personalizar</button>
      </div>

      {showSettings && (
        <div style={{ background: '#fff', borderRadius: '12px', padding: '20px', marginBottom: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
          <h3 style={{ margin: '0 0 12px', fontSize: '15px', color: '#1E3A5F' }}>Escolha os módulos visíveis</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '8px' }}>
            {DASHBOARD_MODULES.map(m => (
              <label key={m.key} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px', borderRadius: '6px', cursor: 'pointer', background: visibleModules[m.key] ? '#F0FDF4' : '#F9FAFB' }}>
                <input type="checkbox" checked={visibleModules[m.key] !== false} onChange={e => {
                  const next = { ...visibleModules, [m.key]: e.target.checked }
                  setVisibleModules(next)
                  try { localStorage.setItem('fengshui-dashboard-modules', JSON.stringify(next)) } catch {}
                }} style={{ accentColor: '#7C3AED' }} />
                <span style={{ fontSize: '13px', color: '#374151' }}>{m.label}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '20px', marginBottom: '32px'
      }}>
        {[
          { label: 'Clientes ativos', value: String(totalClientes), icon: '👤', color: '#1D4ED8', link: '/clientes' },
          { label: 'Consultas realizadas', value: String(totalConsultas), icon: '📋', color: '#15803D', link: '/consultas' },
          { label: 'Rituais pendentes', value: String(totalRituais), icon: '🌙', color: '#7C3AED', link: '/calendario' },
          { label: 'Plano atual', value: isProfissional(profile) ? 'Profissional' : planoLabel(profile?.plano), icon: '⭐', color: '#B8860B', link: '/planos' },
        ].map((kpi, i) => (
          <div key={i} onClick={() => window.location.href = kpi.link} style={{
            background: '#ffffff', borderRadius: '12px', padding: '24px',
            boxShadow: '0 1px 4px rgba(0,0,0,0.08)', borderLeft: `4px solid ${kpi.color}`,
            cursor: 'pointer',
          }}>
            <div style={{ fontSize: '28px', marginBottom: '8px' }}>{kpi.icon}</div>
            <div style={{ fontSize: '28px', fontWeight: 'bold', color: kpi.color, marginBottom: '4px' }}>{kpi.value}</div>
            <div style={{ color: '#6B7280', fontSize: '13px' }}>{kpi.label}</div>
          </div>
        ))}
      </div>

      {/* Row 1: Status Consultas (Pie) + Pagamentos (Bar) */}
      {(visibleModules.status_consultas !== false || visibleModules.pagamentos !== false) && (
      <div style={{ display: 'grid', gridTemplateColumns: visibleModules.status_consultas !== false && visibleModules.pagamentos !== false ? '1fr 1fr' : '1fr', gap: '20px', marginBottom: '20px' }}>

        {/* CHART 1: Status Consultas - Pie */}
        {visibleModules.status_consultas !== false && (
        <div style={{
          background: '#ffffff', borderRadius: '12px', padding: '24px',
          boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
        }}>
          <h3 style={{ color: '#1E3A5F', fontSize: '16px', fontWeight: 'bold', margin: '0 0 16px 0' }}>
            Status das Consultas
          </h3>
          <StatusPieChart statusData={statusData} />
        </div>
        )}

        {/* CHART 2: Pagamentos - Bar empilhado */}
        {visibleModules.pagamentos !== false && (
        <div style={{
          background: '#ffffff', borderRadius: '12px', padding: '24px',
          boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
            <h3 style={{ color: '#1E3A5F', fontSize: '16px', fontWeight: 'bold', margin: '0' }}>
              Pagamentos
            </h3>
            <button onClick={() => window.location.href = '/pagamentos'} style={{
              background: 'none', border: 'none', color: '#7C3AED',
              fontSize: '13px', fontWeight: 'bold', cursor: 'pointer',
            }}>Ver todos →</button>
          </div>

          {/* Mini KPIs */}
          <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
            <div style={{ flex: 1, background: '#F0FDF4', borderRadius: '8px', padding: '10px 12px', textAlign: 'center' }}>
              <p style={{ color: COR_PAGO, fontSize: '16px', fontWeight: 'bold', margin: '0' }}>{formatCurrency(totalRecebido)}</p>
              <p style={{ color: '#6B7280', fontSize: '11px', margin: '2px 0 0 0' }}>Recebido</p>
            </div>
            <div style={{ flex: 1, background: '#FFFBEB', borderRadius: '8px', padding: '10px 12px', textAlign: 'center' }}>
              <p style={{ color: COR_PENDENTE, fontSize: '16px', fontWeight: 'bold', margin: '0' }}>{formatCurrency(totalPendente)}</p>
              <p style={{ color: '#6B7280', fontSize: '11px', margin: '2px 0 0 0' }}>Pendente</p>
            </div>
            {totalAtrasado > 0 && (
              <div style={{ flex: 1, background: '#FEF2F2', borderRadius: '8px', padding: '10px 12px', textAlign: 'center' }}>
                <p style={{ color: COR_ATRASADO, fontSize: '16px', fontWeight: 'bold', margin: '0' }}>{formatCurrency(totalAtrasado)}</p>
                <p style={{ color: '#6B7280', fontSize: '11px', margin: '2px 0 0 0' }}>Atrasado</p>
              </div>
            )}
          </div>

          <PagamentosBarChart pagamentosData={pagamentosData} />
        </div>
        )}
      </div>
      )}

      {/* Row 2: Consultas por mês (Line) + Agenda */}
      {(visibleModules.consultas_mes !== false || visibleModules.proximas_atividades !== false) && (
      <div style={{ display: 'grid', gridTemplateColumns: visibleModules.consultas_mes !== false && visibleModules.proximas_atividades !== false ? '1fr 1fr' : '1fr', gap: '20px', marginBottom: '20px' }}>

        {/* CHART 3: Evolução Consultas - Line */}
        {visibleModules.consultas_mes !== false && (
        <div style={{
          background: '#ffffff', borderRadius: '12px', padding: '24px',
          boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
        }}>
          <h3 style={{ color: '#1E3A5F', fontSize: '16px', fontWeight: 'bold', margin: '0 0 16px 0' }}>
            Consultas por Mês
          </h3>
          <ConsultasLineChart consultasMesData={consultasMesData} />
        </div>
        )}

        {/* AGENDA */}
        {visibleModules.proximas_atividades !== false && (
        <div style={{
          background: '#ffffff', borderRadius: '12px', padding: '24px',
          boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ color: '#1E3A5F', fontSize: '16px', fontWeight: 'bold', margin: '0' }}>
              Próximas Atividades
            </h3>
            <span style={{ color: '#9CA3AF', fontSize: '12px' }}>Próximos 30 dias</span>
          </div>

          {agenda.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '280px', overflowY: 'auto' }}>
              {agenda.map((item, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '10px 12px', borderRadius: '10px',
                  background: '#F9FAFB', border: '1px solid #F1F5F9',
                }}>
                  <div style={{
                    width: '40px', height: '40px', borderRadius: '10px',
                    background: `${item.cor}15`, display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                    fontSize: '20px', flexShrink: 0,
                  }}>{item.icon}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ color: '#111827', fontSize: '13px', fontWeight: 'bold', margin: '0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.titulo}
                    </p>
                    <p style={{ color: '#9CA3AF', fontSize: '12px', margin: '2px 0 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.subtitulo}
                    </p>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <p style={{ color: item.cor, fontSize: '13px', fontWeight: 'bold', margin: '0' }}>
                      {formatDate(item.data)}
                    </p>
                    {item.horario && (
                      <p style={{ color: '#9CA3AF', fontSize: '11px', margin: '2px 0 0 0' }}>{item.horario}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ height: '260px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <span style={{ fontSize: '32px' }}>📅</span>
              <p style={{ color: '#9CA3AF', fontSize: '14px', textAlign: 'center', margin: '0' }}>Nenhuma atividade próxima</p>
              <p style={{ color: '#D1D5DB', fontSize: '12px', textAlign: 'center', margin: '0' }}>Rituais, consultas e pagamentos aparecem aqui</p>
            </div>
          )}
        </div>
        )}
      </div>
      )}

      {/* Row 3: Clientes por mês (Bar) */}
      {visibleModules.novos_clientes !== false && (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px', marginBottom: '32px' }}>
        <div style={{
          background: '#ffffff', borderRadius: '12px', padding: '24px',
          boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
        }}>
          <h3 style={{ color: '#1E3A5F', fontSize: '16px', fontWeight: 'bold', margin: '0 0 16px 0' }}>
            Novos Clientes por Mês
          </h3>
          <ClientesBarChart clientesMesData={clientesMesData} />
        </div>
      </div>
      )}

      {/* Análises Baguá recentes */}
      {visibleModules.analises_bagua !== false && analisesBagua.length > 0 && (
        <div style={{ marginBottom: '32px' }}>
          <h2 style={{ color: '#1E3A5F', fontSize: '18px', fontWeight: 'bold', marginBottom: '16px' }}>
            ☯ Análises Ba Gua recentes
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {analisesBagua.map(a => (
              <div key={a.id} onClick={() => window.location.href = `/consultas/${a.id}`} style={{
                background: '#ffffff', borderRadius: '10px', padding: '14px 18px',
                boxShadow: '0 1px 4px rgba(0,0,0,0.08)', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                borderLeft: `4px solid ${a.status_bagua==='concluida'?'#15803D':'#D97706'}`
              }}>
                <div>
                  <p style={{ color: '#111827', fontWeight: 'bold', fontSize: '14px', margin: '0 0 2px 0' }}>{a.nome_imovel}</p>
                  <p style={{ color: '#9CA3AF', fontSize: '12px', margin: '0' }}>
                    {a.cliente_nome && `${a.cliente_nome} · `}
                    {a.status_bagua==='concluida'
                      ? `Concluída em ${new Date(a.finalizada_em).toLocaleDateString('pt-BR')} às ${new Date(a.finalizada_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
                      : 'Análise em andamento'
                    }
                  </p>
                </div>
                <span style={{
                  background: a.status_bagua==='concluida'?'#F0FDF4':'#FFF7ED',
                  color: a.status_bagua==='concluida'?'#15803D':'#D97706',
                  padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 'bold'
                }}>
                  {a.status_bagua==='concluida' ? '✓ Concluída' : '○ Em andamento'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Ações rápidas */}
      {visibleModules.acoes_rapidas !== false && (
      <div style={{ marginBottom: '32px' }}>
        <h2 style={{ color: '#1E3A5F', fontSize: '18px', fontWeight: 'bold', marginBottom: '16px' }}>
          Ações rápidas
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
          {[
            { label: 'Nova consulta', desc: 'Iniciar novo diagnóstico Ba Gua', icon: '✨', color: '#7C3AED', link: '/consultas/nova' },
            { label: 'Novo cliente', desc: 'Cadastrar cliente na plataforma', icon: '👤', color: '#1D4ED8', link: '/clientes' },
            { label: 'Ver relatórios', desc: 'Consultas finalizadas e PDFs', icon: '📄', color: '#15803D', link: '/consultas' },
            { label: 'Calendário lunar', desc: 'Próximos rituais agendados', icon: '🌙', color: '#B8860B', link: '/calendario' },
          ].map((kpi, i) => (
            <div key={i} onClick={() => window.location.href = kpi.link} style={{
              background: '#ffffff', borderRadius: '12px', padding: '20px',
              boxShadow: '0 1px 4px rgba(0,0,0,0.08)', cursor: 'pointer',
              borderTop: `3px solid ${kpi.color}`,
            }}>
              <div style={{ fontSize: '24px', marginBottom: '8px' }}>{kpi.icon}</div>
              <div style={{ color: '#111827', fontWeight: 'bold', fontSize: '15px', marginBottom: '4px' }}>{kpi.label}</div>
              <div style={{ color: '#9CA3AF', fontSize: '13px' }}>{kpi.desc}</div>
            </div>
          ))}
        </div>
      </div>
      )}

      {/* Banner upgrade */}
      {planoUsuario(profile) !== 'profissional' && (
        <div style={{
          background: 'linear-gradient(135deg, #7C3AED, #1E3A5F)',
          borderRadius: '12px', padding: '24px 32px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexWrap: 'wrap', gap: '16px'
        }}>
          <div>
            <p style={{ color: '#ffffff', fontWeight: 'bold', fontSize: '16px', margin: '0 0 4px 0' }}>
              Você está no plano Freemium
            </p>
            <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '14px', margin: '0' }}>
              Faça upgrade para acessar relatórios PDF, cronograma lunar e clientes ilimitados
            </p>
          </div>
          <button onClick={() => window.location.href = '/planos'} style={{
            background: '#B8860B', color: '#ffffff', border: 'none',
            padding: '12px 24px', borderRadius: '8px', fontSize: '14px',
            fontWeight: 'bold', cursor: 'pointer', whiteSpace: 'nowrap'
          }}>
            Fazer upgrade
          </button>
        </div>
      )}
    </AppShell>
  )
}