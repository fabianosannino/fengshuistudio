'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../src/lib/supabase'
import AppShell from '../components/AppShell'
import TabRodaDaVida from '../consultas/[id]/TabRodaDaVida'
import type { SetorBagua } from '../../src/lib/types'
import type { User } from '@supabase/supabase-js'

type Consulta = {
  id: string
  nome_imovel: string
  criado_em: string
  clientes?: { nome_completo: string } | null
  roda_da_vida?: Record<string, number> | null
}

export default function RodaDaVidaPage() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [consultas, setConsultas] = useState<Consulta[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [rodaData, setRodaData] = useState<Record<string, number>>({})
  const [setores, setSetores] = useState<SetorBagua[]>([])
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/login'; return }
      setUser(user)

      const { data } = await supabase
        .from('consultas')
        .select('id, nome_imovel, criado_em, roda_da_vida, clientes(nome_completo)')
        .eq('consultor_id', user.id)
        .neq('status', 'deletada')
        .order('criado_em', { ascending: false })

      setConsultas((data || []) as Consulta[])
      setLoading(false)
    }
    load()
  }, [])

  async function selectConsulta(id: string) {
    setSelectedId(id)
    const consulta = consultas.find(c => c.id === id)
    setRodaData(consulta?.roda_da_vida || {})

    // Load setores for correlation
    const { data: setoresData } = await supabase
      .from('setores_bagua')
      .select('*')
      .eq('consulta_id', id)
    setSetores(setoresData || [])
  }

  async function handleSave() {
    if (!selectedId) return
    setSaving(true)
    const { error } = await supabase
      .from('consultas')
      .update({ roda_da_vida: rodaData })
      .eq('id', selectedId)
    setSaving(false)
    if (error) {
      setMessage('Erro ao salvar: ' + error.message)
    } else {
      setMessage('Roda da Vida salva com sucesso!')
      // Update local state
      setConsultas(prev => prev.map(c => c.id === selectedId ? { ...c, roda_da_vida: rodaData } : c))
    }
    setTimeout(() => setMessage(''), 3000)
  }

  function hasRodaData(consulta: Consulta): boolean {
    if (!consulta.roda_da_vida) return false
    return Object.values(consulta.roda_da_vida).some(v => v > 0)
  }

  function formatDate(dateStr: string): string {
    try {
      return new Date(dateStr).toLocaleDateString('pt-BR', {
        day: '2-digit', month: '2-digit', year: 'numeric'
      })
    } catch {
      return dateStr
    }
  }

  if (loading) {
    return (
      <AppShell currentPage="roda-da-vida">
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>◎</div>
            <p style={{ color: '#7C3AED', fontSize: '16px' }}>Carregando...</p>
          </div>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell currentPage="roda-da-vida">
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ color: '#1E3A5F', fontSize: '24px', fontWeight: 'bold', margin: '0 0 8px 0' }}>
          Roda da Vida
        </h1>
        <p style={{ color: '#6B7280', fontSize: '14px', margin: 0 }}>
          Selecione uma consulta para visualizar ou editar a Roda da Vida do cliente
        </p>
      </div>

      {/* Message banner */}
      {message && (
        <div style={{
          padding: '12px 16px', marginBottom: '16px', borderRadius: '8px',
          background: message.includes('Erro') ? '#FEF2F2' : '#F0FDF4',
          color: message.includes('Erro') ? '#DC2626' : '#15803D',
          fontSize: '14px', fontWeight: 'bold',
          border: `1px solid ${message.includes('Erro') ? '#FECACA' : '#BBF7D0'}`
        }}>
          {message}
        </div>
      )}

      {/* Consultation list */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: '12px',
        marginBottom: '24px'
      }}>
        {consultas.length === 0 && (
          <div style={{
            gridColumn: '1 / -1', textAlign: 'center', padding: '48px 24px',
            background: '#ffffff', borderRadius: '12px', border: '1px solid #E5E7EB'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>◎</div>
            <p style={{ color: '#6B7280', fontSize: '15px', margin: '0 0 8px 0' }}>
              Nenhuma consulta encontrada
            </p>
            <a href="/consultas" style={{
              color: '#7C3AED', fontSize: '14px', textDecoration: 'none', fontWeight: 'bold'
            }}>
              Ir para Consultas
            </a>
          </div>
        )}
        {consultas.map(consulta => {
          const isSelected = selectedId === consulta.id
          const filled = hasRodaData(consulta)
          return (
            <div
              key={consulta.id}
              onClick={() => selectConsulta(consulta.id)}
              style={{
                background: isSelected ? '#F5F0FF' : '#ffffff',
                border: `2px solid ${isSelected ? '#7C3AED' : '#E5E7EB'}`,
                borderRadius: '10px',
                padding: '16px',
                cursor: 'pointer',
                transition: 'all 0.15s',
                boxShadow: isSelected ? '0 2px 8px rgba(124,58,237,0.15)' : '0 1px 4px rgba(0,0,0,0.06)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: '14px', fontWeight: 'bold',
                    color: isSelected ? '#7C3AED' : '#1E3A5F',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                  }}>
                    {consulta.clientes?.nome_completo || 'Cliente nao informado'}
                  </div>
                  <div style={{
                    fontSize: '13px', color: '#6B7280', marginTop: '2px',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                  }}>
                    {consulta.nome_imovel || 'Imovel sem nome'}
                  </div>
                </div>
                {/* Roda da Vida indicator */}
                <div
                  title={filled ? 'Roda da Vida preenchida' : 'Roda da Vida vazia'}
                  style={{
                    width: '14px', height: '14px', borderRadius: '50%', flexShrink: 0,
                    marginLeft: '8px', marginTop: '2px',
                    background: filled ? '#7C3AED' : 'transparent',
                    border: `2px solid ${filled ? '#7C3AED' : '#D1D5DB'}`,
                  }}
                />
              </div>
              <div style={{ fontSize: '12px', color: '#9CA3AF' }}>
                {formatDate(consulta.criado_em)}
              </div>
            </div>
          )
        })}
      </div>

      {/* Selected consultation: Roda da Vida */}
      {selectedId && (
        <div>
          {/* Action bar */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            marginBottom: '16px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <h2 style={{ color: '#1E3A5F', fontSize: '16px', fontWeight: 'bold', margin: 0 }}>
                {consultas.find(c => c.id === selectedId)?.clientes?.nome_completo || 'Cliente'} —{' '}
                {consultas.find(c => c.id === selectedId)?.nome_imovel || 'Imovel'}
              </h2>
            </div>
            <a
              href={`/consultas/${selectedId}`}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                padding: '8px 16px', borderRadius: '8px',
                background: '#1E3A5F', color: '#ffffff',
                textDecoration: 'none', fontSize: '13px', fontWeight: 'bold',
              }}
            >
              Voltar a consulta
            </a>
          </div>

          <TabRodaDaVida
            rodaData={rodaData}
            onChange={setRodaData}
            onSave={handleSave}
            saving={saving}
            setores={setores}
          />
        </div>
      )}
    </AppShell>
  )
}
