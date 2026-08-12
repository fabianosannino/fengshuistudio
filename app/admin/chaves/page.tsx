'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../../src/lib/supabase'
import AppShell from '../../components/AppShell'
import Skeleton from '../../components/Skeleton'
import ConfirmModal from '../../components/ConfirmModal'
import type { ActivationKey } from '../../../src/lib/types'
import { planoEfetivo, planoLabel } from '../../../src/lib/plano-utils'
import { ScrollText, KeyRound, CircleCheck, CircleDot, CircleAlert, ClipboardList, Copy, Download, X, ChevronUp, ChevronDown, ArrowLeft, ArrowRight, Zap, ArrowUpCircle } from 'lucide-react'

const PAGE_SIZE = 20
/** Abaixo disto a busca de usuário não dispara — evita varrer a base por uma letra. */
const BUSCA_MINIMA = 2

const STATUS_COLORS: Record<string, { bg: string; color: string; label: string }> = {
  available: { bg: '#F0F6F3', color: '#2E7D6B', label: 'Disponível' },
  used:      { bg: '#EAF1EE', color: '#245F52', label: 'Utilizada' },
  expired:   { bg: '#FAF3E0', color: '#8A6E2F', label: 'Expirada' },
  cancelled: { bg: '#FAEEE9', color: '#B4533A', label: 'Cancelada' },
}

interface Summary { total: number; available: number; used: number; expired: number; cancelled: number }

export default function AdminChaves() {
  const [loading, setLoading] = useState(true)
  const [keys, setKeys] = useState<ActivationKey[]>([])
  const [summary, setSummary] = useState<Summary>({ total: 0, available: 0, used: 0, expired: 0, cancelled: 0 })
  const [totalKeys, setTotalKeys] = useState(0)
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [msg, setMsg] = useState('')
  const [msgType, setMsgType] = useState<'success' | 'error'>('success')

  // Generator state
  const [genQty, setGenQty] = useState(1)
  const [genPlano, setGenPlano] = useState<'pro' | 'simples'>('pro')
  const [genExpiry, setGenExpiry] = useState<'none' | 'date'>('none')
  const [genDate, setGenDate] = useState('')
  const [genNote, setGenNote] = useState('')
  const [generating, setGenerating] = useState(false)
  const [generatedKeys, setGeneratedKeys] = useState<string[]>([])
  const [showGenModal, setShowGenModal] = useState(false)

  // Cancel state
  const [cancelTarget, setCancelTarget] = useState<string | null>(null)

  // Promote state
  const [promoteSearch, setPromoteSearch] = useState('')
  const [promoteResults, setPromoteResults] = useState<{ id: string; nome_completo: string; plano: string }[]>([])
  const [promoteTarget, setPromoteTarget] = useState<{ id: string; nome_completo: string; plano: string } | null>(null)
  const [showPromoteModal, setShowPromoteModal] = useState(false)
  const [promoting, setPromoting] = useState(false)

  // Expand row
  const [expandedRow, setExpandedRow] = useState<string | null>(null)

  const showMsg = useCallback((text: string, type: 'success' | 'error' = 'success') => {
    setMsg(text)
    setMsgType(type)
    setTimeout(() => setMsg(''), 4000)
  }, [])

  const fetchKeys = useCallback(async () => {
    const params = new URLSearchParams({ page: String(page), status: statusFilter })
    if (search) params.set('search', search)

    const res = await fetch(`/api/admin/chaves?${params}`)
    if (!res.ok) {
      showMsg('Erro ao carregar chaves', 'error')
      setLoading(false)
      return
    }
    const data = await res.json()
    setKeys(data.keys || [])
    setSummary(data.summary || { total: 0, available: 0, used: 0, expired: 0, cancelled: 0 })
    setTotalKeys(data.total || 0)
    setLoading(false)
  }, [page, statusFilter, search, showMsg])

  useEffect(() => {
    /*
     * Carga de dados no cliente: a função liga o spinner de forma síncrona.
     * Sair deste padrão é migrar para server component / camada de dados —
     * o débito R1 registrado na auditoria de 2026-07-18 —, não reescrever
     * este efeito. A supressão é por sítio, e nova violação quebra o CI.
     */
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchKeys()
  }, [fetchKeys])

  async function handleGenerate() {
    setGenerating(true)
    const res = await fetch('/api/admin/chaves', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quantidade: genQty,
        plan_type: genPlano,
        expires_at: genExpiry === 'date' && genDate ? new Date(genDate).toISOString() : null,
        note: genNote || null,
      }),
    })
    const data = await res.json()
    setGenerating(false)
    if (!res.ok) {
      showMsg(data.error || 'Erro ao gerar chaves', 'error')
      return
    }
    const newKeys = (data.keys || []).map((k: ActivationKey) => k.key)
    setGeneratedKeys(newKeys)
    setShowGenModal(true)
    setGenQty(1)
    setGenNote('')
    setGenExpiry('none')
    setGenDate('')
    fetchKeys()
  }

  async function handleCancel(id: string) {
    const res = await fetch('/api/admin/chaves', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action: 'cancel' }),
    })
    setCancelTarget(null)
    if (res.ok) {
      showMsg('Chave cancelada com sucesso')
      fetchKeys()
    } else {
      showMsg('Erro ao cancelar chave', 'error')
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text)
    showMsg('Copiado!')
  }

  function downloadKeys(keysArr: string[]) {
    const content = keysArr.join('\n')
    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `chaves-pro-${new Date().toISOString().slice(0, 10)}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Promote user search with debounce
  useEffect(() => {
    // Busca curta: nada a mostrar. Derivado no render (`resultadosVisiveis`)
    // em vez de limpar o estado por efeito — o efeito repintava a lista antes
    // de apagá-la.
    if (promoteSearch.length < BUSCA_MINIMA) return
    const timer = setTimeout(async () => {
      const res = await fetch(`/api/admin/promover?q=${encodeURIComponent(promoteSearch)}`)
      if (res.ok) {
        const data = await res.json()
        setPromoteResults(data.users || [])
      }
    }, 400)
    return () => clearTimeout(timer)
  }, [promoteSearch])

  const resultadosVisiveis = promoteSearch.length < BUSCA_MINIMA ? [] : promoteResults

  async function handlePromote() {
    if (!promoteTarget) return
    setPromoting(true)
    const res = await fetch('/api/admin/promover', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: promoteTarget.id }),
    })
    const data = await res.json()
    setPromoting(false)
    setShowPromoteModal(false)
    if (res.ok) {
      showMsg(`Usuário ${data.nome || promoteTarget.nome_completo} promovido para Pro com sucesso.`)
      setPromoteTarget(null)
      setPromoteSearch('')
      setPromoteResults([])
    } else {
      showMsg(data.error || 'Erro ao promover', 'error')
    }
  }

  const totalPages = Math.ceil(totalKeys / PAGE_SIZE)

  if (loading) {
    return (
      <AppShell currentPage="admin/chaves">
        <div style={{ marginBottom: '24px' }}>
          <Skeleton width="260px" height="24px" />
          <div style={{ marginTop: '8px' }}><Skeleton width="200px" height="16px" /></div>
        </div>
        <Skeleton variant="list" rows={5} />
      </AppShell>
    )
  }

  return (
    <AppShell currentPage="admin/chaves">
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h1 style={{ color: '#0E1B2C', fontSize: '24px', fontWeight: 'bold', margin: '0 0 4px 0' }}>Gerenciamento de Chaves</h1>
            <p style={{ color: '#6B7280', fontSize: '14px', margin: 0 }}>Gere, gerencie e monitore chaves de ativação Pro</p>
          </div>
          <a href="/admin/auditoria" style={{
            padding: '8px 16px', background: '#0E1B2C', color: '#fff', borderRadius: '8px',
            fontSize: '13px', fontWeight: 'bold', textDecoration: 'none',
            display: 'inline-flex', alignItems: 'center', gap: '6px',
          }}><ScrollText size={15} strokeWidth={1.75} aria-hidden="true" /> Log de auditoria</a>
        </div>
      </div>

      {/* Toast */}
      {msg && (
        <div style={{
          marginBottom: '16px', padding: '10px 16px', borderRadius: '8px',
          background: msgType === 'success' ? '#F0F6F3' : '#FAEEE9',
          border: `1px solid ${msgType === 'success' ? '#DCEAE4' : '#EBD3C7'}`,
          color: msgType === 'success' ? '#2E7D6B' : '#B4533A',
          fontSize: '14px', fontWeight: 'bold',
        }}>{msg}</div>
      )}

      {/* ═══ SUMMARY CARDS ═══ */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', marginBottom: '24px' }}>
        {[
          { label: 'Total gerado', value: summary.total, color: '#0E1B2C', Icon: KeyRound },
          { label: 'Disponíveis', value: summary.available, color: '#2E7D6B', Icon: CircleCheck },
          { label: 'Utilizadas', value: summary.used, color: '#2E7D6B', Icon: CircleDot },
          { label: 'Expiradas', value: summary.expired, color: '#8A6E2F', Icon: CircleAlert },
        ].map(card => (
          <div key={card.label} style={{
            background: '#fff', borderRadius: '12px', padding: '16px 20px',
            boxShadow: '0 1px 4px rgba(0,0,0,0.08)', borderTop: `3px solid ${card.color}`,
          }}>
            <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}><card.Icon size={13} strokeWidth={1.75} color={card.color} aria-hidden="true" /> {card.label}</div>
            <div style={{ fontSize: '28px', fontWeight: 'bold', color: card.color }}>{card.value}</div>
          </div>
        ))}
      </div>

      {/* ═══ KEY GENERATOR ═══ */}
      <div style={{
        background: '#fff', borderRadius: '12px', padding: '20px 24px', marginBottom: '24px',
        boxShadow: '0 1px 4px rgba(0,0,0,0.08)', border: '1px solid #E5E7EB',
      }}>
        <h2 style={{ color: '#0E1B2C', fontSize: '16px', fontWeight: 'bold', margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px' }}><KeyRound size={16} strokeWidth={1.75} aria-hidden="true" /> Gerar novas chaves</h2>

        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          {/* Quick quantity */}
          <div>
            <label style={{ fontSize: '12px', color: '#6B7280', display: 'block', marginBottom: '4px' }}>Quantidade</label>
            <div style={{ display: 'flex', gap: '4px' }}>
              {[1, 5, 10, 25].map(n => (
                <button type="button" key={n} onClick={() => setGenQty(n)} style={{
                  padding: '6px 14px', borderRadius: '6px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer',
                  background: genQty === n ? '#2E7D6B' : '#F3F4F6', color: genQty === n ? '#fff' : '#374151',
                  border: genQty === n ? '2px solid #2E7D6B' : '1px solid #D1D5DB',
                }}>{n}</button>
              ))}
              <input
                type="number" min={1} max={100} value={genQty}
                onChange={e => setGenQty(Math.min(100, Math.max(1, parseInt(e.target.value) || 1)))}
                style={{
                  width: '60px', padding: '6px 8px', borderRadius: '6px', border: '1px solid #D1D5DB',
                  fontSize: '13px', textAlign: 'center',
                }}
              />
            </div>
          </div>

          {/* Plano da chave — a chave só ativa o plano para o qual foi emitida
              (`/api/planos` compara `plan_type` com o plano pedido), então um
              seletor travado em «Pro» tornava o plano Simples inativável. */}
          <div>
            <label htmlFor="select-plano-chave" style={{ fontSize: '12px', color: '#6B7280', display: 'block', marginBottom: '4px' }}>Plano</label>
            <select
              id="select-plano-chave"
              value={genPlano}
              onChange={e => setGenPlano(e.target.value as 'pro' | 'simples')}
              style={{
                padding: '7px 12px', borderRadius: '6px', border: '1px solid #D1D5DB',
                fontSize: '13px', background: '#fff', color: '#374151',
              }}
            >
              <option value="pro">Profissional</option>
              <option value="simples">Simples</option>
            </select>
          </div>

          {/* Expiry */}
          <div>
            <label style={{ fontSize: '12px', color: '#6B7280', display: 'block', marginBottom: '4px' }}>Validade</label>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <select value={genExpiry} onChange={e => setGenExpiry(e.target.value as 'none' | 'date')} style={{
                padding: '7px 12px', borderRadius: '6px', border: '1px solid #D1D5DB', fontSize: '13px',
              }}>
                <option value="none">Sem expiração</option>
                <option value="date">Data específica</option>
              </select>
              {genExpiry === 'date' && (
                <input type="date" value={genDate} onChange={e => setGenDate(e.target.value)} style={{
                  padding: '7px 12px', borderRadius: '6px', border: '1px solid #D1D5DB', fontSize: '13px',
                }} />
              )}
            </div>
          </div>

          {/* Note */}
          <div style={{ flex: '1 1 200px' }}>
            <label style={{ fontSize: '12px', color: '#6B7280', display: 'block', marginBottom: '4px' }}>Observação (opcional)</label>
            <input
              type="text" value={genNote} onChange={e => setGenNote(e.target.value)}
              placeholder="Ex: Campanha Black Friday, Cliente VIP..."
              style={{
                width: '100%', padding: '7px 12px', borderRadius: '6px', border: '1px solid #D1D5DB',
                fontSize: '13px', boxSizing: 'border-box',
              }}
            />
          </div>

          <button type="button" onClick={handleGenerate} disabled={generating} style={{
            padding: '10px 24px', background: '#2E7D6B', color: '#fff', border: 'none',
            borderRadius: '8px', fontSize: '14px', fontWeight: 'bold', cursor: generating ? 'wait' : 'pointer',
            opacity: generating ? 0.6 : 1, whiteSpace: 'nowrap',
          }}>{generating ? 'Gerando...' : `Gerar ${genQty} chave${genQty > 1 ? 's' : ''}`}</button>
        </div>
      </div>

      {/* ═══ GENERATED KEYS MODAL ═══ */}
      {showGenModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
        }}>
          <div style={{
            background: '#fff', borderRadius: '16px', padding: '24px', maxWidth: '500px',
            width: '100%', maxHeight: '80vh', overflowY: 'auto',
          }}>
            <h3 style={{ color: '#0E1B2C', fontSize: '18px', margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <KeyRound size={18} strokeWidth={1.75} aria-hidden="true" /> {generatedKeys.length} chave{generatedKeys.length > 1 ? 's' : ''} gerada{generatedKeys.length > 1 ? 's' : ''}
            </h3>
            <div style={{
              background: '#F9FAFB', borderRadius: '8px', padding: '12px', marginBottom: '16px',
              fontFamily: 'monospace', fontSize: '13px', lineHeight: '1.8',
            }}>
              {generatedKeys.map(k => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>{k}</span>
                  <button type="button" onClick={() => copyToClipboard(k)} style={{
                    background: 'transparent', border: 'none', cursor: 'pointer', color: '#6B7280',
                    display: 'inline-flex', alignItems: 'center',
                  }} title="Copiar" aria-label="Copiar chave"><Copy size={15} strokeWidth={1.75} aria-hidden="true" /></button>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button type="button" onClick={() => copyToClipboard(generatedKeys.join('\n'))} style={{
                padding: '8px 16px', background: '#2E7D6B', color: '#fff', border: 'none',
                borderRadius: '6px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: '6px',
              }}><Copy size={14} strokeWidth={1.75} aria-hidden="true" /> Copiar todas</button>
              <button type="button" onClick={() => downloadKeys(generatedKeys)} style={{
                padding: '8px 16px', background: '#0E1B2C', color: '#fff', border: 'none',
                borderRadius: '6px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: '6px',
              }}><Download size={14} strokeWidth={1.75} aria-hidden="true" /> Baixar .txt</button>
              <button type="button" onClick={() => setShowGenModal(false)} style={{
                padding: '8px 16px', background: '#F3F4F6', color: '#374151', border: '1px solid #D1D5DB',
                borderRadius: '6px', fontSize: '13px', cursor: 'pointer',
              }}>Fechar</button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ KEYS TABLE ═══ */}
      <div style={{
        background: '#fff', borderRadius: '12px', padding: '20px 24px', marginBottom: '24px',
        boxShadow: '0 1px 4px rgba(0,0,0,0.08)', border: '1px solid #E5E7EB',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
          <h2 style={{ color: '#0E1B2C', fontSize: '16px', fontWeight: 'bold', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}><ClipboardList size={16} strokeWidth={1.75} aria-hidden="true" /> Chaves existentes</h2>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {/* Status filter */}
            <select
              value={statusFilter}
              onChange={e => { setStatusFilter(e.target.value); setPage(1) }}
              style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #D1D5DB', fontSize: '12px' }}
            >
              <option value="all">Todas</option>
              <option value="available">Disponíveis</option>
              <option value="used">Utilizadas</option>
              <option value="expired">Expiradas</option>
              <option value="cancelled">Canceladas</option>
            </select>
            {/* Search */}
            <input
              type="text" placeholder="Buscar chave..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1) }}
              style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #D1D5DB', fontSize: '12px', width: '180px' }}
            />
          </div>
        </div>

        {keys.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#9CA3AF', fontSize: '14px' }}>
            Nenhuma chave encontrada
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #E5E7EB' }}>
                  {['Chave', 'Plano', 'Status', 'Criada em', 'Expira em', 'Usada em', 'Usada por', 'Obs.', 'Ações'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '8px 6px', color: '#6B7280', fontWeight: 'bold', fontSize: '11px', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {keys.map(k => {
                  const sc = STATUS_COLORS[k.status] || STATUS_COLORS.available
                  const expanded = expandedRow === k.id
                  return (
                    <tr key={k.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                      <td style={{ padding: '8px 6px', fontFamily: 'monospace', fontSize: '11px', whiteSpace: 'nowrap' }}>{k.key}</td>
                      <td style={{ padding: '8px 6px' }}>
                        <span style={{ background: '#E6F2EF', color: '#2E7D6B', padding: '2px 8px', borderRadius: '10px', fontSize: '10px', fontWeight: 'bold' }}>
                          {k.plan_type.toUpperCase()}
                        </span>
                      </td>
                      <td style={{ padding: '8px 6px' }}>
                        <span style={{ background: sc.bg, color: sc.color, padding: '2px 10px', borderRadius: '10px', fontSize: '10px', fontWeight: 'bold' }}>
                          {sc.label}
                        </span>
                      </td>
                      <td style={{ padding: '8px 6px', color: '#6B7280', whiteSpace: 'nowrap' }}>
                        {new Date(k.created_at).toLocaleDateString('pt-BR')}
                      </td>
                      <td style={{ padding: '8px 6px', color: '#6B7280', whiteSpace: 'nowrap' }}>
                        {k.expires_at ? new Date(k.expires_at).toLocaleDateString('pt-BR') : '—'}
                      </td>
                      <td style={{ padding: '8px 6px', color: '#6B7280', whiteSpace: 'nowrap' }}>
                        {k.used_at ? new Date(k.used_at).toLocaleDateString('pt-BR') : '—'}
                      </td>
                      <td style={{ padding: '8px 6px', color: '#374151' }}>
                        {k.used_by_profile?.nome_completo || '—'}
                      </td>
                      <td style={{ padding: '8px 6px', color: '#9CA3AF', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {k.note || '—'}
                      </td>
                      <td style={{ padding: '8px 6px', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button type="button" onClick={() => copyToClipboard(k.key)} title="Copiar chave" aria-label="Copiar chave" style={{
                            padding: '4px 8px', background: '#F3F4F6', border: '1px solid #D1D5DB',
                            borderRadius: '4px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center',
                          }}><Copy size={13} strokeWidth={1.75} aria-hidden="true" /></button>
                          {k.status === 'available' && (
                            <button type="button" onClick={() => setCancelTarget(k.id)} title="Cancelar chave" aria-label="Cancelar chave" style={{
                              padding: '4px 8px', background: '#FAEEE9', border: '1px solid #EBD3C7',
                              borderRadius: '4px', cursor: 'pointer', color: '#B4533A', display: 'inline-flex', alignItems: 'center',
                            }}><X size={13} strokeWidth={2} aria-hidden="true" /></button>
                          )}
                          <button type="button" onClick={() => setExpandedRow(expanded ? null : k.id)} title="Ver detalhes" aria-label="Ver detalhes" style={{
                            padding: '4px 8px', background: '#F3F4F6', border: '1px solid #D1D5DB',
                            borderRadius: '4px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center',
                          }}>{expanded ? <ChevronUp size={13} strokeWidth={2} aria-hidden="true" /> : <ChevronDown size={13} strokeWidth={2} aria-hidden="true" />}</button>
                        </div>
                        {expanded && (
                          <div style={{
                            marginTop: '6px', padding: '8px', background: '#F9FAFB', borderRadius: '6px',
                            fontSize: '10px', color: '#374151', lineHeight: '1.6',
                          }}>
                            <div><strong>ID:</strong> {k.id}</div>
                            <div><strong>Criada:</strong> {new Date(k.created_at).toLocaleString('pt-BR')}</div>
                            {k.expires_at && <div><strong>Expira:</strong> {new Date(k.expires_at).toLocaleString('pt-BR')}</div>}
                            {k.used_at && <div><strong>Usada em:</strong> {new Date(k.used_at).toLocaleString('pt-BR')}</div>}
                            {k.used_by_profile && <div><strong>Usada por:</strong> {k.used_by_profile.nome_completo} ({k.used_by_profile.id})</div>}
                            {k.note && <div><strong>Obs:</strong> {k.note}</div>}
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', marginTop: '16px' }}>
            <button type="button"
              onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              style={{
                padding: '6px 14px', borderRadius: '6px', border: '1px solid #E5E7EB',
                background: page === 1 ? '#F9FAFB' : '#fff', color: page === 1 ? '#D1D5DB' : '#374151',
                cursor: page === 1 ? 'not-allowed' : 'pointer', fontSize: '12px', fontWeight: 'bold',
                display: 'inline-flex', alignItems: 'center', gap: '4px',
              }}
            ><ArrowLeft size={13} strokeWidth={2} aria-hidden="true" /> Anterior</button>
            <span style={{ color: '#6B7280', fontSize: '12px' }}>Página {page} de {totalPages}</span>
            <button type="button"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              style={{
                padding: '6px 14px', borderRadius: '6px', border: '1px solid #E5E7EB',
                background: page === totalPages ? '#F9FAFB' : '#fff', color: page === totalPages ? '#D1D5DB' : '#374151',
                cursor: page === totalPages ? 'not-allowed' : 'pointer', fontSize: '12px', fontWeight: 'bold',
                display: 'inline-flex', alignItems: 'center', gap: '4px',
              }}
            >Próximo <ArrowRight size={13} strokeWidth={2} aria-hidden="true" /></button>
          </div>
        )}
      </div>

      {/* ═══ QUICK PROMOTE ═══ */}
      <div style={{
        background: '#fff', borderRadius: '12px', padding: '20px 24px', marginBottom: '24px',
        boxShadow: '0 1px 4px rgba(0,0,0,0.08)', border: '1px solid #E5E7EB',
      }}>
        <h2 style={{ color: '#0E1B2C', fontSize: '16px', fontWeight: 'bold', margin: '0 0 4px 0', display: 'flex', alignItems: 'center', gap: '8px' }}><Zap size={16} strokeWidth={1.75} aria-hidden="true" /> Promoção rápida</h2>
        <p style={{ color: '#6B7280', fontSize: '12px', margin: '0 0 16px 0' }}>Promover usuário para Pro sem chave de ativação</p>

        <div style={{ position: 'relative', maxWidth: '400px' }}>
          <input
            type="text"
            placeholder="Buscar por nome do usuário..."
            value={promoteSearch}
            onChange={e => { setPromoteSearch(e.target.value); setPromoteTarget(null) }}
            style={{
              width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #D1D5DB',
              fontSize: '14px', boxSizing: 'border-box',
            }}
          />
          {/* Autocomplete dropdown */}
          {resultadosVisiveis.length > 0 && !promoteTarget && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff',
              border: '1px solid #E5E7EB', borderRadius: '8px', marginTop: '4px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 10, maxHeight: '200px', overflowY: 'auto',
            }}>
              {resultadosVisiveis.map(u => (
                <button type="button" key={u.id} onClick={() => { setPromoteTarget(u); setPromoteSearch(u.nome_completo); setPromoteResults([]) }}
                  style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%',
                    padding: '10px 14px', background: 'transparent', border: 'none', borderBottom: '1px solid #F3F4F6',
                    cursor: 'pointer', textAlign: 'left', fontSize: '13px',
                  }}>
                  <span style={{ color: '#374151' }}>{u.nome_completo}</span>
                  <span style={{
                    padding: '2px 8px', borderRadius: '10px', fontSize: '10px', fontWeight: 'bold',
                    background: planoEfetivo(u.plano) === 'profissional' ? '#E6F2EF' : '#F3F4F6',
                    color: planoEfetivo(u.plano) === 'profissional' ? '#2E7D6B' : '#6B7280',
                  }}>{planoLabel(u.plano)}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Selected user card */}
        {promoteTarget && (
          <div style={{
            marginTop: '16px', padding: '14px 18px', background: '#F9FAFB', borderRadius: '10px',
            border: '1px solid #E5E7EB', maxWidth: '400px',
          }}>
            <div style={{ fontSize: '14px', color: '#374151', marginBottom: '4px' }}>
              <strong>Nome:</strong> {promoteTarget.nome_completo}
            </div>
            <div style={{ fontSize: '13px', color: '#6B7280', marginBottom: '12px' }}>
              <strong>Plano atual:</strong>{' '}
              <span style={{
                padding: '2px 8px', borderRadius: '10px', fontSize: '10px', fontWeight: 'bold',
                background: planoEfetivo(promoteTarget.plano) === 'profissional' ? '#E6F2EF' : '#FAF3E0',
                color: planoEfetivo(promoteTarget.plano) === 'profissional' ? '#2E7D6B' : '#8A6E2F',
              }}>{planoLabel(promoteTarget.plano)}</span>
            </div>
            {planoEfetivo(promoteTarget.plano) === 'profissional' ? (
              <div style={{ fontSize: '12px', color: '#6B7280', fontStyle: 'italic' }}>Este usuário já possui o plano Pro.</div>
            ) : (
              <button type="button" onClick={() => setShowPromoteModal(true)} style={{
                padding: '8px 20px', background: '#2E7D6B', color: '#fff', border: 'none',
                borderRadius: '6px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: '6px',
              }}><ArrowUpCircle size={14} strokeWidth={1.75} aria-hidden="true" /> Promover para Pro</button>
            )}
          </div>
        )}
      </div>

      {/* Cancel modal */}
      <ConfirmModal
        open={!!cancelTarget}
        title="Cancelar chave"
        message="Cancelar esta chave? Ela não poderá mais ser usada para ativação."
        confirmLabel="Cancelar chave"
        cancelLabel="Voltar"
        variant="danger"
        onConfirm={() => cancelTarget && handleCancel(cancelTarget)}
        onCancel={() => setCancelTarget(null)}
      />

      {/* Promote confirmation modal */}
      {showPromoteModal && promoteTarget && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
        }}>
          <div style={{
            background: '#fff', borderRadius: '16px', padding: '24px', maxWidth: '400px', width: '100%',
          }}>
            <h3 style={{ color: '#0E1B2C', fontSize: '18px', margin: '0 0 12px 0' }}>Confirmar promoção</h3>
            <p style={{ color: '#374151', fontSize: '14px', margin: '0 0 20px 0' }}>
              Promover <strong>{promoteTarget.nome_completo}</strong> para o plano <strong>Pro</strong>?
            </p>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setShowPromoteModal(false)} style={{
                padding: '8px 16px', background: '#F3F4F6', color: '#374151', border: '1px solid #D1D5DB',
                borderRadius: '6px', fontSize: '13px', cursor: 'pointer',
              }}>Cancelar</button>
              <button type="button" onClick={handlePromote} disabled={promoting} style={{
                padding: '8px 20px', background: '#2E7D6B', color: '#fff', border: 'none',
                borderRadius: '6px', fontSize: '13px', fontWeight: 'bold',
                cursor: promoting ? 'wait' : 'pointer', opacity: promoting ? 0.6 : 1,
              }}>{promoting ? 'Promovendo...' : 'Confirmar'}</button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  )
}
