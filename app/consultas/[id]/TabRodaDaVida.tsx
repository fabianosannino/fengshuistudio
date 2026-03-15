'use client'

import { useState, useEffect } from 'react'

// Roda da Vida — Life areas mapped to Ba Gua sectors (Black Hat school)
const AREAS_VIDA = [
  { key: 'carreira', label: 'Carreira', gua: 'Carreira', elemento: 'Água', cor: '#1D4ED8', angulo: 0 },
  { key: 'espiritualidade', label: 'Espiritualidade', gua: 'Espiritualidade', elemento: 'Terra', cor: '#92400E', angulo: 40 },
  { key: 'familia', label: 'Família / Saúde', gua: 'Família', elemento: 'Madeira', cor: '#15803D', angulo: 80 },
  { key: 'prosperidade', label: 'Prosperidade', gua: 'Prosperidade', elemento: 'Madeira', cor: '#7C3AED', angulo: 120 },
  { key: 'fama', label: 'Fama / Reputação', gua: 'Fama', elemento: 'Fogo', cor: '#DC2626', angulo: 160 },
  { key: 'relacionamentos', label: 'Relacionamentos', gua: 'Relacionamentos', elemento: 'Terra', cor: '#BE185D', angulo: 200 },
  { key: 'criatividade', label: 'Criatividade / Filhos', gua: 'Criatividade', elemento: 'Metal', cor: '#B45309', angulo: 240 },
  { key: 'pessoas_uteis', label: 'Pessoas Úteis', gua: 'Pessoas Úteis', elemento: 'Metal', cor: '#6B7280', angulo: 280 },
  { key: 'saude_centro', label: 'Saúde / Centro', gua: 'Centro', elemento: 'Terra', cor: '#D97706', angulo: 320 },
]

type RodaData = Record<string, number>

interface Props {
  rodaData: RodaData
  onChange: (data: RodaData) => void
  onSave: () => void
  saving: boolean
  setores: any[]
}

function polarToXY(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

export default function TabRodaDaVida({ rodaData, onChange, onSave, saving, setores }: Props) {
  const [hovered, setHovered] = useState<string | null>(null)

  const cx = 200, cy = 200, maxR = 170

  // Build polygon points for the wheel
  const points = AREAS_VIDA.map(area => {
    const val = rodaData[area.key] ?? 0
    const r = (val / 10) * maxR
    return polarToXY(cx, cy, r, area.angulo)
  })
  const polygonStr = points.map(p => `${p.x},${p.y}`).join(' ')

  // Find matching sector score for correlation display
  function findSetorScore(guaName: string): number | null {
    const setor = setores.find(s =>
      s.nome === guaName ||
      s.nome === 'Conhecimento' && guaName === 'Espiritualidade' ||
      s.nome === 'Centro/Saúde' && guaName === 'Centro' ||
      s.nome === 'Centro' && guaName === 'Centro' ||
      s.nome === 'Fama/Reputação' && guaName === 'Fama' ||
      s.nome === 'Fama' && guaName === 'Fama' ||
      s.nome === 'Filhos' && guaName === 'Criatividade' ||
      s.nome === 'Criatividade' && guaName === 'Criatividade' ||
      s.nome === 'Pessoas Uteis' && guaName === 'Pessoas Úteis' ||
      s.nome === 'Pessoas Úteis' && guaName === 'Pessoas Úteis'
    )
    return setor?.score_percentual ?? null
  }

  // Compute correlation between life score and sector score
  function correlacao(areaKey: string, guaName: string): { label: string; cor: string } | null {
    const vidaScore = rodaData[areaKey]
    const setorPct = findSetorScore(guaName)
    if (vidaScore === undefined || vidaScore === 0 || setorPct === null) return null

    const vidaNorm = vidaScore * 10 // normalize 0-10 to 0-100
    const diff = Math.abs(vidaNorm - setorPct)

    if (diff <= 15) return { label: 'Correlação alta', cor: '#15803D' }
    if (diff <= 35) return { label: 'Correlação moderada', cor: '#D97706' }
    return { label: 'Divergência — investigar', cor: '#DC2626' }
  }

  // Deviation classification
  function classificarDesvio(areaKey: string): { nivel: string; cor: string; bg: string } {
    const val = rodaData[areaKey] ?? 0
    if (val >= 8) return { nivel: 'Ótimo', cor: '#15803D', bg: '#F0FDF4' }
    if (val >= 5) return { nivel: 'Leve', cor: '#2563EB', bg: '#EFF6FF' }
    if (val >= 3) return { nivel: 'Moderado', cor: '#D97706', bg: '#FFFBEB' }
    if (val >= 1) return { nivel: 'Acentuado', cor: '#DC2626', bg: '#FEF2F2' }
    return { nivel: 'Ausente', cor: '#7F1D1D', bg: '#FEF2F2' }
  }

  const media = (() => {
    const vals = AREAS_VIDA.map(a => rodaData[a.key] ?? 0)
    const soma = vals.reduce((a, b) => a + b, 0)
    return (soma / vals.length).toFixed(1)
  })()

  return (
    <div style={{ background: '#ffffff', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h2 style={{ color: '#1E3A5F', fontSize: '18px', fontWeight: 'bold', margin: '0 0 4px 0' }}>
            Roda da Vida
          </h2>
          <p style={{ color: '#6B7280', fontSize: '13px', margin: 0 }}>
            Avalie de 0 a 10 cada área da vida do cliente e compare com o diagnóstico Ba Guá
          </p>
        </div>
        <div style={{
          background: '#1E3A5F', color: '#fff', borderRadius: '12px',
          padding: '8px 16px', fontSize: '16px', fontWeight: 'bold'
        }}>
          Média: {media}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '400px 1fr', gap: '24px', alignItems: 'start' }}>
        {/* SVG Wheel */}
        <div style={{ background: '#F9FAFB', borderRadius: '12px', padding: '12px', textAlign: 'center' }}>
          <svg width="400" height="400" viewBox="0 0 400 400">
            {/* Concentric circles */}
            {[2, 4, 6, 8, 10].map(v => (
              <circle key={v} cx={cx} cy={cy} r={(v / 10) * maxR}
                fill="none" stroke="#E5E7EB" strokeWidth="1" strokeDasharray={v === 10 ? 'none' : '4,4'} />
            ))}
            {/* Scale labels */}
            {[2, 4, 6, 8, 10].map(v => (
              <text key={v} x={cx + 4} y={cy - (v / 10) * maxR + 12}
                fill="#9CA3AF" fontSize="10" fontFamily="Arial">{v}</text>
            ))}
            {/* Sector lines */}
            {AREAS_VIDA.map(area => {
              const p = polarToXY(cx, cy, maxR, area.angulo)
              return <line key={area.key} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="#E5E7EB" strokeWidth="1" />
            })}
            {/* Filled polygon */}
            {points.length > 0 && (
              <polygon points={polygonStr} fill="rgba(124, 58, 237, 0.15)" stroke="#7C3AED" strokeWidth="2" />
            )}
            {/* Data points */}
            {AREAS_VIDA.map((area, i) => {
              const val = rodaData[area.key] ?? 0
              const r = (val / 10) * maxR
              const p = polarToXY(cx, cy, r, area.angulo)
              const labelP = polarToXY(cx, cy, maxR + 20, area.angulo)
              const isHov = hovered === area.key
              return (
                <g key={area.key}
                  onMouseEnter={() => setHovered(area.key)}
                  onMouseLeave={() => setHovered(null)}
                  style={{ cursor: 'pointer' }}>
                  <circle cx={p.x} cy={p.y} r={isHov ? 8 : 6}
                    fill={area.cor} stroke="#fff" strokeWidth="2" />
                  {isHov && (
                    <text x={p.x} y={p.y - 12} textAnchor="middle"
                      fill={area.cor} fontSize="13" fontWeight="bold" fontFamily="Arial">
                      {val}
                    </text>
                  )}
                  <text x={labelP.x} y={labelP.y} textAnchor="middle"
                    fill={isHov ? area.cor : '#6B7280'} fontSize="10" fontWeight={isHov ? 'bold' : 'normal'}
                    fontFamily="Arial" dominantBaseline="central">
                    {area.label.length > 14 ? area.label.split('/')[0].trim() : area.label}
                  </text>
                </g>
              )
            })}
          </svg>
        </div>

        {/* Sliders and correlation */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {AREAS_VIDA.map(area => {
            const val = rodaData[area.key] ?? 0
            const desvio = classificarDesvio(area.key)
            const corr = correlacao(area.key, area.gua)
            const setorPct = findSetorScore(area.gua)
            return (
              <div key={area.key} style={{
                padding: '10px 14px', borderRadius: '8px',
                background: hovered === area.key ? '#F5F0FF' : '#F9FAFB',
                border: `1px solid ${hovered === area.key ? '#E9D5FF' : '#E5E7EB'}`,
                transition: 'all 0.15s'
              }}
                onMouseEnter={() => setHovered(area.key)}
                onMouseLeave={() => setHovered(null)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: area.cor }} />
                    <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#374151' }}>{area.label}</span>
                    <span style={{ fontSize: '11px', color: '#9CA3AF' }}>Guá: {area.gua}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{
                      fontSize: '10px', fontWeight: 'bold', padding: '2px 8px',
                      borderRadius: '10px', background: desvio.bg, color: desvio.cor
                    }}>{desvio.nivel}</span>
                    <span style={{ fontSize: '18px', fontWeight: 'bold', color: area.cor, minWidth: '28px', textAlign: 'right' }}>
                      {val}
                    </span>
                  </div>
                </div>
                <input
                  type="range" min="0" max="10" step="1" value={val}
                  onChange={e => onChange({ ...rodaData, [area.key]: parseInt(e.target.value) })}
                  style={{ width: '100%', accentColor: area.cor, cursor: 'pointer', height: '6px' }}
                />
                {/* Correlation indicator */}
                {(corr || setorPct !== null) && (
                  <div style={{ display: 'flex', gap: '12px', marginTop: '4px', fontSize: '11px' }}>
                    {setorPct !== null && (
                      <span style={{ color: '#6B7280' }}>Score Guá: <strong>{setorPct}%</strong></span>
                    )}
                    {corr && (
                      <span style={{ color: corr.cor, fontWeight: 'bold' }}>{corr.label}</span>
                    )}
                  </div>
                )}
              </div>
            )
          })}

          <button onClick={onSave} disabled={saving} style={{
            width: '100%', padding: '14px', marginTop: '8px',
            background: saving ? '#9CA3AF' : '#7C3AED',
            color: '#ffffff', border: 'none', borderRadius: '8px',
            fontSize: '15px', fontWeight: 'bold', cursor: saving ? 'not-allowed' : 'pointer'
          }}>{saving ? 'Salvando...' : 'Salvar Roda da Vida'}</button>
        </div>
      </div>
    </div>
  )
}
