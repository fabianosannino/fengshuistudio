'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../src/lib/supabase'
import AppShell from '../components/AppShell'

export default function Consultas() {
  const [consultas, setConsultas] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/login'; return }
      const { data } = await supabase
        .from('consultas')
        .select(`*, clientes(nome_completo)`)
        .eq('consultor_id', user.id)
        .order('criado_em', { ascending: false })
      setConsultas(data || [])
      setLoading(false)
    }
    load()
  }, [])

  function statusColor(status: string) {
    const map: any = { rascunho: '#6B7280', em_andamento: '#D97706', finalizada: '#15803D', arquivada: '#9CA3AF' }
    return map[status] || '#6B7280'
  }

  function statusLabel(status: string) {
    const map: any = { rascunho: 'Rascunho', em_andamento: 'Em andamento', finalizada: 'Finalizada', arquivada: 'Arquivada' }
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
    <AppShell currentPage="consultas">

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ color: '#1E3A5F', fontSize: '24px', fontWeight: 'bold', margin: '0 0 4px 0' }}>Consultas</h1>
          <p style={{ color: '#6B7280', fontSize: '15px', margin: '0' }}>{consultas.length} consulta(s) registrada(s)</p>
        </div>
        <button onClick={() => window.location.href = '/consultas/nova'} style={{
          background: '#7C3AED', color: '#ffffff', border: 'none',
          padding: '12px 24px', borderRadius: '8px', fontSize: '15px',
          fontWeight: 'bold', cursor: 'pointer'
        }}>+ Nova consulta</button>
      </div>

      {message && (
        <div style={{
          marginBottom: '20px', padding: '12px 16px', borderRadius: '8px',
          background: '#FEF2F2', border: '1px solid #FECACA',
          color: '#DC2626', fontSize: '14px'
        }}>{message}</div>
      )}

      {consultas.length === 0 ? (
        <div style={{
          background: '#ffffff', borderRadius: '12px', padding: '64px 32px',
          textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.08)'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>📋</div>
          <h3 style={{ color: '#1E3A5F', fontSize: '18px', marginBottom: '8px' }}>Nenhuma consulta registrada</h3>
          <p style={{ color: '#6B7280', fontSize: '14px', marginBottom: '24px' }}>Clique em "Nova consulta" para comecar um diagnostico Ba Gua</p>
          <button onClick={() => window.location.href = '/consultas/nova'} style={{
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
                <button onClick={() => window.location.href = `/consultas/${consulta.id}`} style={{
                  padding: '8px 20px', background: '#7C3AED', color: '#fff',
                  border: 'none', borderRadius: '6px', fontSize: '13px',
                  fontWeight: 'bold', cursor: 'pointer'
                }}>Abrir</button>
                {consulta.status === 'finalizada' && (
                  <button onClick={() => window.location.href = `/consultas/${consulta.id}/relatorio`} style={{
                    padding: '8px 20px', background: '#1E3A5F', color: '#fff',
                    border: 'none', borderRadius: '6px', fontSize: '13px',
                    fontWeight: 'bold', cursor: 'pointer'
                  }}>Relatório</button>
                )}
                <button onClick={async () => {
                  if (confirm('Deseja excluir esta consulta?')) {
                    const { error } = await supabase.from('consultas').delete().eq('id', consulta.id)
                    if (error) {
                      setMessage('Erro ao excluir consulta: ' + error.message)
                      return
                    }
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

    </AppShell>
  )
}