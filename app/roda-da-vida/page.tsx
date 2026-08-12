'use client'

import { mediaDaArea, mediaGeral, notasDaArea } from '../../src/lib/roda-da-vida'
import { redirecionarParaLogin } from '../../src/lib/auth-rotas'
import { useEffect, useState } from 'react'
import { supabase } from '../../src/lib/supabase'
import AppShell from '../components/AppShell'
import type { User } from '@supabase/supabase-js'
import { AREAS, CATEGORIAS, avg, defaultRespostas } from '../../src/lib/roda-da-vida-constants'
import { ChevronDown, ChevronRight, CheckCircle2 } from 'lucide-react'

type RodaDaVidaData = {
  respostas?: Record<string, number[]>
  acoes?: Record<string, string>[]
  pessoa_nome?: string
  observacoes?: Record<string, string>
  observacao_geral?: string
}
type Consulta = { id: string; nome_imovel: string; criado_em: string; cliente_id?: string | null; clientes?: { nome_completo: string } | null; roda_da_vida?: RodaDaVidaData | null }
type Cliente = { id: string; nome_completo: string }
type Acao = { acao: string; categoria: string; data_inicio: string; data_fim: string; estrategia: string; observacoes: string }

const novaAcao = (): Acao => ({ acao: '', categoria: '', data_inicio: '', data_fim: '', estrategia: '', observacoes: '' })
const defaultAcoes = (): Acao[] => [novaAcao()]

function classificar(val: number): { nivel: string; cor: string; bg: string } {
  if (val >= 8) return { nivel: 'Ótimo', cor: '#15803D', bg: '#F0FDF4' }
  if (val >= 5) return { nivel: 'Leve', cor: '#2563EB', bg: '#EFF6FF' }
  if (val >= 3) return { nivel: 'Moderado', cor: '#D97706', bg: '#FFFBEB' }
  if (val >= 1) return { nivel: 'Acentuado', cor: '#DC2626', bg: '#FEF2F2' }
  return { nivel: 'Ausente', cor: '#7F1D1D', bg: '#FEF2F2' }
}
const fmtDate = (d: string) => { try { return new Date(d).toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric'}) } catch { return d } }

function polar(cx: number, cy: number, r: number, i: number, total: number) {
  const a = (i * 2 * Math.PI / total) - Math.PI/2
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) }
}

function RadarChart({ respostas }: { respostas: Record<string, number[]> }) {
  const cx = 200, cy = 200, R = 160, n = 12
  const values = AREAS.map(a => mediaDaArea(respostas[a.key]) ?? 0)
  const rings = [2,4,6,8,10]
  const pts = values.map((v, i) => polar(cx, cy, R * v / 10, i, n))
  const poly = pts.map(p => `${p.x},${p.y}`).join(' ')
  return (
    <svg viewBox="0 0 400 400" style={{ width: '100%', maxWidth: 420 }}>
      {rings.map(r => <polygon key={r} points={Array.from({length:n},(_,i) => polar(cx,cy,R*r/10,i,n)).map(p=>`${p.x},${p.y}`).join(' ')} fill="none" stroke="#E5E7EB" strokeWidth={0.5} />)}
      {AREAS.map((a, i) => {
        const p = polar(cx, cy, R + 8, i, n)
        const lp = polar(cx, cy, R, i, n)
        return <g key={a.key}>
          <line x1={cx} y1={cy} x2={lp.x} y2={lp.y} stroke="#E5E7EB" strokeWidth={0.5} />
          <text x={p.x} y={p.y} textAnchor="middle" dominantBaseline="middle" fontSize={8} fill={a.cor} fontWeight="bold">{a.label}</text>
        </g>
      })}
      <polygon points={poly} fill="rgba(46,125,107,0.15)" stroke="#2E7D6B" strokeWidth={2} />
      {pts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={4} fill={AREAS[i].cor} />)}
      {pts.map((p, i) => <text key={'t'+i} x={p.x} y={p.y - 8} textAnchor="middle" fontSize={8} fill={AREAS[i].cor} fontWeight="bold">{values[i].toFixed(1)}</text>)}
    </svg>
  )
}

export default function RodaDaVidaPage() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [step, setStep] = useState<'list'|'select_client'|'questionnaire'|'results'>('list')
  const [areaAtual, setAreaAtual] = useState(0)
  const [respostas, setRespostas] = useState<Record<string, number[]>>(defaultRespostas())
  const [acoes, setAcoes] = useState<Acao[]>(defaultAcoes())
  const [pessoaNome, setPessoaNome] = useState('')
  const [clienteId, setClienteId] = useState<string | null>(null)
  const [selectedConsultaId, setSelectedConsultaId] = useState<string | null>(null)
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [consultas, setConsultas] = useState<Consulta[]>([])
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [observacoes, setObservacoes] = useState<Record<string, string>>({})
  const [observacaoGeral, setObservacaoGeral] = useState('')
  const [expandedArea, setExpandedArea] = useState<string | null>(null)

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { redirecionarParaLogin(); return }
      setUser(user)
      const [c, cl] = await Promise.all([
        supabase.from('consultas').select('id, nome_imovel, criado_em, cliente_id, roda_da_vida, clientes(nome_completo)').eq('consultor_id', user.id).neq('status', 'deletada').order('criado_em', { ascending: false }),
        supabase.from('clientes').select('id, nome_completo').eq('consultor_id', user.id).order('nome_completo'),
      ])
      setConsultas((c.data || []) as unknown as Consulta[])
      setClientes((cl.data || []) as Cliente[])
      setLoading(false)
    })()
  }, [])

  const flash = (msg: string) => { setMessage(msg); setTimeout(() => setMessage(''), 3000) }

  function openExisting(consulta: Consulta) {
    setSelectedConsultaId(consulta.id)
    const rd = consulta.roda_da_vida
    if (rd?.respostas) {
      setRespostas(rd.respostas)
      // Migrate old actions format to new
      const rawAcoes = rd.acoes || []
      const migratedAcoes = rawAcoes.map((a: Record<string, string>) => ({
        acao: a.acao || '', categoria: a.categoria || '', data_inicio: a.data_inicio || a.data || '',
        data_fim: a.data_fim || '', estrategia: a.estrategia || '', observacoes: a.observacoes || '',
      }))
      setAcoes(migratedAcoes.length > 0 ? migratedAcoes : defaultAcoes())
      setPessoaNome(rd.pessoa_nome || ''); setObservacoes(rd.observacoes || {}); setObservacaoGeral(rd.observacao_geral || '')
    } else {
      setRespostas(defaultRespostas()); setAcoes(defaultAcoes()); setPessoaNome(''); setObservacoes({}); setObservacaoGeral('')
    }
    setStep('results')
  }

  function startNew() { setRespostas(defaultRespostas()); setAcoes(defaultAcoes()); setPessoaNome(''); setClienteId(null); setSelectedConsultaId(null); setStep('select_client') }

  function beginQuestionnaire() {
    if (!pessoaNome.trim()) { flash('Informe o nome da pessoa'); return }
    // If editing existing roda, load its data
    if (selectedConsultaId) {
      const c = consultas.find(x => x.id === selectedConsultaId)
      if (c?.roda_da_vida?.respostas) {
        setRespostas(c.roda_da_vida.respostas)
        setAcoes((c.roda_da_vida.acoes as unknown as Acao[]) || defaultAcoes())
      }
    }
    setAreaAtual(0); setStep('questionnaire')
  }

  function setScore(areaKey: string, qi: number, val: number) {
    setRespostas(prev => ({ ...prev, [areaKey]: prev[areaKey].map((v, i) => i === qi ? val : v) }))
  }

  async function salvar() {
    if (!user) return
    setSaving(true)
    const payload = { respostas, acoes, pessoa_nome: pessoaNome, observacoes, observacao_geral: observacaoGeral, created_at: new Date().toISOString() }
    let cId = clienteId
    let consultaId = selectedConsultaId

    // If no client selected and name provided, create a new client
    if (!cId && pessoaNome.trim()) {
      const { data: newClient, error: clientError } = await supabase
        .from('clientes')
        .insert({ consultor_id: user.id, nome_completo: pessoaNome.trim(), ativo: true })
        .select('id')
        .single()
      if (clientError) { flash('Erro ao criar cliente: ' + clientError.message); setSaving(false); return }
      cId = newClient.id
      setClienteId(cId)
      // Refresh clients list
      const { data: cls } = await supabase.from('clientes').select('id, nome_completo').eq('consultor_id', user.id).order('nome_completo')
      setClientes((cls || []) as Cliente[])
    }

    if (!consultaId) {
      // Create new consultation linked to client
      const { data, error } = await supabase.from('consultas').insert({
        consultor_id: user.id,
        cliente_id: cId,
        nome_imovel: `Roda da Vida - ${pessoaNome}`,
        status: 'em_andamento',
        roda_da_vida: payload,
      }).select('id').single()
      if (error) { flash('Erro: ' + error.message); setSaving(false); return }
      consultaId = data.id
      setSelectedConsultaId(consultaId)
    } else {
      const { error } = await supabase.from('consultas').update({ roda_da_vida: payload }).eq('id', consultaId)
      if (error) { flash('Erro: ' + error.message); setSaving(false); return }
    }
    // Refresh list
    const { data } = await supabase.from('consultas').select('id, nome_imovel, criado_em, cliente_id, roda_da_vida, clientes(nome_completo)').eq('consultor_id', user.id).neq('status', 'deletada').order('criado_em', { ascending: false })
    setConsultas((data || []) as unknown as Consulta[])
    setSaving(false)
    flash('Roda da Vida salva com sucesso!')
  }

  const area = AREAS[areaAtual]
  const catAvg = (keys: string[]) => mediaGeral(respostas, keys)
  const totalAvg = mediaGeral(respostas, AREAS.map(a => a.key))
  const progress = ((areaAtual + 1) / 12 * 100)

  const cardStyle: React.CSSProperties = { background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: 16, marginBottom: 12 }
  const btnPrimary = (bg = '#2E7D6B'): React.CSSProperties => ({ padding: '10px 20px', borderRadius: 8, background: bg, color: '#fff', border: 'none', fontWeight: 'bold', fontSize: 14, cursor: 'pointer' })

  if (loading) return <AppShell currentPage="roda-da-vida"><div style={{ textAlign: 'center', padding: 80 }}><p style={{ color: '#2E7D6B' }}>Carregando...</p></div></AppShell>

  return (
    <AppShell currentPage="roda-da-vida">
      {message && <div style={{ padding: '10px 16px', marginBottom: 16, borderRadius: 8, background: message.includes('Erro') ? '#FEF2F2' : '#F0FDF4', color: message.includes('Erro') ? '#DC2626' : '#15803D', fontSize: 14, fontWeight: 'bold', border: `1px solid ${message.includes('Erro') ? '#FECACA' : '#BBF7D0'}` }}>{message}</div>}

      {/* ── LIST STEP ── */}
      {step === 'list' && <>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <h1 style={{ color: '#0E1B2C', fontSize: 24, fontWeight: 'bold', margin: 0 }}>Roda da Vida</h1>
            <p style={{ color: '#6B7280', fontSize: 14, margin: '4px 0 0' }}>Questionário com 12 áreas da vida — 60 perguntas</p>
          </div>
          <button type="button" onClick={startNew} style={btnPrimary()}>+ Criar Roda da Vida</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 12 }}>
          {consultas.filter(c => c.roda_da_vida?.respostas).map(c => (
            <div key={c.id} onClick={() => openExisting(c)} style={{ ...cardStyle, cursor: 'pointer' }}>
              <div style={{ fontSize: 14, fontWeight: 'bold', color: '#0E1B2C' }}>{c.roda_da_vida?.pessoa_nome || c.clientes?.nome_completo || 'Sem nome'}</div>
              <div style={{ fontSize: 12, color: '#6B7280', marginTop: 4 }}>{c.nome_imovel} — {fmtDate(c.criado_em)}</div>
              <div style={{ fontSize: 12, color: '#2E7D6B', marginTop: 4, fontWeight: 'bold' }}>Média geral: {mediaGeral(c.roda_da_vida?.respostas ?? {}, AREAS.map(a => a.key))?.toFixed(1) ?? '—'}</div>
            </div>
          ))}
          {consultas.filter(c => c.roda_da_vida?.respostas).length === 0 && (
            <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: 48, ...cardStyle }}>
              <p style={{ color: '#6B7280', margin: 0 }}>Nenhuma Roda da Vida criada ainda</p>
            </div>
          )}
        </div>
      </>}

      {/* ── SELECT CLIENT ── */}
      {step === 'select_client' && (() => {
        const consultasDoCliente = clienteId
          ? consultas.filter(c => c.cliente_id === clienteId)
          : []
        return <>
          <h2 style={{ color: '#0E1B2C', fontSize: 20, marginBottom: 16 }}>Para quem é esta Roda da Vida?</h2>

          {/* Option 1: Select existing client */}
          {clientes.length > 0 && <div style={cardStyle}>
            <label style={{ fontSize: 14, fontWeight: 'bold', color: '#374151', display: 'block', marginBottom: 6 }}>Selecione um cliente existente</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {clientes.map(cl => (
                <button type="button" key={cl.id} onClick={() => { setClienteId(cl.id); setPessoaNome(cl.nome_completo); setSelectedConsultaId(null) }}
                  style={{ padding: '6px 14px', borderRadius: 20, border: clienteId === cl.id ? '2px solid #2E7D6B' : '1px solid #D1D5DB', background: clienteId === cl.id ? '#EAF4F1' : '#fff', fontSize: 13, cursor: 'pointer', color: '#374151' }}>
                  {cl.nome_completo}
                </button>
              ))}
            </div>
          </div>}

          {/* If client selected, show their consultations */}
          {clienteId && consultasDoCliente.length > 0 && <div style={cardStyle}>
            <label style={{ fontSize: 14, fontWeight: 'bold', color: '#374151', display: 'block', marginBottom: 6 }}>Vincular a uma consulta existente?</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {consultasDoCliente.map(c => (
                <button type="button" key={c.id} onClick={() => { setSelectedConsultaId(c.id); if (c.roda_da_vida?.respostas) { setRespostas(c.roda_da_vida.respostas); setAcoes((c.roda_da_vida.acoes as unknown as Acao[]) || defaultAcoes()) } }}
                  style={{ textAlign: 'left', padding: '10px 14px', borderRadius: 8, border: selectedConsultaId === c.id ? '2px solid #2E7D6B' : '1px solid #D1D5DB', background: selectedConsultaId === c.id ? '#EAF4F1' : '#fff', cursor: 'pointer' }}>
                  <div style={{ fontSize: 14, fontWeight: 'bold', color: '#0E1B2C' }}>{c.nome_imovel}</div>
                  <div style={{ fontSize: 12, color: '#6B7280', display: 'flex', alignItems: 'center', gap: 4 }}>{fmtDate(c.criado_em)} {c.roda_da_vida?.respostas ? <><span aria-hidden="true">—</span><CheckCircle2 size={12} strokeWidth={2} color="#2E7D6B" aria-hidden="true" /> Já tem Roda da Vida</> : ''}</div>
                </button>
              ))}
              <button type="button" onClick={() => setSelectedConsultaId(null)}
                style={{ textAlign: 'left', padding: '10px 14px', borderRadius: 8, border: selectedConsultaId === null ? '2px solid #2E7D6B' : '1px dashed #D1D5DB', background: selectedConsultaId === null ? '#EAF4F1' : '#fff', cursor: 'pointer', fontSize: 13, color: '#2E7D6B', fontWeight: 'bold' }}>
                + Criar nova consulta para este cliente
              </button>
            </div>
          </div>}

          {/* Option 2: New person (not a client yet) */}
          <div style={cardStyle}>
            <label style={{ fontSize: 14, fontWeight: 'bold', color: '#374151', display: 'block', marginBottom: 6 }}>
              {clienteId ? 'Nome confirmado' : 'Ou digite o nome de uma nova pessoa'}
            </label>
            <input value={pessoaNome} onChange={e => { setPessoaNome(e.target.value); if (!clientes.find(c => c.nome_completo === e.target.value)) setClienteId(null) }}
              placeholder="Digite o nome..." style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #D1D5DB', fontSize: 14, boxSizing: 'border-box' }} />
            {!clienteId && pessoaNome.trim() && (
              <p style={{ fontSize: 12, color: '#D97706', marginTop: 6 }}>Um novo cliente será criado automaticamente</p>
            )}
          </div>

          <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
            <button type="button" onClick={() => setStep('list')} style={{ ...btnPrimary('#6B7280') }}>Voltar</button>
            <button type="button" onClick={beginQuestionnaire} style={btnPrimary()}>
              {selectedConsultaId && consultas.find(c => c.id === selectedConsultaId)?.roda_da_vida?.respostas ? 'Editar Roda da Vida' : 'Iniciar Questionário'}
            </button>
          </div>
        </>
      })()}

      {/* ── QUESTIONNAIRE ── */}
      {step === 'questionnaire' && area && <>
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <h2 style={{ margin: 0, fontSize: 18, color: '#0E1B2C' }}>{areaAtual + 1}/12 — {area.label}</h2>
            <span style={{ fontSize: 12, color: area.cor, fontWeight: 'bold', background: area.cor + '18', padding: '4px 10px', borderRadius: 12 }}>{area.categoria}</span>
          </div>
          <div style={{ height: 6, borderRadius: 3, background: '#E5E7EB' }}>
            <div style={{ height: '100%', borderRadius: 3, background: '#2E7D6B', width: `${progress}%`, transition: 'width 0.3s' }} />
          </div>
        </div>
        <div style={cardStyle}>
          {area.perguntas.map((q, qi) => (
            <div key={qi} style={{ marginBottom: qi < 4 ? 20 : 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 14, color: '#374151' }}>{q}</span>
                <span style={{ fontSize: 14, fontWeight: 'bold', color: area.cor, minWidth: 24, textAlign: 'right' }}>{respostas[area.key][qi]}</span>
              </div>
              <input type="range" min={0} max={10} value={respostas[area.key][qi]} onChange={e => setScore(area.key, qi, +e.target.value)}
                style={{ width: '100%', accentColor: area.cor }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#9CA3AF' }}><span>0</span><span>10</span></div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12 }}>
          <button type="button" onClick={() => areaAtual > 0 ? setAreaAtual(areaAtual - 1) : setStep('select_client')} style={btnPrimary('#6B7280')}>Anterior</button>
          {areaAtual < 11
            ? <button type="button" onClick={() => setAreaAtual(areaAtual + 1)} style={btnPrimary()}>Próxima Área</button>
            : <button type="button" onClick={() => setStep('results')} style={btnPrimary('#15803D')}>Ver Resultados</button>
          }
        </div>
      </>}

      {/* ── RESULTS ── */}
      {step === 'results' && <>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 20, color: '#0E1B2C' }}>Resultados — {pessoaNome || 'Roda da Vida'}</h2>
            <p style={{ margin: '4px 0 0', fontSize: 14, color: '#6B7280' }}>Média geral: <b style={{ color: '#2E7D6B' }}>{totalAvg?.toFixed(1) ?? '—'}</b></p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={() => { setAreaAtual(0); setStep('questionnaire') }} style={btnPrimary('#6B7280')}>Editar</button>
            <button type="button" onClick={salvar} disabled={saving} style={btnPrimary()}>{saving ? 'Salvando...' : 'Salvar'}</button>
            <button type="button" onClick={() => setStep('list')} style={btnPrimary('#0E1B2C')}>Voltar</button>
          </div>
        </div>

        {/* Radar Chart */}
        <div style={{ ...cardStyle, textAlign: 'center' }}>
          <RadarChart respostas={respostas} />
        </div>

        {/* Category bars */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 12, marginBottom: 16 }}>
          {CATEGORIAS.map(cat => {
            const v = catAvg(cat.areas)
            return (
              <div key={cat.key} style={cardStyle}>
                <div style={{ fontSize: 13, fontWeight: 'bold', color: cat.cor, marginBottom: 8 }}>{cat.label}</div>
                <div style={{ height: 8, borderRadius: 4, background: '#E5E7EB' }}>
                  <div style={{ height: '100%', borderRadius: 4, background: cat.cor, width: `${(v ?? 0)*10}%` }} />
                </div>
                <div style={{ fontSize: 20, fontWeight: 'bold', color: cat.cor, marginTop: 6 }}>{v?.toFixed(1) ?? '—'}</div>
                {cat.areas.map(ak => {
                  const a = AREAS.find(x => x.key === ak)!
                  const av = mediaDaArea(respostas[ak])
                  return <div key={ak} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#374151', marginTop: 4 }}>
                    <span>{a.label}</span><span style={{ fontWeight: 'bold', color: a.cor }}>{av?.toFixed(1) ?? '—'}</span>
                  </div>
                })}
              </div>
            )
          })}
        </div>

        {/* Detailed area list with observations */}
        <div style={cardStyle}>
          <h3 style={{ margin: '0 0 12px', fontSize: 16, color: '#0E1B2C' }}>Detalhamento por Área</h3>
          {AREAS.map(a => {
            const scores = notasDaArea(respostas[a.key])
            // `null` significa pergunta não respondida — não entra na média.
            const areaAvg = mediaDaArea(respostas[a.key]) ?? 0
            const cls = classificar(areaAvg)
            const expanded = expandedArea === a.key
            return (
              <div key={a.key} style={{ padding: '10px 12px', marginBottom: 8, borderRadius: 8, border: '1px solid #E5E7EB', background: '#F9FAFB' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: a.cor }} />
                  <span style={{ flex: 1, fontWeight: 'bold', fontSize: 13, color: '#374151' }}>{a.label}</span>
                  <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: cls.bg, color: cls.cor, fontWeight: 'bold' }}>{cls.nivel}</span>
                  <span style={{ fontSize: 16, fontWeight: 'bold', color: a.cor }}>{areaAvg.toFixed(1)}</span>
                </div>
                <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 4 }}>{a.categoria}</div>
                <button type="button" onClick={() => setExpandedArea(expanded ? null : a.key)} style={{ background: 'none', border: 'none', fontSize: 11, color: '#2E7D6B', cursor: 'pointer', padding: 0, fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  {expanded ? <ChevronDown size={13} strokeWidth={2.5} aria-hidden="true" /> : <ChevronRight size={13} strokeWidth={2.5} aria-hidden="true" />} Detalhes das 5 perguntas
                </button>
                {expanded && (
                  <div style={{ marginTop: 6, paddingLeft: 16 }}>
                    {a.perguntas.map((q, qi) => (
                      <div key={qi} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#374151', padding: '3px 0' }}>
                        <span>{q}</span>
                        <span style={{ fontWeight: 'bold', color: a.cor }}>{scores[qi]}</span>
                      </div>
                    ))}
                  </div>
                )}
                {/* Consultant observation */}
                <textarea
                  value={observacoes[a.key] || ''}
                  onChange={e => setObservacoes(prev => ({ ...prev, [a.key]: e.target.value }))}
                  placeholder={`Observação/recomendação para ${a.label}...`}
                  rows={1}
                  style={{
                    width: '100%', marginTop: 6, padding: '6px 8px', border: '1px solid #E5E7EB', borderRadius: 6,
                    fontSize: 11, color: '#374151', resize: 'vertical', boxSizing: 'border-box' as const,
                    background: observacoes[a.key] ? '#FFFBEB' : '#fff'
                  }}
                />
              </div>
            )
          })}
          {/* General observation */}
          <div style={{ marginTop: 12 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 'bold', color: '#2E7D6B', marginBottom: 4 }}>Observação geral do consultor</label>
            <textarea
              value={observacaoGeral}
              onChange={e => setObservacaoGeral(e.target.value)}
              placeholder="Análise geral, recomendações de intervenção, prioridades..."
              rows={3}
              style={{
                width: '100%', padding: '10px 12px', border: '1px solid #D1D5DB', borderRadius: 8,
                fontSize: 13, color: '#374151', resize: 'vertical', boxSizing: 'border-box' as const,
                background: observacaoGeral ? '#FFFBEB' : '#fff'
              }}
            />
          </div>
        </div>

        {/* Action Plan */}
        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ margin: 0, fontSize: 16, color: '#0E1B2C' }}>Plano de Ação</h3>
            <button type="button" onClick={() => setAcoes(prev => [...prev, novaAcao()])} style={{ padding: '6px 16px', background: '#2E7D6B', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 'bold', cursor: 'pointer' }}>+ Nova Ação</button>
          </div>
          {acoes.map((a, i) => (
            <div key={i} style={{ padding: 14, marginBottom: 12, borderRadius: 10, border: '1px solid #E5E7EB', background: '#F9FAFB', position: 'relative' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 'bold', color: '#0E1B2C' }}>Ação {i + 1}</span>
                {acoes.length > 1 && (
                  <button type="button" onClick={() => setAcoes(prev => prev.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', color: '#DC2626', cursor: 'pointer', fontSize: 16 }}>×</button>
                )}
              </div>
              <div style={{ marginBottom: 8 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 'bold', color: '#6B7280', marginBottom: 2 }}>Descrição da ação</label>
                <input value={a.acao} onChange={e => setAcoes(prev => prev.map((x, j) => j === i ? { ...x, acao: e.target.value } : x))}
                  placeholder="O que fazer?" style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #D1D5DB', fontSize: 13, boxSizing: 'border-box' as const }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 'bold', color: '#6B7280', marginBottom: 2 }}>Categoria de impacto</label>
                  <select value={a.categoria} onChange={e => setAcoes(prev => prev.map((x, j) => j === i ? { ...x, categoria: e.target.value } : x))}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #D1D5DB', fontSize: 12, boxSizing: 'border-box' as const }}>
                    <option value="">Selecione...</option>
                    {CATEGORIAS.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 'bold', color: '#6B7280', marginBottom: 2 }}>Data início</label>
                  <input type="date" value={a.data_inicio} onChange={e => setAcoes(prev => prev.map((x, j) => j === i ? { ...x, data_inicio: e.target.value } : x))}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #D1D5DB', fontSize: 12, boxSizing: 'border-box' as const }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 'bold', color: '#6B7280', marginBottom: 2 }}>Data fim / Reavaliação</label>
                  <input type="date" value={a.data_fim} onChange={e => setAcoes(prev => prev.map((x, j) => j === i ? { ...x, data_fim: e.target.value } : x))}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #D1D5DB', fontSize: 12, boxSizing: 'border-box' as const }} />
                </div>
              </div>
              <div style={{ marginBottom: 8 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 'bold', color: '#6B7280', marginBottom: 2 }}>Estratégia de ação</label>
                <textarea value={a.estrategia} onChange={e => setAcoes(prev => prev.map((x, j) => j === i ? { ...x, estrategia: e.target.value } : x))}
                  placeholder="Como colocar em prática?" rows={2}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #D1D5DB', fontSize: 12, resize: 'vertical', boxSizing: 'border-box' as const }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 'bold', color: '#6B7280', marginBottom: 2 }}>Observações e recomendações</label>
                <textarea value={a.observacoes} onChange={e => setAcoes(prev => prev.map((x, j) => j === i ? { ...x, observacoes: e.target.value } : x))}
                  placeholder="Notas adicionais..." rows={2}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #D1D5DB', fontSize: 12, resize: 'vertical', boxSizing: 'border-box' as const }} />
              </div>
            </div>
          ))}
        </div>
      </>}
    </AppShell>
  )
}
