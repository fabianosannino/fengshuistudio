'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../src/lib/supabase'
import { useRouter } from 'next/navigation'

export default function Consultas() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [consultas, setConsultas] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }
      setUser(user)
      const { data } = await supabase
        .from('consultas')
        .select(`*, clientes(nome_completo)`)
        .eq('consultor_id', user.id)
        .order('criado_em', { ascending: false })
      setConsultas(data || [])
      setLoading(false)
    }
    load()
  }, [router])

  function statusColor(status: string) {
    const map: any = {
      rascunho: '#6B7280',
      em_andamento: '#D97706',
      finalizada: '#15803D',
      arquivada: '#9CA3AF'
    }
    return map[status] || '#6B7280'
  }

  function statusLabel(status: string) {
    const map: any = {
      rascunho: 'Rascunho',
      em_andamento: 'Em andamento',
      finalizada: 'Finalizada',
      arquivada: 'Arquivada'
    }
    return map[status] || status
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
    <div style={{ minHeight: '100vh', background: '#F9FAFB', fontFamily: 'Arial, sans-serif' }}>

      <header style={{
        background: '#1E3A5F', padding: '0 32px', height: '64px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '28px', cursor: 'pointer' }} onClick={() => router.push('/dashboard')}>☯</span>
          <span style={{ color: '#B8860B', fontSize: '20px', fontWeight: 'bold' }}>FengShui Studio</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span onClick={() => router.push('/dashboard')} style={{ color: 'rgba(255,255,255,0.7)', fontSize: '14px', cursor: 'pointer' }}>Dashboard</span>
          <span onClick={() => router.push('/clientes')} style={{ color: 'rgba(255,255,255,0.7)', fontSize: '14px', cursor: 'pointer' }}>Clientes</span>
          <span style={{ color: '#ffffff', fontSize: '14px', fontWeight: 'bold' }}>Consultas</span>
          <button onClick={async () => { await supabase.auth.signOut(); window.location.href = '/' }} style={{
            background: 'transparent', border: '1px solid rgba(255,255,255,0.3)',
            color: '#ffffff', padding: '6px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '14px'
          }}>Sair</button>
        </div>
      </header>

      <main style={{ padding: '32px', maxWidth: '1100px', margin: '0 auto' }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div>
            <h1 style={{ color: '#1E3A5F', fontSize: '24px', fontWeight: 'bold', margin: '0 0 4px 0' }}>Consultas</h1>
            <p style={{ color: '#6B7280', fontSize: '15px', margin: '0' }}>{consultas.length} consulta(s) registrada(s)</p>
          </div>
          <button onClick={() => router.push('/consultas/nova')} style={{
            background: '#7C3AED', color: '#ffffff', border: 'none',
            padding: '12px 24px', borderRadius: '8px', fontSize: '15px',
            fontWeight: 'bold', cursor: 'pointer'
          }}>+ Nova consulta</button>
        </div>

        {consultas.length === 0 ? (
          <div style={{
            background: '#ffffff', borderRadius: '12px', padding: '64px 32px',
            textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.08)'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📋</div>
            <h3 style={{ color: '#1E3A5F', fontSize: '18px', marginBottom: '8px' }}>Nenhuma consulta registrada</h3>
            <p style={{ color: '#6B7280', fontSize: '14px', marginBottom: '24px' }}>Clique em "Nova consulta" para comecar um diagnostico Ba Gua</p>
            <button onClick={() => router.push('/consultas/nova')} style={{
              background: '#7C3AED', color: '#ffffff', border: 'none',
              padding: '12px 24px', borderRadius: '8px', fontSize: '15px',
              fontWeight: 'bold', cursor: 'pointer'
            }}>Iniciar primeira consulta</button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {consultas.map(consulta => (
              <div key={consulta.id} style={{
                background: '#ffffff', borderRadius: '12px', padding: '20px 24px',
                boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
                borderLeft: `4px solid ${statusColor(consulta.status)}`,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                flexWrap: 'wrap', gap: '12px'
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
                    <h3 style={{ color: '#111827', fontSize: '16px', fontWeight: 'bold', margin: '0' }}>
                      {consulta.nome_imovel || 'Imovel'}
                    </h3>
                    <span style={{
                      background: `${statusColor(consulta.status)}20`,
                      color: statusColor(consulta.status),
                      padding: '2px 10px', borderRadius: '20px',
                      fontSize: '12px', fontWeight: 'bold'
                    }}>{statusLabel(consulta.status)}</span>
                  </div>
                  <p style={{ color: '#6B7280', fontSize: '14px', margin: '0 0 4px 0' }}>
                    👤 {consulta.clientes?.nome_completo}
                  </p>
                  <p style={{ color: '#9CA3AF', fontSize: '13px', margin: '0' }}>
                    📅 {new Date(consulta.criado_em).toLocaleDateString('pt-BR')}
                    {consulta.tipo_imovel && ` • ${consulta.tipo_imovel}`}
                    {consulta.area_total_m2 && ` • ${consulta.area_total_m2}m²`}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => router.push(`/consultas/${consulta.id}`)} style={{
                    padding: '8px 20px', background: '#7C3AED', color: '#fff',
                    border: 'none', borderRadius: '6px', fontSize: '13px',
                    fontWeight: 'bold', cursor: 'pointer'
                  }}>Abrir</button>
                  <button onClick={async () => {
                    if (confirm('Deseja excluir esta consulta?')) {
                      await supabase.from('consultas').delete().eq('id', consulta.id)
                      setConsultas(consultas.filter(c => c.id !== consulta.id))
                    }
                  }} style={{
                    padding: '8px 16px', background: '#FEF2F2', color: '#DC2626',
                    border: '1px solid #FECACA', borderRadius: '6px', fontSize: '13px',
                    cursor: 'pointer'
                  }}>Excluir</button>
                </div>
              </div>
            ))}
          </div>
        )}

      </main>
    </div>
  )
}