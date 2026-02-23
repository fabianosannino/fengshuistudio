'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../src/lib/supabase'
import AppShell from '../components/AppShell'

export default function Dashboard() {
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [totalClientes, setTotalClientes] = useState(0)
  const [totalConsultas, setTotalConsultas] = useState(0)
  const [totalRituais, setTotalRituais] = useState(0)

  useEffect(() => {
    async function loadUser() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/'; return }
      setUser(user)

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()
      setProfile(profile)

      const { count } = await supabase
        .from('clientes')
        .select('*', { count: 'exact', head: true })
        .eq('consultor_id', user.id)
        .eq('ativo', true)
      setTotalClientes(count || 0)

      const { count: countConsultas } = await supabase
        .from('consultas')
        .select('*', { count: 'exact', head: true })
        .eq('consultor_id', user.id)
      setTotalConsultas(countConsultas || 0)

      const { count: countRituais } = await supabase
        .from('rituais')
        .select('*', { count: 'exact', head: true })
        .eq('consultor_id', user.id)
        .eq('status', 'pendente')
      setTotalRituais(countRituais || 0)

      setLoading(false)
    }
    loadUser()
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
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ color: '#1E3A5F', fontSize: '24px', fontWeight: 'bold', margin: '0 0 4px 0' }}>
          Bem-vindo ao FengShui Studio
        </h1>
        <p style={{ color: '#6B7280', fontSize: '15px', margin: '0' }}>
          Gerencie seus clientes e consultas de Feng Shui
        </p>
      </div>

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
            cursor: 'pointer'
          }}>
            <div style={{ fontSize: '28px', marginBottom: '8px' }}>{kpi.icon}</div>
            <div style={{ fontSize: '28px', fontWeight: 'bold', color: kpi.color, marginBottom: '4px' }}>{kpi.value}</div>
            <div style={{ color: '#6B7280', fontSize: '13px' }}>{kpi.label}</div>
          </div>
        ))}
      </div>

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
              borderTop: `3px solid ${kpi.color}`
            }}>
              <div style={{ fontSize: '24px', marginBottom: '8px' }}>{kpi.icon}</div>
              <div style={{ color: '#111827', fontWeight: 'bold', fontSize: '15px', marginBottom: '4px' }}>{kpi.label}</div>
              <div style={{ color: '#9CA3AF', fontSize: '13px' }}>{kpi.desc}</div>
            </div>
          ))}
        </div>
      </div>

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