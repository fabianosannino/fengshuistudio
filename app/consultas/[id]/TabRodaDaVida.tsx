'use client'

import { useState } from 'react'
import type { SetorBagua } from '../../../src/lib/types'
import { AREAS, CATEGORIAS, AREA_GUA_MAP, avg, defaultRespostas } from '../../../src/lib/roda-da-vida-constants'

// Backwards-compatible data: each area can be number[] (new 5-question format) or number (legacy single slider)
type RodaData = Record<string, number[] | number>

interface Props {
  rodaData: RodaData
  onChange: (data: RodaData) => void
  onSave: () => void
  saving: boolean
  setores: SetorBagua[]
  observacoes?: Record<string, string>
  onChangeObservacoes?: (obs: Record<string, string>) => void
  observacaoGeral?: string
  onChangeObservacaoGeral?: (obs: string) => void
}

/** Get the display value (0-10) for an area, whether stored as array or single number */
function areaValue(rodaData: RodaData, key: string): number {
  const v = rodaData[key]
  if (Array.isArray(v)) return avg(v)
  if (typeof v === 'number') return v
  return 5
}

/** Get the scores array for an area; if legacy single number, expand to 5 identical values */
function areaScores(rodaData: RodaData, key: string): number[] {
  const v = rodaData[key]
  if (Array.isArray(v)) return v
  if (typeof v === 'number') return [v, v, v, v, v]
  return [5, 5, 5, 5, 5]
}

/** Check if this area uses the new array format */
function isArrayFormat(rodaData: RodaData, key: string): boolean {
  return Array.isArray(rodaData[key])
}

function polarToXY(cx: number, cy: number, r: number, index: number, total: number) {
  const angleDeg = (index * 360 / total) - 90
  const rad = (angleDeg * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

export default function TabRodaDaVida({ rodaData, onChange, onSave, saving, setores, observacoes = {}, onChangeObservacoes, observacaoGeral = '', onChangeObservacaoGeral }: Props) {
  const [hovered, setHovered] = useState<string | null>(null)
  const [expandedArea, setExpandedArea] = useState<string | null>(null)
  const [areaAtual, setAreaAtual] = useState(0)
  const [mode, setMode] = useState<'chart' | 'questionnaire'>('chart')

  const cx = 200, cy = 200, maxR = 160
  const n = AREAS.length // 12

  // SVG wheel uses averages
  const values = AREAS.map(a => areaValue(rodaData, a.key))
  const points = AREAS.map((_, i) => {
    const r = (values[i] / 10) * maxR
    return polarToXY(cx, cy, r, i, n)
  })
  const polygonStr = points.map(p => `${p.x},${p.y}`).join(' ')

  // Find matching sector score for correlation display
  function findSetorScore(guaName: string): number | null {
    const setor = setores.find(s =>
      s.nome === guaName ||
      (s.nome === 'Conhecimento' && guaName === 'Espiritualidade') ||
      (s.nome === 'Centro/Saúde' && guaName === 'Centro') ||
      (s.nome === 'Centro' && guaName === 'Centro') ||
      (s.nome === 'Fama/Reputação' && guaName === 'Fama') ||
      (s.nome === 'Fama' && guaName === 'Fama') ||
      (s.nome === 'Filhos' && guaName === 'Criatividade') ||
      (s.nome === 'Criatividade' && guaName === 'Criatividade') ||
      (s.nome === 'Pessoas Uteis' && guaName === 'Pessoas Úteis') ||
      (s.nome === 'Pessoas Úteis' && guaName === 'Pessoas Úteis') ||
      (s.nome === 'Família' && guaName === 'Família') ||
      (s.nome === 'Relacionamentos' && guaName === 'Relacionamentos') ||
      (s.nome === 'Prosperidade' && guaName === 'Prosperidade') ||
      (s.nome === 'Carreira' && guaName === 'Carreira')
    )
    return setor?.score_percentual ?? null
  }

  function correlacao(areaKey: string): { label: string; cor: string } | null {
    const guaName = AREA_GUA_MAP[areaKey]
    if (!guaName) return null
    const vidaScore = areaValue(rodaData, areaKey)
    const setorPct = findSetorScore(guaName)
    if (vidaScore === 0 || setorPct === null) return null

    const vidaNorm = vidaScore * 10
    const diff = Math.abs(vidaNorm - setorPct)

    if (diff <= 15) return { label: 'Correlação alta', cor: '#15803D' }
    if (diff <= 35) return { label: 'Correlação moderada', cor: '#D97706' }
    return { label: 'Divergência — investigar', cor: '#DC2626' }
  }

  function classificarDesvio(areaKey: string): { nivel: string; cor: string; bg: string } {
    const val = areaValue(rodaData, areaKey)
    if (val >= 8) return { nivel: 'Ótimo', cor: '#15803D', bg: '#F0FDF4' }
    if (val >= 5) return { nivel: 'Leve', cor: '#2563EB', bg: '#EFF6FF' }
    if (val >= 3) return { nivel: 'Moderado', cor: '#D97706', bg: '#FFFBEB' }
    if (val >= 1) return { nivel: 'Acentuado', cor: '#DC2626', bg: '#FEF2F2' }
    return { nivel: 'Ausente', cor: '#7F1D1D', bg: '#FEF2F2' }
  }

  const media = (values.reduce((a, b) => a + b, 0) / values.length).toFixed(1)

  const catAvg = (keys: string[]) => {
    const vals = keys.map(k => areaValue(rodaData, k))
    return vals.reduce((s, v) => s + v, 0) / vals.length
  }

  // Set a single question score within an area
  function setScore(areaKey: string, qi: number, val: number) {
    const current = areaScores(rodaData, areaKey)
    const updated = current.map((v, i) => i === qi ? val : v)
    onChange({ ...rodaData, [areaKey]: updated })
  }

  // Initialize all areas to array format if not already
  function initArrayFormat() {
    const updated: RodaData = {}
    let changed = false
    for (const a of AREAS) {
      if (!Array.isArray(rodaData[a.key])) {
        updated[a.key] = areaScores(rodaData, a.key)
        changed = true
      } else {
        updated[a.key] = rodaData[a.key]
      }
    }
    if (changed) onChange({ ...rodaData, ...updated })
  }

  function startQuestionnaire() {
    initArrayFormat()
    setAreaAtual(0)
    setMode('questionnaire')
  }

  const area = AREAS[areaAtual]
  const progress = ((areaAtual + 1) / n * 100)
  const scores = areaScores(rodaData, area?.key || '')

  const btnPrimary = (bg = '#2E7D6B'): React.CSSProperties => ({
    padding: '10px 20px', borderRadius: 8, background: bg, color: '#fff',
    border: 'none', fontWeight: 'bold', fontSize: 14, cursor: 'pointer'
  })

  return (
    <div style={{ background: '#ffffff', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h2 style={{ color: '#0E1B2C', fontSize: '18px', fontWeight: 'bold', margin: '0 0 4px 0' }}>
            Roda da Vida
          </h2>
          <p style={{ color: '#6B7280', fontSize: '13px', margin: 0 }}>
            {mode === 'chart'
              ? '12 áreas da vida — clique "Responder Questionário" para as 60 perguntas detalhadas'
              : `${areaAtual + 1}/12 — ${area?.label} (${area?.categoria})`}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {mode === 'questionnaire' && (
            <button onClick={() => setMode('chart')} style={btnPrimary('#6B7280')}>
              Voltar ao Gráfico
            </button>
          )}
          <div style={{
            background: '#0E1B2C', color: '#fff', borderRadius: '12px',
            padding: '8px 16px', fontSize: '16px', fontWeight: 'bold'
          }}>
            Média: {media}
          </div>
        </div>
      </div>

      {/* ── QUESTIONNAIRE MODE ── */}
      {mode === 'questionnaire' && area && (
        <div>
          {/* Progress bar */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ height: 6, borderRadius: 3, background: '#E5E7EB' }}>
              <div style={{ height: '100%', borderRadius: 3, background: '#2E7D6B', width: `${progress}%`, transition: 'width 0.3s' }} />
            </div>
          </div>

          {/* Area navigation pills */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 16 }}>
            {AREAS.map((a, i) => (
              <button key={a.key} onClick={() => setAreaAtual(i)} style={{
                padding: '4px 10px', borderRadius: 12, border: 'none', cursor: 'pointer',
                fontSize: 11, fontWeight: i === areaAtual ? 'bold' : 'normal',
                background: i === areaAtual ? a.cor + '22' : '#F3F4F6',
                color: i === areaAtual ? a.cor : '#6B7280',
                outline: i === areaAtual ? `2px solid ${a.cor}` : 'none',
              }}>
                {a.label}
              </button>
            ))}
          </div>

          {/* Questions */}
          <div style={{ background: '#F9FAFB', borderRadius: 10, padding: 20, border: `2px solid ${area.cor}22` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <div style={{ width: 12, height: 12, borderRadius: '50%', background: area.cor }} />
              <span style={{ fontSize: 16, fontWeight: 'bold', color: '#0E1B2C' }}>{area.label}</span>
              <span style={{ fontSize: 12, color: area.cor, fontWeight: 'bold', background: area.cor + '18', padding: '3px 10px', borderRadius: 12 }}>{area.categoria}</span>
              <span style={{ marginLeft: 'auto', fontSize: 18, fontWeight: 'bold', color: area.cor }}>
                {areaValue(rodaData, area.key).toFixed(1)}
              </span>
            </div>
            {area.perguntas.map((q, qi) => (
              <div key={qi} style={{ marginBottom: qi < 4 ? 20 : 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 14, color: '#374151' }}>{q}</span>
                  <span style={{ fontSize: 14, fontWeight: 'bold', color: area.cor, minWidth: 24, textAlign: 'right' }}>{scores[qi]}</span>
                </div>
                <input type="range" min={0} max={10} value={scores[qi]}
                  onChange={e => setScore(area.key, qi, +e.target.value)}
                  style={{ width: '100%', accentColor: area.cor }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#9CA3AF' }}><span>0</span><span>10</span></div>
              </div>
            ))}
          </div>

          {/* Navigation buttons */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16 }}>
            <button onClick={() => areaAtual > 0 ? setAreaAtual(areaAtual - 1) : setMode('chart')} style={btnPrimary('#6B7280')}>Anterior</button>
            {areaAtual < n - 1
              ? <button onClick={() => setAreaAtual(areaAtual + 1)} style={btnPrimary()}>Próxima Área</button>
              : <button onClick={() => setMode('chart')} style={btnPrimary('#15803D')}>Ver Resultados</button>
            }
          </div>
        </div>
      )}

      {/* ── CHART MODE ── */}
      {mode === 'chart' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '420px 1fr', gap: '24px', alignItems: 'start' }}>
            {/* SVG Wheel */}
            <div style={{ background: '#F9FAFB', borderRadius: '12px', padding: '12px', textAlign: 'center' }}>
              <svg viewBox="0 0 400 400" style={{ width: '100%', maxWidth: 420 }}>
                {/* Concentric rings */}
                {[2, 4, 6, 8, 10].map(r => (
                  <polygon key={r}
                    points={Array.from({ length: n }, (_, i) => polarToXY(cx, cy, maxR * r / 10, i, n)).map(p => `${p.x},${p.y}`).join(' ')}
                    fill="none" stroke="#E5E7EB" strokeWidth={0.5} />
                ))}
                {/* Sector lines & labels */}
                {AREAS.map((a, i) => {
                  const p = polarToXY(cx, cy, maxR + 10, i, n)
                  const lp = polarToXY(cx, cy, maxR, i, n)
                  return (
                    <g key={a.key}>
                      <line x1={cx} y1={cy} x2={lp.x} y2={lp.y} stroke="#E5E7EB" strokeWidth={0.5} />
                      <text x={p.x} y={p.y} textAnchor="middle" dominantBaseline="middle"
                        fontSize={7} fill={hovered === a.key ? a.cor : '#6B7280'}
                        fontWeight={hovered === a.key ? 'bold' : 'normal'}>
                        {a.label}
                      </text>
                    </g>
                  )
                })}
                {/* Filled polygon */}
                <polygon points={polygonStr} fill="rgba(124,58,237,0.15)" stroke="#2E7D6B" strokeWidth={2} />
                {/* Data points */}
                {points.map((p, i) => (
                  <g key={AREAS[i].key}
                    onMouseEnter={() => setHovered(AREAS[i].key)}
                    onMouseLeave={() => setHovered(null)}
                    style={{ cursor: 'pointer' }}>
                    <circle cx={p.x} cy={p.y} r={hovered === AREAS[i].key ? 6 : 4} fill={AREAS[i].cor} />
                    <text x={p.x} y={p.y - 8} textAnchor="middle" fontSize={8} fill={AREAS[i].cor} fontWeight="bold">
                      {values[i].toFixed(1)}
                    </text>
                  </g>
                ))}
              </svg>

              {/* Start questionnaire button */}
              <button onClick={startQuestionnaire} style={{
                ...btnPrimary(), width: '100%', marginTop: 8, padding: '12px 20px'
              }}>
                Responder Questionário (60 perguntas)
              </button>
            </div>

            {/* Area list with scores and correlation */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {AREAS.map(a => {
                const val = areaValue(rodaData, a.key)
                const desvio = classificarDesvio(a.key)
                const corr = correlacao(a.key)
                const guaName = AREA_GUA_MAP[a.key]
                const setorPct = guaName ? findSetorScore(guaName) : null
                const isArray = isArrayFormat(rodaData, a.key)
                const aScores = areaScores(rodaData, a.key)

                return (
                  <div key={a.key} style={{
                    padding: '10px 14px', borderRadius: '8px',
                    background: hovered === a.key ? '#EAF4F1' : '#F9FAFB',
                    border: `1px solid ${hovered === a.key ? '#DCEFE9' : '#E5E7EB'}`,
                    transition: 'all 0.15s'
                  }}
                    onMouseEnter={() => setHovered(a.key)}
                    onMouseLeave={() => setHovered(null)}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: a.cor }} />
                        <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#374151' }}>{a.label}</span>
                        <span style={{ fontSize: '11px', color: '#9CA3AF' }}>
                          {a.categoria} {guaName ? `· Guá: ${guaName}` : ''}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{
                          fontSize: '10px', fontWeight: 'bold', padding: '2px 8px',
                          borderRadius: '10px', background: desvio.bg, color: desvio.cor
                        }}>{desvio.nivel}</span>
                        <span style={{ fontSize: '18px', fontWeight: 'bold', color: a.cor, minWidth: '28px', textAlign: 'right' }}>
                          {val.toFixed(1)}
                        </span>
                      </div>
                    </div>

                    {/* Score bar */}
                    <div style={{ height: 6, borderRadius: 3, background: '#E5E7EB', marginBottom: 4 }}>
                      <div style={{ height: '100%', borderRadius: 3, background: a.cor, width: `${val * 10}%`, transition: 'width 0.2s' }} />
                    </div>

                    {/* Show individual question scores if array format */}
                    {isArray && (
                      <div style={{ marginTop: 4 }}>
                        <button onClick={() => setExpandedArea(expandedArea === a.key ? null : a.key)} style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          fontSize: '11px', color: '#2E7D6B', fontWeight: 'bold', padding: '2px 0'
                        }}>
                          {expandedArea === a.key ? '▼' : '▶'} Detalhes das 5 perguntas
                        </button>
                        {expandedArea === a.key && (
                          <div style={{ marginTop: 6 }}>
                            {a.perguntas.map((q, qi) => (
                              <div key={qi} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, color: '#6B7280', marginBottom: 3, paddingLeft: 4 }}>
                                <span style={{ flex: 1 }}>{q}</span>
                                <span style={{ fontWeight: 'bold', color: a.cor, minWidth: 24, textAlign: 'right' }}>{aScores[qi]}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* If legacy single-number format, show simple slider */}
                    {!isArray && (
                      <div style={{ marginTop: 4 }}>
                        <input
                          type="range" min="0" max="10" step="1" value={typeof rodaData[a.key] === 'number' ? rodaData[a.key] as number : 5}
                          onChange={e => onChange({ ...rodaData, [a.key]: parseInt(e.target.value) })}
                          style={{ width: '100%', accentColor: a.cor, cursor: 'pointer', height: '6px' }}
                        />
                      </div>
                    )}

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
                background: saving ? '#9CA3AF' : '#2E7D6B',
                color: '#ffffff', border: 'none', borderRadius: '8px',
                fontSize: '15px', fontWeight: 'bold', cursor: saving ? 'not-allowed' : 'pointer'
              }}>{saving ? 'Salvando...' : 'Salvar Roda da Vida'}</button>
            </div>
          </div>

          {/* Category summary */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 12, marginTop: 16 }}>
            {CATEGORIAS.map(cat => {
              const v = catAvg(cat.areas)
              return (
                <div key={cat.key} style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 10, padding: 14 }}>
                  <div style={{ fontSize: 13, fontWeight: 'bold', color: cat.cor, marginBottom: 8 }}>{cat.label}</div>
                  <div style={{ height: 8, borderRadius: 4, background: '#E5E7EB' }}>
                    <div style={{ height: '100%', borderRadius: 4, background: cat.cor, width: `${v * 10}%` }} />
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 'bold', color: cat.cor, marginTop: 6 }}>{v.toFixed(1)}</div>
                  {cat.areas.map(ak => {
                    const a = AREAS.find(x => x.key === ak)!
                    const av = areaValue(rodaData, ak)
                    return (
                      <div key={ak} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#374151', marginTop: 4 }}>
                        <span>{a.label}</span><span style={{ fontWeight: 'bold', color: a.cor }}>{av.toFixed(1)}</span>
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>

          {/* Diagnostic comparison */}
          {setores.length > 0 && AREAS.some(a => areaValue(rodaData, a.key) > 0) && (
            <div style={{ marginTop: '16px', padding: '16px', background: '#EAF4F1', borderRadius: '10px', border: '1px solid #DCEFE9' }}>
              <h3 style={{ color: '#2E7D6B', fontSize: '14px', fontWeight: 'bold', margin: '0 0 8px 0' }}>
                Diagnóstico comparativo: Roda da Vida x Ba Guá
              </h3>

              {/* Explanatory text */}
              <div style={{ background: '#fff', borderRadius: '8px', padding: '12px', marginBottom: '14px', border: '1px solid #DCEFE9', fontSize: '12px', color: '#374151', lineHeight: 1.6 }}>
                <p style={{ margin: '0 0 6px 0' }}>
                  Este diagnóstico cruza a <strong>percepção subjetiva</strong> do cliente (Roda da Vida) com a <strong>análise objetiva</strong> do imóvel (Ba Guá):
                </p>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{ background: '#F0FDF4', color: '#15803D', padding: '3px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold' }}>Correlação alta = harmonia entre espaço e vida</span>
                  <span style={{ background: '#FFFBEB', color: '#D97706', padding: '3px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold' }}>Correlação moderada = monitorar</span>
                  <span style={{ background: '#FEF2F2', color: '#DC2626', padding: '3px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold' }}>Divergência = prioridade de intervenção</span>
                </div>
              </div>

              {AREAS.map(a => {
                const vidaScore = areaValue(rodaData, a.key)
                const guaName = AREA_GUA_MAP[a.key]
                const setorPct = guaName ? findSetorScore(guaName) : null
                if (vidaScore === 0 && setorPct === null) return null
                const corr = correlacao(a.key)
                return (
                  <div key={a.key} style={{ marginBottom: '10px', padding: '8px 10px', background: '#fff', borderRadius: '8px', border: '1px solid #DCEFE9' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', marginBottom: '4px' }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: a.cor }} />
                      <span style={{ width: '160px', fontWeight: 'bold', color: '#374151' }}>{a.label}</span>
                      <span style={{ color: '#6B7280' }}>Vida: {vidaScore.toFixed(1)}/10</span>
                      {setorPct !== null && <span style={{ color: '#6B7280' }}>Guá: {setorPct}%</span>}
                      {corr && <span style={{ fontWeight: 'bold', color: corr.cor }}>{corr.label}</span>}
                    </div>
                    {/* Consultant observation per area */}
                    {onChangeObservacoes && (
                      <textarea
                        value={observacoes[a.key] || ''}
                        onChange={e => onChangeObservacoes({ ...observacoes, [a.key]: e.target.value })}
                        placeholder={`Observação/recomendação do consultor para ${a.label}...`}
                        rows={1}
                        style={{
                          width: '100%', padding: '6px 8px', border: '1px solid #E5E7EB', borderRadius: '6px',
                          fontSize: '11px', color: '#374151', resize: 'vertical', boxSizing: 'border-box',
                          background: observacoes[a.key] ? '#FFFBEB' : '#F9FAFB'
                        }}
                      />
                    )}
                  </div>
                )
              }).filter(Boolean)}

              {/* General consultant observation */}
              {onChangeObservacaoGeral && (
                <div style={{ marginTop: '12px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#2E7D6B', marginBottom: '4px' }}>
                    Observação geral do consultor
                  </label>
                  <textarea
                    value={observacaoGeral}
                    onChange={e => onChangeObservacaoGeral(e.target.value)}
                    placeholder="Análise geral do diagnóstico comparativo, recomendações de intervenção, prioridades..."
                    rows={3}
                    style={{
                      width: '100%', padding: '10px 12px', border: '1px solid #D1D5DB', borderRadius: '8px',
                      fontSize: '13px', color: '#374151', resize: 'vertical', boxSizing: 'border-box',
                      background: observacaoGeral ? '#FFFBEB' : '#fff'
                    }}
                  />
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
