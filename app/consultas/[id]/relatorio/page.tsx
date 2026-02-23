'use client'

import { useEffect, useState, useRef } from 'react'
import { supabase } from '../../../../src/lib/supabase'
import { useRouter, useParams } from 'next/navigation'

export default function Relatorio() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const printRef = useRef<HTMLDivElement>(null)

  const [consulta, setConsulta] = useState<any>(null)
  const [setores, setSetores] = useState<any[]>([])
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }

      const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      setProfile(prof)

      const { data: consulta } = await supabase
        .from('consultas')
        .select('*, clientes(nome_completo, email, telefone, cidade, estado)')
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
      setLoading(false)
    }
    load()
  }, [id, router])

  function scoreColor(pct: number | null) {
    if (pct === null || pct === undefined) return '#9CA3AF'
    if (pct >= 70) return '#15803D'
    if (pct >= 40) return '#D97706'
    return '#DC2626'
  }

  function scoreLabel(pct: number | null) {
    if (pct === null || pct === undefined) return 'Nao avaliado'
    if (pct >= 70) return 'Bom'
    if (pct >= 40) return 'Regular'
    return 'Critico'
  }

  function scoreGeral() {
    const avaliados = setores.filter(s => s.score_percentual !== null)
    if (avaliados.length === 0) return null
    const soma = avaliados.reduce((a, s) => a + s.score_percentual, 0)
    return Math.round(soma / avaliados.length)
  }

  function handlePrint() {
    window.print()
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F9FAFB', fontFamily: 'Arial, sans-serif' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>☯</div>
          <p style={{ color: '#7C3AED', fontSize: '16px' }}>Gerando relatorio...</p>
        </div>
      </div>
    )
  }

  const geral = scoreGeral()

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { margin: 0; }
          .print-area { padding: 0 !important; }
        }
      `}</style>

      {/* Toolbar */}
      <div className="no-print" style={{
        background: '#1E3A5F', padding: '12px 32px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '24px', cursor: 'pointer' }} onClick={() => router.push(`/consultas/${id}`)}>☯</span>
          <span style={{ color: '#B8860B', fontSize: '18px', fontWeight: 'bold' }}>FengShui Studio</span>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button onClick={() => router.push(`/consultas/${id}`)} style={{
            background: 'transparent', border: '1px solid rgba(255,255,255,0.3)',
            color: '#ffffff', padding: '8px 20px', borderRadius: '6px', cursor: 'pointer', fontSize: '14px'
          }}>← Voltar</button>
          <button onClick={handlePrint} style={{
            background: '#7C3AED', border: 'none',
            color: '#ffffff', padding: '8px 24px', borderRadius: '6px',
            cursor: 'pointer', fontSize: '14px', fontWeight: 'bold'
          }}>Imprimir / Salvar PDF</button>
        </div>
      </div>

      {/* Relatorio */}
      <div ref={printRef} className="print-area" style={{
        background: '#ffffff', maxWidth: '800px', margin: '32px auto',
        padding: '48px', fontFamily: 'Arial, sans-serif',
        boxShadow: '0 4px 20px rgba(0,0,0,0.1)', borderRadius: '8px'
      }}>

        {/* Header */}
        <div style={{ borderBottom: '3px solid #1E3A5F', paddingBottom: '24px', marginBottom: '32px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '36px', marginBottom: '4px' }}>☯</div>
              <h1 style={{ color: '#1E3A5F', fontSize: '24px', fontWeight: 'bold', margin: '0 0 4px 0' }}>
                FengShui Studio
              </h1>
              <p style={{ color: '#7C3AED', fontSize: '13px', margin: '0' }}>
                Relatorio de Diagnostico Ba Gua
              </p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ color: '#6B7280', fontSize: '12px', margin: '0 0 4px 0' }}>
                Consultor: {profile?.nome_completo}
              </p>
              {profile?.nome_empresa && (
                <p style={{ color: '#6B7280', fontSize: '12px', margin: '0 0 4px 0' }}>{profile.nome_empresa}</p>
              )}
              <p style={{ color: '#6B7280', fontSize: '12px', margin: '0' }}>
                Data: {new Date(consulta.criado_em).toLocaleDateString('pt-BR')}
              </p>
            </div>
          </div>
        </div>

        {/* Dados do imovel */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '32px' }}>
          <div style={{ background: '#F9FAFB', borderRadius: '8px', padding: '20px' }}>
            <h3 style={{ color: '#1E3A5F', fontSize: '14px', fontWeight: 'bold', margin: '0 0 12px 0', textTransform: 'uppercase' }}>Imovel</h3>
            <p style={{ margin: '4px 0', fontSize: '14px', color: '#374151' }}><strong>{consulta.nome_imovel}</strong></p>
            {consulta.tipo_imovel && <p style={{ margin: '4px 0', fontSize: '13px', color: '#6B7280' }}>Tipo: {consulta.tipo_imovel}</p>}
            {consulta.area_total_m2 && <p style={{ margin: '4px 0', fontSize: '13px', color: '#6B7280' }}>Area: {consulta.area_total_m2}m²</p>}
            {consulta.endereco_imovel && <p style={{ margin: '4px 0', fontSize: '13px', color: '#6B7280' }}>{consulta.endereco_imovel}</p>}
            <p style={{ margin: '4px 0', fontSize: '13px', color: '#6B7280' }}>Porta: {consulta.porta_posicao?.replace(/_/g, ' ')}</p>
          </div>
          <div style={{ background: '#F9FAFB', borderRadius: '8px', padding: '20px' }}>
            <h3 style={{ color: '#1E3A5F', fontSize: '14px', fontWeight: 'bold', margin: '0 0 12px 0', textTransform: 'uppercase' }}>Cliente</h3>
            <p style={{ margin: '4px 0', fontSize: '14px', color: '#374151' }}><strong>{consulta.clientes?.nome_completo}</strong></p>
            {consulta.clientes?.email && <p style={{ margin: '4px 0', fontSize: '13px', color: '#6B7280' }}>{consulta.clientes.email}</p>}
            {consulta.clientes?.telefone && <p style={{ margin: '4px 0', fontSize: '13px', color: '#6B7280' }}>{consulta.clientes.telefone}</p>}
            {consulta.clientes?.cidade && <p style={{ margin: '4px 0', fontSize: '13px', color: '#6B7280' }}>{consulta.clientes.cidade}{consulta.clientes.estado ? ` - ${consulta.clientes.estado}` : ''}</p>}
          </div>
        </div>

        {/* Score geral */}
        {geral !== null && (
          <div style={{
            background: `linear-gradient(135deg, #1E3A5F, #2d5a8e)`,
            borderRadius: '12px', padding: '24px 32px', marginBottom: '32px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between'
          }}>
            <div>
              <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '13px', margin: '0 0 4px 0' }}>Score Energetico Geral</p>
              <p style={{ color: '#ffffff', fontSize: '28px', fontWeight: 'bold', margin: '0' }}>{consulta.nome_imovel}</p>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{
                width: '80px', height: '80px', borderRadius: '50%',
                background: scoreColor(geral), display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                flexDirection: 'column'
              }}>
                <span style={{ color: '#fff', fontSize: '22px', fontWeight: 'bold' }}>{geral}%</span>
              </div>
              <p style={{ color: '#ffffff', fontSize: '13px', margin: '8px 0 0 0' }}>{scoreLabel(geral)}</p>
            </div>
          </div>
        )}

        {/* Setores */}
        <h2 style={{ color: '#1E3A5F', fontSize: '18px', fontWeight: 'bold', marginBottom: '16px' }}>
          Diagnostico por Setor
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '32px' }}>
          {setores.map(setor => (
            <div key={setor.id} style={{
              border: `1px solid #E5E7EB`, borderRadius: '8px', overflow: 'hidden'
            }}>
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '12px 16px',
                background: '#F9FAFB', borderBottom: '1px solid #E5E7EB'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '28px', height: '28px', borderRadius: '50%',
                    background: scoreColor(setor.score_percentual),
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff', fontSize: '12px', fontWeight: 'bold'
                  }}>{setor.numero}</div>
                  <div>
                    <span style={{ color: '#1E3A5F', fontWeight: 'bold', fontSize: '15px' }}>{setor.nome}</span>
                    <span style={{ color: '#9CA3AF', fontSize: '12px', marginLeft: '8px' }}>{setor.elemento} • {setor.posicao_grid}</span>
                  </div>
                </div>
                {setor.score_percentual !== null && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{
                      width: '100px', height: '8px', background: '#E5E7EB', borderRadius: '4px', overflow: 'hidden'
                    }}>
                      <div style={{ width: `${setor.score_percentual}%`, height: '100%', background: scoreColor(setor.score_percentual), borderRadius: '4px' }} />
                    </div>
                    <span style={{ color: scoreColor(setor.score_percentual), fontWeight: 'bold', fontSize: '14px', minWidth: '40px' }}>
                      {setor.score_percentual}%
                    </span>
                  </div>
                )}
              </div>
              {setor.diagnostico_criterios?.length > 0 && (
                <div style={{ padding: '12px 16px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                    {setor.diagnostico_criterios.map((c: any) => (
                      <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#6B7280' }}>
                        <span>{c.criterio}</span>
                        <span style={{ color: scoreColor(c.score * 33), fontWeight: 'bold' }}>{c.score}/3</span>
                      </div>
                    ))}
                  </div>
                  {setor.diagnostico_criterios.some((c: any) => c.notas) && (
                    <div style={{ marginTop: '8px', padding: '8px', background: '#F5F0FF', borderRadius: '6px' }}>
                      {setor.diagnostico_criterios.filter((c: any) => c.notas).map((c: any) => (
                        <p key={c.id} style={{ margin: '2px 0', fontSize: '12px', color: '#5B21B6' }}>
                          <strong>{c.criterio}:</strong> {c.notas}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{ borderTop: '2px solid #E5E7EB', paddingTop: '20px', textAlign: 'center' }}>
          <p style={{ color: '#9CA3AF', fontSize: '12px', margin: '0' }}>
            Relatorio gerado pelo FengShui Studio • {new Date().toLocaleDateString('pt-BR')} • Escola Black Hat
          </p>
        </div>

      </div>
    </>
  )
}