'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../../src/lib/supabase'
import { useRouter, useParams } from 'next/navigation'

const CRITERIOS = [
  'Limpeza e organizacao',
  'Iluminacao adequada',
  'Ventilacao e ar fresco',
  'Cores harmonicas',
  'Mobiliario posicionado',
  'Plantas e elementos naturais',
  'Ausencia de objetos quebrados',
  'Fluxo de energia livre',
]

export default function ConsultaDetalhe() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [consulta, setConsulta] = useState<any>(null)
  const [setores, setSetores] = useState<any[]>([])
  const [criterios, setCriterios] = useState<Record<string, Record<string, number>>>({})
  const [notas, setNotas] = useState<Record<string, Record<string, string>>>({})
  const [setorAtivo, setSetorAtivo] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }

      const { data: consulta } = await supabase
        .from('consultas')
        .select('*, clientes(nome_completo)')
        .eq('id', id)
        .single()

      if (!consulta) { router.push('/consultas'); return }
      setConsulta(consulta)

      const { data: setoresData } = await supabase
        .from('setores_bagua')
        .select('*, diagnostico_criterios(*)')
        .eq('consulta_id', id)
        .order('numero')

      setSetores(setoresData || [])

      const cMap: Record<string, Record<string, number>> = {}
      const nMap: Record<string, Record<string, string>> = {}
      setoresData?.forEach(setor => {
        cMap[setor.id] = {}
        nMap[setor.id] = {}
        setor.diagnostico_criterios?.forEach((c: any) => {
          cMap[setor.id][c.criterio] = c.score
          nMap[setor.id][c.criterio] = c.notas || ''
        })
      })
      setCriterios(cMap)
      setNotas(nMap)

      if (setoresData && setoresData.length > 0) {
        setSetorAtivo(setoresData[0].id)
      }

      setLoading(false)
    }
    load()
  }, [id, router])

  function getScore(setorId: string) {
    const scores = Object.values(criterios[setorId] || {})
    if (scores.length === 0) return null
    const total = scores.reduce((a, b) => a + b, 0)
    return Math.round((total / (scores.length * 3)) * 100)
  }

  function scoreColor(pct: number | null) {
    if (pct === null) return '#D1D5DB'
    if (pct >= 70) return '#15803D'
    if (pct >= 40) return '#D97706'
    return '#DC2626'
  }

  async function handleSaveSetor(setorId: string) {
    setSaving(true)
    setMessage('')

    const inserts = CRITERIOS.map(criterio => ({
      setor_id: setorId,
      criterio,
      score: criterios[setorId]?.[criterio] ?? 0,
      notas: notas[setorId]?.[criterio] || null
    }))

    await supabase.from('diagnostico_criterios').delete().eq('setor_id', setorId)
    const { error } = await supabase.from('diagnostico_criterios').insert(inserts)

    if (error) {
      setMessage('Erro ao salvar: ' + error.message)
    } else {
      const pct = getScore(setorId)
      await supabase.from('setores_bagua').update({ score_percentual: pct }).eq('id', setorId)
      setSetores(prev => prev.map(s => s.id === setorId ? { ...s, score_percentual: pct } : s))
      setMessage('Setor salvo com sucesso!')
      setTimeout(() => setMessage(''), 3000)
    }
    setSaving(false)
  }

  async function handleFinalizar() {
    if (!confirm('Deseja finalizar esta consulta?')) return
    await supabase.from('consultas').update({ status: 'finalizada', finalizada_em: new Date().toISOString() }).eq('id', id)
    router.push('/consultas')
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F9FAFB', fontFamily: 'Arial, sans-serif' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>☯</div>
          <p style={{ color: '#7C3AED', fontSize: '16px' }}>Carregando consulta...</p>
        </div>
      </div>
    )
  }

  const setorAtivoData = setores.find(s => s.id === setorAtivo)

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
          <span onClick={() => router.push('/consultas')} style={{ color: 'rgba(255,255,255,0.7)', fontSize: '14px', cursor: 'pointer' }}>← Consultas</span>
          <span style={{ color: '#ffffff', fontSize: '14px', fontWeight: 'bold' }}>Diagnostico</span>
        </div>
      </header>

      <main style={{ padding: '24px 32px', maxWidth: '1200px', margin: '0 auto' }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h1 style={{ color: '#1E3A5F', fontSize: '22px', fontWeight: 'bold', margin: '0 0 4px 0' }}>
              {consulta.nome_imovel}
            </h1>
            <p style={{ color: '#6B7280', fontSize: '14px', margin: '0' }}>
              Cliente: {consulta.clientes?.nome_completo} • {consulta.tipo_imovel} {consulta.area_total_m2 ? `• ${consulta.area_total_m2}m²` : ''}
            </p>
          </div>
          <button onClick={handleFinalizar} style={{
            background: '#15803D', color: '#ffffff', border: 'none',
            padding: '10px 24px', borderRadius: '8px', fontSize: '14px',
            fontWeight: 'bold', cursor: 'pointer'
          }}>Finalizar consulta ✓</button>
        </div>

        {message && (
          <div style={{
            marginBottom: '16px', padding: '10px 16px', borderRadius: '8px',
            background: message.includes('Erro') ? '#FEF2F2' : '#F0FDF4',
            border: `1px solid ${message.includes('Erro') ? '#FECACA' : '#BBF7D0'}`,
            color: message.includes('Erro') ? '#DC2626' : '#15803D', fontSize: '14px'
          }}>{message}</div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '24px' }}>

          {/* Sidebar setores */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <h3 style={{ color: '#1E3A5F', fontSize: '14px', fontWeight: 'bold', margin: '0 0 8px 0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Setores Ba Gua
            </h3>
            {setores.map(setor => {
              const pct = setor.score_percentual ?? getScore(setor.id)
              const ativo = setor.id === setorAtivo
              return (
                <div key={setor.id} onClick={() => setSetorAtivo(setor.id)} style={{
                  padding: '12px 16px', borderRadius: '10px', cursor: 'pointer',
                  background: ativo ? '#1E3A5F' : '#ffffff',
                  border: `2px solid ${ativo ? '#1E3A5F' : '#E5E7EB'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                }}>
                  <div>
                    <div style={{ color: ativo ? '#ffffff' : '#111827', fontWeight: 'bold', fontSize: '14px' }}>
                      {setor.numero}. {setor.nome}
                    </div>
                    <div style={{ color: ativo ? 'rgba(255,255,255,0.7)' : '#9CA3AF', fontSize: '12px' }}>
                      {setor.elemento}
                    </div>
                  </div>
                  {pct !== null && (
                    <div style={{
                      background: scoreColor(pct), color: '#fff',
                      borderRadius: '20px', padding: '2px 8px',
                      fontSize: '12px', fontWeight: 'bold'
                    }}>{pct}%</div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Criterios */}
          {setorAtivoData && (
            <div style={{ background: '#ffffff', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div>
                  <h2 style={{ color: '#1E3A5F', fontSize: '18px', fontWeight: 'bold', margin: '0 0 4px 0' }}>
                    {setorAtivoData.nome}
                  </h2>
                  <p style={{ color: '#6B7280', fontSize: '13px', margin: '0' }}>
                    Elemento: {setorAtivoData.elemento} • {setorAtivoData.posicao_grid}
                  </p>
                </div>
                {getScore(setorAtivoData.id) !== null && (
                  <div style={{
                    background: scoreColor(getScore(setorAtivoData.id)),
                    color: '#fff', borderRadius: '12px', padding: '8px 16px',
                    fontSize: '20px', fontWeight: 'bold'
                  }}>{getScore(setorAtivoData.id)}%</div>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
                {CRITERIOS.map(criterio => (
                  <div key={criterio} style={{ padding: '16px', background: '#F9FAFB', borderRadius: '10px', border: '1px solid #E5E7EB' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                      <label style={{ color: '#374151', fontSize: '14px', fontWeight: 'bold' }}>{criterio}</label>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        {[0, 1, 2, 3].map(val => (
                          <button key={val} onClick={() => {
                            setCriterios(prev => ({
                              ...prev,
                              [setorAtivoData.id]: { ...prev[setorAtivoData.id], [criterio]: val }
                            }))
                          }} style={{
                            width: '36px', height: '36px', borderRadius: '8px', border: 'none',
                            cursor: 'pointer', fontWeight: 'bold', fontSize: '14px',
                            background: criterios[setorAtivoData.id]?.[criterio] === val
                              ? val === 0 ? '#DC2626' : val === 1 ? '#D97706' : val === 2 ? '#2563EB' : '#15803D'
                              : '#E5E7EB',
                            color: criterios[setorAtivoData.id]?.[criterio] === val ? '#fff' : '#6B7280'
                          }}>{val}</button>
                        ))}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', fontSize: '11px', color: '#9CA3AF', marginBottom: '8px' }}>
                      <span style={{ color: '#DC2626' }}>0=Critico</span>
                      <span style={{ color: '#D97706' }}>1=Regular</span>
                      <span style={{ color: '#2563EB' }}>2=Bom</span>
                      <span style={{ color: '#15803D' }}>3=Otimo</span>
                    </div>
                    <input
                      placeholder="Observacao (opcional)"
                      value={notas[setorAtivoData.id]?.[criterio] || ''}
                      onChange={e => setNotas(prev => ({
                        ...prev,
                        [setorAtivoData.id]: { ...prev[setorAtivoData.id], [criterio]: e.target.value }
                      }))}
                      style={{ width: '100%', padding: '8px 12px', border: '1px solid #D1D5DB', borderRadius: '6px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                    />
                  </div>
                ))}
              </div>

              <button onClick={() => handleSaveSetor(setorAtivoData.id)} disabled={saving} style={{
                width: '100%', padding: '14px', background: saving ? '#9CA3AF' : '#7C3AED',
                color: '#ffffff', border: 'none', borderRadius: '8px',
                fontSize: '15px', fontWeight: 'bold', cursor: saving ? 'not-allowed' : 'pointer'
              }}>{saving ? 'Salvando...' : 'Salvar avaliacao deste setor'}</button>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}