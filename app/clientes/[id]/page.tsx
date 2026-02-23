'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../../src/lib/supabase'
import { useRouter, useParams } from 'next/navigation'

export default function ClienteDetalhe() {
  const router = useRouter()
  const params = useParams()
  const [cliente, setCliente] = useState<any>(null)
  const [consultas, setConsultas] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/'; return }

      const { data: cli } = await supabase
        .from('clientes')
        .select('*')
        .eq('id', params.id)
        .eq('consultor_id', user.id)
        .single()

      if (!cli) { window.location.href = '/clientes'; return }
      setCliente(cli)

      const { data: cons } = await supabase
        .from('consultas')
        .select('*')
        .eq('cliente_id', params.id)
        .eq('consultor_id', user.id)
        .order('criado_em', { ascending: false })

      setConsultas(cons || [])
      setLoading(false)
    }
    load()
  }, [params.id])

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
          <span style={{ fontSize: '28px', cursor: 'pointer' }} onClick={() => window.location.href = '/dashboard'}>☯</span>
          <span style={{ color: '#B8860B', fontSize: '20px', fontWeight: 'bold' }}>FengShui Studio</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span onClick={() => window.location.href = '/dashboard'} style={{ color: 'rgba(255,255,255,0.7)', fontSize: '14px', cursor: 'pointer' }}>Dashboard</span>
          <span onClick={() => window.location.href = '/clientes'} style={{ color: 'rgba(255,255,255,0.7)', fontSize: '14px', cursor: 'pointer' }}>Clientes</span>
          <span onClick={() => window.location.href = '/consultas'} style={{ color: 'rgba(255,255,255,0.7)', fontSize: '14px', cursor: 'pointer' }}>Consultas</span>
          <button onClick={async () => { await supabase.auth.signOut(); window.location.href = '/' }} style={{
            background: 'transparent', border: '1px solid rgba(255,255,255,0.3)',
            color: '#ffffff', padding: '6px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '14px'
          }}>Sair</button>
        </div>
      </header>

      <main style={{ padding: '32px', maxWidth: '900px', margin: '0 auto' }}>

        {/* Voltar */}
        <div style={{ marginBottom: '24px' }}>
          <span onClick={() => window.location.href = '/clientes'} style={{ color: '#7C3AED', fontSize: '14px', cursor: 'pointer' }}>← Voltar para clientes</span>
        </div>

        {/* Card do cliente */}
        <div style={{
          background: '#ffffff', borderRadius: '12px', padding: '28px',
          boxShadow: '0 1px 4px rgba(0,0,0,0.08)', borderLeft: '4px solid #7C3AED',
          marginBottom: '32px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
            <div style={{
              width: '56px', height: '56px', borderRadius: '50%',
              background: '#7C3AED', display: 'flex', alignItems: 'center',
              justifyContent: 'center', color: '#fff', fontWeight: 'bold', fontSize: '22px'
            }}>
              {cliente.nome_completo?.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 style={{ color: '#1E3A5F', fontSize: '22px', fontWeight: 'bold', margin: '0 0 4px 0' }}>{cliente.nome_completo}</h1>
              <span style={{
                background: '#F0FDF4', color: '#15803D', padding: '2px 10px',
                borderRadius: '20px', fontSize: '12px', fontWeight: 'bold'
              }}>Ativo</span>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            {cliente.email && (
              <div><span style={{ color: '#9CA3AF', fontSize: '13px' }}>E-mail</span><p style={{ color: '#374151', fontSize: '15px', margin: '4px 0 0 0' }}>✉ {cliente.email}</p></div>
            )}
            {cliente.telefone && (
              <div><span style={{ color: '#9CA3AF', fontSize: '13px' }}>Telefone</span><p style={{ color: '#374151', fontSize: '15px', margin: '4px 0 0 0' }}>📱 {cliente.telefone}</p></div>
            )}
            {cliente.cidade && (
              <div><span style={{ color: '#9CA3AF', fontSize: '13px' }}>Localidade</span><p style={{ color: '#374151', fontSize: '15px', margin: '4px 0 0 0' }}>📍 {cliente.cidade}{cliente.estado ? ` - ${cliente.estado}` : ''}</p></div>
            )}
            {cliente.notas && (
              <div><span style={{ color: '#9CA3AF', fontSize: '13px' }}>Observações</span><p style={{ color: '#374151', fontSize: '15px', margin: '4px 0 0 0' }}>{cliente.notas}</p></div>
            )}
          </div>

          <div style={{ marginTop: '20px', display: 'flex', gap: '8px' }}>
            <button onClick={() => window.location.href = `/consultas/nova?cliente_id=${cliente.id}`} style={{
              padding: '10px 24px', background: '#7C3AED', color: '#fff',
              border: 'none', borderRadius: '8px', fontSize: '14px',
              fontWeight: 'bold', cursor: 'pointer'
            }}>+ Nova consulta</button>
          </div>
        </div>

        {/* Consultas do cliente */}
        <h2 style={{ color: '#1E3A5F', fontSize: '18px', fontWeight: 'bold', marginBottom: '16px' }}>
          Consultas ({consultas.length})
        </h2>

        {consultas.length === 0 ? (
          <div style={{
            background: '#ffffff', borderRadius: '12px', padding: '48px 32px',
            textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.08)'
          }}>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>📋</div>
            <p style={{ color: '#6B7280', fontSize: '15px', margin: '0' }}>Nenhuma consulta para este cliente ainda.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {consultas.map(c => (
              <div key={c.id} onClick={() => window.location.href = `/consultas/${c.id}`} style={{
                background: '#ffffff', borderRadius: '12px', padding: '16px 20px',
                boxShadow: '0 1px 4px rgba(0,0,0,0.08)', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between'
              }}>
                <div>
                  <p style={{ color: '#111827', fontWeight: 'bold', fontSize: '15px', margin: '0 0 4px 0' }}>{c.nome_imovel || 'Imóvel'}</p>
                  <p style={{ color: '#9CA3AF', fontSize: '13px', margin: '0' }}>
                    📅 {new Date(c.criado_em).toLocaleDateString('pt-BR')}
                    {c.tipo_imovel && ` • ${c.tipo_imovel}`}
                  </p>
                </div>
                <span style={{
                  background: c.status === 'finalizada' ? '#F0FDF4' : c.status === 'em_andamento' ? '#FFF7ED' : '#F3F4F6',
                  color: c.status === 'finalizada' ? '#15803D' : c.status === 'em_andamento' ? '#D97706' : '#6B7280',
                  padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold'
                }}>{c.status === 'finalizada' ? 'Finalizada' : c.status === 'em_andamento' ? 'Em andamento' : 'Rascunho'}</span>
              </div>
            ))}
          </div>
        )}

      </main>
    </div>
  )
}