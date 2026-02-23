'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../../src/lib/supabase'
import { useParams } from 'next/navigation'
import AppShell from '../../components/AppShell'
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, Tooltip,
} from 'recharts'

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
  const [profile, setProfile] = useState<any>(null)
  const [radarData, setRadarData] = useState<any[]>([])

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/login'; return }

      const { data: consulta } = await supabase
        .from('consultas')
        .select('*, clientes(nome_completo)')
        .eq('id', id)
        .single()

      if (!consulta) { window.location.href = '/consultas'; return }
      setConsulta(consulta)
      const { data: prof } = await supabase
        .from('profiles')
        .select('plano')
        .eq('id', user.id)
        .single()
      setProfile(prof)

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

      // Build radar data
      buildRadarData(setoresData || [])

      if (setoresData && setoresData.length > 0) {
        setSetorAtivo(setoresData[0].id)
      }

      setLoading(false)
    }
    load()
  }, [id])

  function buildRadarData(setoresArr: any[]) {
    const data = setoresArr.map(s => ({
      setor: s.nome,
      score: s.score_percentual ?? 0,
      fullMark: 100,
    }))
    setRadarData(data)
  }

  function getScore(setorId: string) {
    const scores = Object.values(criterios[setorId] || {})
    if (scores.length === 0) return null
    const total = scores.reduce((a, b) => a + b, 0)
    return Math.round((total / (scores.length * 3)) * 100)
  }

  function getScoreGeral() {
    const avaliados = setores.filter(s => s.score_percentual !== null && s.score_percentual !== undefined)
    if (avaliados.length === 0) return null
    const soma = avaliados.reduce((a, s) => a + s.score_percentual, 0)
    return Math.round(soma / avaliados.length)
  }

  function scoreColor(pct: number | null) {
    if (pct === null) return '#D1D5DB'
    if (pct >= 70) return '#15803D'
    if (pct >= 40) return '#D97706'
    return '#DC2626'
  }

  function scoreLabel(pct: number | null) {
    if (pct === null) return 'Não avaliado'
    if (pct >= 70) return 'Bom'
    if (pct >= 40) return 'Regular'
    return 'Crítico'
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
      const updatedSetores = setores.map(s => s.id === setorId ? { ...s, score_percentual: pct } : s)
      setSetores(updatedSetores)
      buildRadarData(updatedSetores)
      setMessage('Setor salvo com sucesso!')
      setTimeout(() => setMessage(''), 3000)
    }
    setSaving(false)
  }

  async function handleFinalizar() {
    if (!confirm('Deseja finalizar esta consulta?')) return
    await supabase.from('consultas').update({ status: 'finalizada', finalizada_em: new Date().toISOString() }).eq('id', id)
    window.location.href = '/consultas'
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
  const scoreGeral = getScoreGeral()
  const hasAnyScore = radarData.some(d => d.score > 0)

  return (
    <AppShell currentPage="consultas">

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ color: '#1E3A5F', fontSize: '22px', fontWeight: 'bold', margin: '0 0 4px 0' }}>
            {consulta.nome_imovel}
          </h1>
          <p style={{ color: '#6B7280', fontSize: '14px', margin: '0' }}>
            Cliente: {consulta.clientes?.nome_completo} • {consulta.tipo_imovel} {consulta.area_total_m2 ? `• ${consulta.area_total_m2}m²` : ''}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          {consulta.status !== 'finalizada' && (
            <button onClick={handleFinalizar} style={{
              background: '#15803D', color: '#ffffff', border: 'none',
              padding: '10px 24px', borderRadius: '8px', fontSize: '14px',
              fontWeight: 'bold', cursor: 'pointer'
            }}>Finalizar consulta</button>
          )}
          <button onClick={() => {
            if (profile?.plano !== 'pro') {
              setMessage('Erro: Geração de relatório PDF disponível apenas no plano Pro.')
              return
            }
            window.location.href = `/consultas/${id}/relatorio`
          }} style={{
            background: '#1D4ED8', color: '#ffffff', border: 'none',
            padding: '10px 24px', borderRadius: '8px', fontSize: '14px',
            fontWeight: 'bold', cursor: 'pointer'
          }}>Ver relatorio</button>
        </div>
      </div>

      {message && (
        <div style={{
          marginBottom: '16px', padding: '10px 16px', borderRadius: '8px',
          background: message.includes('Erro') ? '#FEF2F2' : '#F0FDF4',
          border: `1px solid ${message.includes('Erro') ? '#FECACA' : '#BBF7D0'}`,
          color: message.includes('Erro') ? '#DC2626' : '#15803D', fontSize: '14px'
        }}>{message}</div>
      )}

      {/* Radar + Score Geral Card */}
      <div style={{
        background: '#ffffff', borderRadius: '12px', padding: '24px',
        boxShadow: '0 1px 4px rgba(0,0,0,0.08)', marginBottom: '24px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <h3 style={{ color: '#1E3A5F', fontSize: '16px', fontWeight: 'bold', margin: '0' }}>
            Perfil Energetico do Imovel
          </h3>
          {scoreGeral !== null && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ color: '#6B7280', fontSize: '14px' }}>Score geral:</span>
              <div style={{
                background: scoreColor(scoreGeral), color: '#fff',
                borderRadius: '20px', padding: '6px 16px',
                fontSize: '16px', fontWeight: 'bold',
              }}>{scoreGeral}% — {scoreLabel(scoreGeral)}</div>
            </div>
          )}
        </div>

        {hasAnyScore ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap' }}>
            {/* Radar Chart */}
            <div style={{ flex: '1 1 400px', minWidth: '300px' }}>
              <ResponsiveContainer width="100%" height={320}>
                <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="72%">
                  <PolarGrid stroke="#E5E7EB" />
                  <PolarAngleAxis
                    dataKey="setor"
                    tick={{ fontSize: 11, fill: '#374151', fontWeight: 600 }}
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
                    strokeWidth={2.5}
                  />
                  <Tooltip
                    formatter={(value: any) => [`${value}%`, 'Score']}
                    contentStyle={{ borderRadius: '8px', border: '1px solid #E5E7EB', fontSize: '13px' }}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>

            {/* Mini score list */}
            <div style={{ flex: '1 1 280px', minWidth: '250px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {radarData.map((item, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '8px 12px', borderRadius: '8px', background: '#F9FAFB',
                  }}>
                    <span style={{ color: '#374151', fontSize: '13px', fontWeight: 600 }}>{item.setor}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{
                        width: '60px', height: '6px', background: '#E5E7EB',
                        borderRadius: '3px', overflow: 'hidden',
                      }}>
                        <div style={{
                          width: `${item.score}%`, height: '100%',
                          background: scoreColor(item.score),
                          borderRadius: '3px',
                        }} />
                      </div>
                      <span style={{
                        color: scoreColor(item.score), fontSize: '13px',
                        fontWeight: 'bold', minWidth: '36px', textAlign: 'right',
                      }}>{item.score}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div style={{ height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <p style={{ color: '#9CA3AF', fontSize: '14px' }}>Avalie os setores abaixo para ver o perfil energetico</p>
          </div>
        )}
      </div>

      {/* Setores + Avaliação */}
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

        {/* Formulário de avaliação */}
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

    </AppShell>
  )
}