'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../src/lib/supabase'
import AppShell from '../components/AppShell'
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  LineChart, Line,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
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

export default function Dashboard() {
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [totalClientes, setTotalClientes] = useState(0)
  const [totalConsultas, setTotalConsultas] = useState(0)
  const [totalRituais, setTotalRituais] = useState(0)

  // Chart data
  const [statusData, setStatusData] = useState<any[]>([])
  const [radarData, setRadarData] = useState<any[]>([])
  const [consultasMesData, setConsultasMesData] = useState<any[]>([])
  const [clientesMesData, setClientesMesData] = useState<any[]>([])

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

      // ── CHART 2: Score médio por setor Ba Gua (Radar) ──
      const { data: setoresAll } = await supabase
        .from('setores_bagua')
        .select('nome, score_percentual, consulta_id')
        .in('consulta_id',
          (allConsultas || []).length > 0
            ? await supabase
                .from('consultas')
                .select('id')
                .eq('consultor_id', user.id)
                .then(r => (r.data || []).map(c => c.id))
            : []
        )

      if (setoresAll && setoresAll.length > 0) {
        const setorMap: Record<string, { total: number; count: number }> = {}
        setoresAll.forEach(s => {
          if (s.score_percentual !== null && s.score_percentual !== undefined) {
            if (!setorMap[s.nome]) setorMap[s.nome] = { total: 0, count: 0 }
            setorMap[s.nome].total += s.score_percentual
            setorMap[s.nome].count += 1
          }
        })
        const radar = Object.entries(setorMap).map(([nome, { total, count }]) => ({
          setor: nome,
          score: Math.round(total / count),
        }))
        setRadarData(radar)
      }

      // ── CHART 3: Evolução de consultas por mês (Line) ──
      const { data: consultasComData } = await supabase
        .from('consultas')
        .select('criado_em')
        .eq('consultor_id', user.id)

      if (consultasComData && consultasComData.length > 0) {
        const now = new Date()
        const monthCounts: Record<string, number> = {}

        // Últimos 6 meses
        for (let i = 5; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
          monthCounts[key] = 0
        }

        consultasComData.forEach(c => {
          const d = new Date(c.criado_em)
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
          if (key in monthCounts) {
            monthCounts[key]++
          }
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
          if (key in monthCounts) {
            monthCounts[key]++
          }
        })

        const barData = Object.entries(monthCounts).map(([key, value]) => {
          const [, m] = key.split('-')
          return { mes: MESES[parseInt(m) - 1], clientes: value }
        })
        setClientesMesData(barData)
      }

      setLoading(false)
    }
    loadAll()
  }, [])

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
            cursor: 'pointer', transition: 'transform 0.2s ease',
          }}>
            <div style={{ fontSize: '28px', marginBottom: '8px' }}>{kpi.icon}</div>
            <div style={{ fontSize: '28px', fontWeight: 'bold', color: kpi.color, marginBottom: '4px' }}>{kpi.value}</div>
            <div style={{ color: '#6B7280', fontSize: '13px' }}>{kpi.label}</div>
          </div>
        ))}
      </div>

      {/* Charts Row 1: Pie + Radar */}
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
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={90}
                  paddingAngle={4}
                  dataKey="value"
                  stroke="none"
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number, name: string) => [`${value} consulta(s)`, name]}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #E5E7EB', fontSize: '13px' }}
                />
                <Legend
                  iconType="circle"
                  iconSize={10}
                  wrapperStyle={{ fontSize: '13px', color: '#6B7280' }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: '260px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <p style={{ color: '#9CA3AF', fontSize: '14px' }}>Nenhuma consulta registrada ainda</p>
            </div>
          )}
        </div>

        {/* CHART 2: Score Ba Gua - Radar */}
        <div style={{
          background: '#ffffff', borderRadius: '12px', padding: '24px',
          boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
        }}>
          <h3 style={{ color: '#1E3A5F', fontSize: '16px', fontWeight: 'bold', margin: '0 0 16px 0' }}>
            Score Medio por Setor Ba Gua
          </h3>
          {radarData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="70%">
                <PolarGrid stroke="#E5E7EB" />
                <PolarAngleAxis
                  dataKey="setor"
                  tick={{ fontSize: 11, fill: '#6B7280' }}
                />
                <PolarRadiusAxis
                  angle={90}
                  domain={[0, 100]}
                  tick={{ fontSize: 10, fill: '#9CA3AF' }}
                  axisLine={false}
                />
                <Radar
                  name="Score %"
                  dataKey="score"
                  stroke="#7C3AED"
                  fill="#7C3AED"
                  fillOpacity={0.25}
                  strokeWidth={2}
                />
                <Tooltip
                  formatter={(value: number) => [`${value}%`, 'Score']}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #E5E7EB', fontSize: '13px' }}
                />
              </RadarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: '260px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <p style={{ color: '#9CA3AF', fontSize: '14px' }}>Avalie setores para ver o grafico</p>
            </div>
          )}
        </div>
      </div>

      {/* Charts Row 2: Line + Bar */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '32px' }}>

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
                <XAxis
                  dataKey="mes"
                  tick={{ fontSize: 12, fill: '#6B7280' }}
                  axisLine={{ stroke: '#E5E7EB' }}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 12, fill: '#9CA3AF' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  formatter={(value: number) => [`${value}`, 'Consultas']}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #E5E7EB', fontSize: '13px' }}
                />
                <Line
                  type="monotone"
                  dataKey="consultas"
                  stroke="#15803D"
                  strokeWidth={3}
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

        {/* CHART 4: Clientes por Mês - Bar */}
        <div style={{
          background: '#ffffff', borderRadius: '12px', padding: '24px',
          boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
        }}>
          <h3 style={{ color: '#1E3A5F', fontSize: '16px', fontWeight: 'bold', margin: '0 0 16px 0' }}>
            Novos Clientes por Mes
          </h3>
          {clientesMesData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={clientesMesData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis
                  dataKey="mes"
                  tick={{ fontSize: 12, fill: '#6B7280' }}
                  axisLine={{ stroke: '#E5E7EB' }}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 12, fill: '#9CA3AF' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  formatter={(value: number) => [`${value}`, 'Clientes']}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #E5E7EB', fontSize: '13px' }}
                />
                <Bar
                  dataKey="clientes"
                  fill="#1D4ED8"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={40}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: '260px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
              borderTop: `3px solid ${kpi.color}`, transition: 'transform 0.2s ease',
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