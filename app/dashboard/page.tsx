'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../src/lib/supabase'
import AppShell from '../components/AppShell'
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  LineChart, Line,
} from 'recharts'

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

export default function Dashboard() {
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [totalClientes, setTotalClientes] = useState(0)
  const [totalConsultas, setTotalConsultas] = useState(0)
  const [totalRituais, setTotalRituais] = useState(0)

  // Chart data
  const [statusData, setStatusData] = useState<any[]>([])
  const [consultasMesData, setConsultasMesData] = useState<any[]>([])
  const [clientesMesData, setClientesMesData] = useState<any[]>([])

  // Pagamentos
  const [pagamentosData, setPagamentosData] = useState<any[]>([])
  const [totalRecebido, setTotalRecebido] = useState(0)
  const [totalPendente, setTotalPendente] = useState(0)
  const [totalAtrasado, setTotalAtrasado] = useState(0)

  // Agenda
  const [agenda, setAgenda] = useState<any[]>([])

  useEffect(() => {
    async function loadAll() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/login'; return }
      setUser(user)

      // Profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()
      setProfile(profile)

      // KPI: Clientes ativos
      const { count } = await supabase
        .from('clientes')
        .select('*', { count: 'exact', head: true })
        .eq('consultor_id', user.id)
        .eq('ativo', true)
      setTotalClientes(count || 0)

      // KPI: Total consultas
      const { count: countConsultas } = await supabase
        .from('consultas')
        .select('*', { count: 'exact', head: true })
        .eq('consultor_id', user.id)
      setTotalConsultas(countConsultas || 0)

      // KPI: Rituais pendentes
      const { count: countRituais } = await supabase
        .from('rituais')
        .select('*', { count: 'exact', head: true })
        .eq('consultor_id', user.id)
        .eq('status', 'pendente')
      setTotalRituais(countRituais || 0)

      // ── CHART 1: Status das consultas (Pie) ──
      const { data: allConsultas } = await supabase
        .from('consultas')
        .select('status')
        .eq('consultor_id', user.id)

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
      const { data: allPagamentos } = await supabase
        .from('pagamentos')
        .select('*')
        .eq('consultor_id', user.id)

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
      const { data: consultasComData } = await supabase
        .from('consultas')
        .select('criado_em')
        .eq('consultor_id', user.id)

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
      const { data: clientesComData } = await supabase
        .from('clientes')
        .select('criado_em')
        .eq('consultor_id', user.id)

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

      // ── AGENDA: Próximos rituais + consultas em andamento ──
      const agendaItems: any[] = []

      // Rituais pendentes (próximos 30 dias)
      const hoje = new Date().toISOString().split('T')[0]
      const em30dias = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

      const { data: rituais } = await supabase
        .from('rituais')
        .select('*, clientes(nome_completo)')
        .eq('consultor_id', user.id)
        .eq('status', 'pendente')
        .gte('data_ritual', hoje)
        .lte('data_ritual', em30dias)
        .order('data_ritual', { ascending: true })
        .limit(5)

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

      // Consultas em andamento
      const { data: consultasAndamento } = await supabase
        .from('consultas')
        .select('*, clientes(nome_completo)')
        .eq('consultor_id', user.id)
        .eq('status', 'em_andamento')
        .order('criado_em', { ascending: false })
        .limit(5)

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

      // Pagamentos pendentes próximos
      const { data: pagProximos } = await supabase
        .from('pagamentos')
        .select('*, clientes(nome_completo)')
        .eq('consultor_id', user.id)
        .in('status', ['pendente', 'atrasado'])
        .order('data_vencimento', { ascending: true })
        .limit(5)

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
    if (d.toDateString() === amanha.toDateString()) return 'Amanha'
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
  }

  function formatCurrency(value: number) {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F9FAFB', fontFamily: 'Arial, sans-serif' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>☯</div>
          <p style={{ color: '#7C3AED', fontSize: '16px' }}>Carregando...</p>
        </div>
      </div>
    )
  }

  return (
    <AppShell currentPage="dashboard">
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ color: '#1E3A5F', fontSize: '24px', fontWeight: 'bold', margin: '0 0 4px 0' }}>
          Bem-vindo ao FengShui Studio
        </h1>
        <p style={{ color: '#6B7280', fontSize: '15px', margin: '0' }}>
          Gerencie seus clientes e consultas de Feng Shui
        </p>
      </div>

      {/* KPI Cards */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '20px', marginBottom: '32px'
      }}>
        {[
          { label: 'Clientes ativos', value: String(totalClientes), icon: '👤', color: '#1D4ED8', link: '/clientes' },
          { label: 'Consultas realizadas', value: String(totalConsultas), icon: '📋', color: '#15803D', link: '/consultas' },
          { label: 'Rituais pendentes', value: String(totalRituais), icon: '🌙', color: '#7C3AED', link: '/calendario' },
          { label: 'Plano atual', value: profile?.plano === 'pro' ? 'Pro' : 'Free', icon: '⭐', color: '#B8860B', link: '/planos' },
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
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>

        {/* CHART 1: Status Consultas - Pie */}
        <div style={{
          background: '#ffffff', borderRadius: '12px', padding: '24px',
          boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
        }}>
          <h3 style={{ color: '#1E3A5F', fontSize: '16px', fontWeight: 'bold', margin: '0 0 16px 0' }}>
            Status das Consultas
          </h3>
          {statusData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%" cy="50%"
                  innerRadius={55} outerRadius={90}
                  paddingAngle={4} dataKey="value" stroke="none"
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: any, name: any) => [`${value} consulta(s)`, name]}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #E5E7EB', fontSize: '13px' }}
                />
                <Legend iconType="circle" iconSize={10} wrapperStyle={{ fontSize: '13px', color: '#6B7280' }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: '260px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <p style={{ color: '#9CA3AF', fontSize: '14px' }}>Nenhuma consulta registrada ainda</p>
            </div>
          )}
        </div>

        {/* CHART 2: Pagamentos - Bar empilhado */}
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

          {pagamentosData.length > 0 ? (
            <ResponsiveContainer width="100%" height={170}>
              <BarChart data={pagamentosData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#6B7280' }} axisLine={{ stroke: '#E5E7EB' }} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                <Tooltip
                  formatter={(value: any, name: any) => [formatCurrency(Number(value)), name]}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #E5E7EB', fontSize: '12px' }}
                />
                <Bar dataKey="Recebido" stackId="a" fill={COR_PAGO} radius={[0, 0, 0, 0]} maxBarSize={28} />
                <Bar dataKey="Pendente" stackId="a" fill={COR_PENDENTE} radius={[0, 0, 0, 0]} maxBarSize={28} />
                <Bar dataKey="Atrasado" stackId="a" fill={COR_ATRASADO} radius={[4, 4, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: '170px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <p style={{ color: '#9CA3AF', fontSize: '14px' }}>Nenhum pagamento registrado</p>
            </div>
          )}
        </div>
      </div>

      {/* Row 2: Consultas por mês (Line) + Agenda */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>

        {/* CHART 3: Evolução Consultas - Line */}
        <div style={{
          background: '#ffffff', borderRadius: '12px', padding: '24px',
          boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
        }}>
          <h3 style={{ color: '#1E3A5F', fontSize: '16px', fontWeight: 'bold', margin: '0 0 16px 0' }}>
            Consultas por Mes
          </h3>
          {consultasMesData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={consultasMesData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="mes" tick={{ fontSize: 12, fill: '#6B7280' }} axisLine={{ stroke: '#E5E7EB' }} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                <Tooltip
                  formatter={(value: any) => [`${value}`, 'Consultas']}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #E5E7EB', fontSize: '13px' }}
                />
                <Line type="monotone" dataKey="consultas" stroke="#15803D" strokeWidth={3}
                  dot={{ fill: '#15803D', r: 5, strokeWidth: 2, stroke: '#ffffff' }}
                  activeDot={{ r: 7, fill: '#15803D', stroke: '#ffffff', strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: '260px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <p style={{ color: '#9CA3AF', fontSize: '14px' }}>Crie consultas para ver a evolucao</p>
            </div>
          )}
        </div>

        {/* AGENDA */}
        <div style={{
          background: '#ffffff', borderRadius: '12px', padding: '24px',
          boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ color: '#1E3A5F', fontSize: '16px', fontWeight: 'bold', margin: '0' }}>
              Proximas Atividades
            </h3>
            <span style={{ color: '#9CA3AF', fontSize: '12px' }}>Proximos 30 dias</span>
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
              <p style={{ color: '#9CA3AF', fontSize: '14px', textAlign: 'center', margin: '0' }}>Nenhuma atividade proxima</p>
              <p style={{ color: '#D1D5DB', fontSize: '12px', textAlign: 'center', margin: '0' }}>Rituais, consultas e pagamentos aparecem aqui</p>
            </div>
          )}
        </div>
      </div>

      {/* Row 3: Clientes por mês (Bar) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px', marginBottom: '32px' }}>
        <div style={{
          background: '#ffffff', borderRadius: '12px', padding: '24px',
          boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
        }}>
          <h3 style={{ color: '#1E3A5F', fontSize: '16px', fontWeight: 'bold', margin: '0 0 16px 0' }}>
            Novos Clientes por Mes
          </h3>
          {clientesMesData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={clientesMesData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="mes" tick={{ fontSize: 12, fill: '#6B7280' }} axisLine={{ stroke: '#E5E7EB' }} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                <Tooltip
                  formatter={(value: any) => [`${value}`, 'Clientes']}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #E5E7EB', fontSize: '13px' }}
                />
                <Bar dataKey="clientes" fill="#1D4ED8" radius={[6, 6, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <p style={{ color: '#9CA3AF', fontSize: '14px' }}>Cadastre clientes para ver o grafico</p>
            </div>
          )}
        </div>
      </div>

      {/* Ações rápidas */}
      <div style={{ marginBottom: '32px' }}>
        <h2 style={{ color: '#1E3A5F', fontSize: '18px', fontWeight: 'bold', marginBottom: '16px' }}>
          Acoes rapidas
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
          {[
            { label: 'Nova consulta', desc: 'Iniciar novo diagnostico Ba Gua', icon: '✨', color: '#7C3AED', link: '/consultas/nova' },
            { label: 'Novo cliente', desc: 'Cadastrar cliente na plataforma', icon: '👤', color: '#1D4ED8', link: '/clientes' },
            { label: 'Ver relatorios', desc: 'Consultas finalizadas e PDFs', icon: '📄', color: '#15803D', link: '/consultas' },
            { label: 'Calendario lunar', desc: 'Proximos rituais agendados', icon: '🌙', color: '#B8860B', link: '/calendario' },
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

      {/* Banner upgrade */}
      {profile?.plano === 'freemium' && (
        <div style={{
          background: 'linear-gradient(135deg, #7C3AED, #1E3A5F)',
          borderRadius: '12px', padding: '24px 32px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexWrap: 'wrap', gap: '16px'
        }}>
          <div>
            <p style={{ color: '#ffffff', fontWeight: 'bold', fontSize: '16px', margin: '0 0 4px 0' }}>
              Voce esta no plano Freemium
            </p>
            <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '14px', margin: '0' }}>
              Faca upgrade para acessar relatorios PDF, cronograma lunar e clientes ilimitados
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