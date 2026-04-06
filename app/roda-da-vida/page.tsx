'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../src/lib/supabase'
import AppShell from '../components/AppShell'
import type { User } from '@supabase/supabase-js'

type Area = { key: string; label: string; categoria: string; cor: string; perguntas: string[] }
type Consulta = { id: string; nome_imovel: string; criado_em: string; clientes?: { nome_completo: string } | null; roda_da_vida?: any }
type Cliente = { id: string; nome_completo: string }
type Acao = { acao: string; data: string; estrategia: string }

const AREAS: Area[] = [
  { key: 'familia', label: 'Família', categoria: 'Relacionamentos', cor: '#15803D', perguntas: ['Tempo dedicado aos familiares','Momentos agradáveis com a família','Diálogo e boa vontade para resolver conflitos','Grau de abertura para falar e ouvir','Confiança e apoio mútuos'] },
  { key: 'relacao_amorosa', label: 'Relação Amorosa', categoria: 'Relacionamentos', cor: '#BE185D', perguntas: ['Tempo dedicado ao parceiro(a)','Grau de abertura para falar e ouvir','Satisfação com as relações íntimas','Criação de momentos românticos','Dividir sonhos e expectativas de vida'] },
  { key: 'vida_social', label: 'Vida Social', categoria: 'Relacionamentos', cor: '#D97706', perguntas: ['Festas e reuniões de amigos (periodicidade)','Esforço para manter contato com amigos','Número de amigos que encontra regularmente','Qualidade dos encontros com amigos','Participação em atividades em grupo'] },
  { key: 'espiritualidade', label: 'Espiritualidade', categoria: 'Qualidade de Vida', cor: '#7C3AED', perguntas: ['Paz interior','Coerência de valores (faz o que prega)','Força e equilíbrio internos','Tempo para si (reflexão meditação oração)','Religiosidade'] },
  { key: 'hobbies', label: 'Hobbies & Lazer', categoria: 'Qualidade de Vida', cor: '#0EA5E9', perguntas: ['Qualidade do tempo dedicado ao lazer','Variedade de formas para relaxar e se divertir','Prazer que as atividades proporcionam','Periodicidade das atividades de hobbie e lazer','Relaxamento ou revigoramento após as atividades'] },
  { key: 'plenitude', label: 'Plenitude', categoria: 'Qualidade de Vida', cor: '#F59E0B', perguntas: ['Otimismo em relação ao futuro','Satisfação com a vida atual','Frequência com que sorri','Confiança em você mesmo(a)','Orgulho pelas conquistas do passado'] },
  { key: 'contribuicao', label: 'Contribuição', categoria: 'Profissional', cor: '#10B981', perguntas: ['Desejo sincero pela prosperidade dos outros','Cordialidade com as pessoas em geral','Colocar-se à disposição para ajudar alguém','Dedicação ao ensinar o que sabe aos outros','Trabalhos voluntários ou doações'] },
  { key: 'financeiro', label: 'Financeiro', categoria: 'Profissional', cor: '#B8860B', perguntas: ['Satisfação com os rendimentos financeiros','Equilíbrio entre ganhos e gastos','Reservas para possíveis crises','Satisfação sobre investimentos no último ano','Oportunidades para o aumento da renda'] },
  { key: 'realizacao', label: 'Realização Profissional', categoria: 'Profissional', cor: '#6366F1', perguntas: ['Auto-imagem profissional positiva','Satisfação com a carreira','Oportunidades de crescimento profissional','Ambiente de trabalho proporciona desafios','Atividade profissional congruente com crenças e valores'] },
  { key: 'saude', label: 'Saúde', categoria: 'Pessoal', cor: '#DC2626', perguntas: ['Alimentação equilibrada','Exercícios físicos regulares','Horas de sono diárias adequadas','Controle do nível de stress','Check-up e exames de rotina'] },
  { key: 'emocional', label: 'Equilíbrio Emocional', categoria: 'Pessoal', cor: '#8B5CF6', perguntas: ['Reações emocionais proporcionais aos eventos','Controle das emoções sob pressão e stress','Manter o foco em momentos difíceis','Expressar opiniões de forma clara e cordial','Controle da frustração com expectativas não atingidas'] },
  { key: 'intelectual', label: 'Desenvolvimento Intelectual', categoria: 'Pessoal', cor: '#1D4ED8', perguntas: ['Participação em cursos e treinamentos','Leitura sobre temas diversos','Presença em atividades novas e não habituais','Manter-se informado(a)','Participação em conversas com assuntos diferentes dos habituais'] },
]

const CATEGORIAS = [
  { key: 'relacionamentos', label: 'Relacionamentos', areas: ['familia','relacao_amorosa','vida_social'], cor: '#BE185D' },
  { key: 'qualidade_vida', label: 'Qualidade de Vida', areas: ['espiritualidade','hobbies','plenitude'], cor: '#7C3AED' },
  { key: 'profissional', label: 'Profissional', areas: ['contribuicao','financeiro','realizacao'], cor: '#B8860B' },
  { key: 'pessoal', label: 'Pessoal', areas: ['saude','emocional','intelectual'], cor: '#DC2626' },
]

const defaultRespostas = (): Record<string, number[]> => Object.fromEntries(AREAS.map(a => [a.key, [5,5,5,5,5]]))
const defaultAcoes = (): Acao[] => [{ acao:'', data:'', estrategia:'' },{ acao:'', data:'', estrategia:'' },{ acao:'', data:'', estrategia:'' }]
const avg = (arr: number[]) => arr.reduce((s,v) => s+v, 0) / arr.length
const fmtDate = (d: string) => { try { return new Date(d).toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric'}) } catch { return d } }

function polar(cx: number, cy: number, r: number, i: number, total: number) {
  const a = (i * 2 * Math.PI / total) - Math.PI/2
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) }
}

function RadarChart({ respostas }: { respostas: Record<string, number[]> }) {
  const cx = 200, cy = 200, R = 160, n = 12
  const values = AREAS.map(a => avg(respostas[a.key] || [5,5,5,5,5]))
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
      <polygon points={poly} fill="rgba(124,58,237,0.15)" stroke="#7C3AED" strokeWidth={2} />
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

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/login'; return }
      setUser(user)
      const [c, cl] = await Promise.all([
        supabase.from('consultas').select('id, nome_imovel, criado_em, roda_da_vida, clientes(nome_completo)').eq('consultor_id', user.id).neq('status', 'deletada').order('criado_em', { ascending: false }),
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
    if (rd?.respostas) { setRespostas(rd.respostas); setAcoes(rd.acoes || defaultAcoes()); setPessoaNome(rd.pessoa_nome || '') }
    else { setRespostas(defaultRespostas()); setAcoes(defaultAcoes()); setPessoaNome('') }
    setStep('results')
  }

  function startNew() { setRespostas(defaultRespostas()); setAcoes(defaultAcoes()); setPessoaNome(''); setClienteId(null); setSelectedConsultaId(null); setStep('select_client') }

  function beginQuestionnaire() {
    if (!pessoaNome.trim()) { flash('Informe o nome da pessoa'); return }
    setAreaAtual(0); setStep('questionnaire')
  }

  function setScore(areaKey: string, qi: number, val: number) {
    setRespostas(prev => ({ ...prev, [areaKey]: prev[areaKey].map((v, i) => i === qi ? val : v) }))
  }

  async function salvar() {
    if (!user) return
    setSaving(true)
    const payload = { respostas, acoes, pessoa_nome: pessoaNome, created_at: new Date().toISOString() }
    let consultaId = selectedConsultaId
    if (!consultaId) {
      const { data, error } = await supabase.from('consultas').insert({ consultor_id: user.id, cliente_id: clienteId, nome_imovel: `Roda da Vida - ${pessoaNome}`, status: 'em_andamento', roda_da_vida: payload }).select('id').single()
      if (error) { flash('Erro: ' + error.message); setSaving(false); return }
      consultaId = data.id
      setSelectedConsultaId(consultaId)
    } else {
      const { error } = await supabase.from('consultas').update({ roda_da_vida: payload }).eq('id', consultaId)
      if (error) { flash('Erro: ' + error.message); setSaving(false); return }
    }
    // Refresh list
    const { data } = await supabase.from('consultas').select('id, nome_imovel, criado_em, roda_da_vida, clientes(nome_completo)').eq('consultor_id', user.id).neq('status', 'deletada').order('criado_em', { ascending: false })
    setConsultas((data || []) as unknown as Consulta[])
    setSaving(false)
    flash('Roda da Vida salva com sucesso!')
  }

  const area = AREAS[areaAtual]
  const catAvg = (keys: string[]) => { const vals = keys.map(k => avg(respostas[k] || [5,5,5,5,5])); return vals.reduce((s,v)=>s+v,0)/vals.length }
  const totalAvg = avg(AREAS.map(a => avg(respostas[a.key] || [5,5,5,5,5])))
  const progress = ((areaAtual + 1) / 12 * 100)

  const cardStyle: React.CSSProperties = { background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: 16, marginBottom: 12 }
  const btnPrimary = (bg = '#7C3AED'): React.CSSProperties => ({ padding: '10px 20px', borderRadius: 8, background: bg, color: '#fff', border: 'none', fontWeight: 'bold', fontSize: 14, cursor: 'pointer' })

  if (loading) return <AppShell currentPage="roda-da-vida"><div style={{ textAlign: 'center', padding: 80 }}><p style={{ color: '#7C3AED' }}>Carregando...</p></div></AppShell>

  return (
    <AppShell currentPage="roda-da-vida">
      {message && <div style={{ padding: '10px 16px', marginBottom: 16, borderRadius: 8, background: message.includes('Erro') ? '#FEF2F2' : '#F0FDF4', color: message.includes('Erro') ? '#DC2626' : '#15803D', fontSize: 14, fontWeight: 'bold', border: `1px solid ${message.includes('Erro') ? '#FECACA' : '#BBF7D0'}` }}>{message}</div>}

      {/* ── LIST STEP ── */}
      {step === 'list' && <>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <h1 style={{ color: '#1E3A5F', fontSize: 24, fontWeight: 'bold', margin: 0 }}>Roda da Vida</h1>
            <p style={{ color: '#6B7280', fontSize: 14, margin: '4px 0 0' }}>Questionário com 12 áreas da vida — 60 perguntas</p>
          </div>
          <button onClick={startNew} style={btnPrimary()}>+ Criar Roda da Vida</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 12 }}>
          {consultas.filter(c => c.roda_da_vida?.respostas).map(c => (
            <div key={c.id} onClick={() => openExisting(c)} style={{ ...cardStyle, cursor: 'pointer' }}>
              <div style={{ fontSize: 14, fontWeight: 'bold', color: '#1E3A5F' }}>{c.roda_da_vida?.pessoa_nome || c.clientes?.nome_completo || 'Sem nome'}</div>
              <div style={{ fontSize: 12, color: '#6B7280', marginTop: 4 }}>{c.nome_imovel} — {fmtDate(c.criado_em)}</div>
              <div style={{ fontSize: 12, color: '#7C3AED', marginTop: 4, fontWeight: 'bold' }}>Média geral: {avg(AREAS.map(a => avg(c.roda_da_vida?.respostas?.[a.key] || [5,5,5,5,5]))).toFixed(1)}</div>
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
      {step === 'select_client' && <>
        <h2 style={{ color: '#1E3A5F', fontSize: 20, marginBottom: 16 }}>Para quem é esta Roda da Vida?</h2>
        <div style={cardStyle}>
          <label style={{ fontSize: 14, fontWeight: 'bold', color: '#374151', display: 'block', marginBottom: 6 }}>Nome da pessoa</label>
          <input value={pessoaNome} onChange={e => setPessoaNome(e.target.value)} placeholder="Digite o nome..." style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #D1D5DB', fontSize: 14, boxSizing: 'border-box' }} />
        </div>
        {clientes.length > 0 && <div style={cardStyle}>
          <label style={{ fontSize: 14, fontWeight: 'bold', color: '#374151', display: 'block', marginBottom: 6 }}>Ou selecione um cliente existente</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {clientes.map(cl => (
              <button key={cl.id} onClick={() => { setClienteId(cl.id); setPessoaNome(cl.nome_completo) }}
                style={{ padding: '6px 14px', borderRadius: 20, border: clienteId === cl.id ? '2px solid #7C3AED' : '1px solid #D1D5DB', background: clienteId === cl.id ? '#F5F0FF' : '#fff', fontSize: 13, cursor: 'pointer', color: '#374151' }}>
                {cl.nome_completo}
              </button>
            ))}
          </div>
        </div>}
        <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
          <button onClick={() => setStep('list')} style={{ ...btnPrimary('#6B7280') }}>Voltar</button>
          <button onClick={beginQuestionnaire} style={btnPrimary()}>Iniciar Questionário</button>
        </div>
      </>}

      {/* ── QUESTIONNAIRE ── */}
      {step === 'questionnaire' && area && <>
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <h2 style={{ margin: 0, fontSize: 18, color: '#1E3A5F' }}>{areaAtual + 1}/12 — {area.label}</h2>
            <span style={{ fontSize: 12, color: area.cor, fontWeight: 'bold', background: area.cor + '18', padding: '4px 10px', borderRadius: 12 }}>{area.categoria}</span>
          </div>
          <div style={{ height: 6, borderRadius: 3, background: '#E5E7EB' }}>
            <div style={{ height: '100%', borderRadius: 3, background: '#7C3AED', width: `${progress}%`, transition: 'width 0.3s' }} />
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
          <button onClick={() => areaAtual > 0 ? setAreaAtual(areaAtual - 1) : setStep('select_client')} style={btnPrimary('#6B7280')}>Anterior</button>
          {areaAtual < 11
            ? <button onClick={() => setAreaAtual(areaAtual + 1)} style={btnPrimary()}>Próxima Área</button>
            : <button onClick={() => setStep('results')} style={btnPrimary('#15803D')}>Ver Resultados</button>
          }
        </div>
      </>}

      {/* ── RESULTS ── */}
      {step === 'results' && <>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 20, color: '#1E3A5F' }}>Resultados — {pessoaNome || 'Roda da Vida'}</h2>
            <p style={{ margin: '4px 0 0', fontSize: 14, color: '#6B7280' }}>Média geral: <b style={{ color: '#7C3AED' }}>{totalAvg.toFixed(1)}</b></p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => { setAreaAtual(0); setStep('questionnaire') }} style={btnPrimary('#6B7280')}>Editar</button>
            <button onClick={salvar} disabled={saving} style={btnPrimary()}>{saving ? 'Salvando...' : 'Salvar'}</button>
            <button onClick={() => setStep('list')} style={btnPrimary('#1E3A5F')}>Voltar</button>
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
                  <div style={{ height: '100%', borderRadius: 4, background: cat.cor, width: `${v*10}%` }} />
                </div>
                <div style={{ fontSize: 20, fontWeight: 'bold', color: cat.cor, marginTop: 6 }}>{v.toFixed(1)}</div>
                {cat.areas.map(ak => {
                  const a = AREAS.find(x => x.key === ak)!
                  const av = avg(respostas[ak] || [5,5,5,5,5])
                  return <div key={ak} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#374151', marginTop: 4 }}>
                    <span>{a.label}</span><span style={{ fontWeight: 'bold', color: a.cor }}>{av.toFixed(1)}</span>
                  </div>
                })}
              </div>
            )
          })}
        </div>

        {/* Action Plan */}
        <div style={cardStyle}>
          <h3 style={{ margin: '0 0 12px', fontSize: 16, color: '#1E3A5F' }}>Plano de Ação</h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>{['#','Ação','Data','Estratégia'].map(h => <th key={h} style={{ textAlign: 'left', padding: '8px 6px', borderBottom: '2px solid #E5E7EB', color: '#6B7280', fontWeight: 'bold' }}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {acoes.map((a, i) => (
                  <tr key={i}>
                    <td style={{ padding: '6px', color: '#9CA3AF', width: 30 }}>{i + 1}</td>
                    {(['acao','data','estrategia'] as const).map(field => (
                      <td key={field} style={{ padding: '4px 6px' }}>
                        <input value={a[field]} onChange={e => setAcoes(prev => prev.map((x, j) => j === i ? { ...x, [field]: e.target.value } : x))}
                          type={field === 'data' ? 'date' : 'text'}
                          placeholder={field === 'acao' ? 'O que fazer?' : field === 'data' ? '' : 'Como fazer?'}
                          style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #D1D5DB', fontSize: 13, boxSizing: 'border-box' }} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </>}
    </AppShell>
  )
}
