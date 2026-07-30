'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '../../src/lib/supabase'
import AppShell from '../components/AppShell'
import Skeleton from '../components/Skeleton'
import type { SetorBagua } from '../../src/lib/types'
import { ELEMENTOS } from '../../src/lib/curas'
import { BookOpen, Gem, Leaf, Amphora, MapPin, Flower2, AudioLines } from 'lucide-react'

interface CuraCustomRef {
  id: string
  setor_id: string
  tipo: string
  nome: string
  descricao?: string | null
  como_utilizar?: string | null
}


// ══════════════════════════════════════════════════════════════════════════════
// PAGE COMPONENT
// ══════════════════════════════════════════════════════════════════════════════

function CurasPageContent() {
  const searchParams = useSearchParams()
  const consultaId = searchParams.get('consultaId')
  const [setores, setSetores] = useState<SetorBagua[]>([])
  const [loading, setLoading] = useState(true)
  const [activeSection, setActiveSection] = useState(ELEMENTOS[0].id)
  const [filtroSetor, setFiltroSetor] = useState<string>('todos')
  const [filtroTipo, setFiltroTipo] = useState<string>('todos')
  const [consulta, setConsulta] = useState<{ nome_imovel: string; criado_em: string; clientes?: { nome_completo: string } | null } | null>(null)
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({})

  // Consultation selector state
  const [consultasList, setConsultasList] = useState<{id: string; nome_imovel: string; criado_em: string; clientes?: {nome_completo: string} | null}[]>([])
  const [selectedConsultaId, setSelectedConsultaId] = useState<string | null>(consultaId || null)

  // Custom references state
  const [customRefs, setCustomRefs] = useState<Record<string, CuraCustomRef[]>>({})
  const [showAddRef, setShowAddRef] = useState<string | null>(null)
  const [refForm, setRefForm] = useState({ nome: '', descricao: '', como_utilizar: '' })
  const [expandedRefs, setExpandedRefs] = useState<Record<string, boolean>>({})
  const [editingRef, setEditingRef] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ nome: '', descricao: '', como_utilizar: '' })
  const [userId, setUserId] = useState<string | null>(null)
  const [savingRef, setSavingRef] = useState(false)

  // Load consultation data (setores + consulta) for a given id
  async function loadConsultaData(cId: string) {
    setLoading(true)
    const [setoresRes, consultaRes] = await Promise.all([
      supabase
        .from('setores_bagua')
        .select('*')
        .eq('consulta_id', cId)
        .order('numero'),
      supabase
        .from('consultas')
        .select('nome_imovel, criado_em, clientes(nome_completo)')
        .eq('id', cId)
        .single(),
    ])
    if (setoresRes.data) setSetores(setoresRes.data)
    if (consultaRes.data) setConsulta(consultaRes.data as unknown as { nome_imovel: string; criado_em: string; clientes?: { nome_completo: string } | null })
    setLoading(false)
  }

  // Load all consultations for selector + auto-load if consultaId from URL
  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }

      // Load all consultations for selector
      const { data: consultasData } = await supabase
        .from('consultas')
        .select('id, nome_imovel, criado_em, clientes(nome_completo)')
        .eq('consultor_id', user.id)
        .neq('status', 'deletada')
        .order('criado_em', { ascending: false })
      setConsultasList((consultasData || []) as unknown as typeof consultasList)

      // If consultaId from URL, auto-load that consultation
      if (consultaId) {
        await loadConsultaData(consultaId)
      } else {
        setLoading(false)
      }
    }
    init()
  }, [consultaId])

  // Load custom references
  useEffect(() => {
    async function loadCustomRefs() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUserId(user.id)
        const { data: refs } = await supabase
          .from('consultor_curas_custom')
          .select('*')
          .eq('consultor_id', user.id)

        const grouped: Record<string, CuraCustomRef[]> = {}
        for (const ref of refs || []) {
          const key = `${ref.setor_id}_${ref.tipo}`
          if (!grouped[key]) grouped[key] = []
          grouped[key].push(ref)
        }
        setCustomRefs(grouped)
      }
    }
    loadCustomRefs()
  }, [])

  async function saveCustomRef(setorId: string, tipo: string) {
    if (!userId || !refForm.nome.trim()) return
    setSavingRef(true)
    const { data, error } = await supabase
      .from('consultor_curas_custom')
      .insert({
        consultor_id: userId,
        setor_id: setorId,
        tipo,
        nome: refForm.nome.trim(),
        descricao: refForm.descricao.trim(),
        como_utilizar: refForm.como_utilizar.trim(),
      })
      .select()
      .single()
    if (!error && data) {
      const key = `${setorId}_${tipo}`
      setCustomRefs(prev => ({
        ...prev,
        [key]: [...(prev[key] || []), data],
      }))
      setRefForm({ nome: '', descricao: '', como_utilizar: '' })
      setShowAddRef(null)
    }
    setSavingRef(false)
  }

  async function updateCustomRef(refId: string, setorId: string, tipo: string) {
    if (!editForm.nome.trim()) return
    setSavingRef(true)
    const { error } = await supabase
      .from('consultor_curas_custom')
      .update({
        nome: editForm.nome.trim(),
        descricao: editForm.descricao.trim(),
        como_utilizar: editForm.como_utilizar.trim(),
      })
      .eq('id', refId)
    if (!error) {
      const key = `${setorId}_${tipo}`
      setCustomRefs(prev => ({
        ...prev,
        [key]: (prev[key] || []).map(r => r.id === refId ? { ...r, nome: editForm.nome.trim(), descricao: editForm.descricao.trim(), como_utilizar: editForm.como_utilizar.trim() } : r),
      }))
      setEditingRef(null)
    }
    setSavingRef(false)
  }

  async function deleteCustomRef(refId: string, setorId: string, tipo: string) {
    if (!confirm('Excluir esta referencia?')) return
    const { error } = await supabase
      .from('consultor_curas_custom')
      .delete()
      .eq('id', refId)
    if (!error) {
      const key = `${setorId}_${tipo}`
      setCustomRefs(prev => ({
        ...prev,
        [key]: (prev[key] || []).filter(r => r.id !== refId),
      }))
    }
  }

  function renderCustomRefsSection(elId: string, tipo: string) {
    const key = `${elId}_${tipo}`
    const refs = customRefs[key] || []
    const isExpanded = expandedRefs[key] || false
    const isAdding = showAddRef === key

    return (
      <div style={{ marginTop: '8px', marginBottom: '8px' }}>
        <button
          onClick={() => setExpandedRefs(prev => ({ ...prev, [key]: !isExpanded }))}
          style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: '6px 0',
            fontSize: '12px', color: '#2E7D6B', fontWeight: 'bold', display: 'flex',
            alignItems: 'center', gap: '6px',
          }}
        >
          <span style={{ transition: 'transform 0.2s', display: 'inline-block', transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>{'\u25B6'}</span>
          Minhas referencias ({refs.length})
        </button>

        {isExpanded && (
          <div style={{ marginTop: '8px', paddingLeft: '8px' }}>
            {refs.map(ref => (
              <div key={ref.id} style={{
                background: '#FAFAFA', borderRadius: '8px', padding: '10px 14px',
                border: '1px solid #E5E7EB', marginBottom: '8px',
              }}>
                {editingRef === ref.id ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <input
                      value={editForm.nome}
                      onChange={e => setEditForm(f => ({ ...f, nome: e.target.value }))}
                      placeholder="Nome"
                      style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #D1D5DB', fontSize: '12px' }}
                    />
                    <textarea
                      value={editForm.descricao}
                      onChange={e => setEditForm(f => ({ ...f, descricao: e.target.value }))}
                      placeholder="Descricao"
                      rows={2}
                      style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #D1D5DB', fontSize: '12px', resize: 'vertical' }}
                    />
                    <textarea
                      value={editForm.como_utilizar}
                      onChange={e => setEditForm(f => ({ ...f, como_utilizar: e.target.value }))}
                      placeholder="Como utilizar"
                      rows={2}
                      style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #D1D5DB', fontSize: '12px', resize: 'vertical' }}
                    />
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => updateCustomRef(ref.id, elId, tipo)}
                        disabled={savingRef}
                        style={{
                          padding: '6px 14px', borderRadius: '6px', border: 'none', cursor: 'pointer',
                          background: '#2E7D6B', color: '#fff', fontSize: '12px', fontWeight: 'bold',
                        }}
                      >
                        {savingRef ? 'Salvando...' : 'Salvar'}
                      </button>
                      <button
                        onClick={() => setEditingRef(null)}
                        style={{
                          padding: '6px 14px', borderRadius: '6px', border: '1px solid #D1D5DB',
                          cursor: 'pointer', background: '#fff', fontSize: '12px', color: '#374151',
                        }}
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <p style={{ fontSize: '13px', fontWeight: 'bold', color: '#374151', margin: '0 0 4px 0' }}>{ref.nome}</p>
                      <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                        <button
                          onClick={() => { setEditingRef(ref.id); setEditForm({ nome: ref.nome, descricao: ref.descricao || '', como_utilizar: ref.como_utilizar || '' }) }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: '#2E7D6B', padding: '2px 4px' }}
                        >
                          {'\u270F\uFE0F'}
                        </button>
                        <button
                          onClick={() => deleteCustomRef(ref.id, elId, tipo)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: '#DC2626', padding: '2px 4px' }}
                        >
                          {'\u{1F5D1}\uFE0F'}
                        </button>
                      </div>
                    </div>
                    {ref.descricao && <p style={{ fontSize: '12px', color: '#6B7280', margin: '0 0 4px 0' }}>{ref.descricao}</p>}
                    {ref.como_utilizar && <p style={{ fontSize: '11px', color: '#9CA3AF', margin: 0, fontStyle: 'italic' }}>Como utilizar: {ref.como_utilizar}</p>}
                  </div>
                )}
              </div>
            ))}

            {isAdding ? (
              <div style={{
                background: '#EAF4F1', borderRadius: '8px', padding: '14px',
                border: '1px solid #DCEFE9', display: 'flex', flexDirection: 'column', gap: '8px',
              }}>
                <input
                  value={refForm.nome}
                  onChange={e => setRefForm(f => ({ ...f, nome: e.target.value }))}
                  placeholder="Nome da referencia"
                  style={{ padding: '8px 10px', borderRadius: '6px', border: '1px solid #D1D5DB', fontSize: '12px' }}
                />
                <textarea
                  value={refForm.descricao}
                  onChange={e => setRefForm(f => ({ ...f, descricao: e.target.value }))}
                  placeholder="Descricao"
                  rows={2}
                  style={{ padding: '8px 10px', borderRadius: '6px', border: '1px solid #D1D5DB', fontSize: '12px', resize: 'vertical' }}
                />
                <textarea
                  value={refForm.como_utilizar}
                  onChange={e => setRefForm(f => ({ ...f, como_utilizar: e.target.value }))}
                  placeholder="Como utilizar"
                  rows={2}
                  style={{ padding: '8px 10px', borderRadius: '6px', border: '1px solid #D1D5DB', fontSize: '12px', resize: 'vertical' }}
                />
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => saveCustomRef(elId, tipo)}
                    disabled={savingRef || !refForm.nome.trim()}
                    style={{
                      padding: '8px 16px', borderRadius: '6px', border: 'none', cursor: 'pointer',
                      background: (!refForm.nome.trim() || savingRef) ? '#A7D3C9' : '#2E7D6B',
                      color: '#fff', fontSize: '12px', fontWeight: 'bold',
                    }}
                  >
                    {savingRef ? 'Salvando...' : 'Salvar'}
                  </button>
                  <button
                    onClick={() => { setShowAddRef(null); setRefForm({ nome: '', descricao: '', como_utilizar: '' }) }}
                    style={{
                      padding: '8px 16px', borderRadius: '6px', border: '1px solid #D1D5DB',
                      cursor: 'pointer', background: '#fff', fontSize: '12px', color: '#374151',
                    }}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => { setShowAddRef(key); setRefForm({ nome: '', descricao: '', como_utilizar: '' }) }}
                style={{
                  background: 'none', border: '1px dashed #A7D3C9', borderRadius: '6px',
                  cursor: 'pointer', padding: '8px 14px', fontSize: '12px', color: '#2E7D6B',
                  fontWeight: 'bold', width: '100%', textAlign: 'center',
                }}
              >
                + Adicionar referencia
              </button>
            )}
          </div>
        )}
      </div>
    )
  }

  // Scroll spy
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id)
          }
        }
      },
      { rootMargin: '-100px 0px -60% 0px', threshold: 0.1 }
    )
    Object.values(sectionRefs.current).forEach(el => { if (el) observer.observe(el) })
    return () => observer.disconnect()
  }, [])

  function scrollTo(id: string) {
    sectionRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  // Find sector score for a guá name
  function findScore(guaName: string): number | null {
    const mappings: Record<string, string[]> = {
      'Carreira': ['Carreira'],
      'Família / Saúde': ['Família', 'Família/Saúde'],
      'Prosperidade': ['Prosperidade'],
      'Fama / Reputação': ['Fama', 'Fama/Reputação'],
      'Relacionamentos': ['Relacionamentos', 'Amor'],
      'Criatividade / Filhos': ['Criatividade', 'Filhos'],
      'Pessoas Úteis': ['Pessoas Úteis', 'Pessoas Uteis', 'Mentores'],
      'Espiritualidade': ['Espiritualidade', 'Conhecimento', 'Sabedoria'],
      'Saúde / Centro': ['Centro', 'Centro/Saúde', 'Saúde'],
    }
    const names = mappings[guaName] || [guaName]
    const setor = setores.find(s => names.some(n => s.nome === n))
    return setor?.score_percentual ?? null
  }

  function scoreLevel(score: number): { label: string; cor: string; bg: string } {
    if (score >= 70) return { label: 'Equilibrado', cor: '#15803D', bg: '#F0FDF4' }
    if (score >= 40) return { label: 'Atenção', cor: '#D97706', bg: '#FFFBEB' }
    return { label: 'Urgente', cor: '#DC2626', bg: '#FEF2F2' }
  }

  if (loading) {
    return (
      <AppShell currentPage="curas">
        <div style={{ marginBottom: '32px' }}>
          <Skeleton width="280px" height="24px" />
          <div style={{ marginTop: '8px' }}><Skeleton width="400px" height="16px" /></div>
        </div>
        <Skeleton variant="card" />
        <div style={{ marginTop: '20px' }}><Skeleton variant="card" /></div>
      </AppShell>
    )
  }

  // Shared card style matching Dashboard
  const cardStyle = {
    background: '#ffffff', borderRadius: '12px', padding: '24px',
    boxShadow: '0 1px 2px rgba(14,27,44,0.04), 0 10px 28px -16px rgba(14,27,44,0.18)', border: '1px solid rgba(14,27,44,0.06)',
  }

  // Shared sub-card style for items inside sections
  const itemCardStyle = {
    background: '#F9FAFB', borderRadius: '10px', padding: '14px',
    border: '1px solid #E5E7EB',
  }

  return (
    <AppShell currentPage="curas">

      {/* ── PAGE HEADER ──────────────────────────────────────────────── */}
      <div style={{ marginBottom: '32px' }}>
        <p style={{ color: '#2E7D6B', fontSize: '12px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 8px 0' }}>Biblioteca</p>
        <h1 style={{ color: '#0E1B2C', fontSize: '30px', fontWeight: 600, margin: '0 0 6px 0', letterSpacing: '-0.01em' }}>
          Curas & Ativações
        </h1>
        <p style={{ color: '#6B7280', fontSize: '15px', margin: '0 0 8px 0' }}>
          Cristais, plantas, objetos, mudras, meditações e mantras organizados por elemento e Guá do Ba Guá
        </p>
        <a href="/curas/entenda" style={{ color: '#2E7D6B', fontSize: '13px', fontWeight: 'bold', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
          <BookOpen size={14} strokeWidth={1.75} aria-hidden="true" /> Entenda mais sobre Curas e Ativações
        </a>
      </div>

      {/* ── CONSULTATION SELECTOR ────────────────────────────────────── */}
      {!selectedConsultaId && (
        <div>
          <div style={{ marginBottom: '24px' }}>
            <h2 style={{ color: '#0E1B2C', fontSize: '20px', fontWeight: 'bold', margin: '0 0 8px 0' }}>
              Selecione uma consulta
            </h2>
            <p style={{ color: '#6B7280', fontSize: '14px', margin: 0 }}>
              As curas e ativações são vinculadas a uma consulta específica
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
            {consultasList.map(c => (
              <button key={c.id} onClick={() => { setSelectedConsultaId(c.id); loadConsultaData(c.id) }}
                style={{
                  background: '#fff', borderRadius: '10px', padding: '16px', border: '1px solid #E5E7EB',
                  cursor: 'pointer', textAlign: 'left', boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                  transition: 'all 0.2s'
                }}>
                <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#0E1B2C', marginBottom: '4px' }}>
                  {c.clientes?.nome_completo || 'Sem cliente'}
                </div>
                <div style={{ fontSize: '13px', color: '#6B7280' }}>{c.nome_imovel}</div>
                <div style={{ fontSize: '11px', color: '#9CA3AF', marginTop: '4px' }}>
                  {new Date(c.criado_em).toLocaleDateString('pt-BR')}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── SELECTED CONSULTATION CONTENT ────────────────────────────── */}
      {selectedConsultaId && (
      <>
        <button onClick={() => { setSelectedConsultaId(null); setSetores([]); setConsulta(null) }} style={{
          marginBottom: '16px', padding: '8px 16px', background: '#F3F4F6', color: '#6B7280',
          border: 'none', borderRadius: '6px', fontSize: '13px', cursor: 'pointer'
        }}>← Trocar consulta</button>

        {setores.length > 0 && (
          <div style={{
            marginBottom: '12px', padding: '8px 16px', background: '#EAF4F1',
            borderRadius: '8px', display: 'inline-block', border: '1px solid #DCEFE9'
          }}>
            <span style={{ color: '#2E7D6B', fontSize: '13px', fontWeight: 'bold' }}>
              Consulta selecionada
            </span>
          </div>
        )}

      {/* ── CONSULTATION CONTEXT ────────────────────────────────────── */}
      {consulta && (
        <div style={{ background: '#EAF4F1', borderRadius: '10px', padding: '12px 16px', marginBottom: '16px', fontSize: '13px', color: '#2E7D6B' }}>
          <strong>Cliente:</strong> {consulta.clientes?.nome_completo} | <strong>Imóvel:</strong> {consulta.nome_imovel} | {new Date(consulta.criado_em).toLocaleDateString('pt-BR')}
        </div>
      )}

      {/* ── FILTER BAR ───────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <select value={filtroSetor} onChange={e => setFiltroSetor(e.target.value)} style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #D1D5DB', fontSize: '13px' }}>
          <option value="todos">Todos os setores</option>
          {ELEMENTOS.map(el => <option key={el.id} value={el.id}>{el.gua} ({el.nome})</option>)}
        </select>
        <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)} style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #D1D5DB', fontSize: '13px' }}>
          <option value="todos">Todos os tipos</option>
          <option value="cristais">Cristais</option>
          <option value="plantas">Plantas</option>
          <option value="objetos">Objetos</option>
          <option value="mudra">Mudras</option>
          <option value="meditacao">Meditação</option>
          <option value="mantras">Mantras</option>
        </select>
      </div>

      {/* ── NAVIGATION PILLS ─────────────────────────────────────────── */}
      <div style={{
        ...cardStyle, padding: '16px 20px', marginBottom: '20px',
        display: 'flex', gap: '8px', overflowX: 'auto', flexWrap: 'wrap',
      }}>
        {ELEMENTOS.map(el => {
          const isActive = activeSection === el.id
          const score = findScore(el.gua)
          const isPriority = score !== null && score < 40
          return (
            <button key={el.id} onClick={() => scrollTo(el.id)} style={{
              padding: '8px 16px', borderRadius: '20px', cursor: 'pointer',
              fontSize: '13px', fontWeight: isActive ? 'bold' : 'normal',
              background: isActive ? '#2E7D6B' : '#F3F4F6',
              color: isActive ? '#ffffff' : '#374151',
              border: isPriority ? '2px solid #DC2626' : isActive ? '1px solid #2E7D6B' : '1px solid #E5E7EB',
              transition: 'all 0.2s', whiteSpace: 'nowrap',
              display: 'flex', alignItems: 'center', gap: '6px',
            }}>
              <span>{el.trigramo}</span>
              <span>{el.gua}</span>
              {score !== null && (
                <span style={{
                  fontSize: '10px', padding: '2px 8px', borderRadius: '10px',
                  background: scoreLevel(score).bg, color: scoreLevel(score).cor, fontWeight: 'bold',
                }}>{score}%</span>
              )}
            </button>
          )
        })}
      </div>

      {/* ── CONTENT SECTIONS ─────────────────────────────────────────── */}
      {ELEMENTOS.filter(el => filtroSetor === 'todos' || el.id === filtroSetor).map(el => {
        const score = findScore(el.gua)
        const level = score !== null ? scoreLevel(score) : null
        return (
          <div
            key={el.id}
            id={el.id}
            ref={r => { sectionRefs.current[el.id] = r }}
            style={{ marginBottom: '24px', scrollMarginTop: '70px' }}
          >
            <div style={cardStyle}>
              {/* Section Header */}
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                paddingBottom: '16px', marginBottom: '20px',
                borderBottom: '1px solid #E5E7EB',
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
                    <span style={{ fontSize: '28px', color: '#2E7D6B' }}>{el.trigramo}</span>
                    <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#0E1B2C', margin: 0 }}>
                      {el.gua}
                    </h2>
                  </div>
                  <p style={{ fontSize: '13px', color: '#6B7280', margin: 0 }}>
                    Elemento: {el.elemento} · Trigramo: {el.trigramo}
                  </p>
                </div>
                {level && (
                  <div style={{
                    padding: '6px 14px', borderRadius: '20px',
                    background: level.bg, border: `1px solid ${level.cor}30`,
                  }}>
                    <span style={{ fontSize: '13px', color: level.cor, fontWeight: 'bold' }}>
                      Score: {score}% — {level.label}
                    </span>
                  </div>
                )}
              </div>

              {/* ── CRISTAIS ──────────────────────────────────────────── */}
              {(filtroTipo === 'todos' || filtroTipo === 'cristais') && (
              <div style={{ marginBottom: '24px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: '#0E1B2C', margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Gem size={17} strokeWidth={1.75} color="#2E7D6B" aria-hidden="true" /> Cristais
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
                  {el.cristais.map(c => (
                    <div key={c.nome} style={{
                      ...itemCardStyle, display: 'flex', gap: '10px', alignItems: 'flex-start',
                    }}>
                      <div style={{
                        width: '28px', height: '28px', borderRadius: '50%',
                        background: c.cor, flexShrink: 0, border: '2px solid #E5E7EB',
                        boxShadow: `0 0 6px ${c.cor}30`,
                      }} />
                      <div>
                        <p style={{ fontSize: '13px', fontWeight: 'bold', color: '#374151', margin: '0 0 2px 0' }}>{c.nome}</p>
                        <p style={{ fontSize: '12px', color: '#6B7280', margin: 0 }}>{c.propriedade}</p>
                      </div>
                    </div>
                  ))}
                </div>
                {renderCustomRefsSection(el.id, 'cristais')}
              </div>
              )}

              {/* ── PLANTAS ───────────────────────────────────────────── */}
              {(filtroTipo === 'todos' || filtroTipo === 'plantas') && (
              <div style={{ marginBottom: '24px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: '#0E1B2C', margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Leaf size={17} strokeWidth={1.75} color="#2E7D6B" aria-hidden="true" /> Plantas
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '12px' }}>
                  {el.plantas.map(p => (
                    <div key={p.nome} style={itemCardStyle}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                        <span style={{ fontSize: '20px' }}>{p.icon}</span>
                        <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#374151' }}>{p.nome}</span>
                      </div>
                      <p style={{ fontSize: '12px', color: '#6B7280', margin: '0 0 4px 0' }}>{p.dica}</p>
                      <p style={{ fontSize: '11px', color: '#9CA3AF', margin: 0, display: 'flex', alignItems: 'center', gap: '4px' }}><MapPin size={11} strokeWidth={1.75} aria-hidden="true" /> {p.posicao}</p>
                    </div>
                  ))}
                </div>
                {renderCustomRefsSection(el.id, 'plantas')}
              </div>
              )}

              {/* ── OBJETOS ──────────────────────────────────────────── */}
              {(filtroTipo === 'todos' || filtroTipo === 'objetos') && (
              <div style={{ marginBottom: '24px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: '#0E1B2C', margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Amphora size={17} strokeWidth={1.75} color="#2E7D6B" aria-hidden="true" /> Objetos & Curas
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
                  {el.objetos.map(o => (
                    <div key={o.nome} style={{
                      ...itemCardStyle, display: 'flex', gap: '10px', alignItems: 'center',
                    }}>
                      <span style={{ fontSize: '22px' }}>{o.icon}</span>
                      <div>
                        <p style={{ fontSize: '13px', fontWeight: 'bold', color: '#374151', margin: '0 0 2px 0' }}>{o.nome}</p>
                        <p style={{ fontSize: '11px', color: '#9CA3AF', margin: 0, display: 'flex', alignItems: 'center', gap: '4px' }}><MapPin size={11} strokeWidth={1.75} aria-hidden="true" /> {o.posicao}</p>
                      </div>
                    </div>
                  ))}
                </div>
                {renderCustomRefsSection(el.id, 'objetos')}
              </div>
              )}

              {/* ── MUDRA & MEDITAÇÃO (side by side) ─────────────────── */}
              {(filtroTipo === 'todos' || filtroTipo === 'mudra' || filtroTipo === 'meditacao') && (
              <div style={{ display: 'grid', gridTemplateColumns: (filtroTipo === 'mudra' || filtroTipo === 'meditacao') ? '1fr' : '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                {/* Mudra */}
                {(filtroTipo === 'todos' || filtroTipo === 'mudra') && (
                <div style={{
                  background: '#EAF4F1', borderRadius: '12px', padding: '20px',
                  border: '1px solid #DCEFE9',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                    <span style={{ fontSize: '24px' }}>{el.mudra.icon}</span>
                    <h4 style={{ fontSize: '14px', fontWeight: 'bold', color: '#2E7D6B', margin: 0 }}>
                      {el.mudra.nome}
                    </h4>
                  </div>
                  <p style={{ fontSize: '13px', color: '#6B7280', margin: '0 0 12px 0' }}>{el.mudra.descricao}</p>
                  <ol style={{ margin: 0, paddingLeft: '18px' }}>
                    {el.mudra.passos.map((p, i) => (
                      <li key={i} style={{ fontSize: '12px', color: '#374151', marginBottom: '6px', lineHeight: '1.5' }}>{p}</li>
                    ))}
                  </ol>
                </div>
                )}

                {/* Meditação */}
                {(filtroTipo === 'todos' || filtroTipo === 'meditacao') && (
                <div style={{
                  background: '#F0FDF4', borderRadius: '12px', padding: '20px',
                  border: '1px solid #BBF7D0',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                    <Flower2 size={22} strokeWidth={1.75} color="#15803D" aria-hidden="true" />
                    <h4 style={{ fontSize: '14px', fontWeight: 'bold', color: '#15803D', margin: 0 }}>
                      {el.meditacao.nome}
                    </h4>
                  </div>
                  <p style={{ fontSize: '12px', color: '#6B7280', margin: '0 0 8px 0' }}>Duração: {el.meditacao.duracao}</p>
                  <p style={{ fontSize: '13px', color: '#6B7280', margin: '0 0 12px 0' }}>{el.meditacao.descricao}</p>
                  <ol style={{ margin: 0, paddingLeft: '18px' }}>
                    {el.meditacao.passos.map((p, i) => (
                      <li key={i} style={{ fontSize: '12px', color: '#374151', marginBottom: '6px', lineHeight: '1.5' }}>{p}</li>
                    ))}
                  </ol>
                </div>
                )}
              </div>
              )}
              {(filtroTipo === 'todos' || filtroTipo === 'mudra') && renderCustomRefsSection(el.id, 'mudra')}
              {(filtroTipo === 'todos' || filtroTipo === 'meditacao') && renderCustomRefsSection(el.id, 'meditacao')}

              {/* ── MANTRAS ──────────────────────────────────────────── */}
              {(filtroTipo === 'todos' || filtroTipo === 'mantras') && (
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: '#0E1B2C', margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <AudioLines size={17} strokeWidth={1.75} color="#2E7D6B" aria-hidden="true" /> Mantras
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  {el.mantras.map((m, i) => (
                    <div key={i} style={{
                      background: '#FFFBEB', borderRadius: '12px', padding: '20px', textAlign: 'center',
                      border: '1px solid #FDE68A',
                    }}>
                      <p style={{ fontSize: '28px', color: '#0E1B2C', fontWeight: 'bold', margin: '0 0 6px 0', letterSpacing: '4px' }}>
                        {m.caracteres}
                      </p>
                      <p style={{ fontSize: '13px', color: '#374151', margin: '0 0 4px 0', fontStyle: 'italic' }}>
                        {m.romanizacao}
                      </p>
                      <p style={{ fontSize: '12px', color: '#6B7280', margin: 0 }}>
                        {m.significado}
                      </p>
                    </div>
                  ))}
                </div>
                {renderCustomRefsSection(el.id, 'mantras')}
              </div>
              )}
            </div>
          </div>
        )
      })}

      {/* ── VOLTAR À CONSULTA ────────────────────────────────────────── */}
      {consultaId && (
        <div style={{ textAlign: 'center', marginTop: '24px' }}>
          <a href={`/consultas/${consultaId}`} style={{ display: 'inline-block', padding: '12px 24px', background: '#2E7D6B', color: '#fff', borderRadius: '8px', textDecoration: 'none', fontWeight: 'bold', fontSize: '14px' }}>
            ← Voltar à consulta
          </a>
        </div>
      )}
      </>
      )}
    </AppShell>
  )
}

export default function CurasPage() {
  return (
    <Suspense fallback={
      <AppShell currentPage="curas">
        <div style={{ marginBottom: '32px' }}>
          <Skeleton width="280px" height="24px" />
          <div style={{ marginTop: '8px' }}><Skeleton width="400px" height="16px" /></div>
        </div>
        <Skeleton variant="card" />
        <div style={{ marginTop: '20px' }}><Skeleton variant="card" /></div>
      </AppShell>
    }>
      <CurasPageContent />
    </Suspense>
  )
}
