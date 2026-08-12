'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../../src/lib/supabase'
import AppShell from '../../components/AppShell'
import ConfirmModal from '../../components/ConfirmModal'
import { X } from 'lucide-react'

interface Metrics {
  mrr: number
  arr: number
  totalActive: number
  pastDue: number
  pastDueAmount: number
  cancelledThisMonth: number
  gratuidades: number
  totalUsers: number
}

interface SubInfo {
  id: string
  status: string
  billing_cycle: string
  price_paid: number | null
  current_period_end: string | null
  next_billing_date: string | null
  gratuidade_motivo: string | null
  plans?: { name: string; slug: string; price_monthly: number; price_yearly: number } | null
}

interface UserRow {
  id: string
  nome_completo: string
  plano: string
  tipo_usuario: string
  role: string
  criado_em: string
  subscriptions: SubInfo[]
}

const STATUS_BADGES: Record<string, { label: string; bg: string; color: string }> = {
  active: { label: 'Ativo', bg: '#F0F6F3', color: '#2E7D6B' },
  past_due: { label: 'Em atraso', bg: '#FAF3E0', color: '#8A6E2F' },
  cancelled: { label: 'Cancelado', bg: '#F3F4F6', color: '#6B7280' },
  gratuidade: { label: 'Gratuidade', bg: '#F0F6F3', color: '#2E7D6B' },
  trial: { label: 'Trial', bg: '#EEF6F3', color: '#2E7D6B' },
  paused: { label: 'Pausado', bg: '#FAF3E0', color: '#EA580C' },
}

function fmt(val: number): string {
  return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function fmtDate(d?: string | null): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('pt-BR')
}

export default function AdminPagamentos() {
  const [loading, setLoading] = useState(true)
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [users, setUsers] = useState<UserRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [planFilter, setPlanFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null)
  const [actionModal, setActionModal] = useState<string | null>(null)
  const [actionForm, setActionForm] = useState<Record<string, string>>({})
  const [actionLoading, setActionLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [confirmModal, setConfirmModal] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({
      page: String(page),
      plan: planFilter,
      status: statusFilter,
      ...(search ? { search } : {}),
    })
    const res = await fetch(`/api/admin/subscriptions?${params}`)
    if (res.ok) {
      const data = await res.json()
      setMetrics(data.metrics)
      setUsers(data.users || [])
      setTotal(data.total || 0)
    }
    setLoading(false)
  }, [page, planFilter, statusFilter, search])

  useEffect(() => {
    /*
     * Carga de dados no cliente: a função liga o spinner de forma síncrona.
     * Sair deste padrão é migrar para server component / camada de dados —
     * o débito R1 registrado na auditoria de 2026-07-18 —, não reescrever
     * este efeito. A supressão é por sítio, e nova violação quebra o CI.
     */
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadData()
  }, [loadData])

  async function execAction(action: string, extra: Record<string, unknown> = {}) {
    if (!selectedUser) return
    setActionLoading(true)
    setMessage('')
    try {
      const res = await fetch('/api/admin/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, user_id: selectedUser.id, ...extra }),
      })
      const data = await res.json()
      if (!res.ok) { setMessage(data.error || 'Erro'); setActionLoading(false); return }
      setMessage(data.message || 'Sucesso!')
      setActionModal(null)
      setActionForm({})
      await loadData()
    } catch { setMessage('Erro de conexão') }
    setActionLoading(false)
  }

  const metricsCards = metrics ? [
    { label: 'MRR', value: fmt(metrics.mrr), sub: 'Receita Mensal', color: '#2E7D6B', bg: '#F0F6F3' },
    { label: 'ARR', value: fmt(metrics.arr), sub: 'Receita Anual', color: '#2E7D6B', bg: '#F0F6F3' },
    { label: 'Total Assinaturas', value: String(metrics.totalActive), sub: 'Ativas', color: '#2E7D6B', bg: '#EEF6F3' },
    { label: 'Em Atraso', value: String(metrics.pastDue), sub: fmt(metrics.pastDueAmount), color: '#8A6E2F', bg: '#FAF3E0' },
    { label: 'Canceladas', value: String(metrics.cancelledThisMonth), sub: 'este mês', color: '#B4533A', bg: '#FAEEE9' },
    { label: 'Gratuidades', value: String(metrics.gratuidades), sub: 'ativas', color: '#2E7D6B', bg: '#F0F6F3' },
  ] : []

  const pageCount = Math.ceil(total / 20)

  return (
    <AppShell currentPage="admin/pagamentos">
      <h1 style={{ color: '#0E1B2C', fontSize: '24px', fontWeight: 'bold', margin: '0 0 24px 0' }}>Gestão de Pagamentos</h1>

      {message && (
        <div style={{
          marginBottom: '16px', padding: '12px', borderRadius: '8px',
          background: message.includes('Erro') ? '#FAEEE9' : '#F0F6F3',
          color: message.includes('Erro') ? '#B4533A' : '#2E7D6B', fontSize: '14px'
        }}>{message}</div>
      )}

      {/* Metrics Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '32px' }}>
        {metricsCards.map((c, i) => (
          <div key={i} style={{
            background: c.bg, borderRadius: '12px', padding: '20px',
            border: `1px solid ${c.color}20`
          }}>
            <div style={{ color: c.color, fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '4px' }}>{c.label}</div>
            <div style={{ color: '#111827', fontSize: '24px', fontWeight: 'bold' }}>{c.value}</div>
            <div style={{ color: '#6B7280', fontSize: '12px', marginTop: '2px' }}>{c.sub}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
        <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
          placeholder="Buscar nome ou e-mail..."
          style={{ padding: '8px 14px', border: '1px solid #E5E7EB', borderRadius: '8px', fontSize: '14px', minWidth: '200px' }} />
        <select value={planFilter} onChange={e => { setPlanFilter(e.target.value); setPage(1) }}
          style={{ padding: '8px 12px', border: '1px solid #E5E7EB', borderRadius: '8px', fontSize: '14px', cursor: 'pointer' }}>
          <option value="all">Todos os planos</option>
          <option value="free">Free</option>
          <option value="simples">Simples</option>
          <option value="profissional">Profissional</option>
          <option value="pro">Pro</option>
        </select>
        <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1) }}
          style={{ padding: '8px 12px', border: '1px solid #E5E7EB', borderRadius: '8px', fontSize: '14px', cursor: 'pointer' }}>
          <option value="all">Todos status</option>
          <option value="active">Ativos</option>
          <option value="past_due">Em atraso</option>
          <option value="cancelled">Cancelados</option>
          <option value="gratuidade">Gratuidade</option>
          <option value="free">Sem assinatura</option>
        </select>
      </div>

      {/* Users Table */}
      <div style={{ background: '#fff', borderRadius: '12px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', overflow: 'auto', marginBottom: '20px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #E5E7EB' }}>
              <th style={{ textAlign: 'left', padding: '12px', color: '#6B7280' }}>Usuário</th>
              <th style={{ textAlign: 'left', padding: '12px', color: '#6B7280' }}>Plano</th>
              <th style={{ textAlign: 'center', padding: '12px', color: '#6B7280' }}>Ciclo</th>
              <th style={{ textAlign: 'center', padding: '12px', color: '#6B7280' }}>Status</th>
              <th style={{ textAlign: 'center', padding: '12px', color: '#6B7280' }}>Próx. Cobrança</th>
              <th style={{ textAlign: 'center', padding: '12px', color: '#6B7280' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: '#9CA3AF' }}>Carregando...</td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: '#9CA3AF' }}>Nenhum usuário encontrado</td></tr>
            ) : users.map(u => {
              const activeSub = (u.subscriptions || []).find(s => s.status !== 'cancelled') || (u.subscriptions || [])[0]
              const status = activeSub?.status || 'free'
              const badge = STATUS_BADGES[status] || { label: u.plano || 'Free', bg: '#F3F4F6', color: '#6B7280' }
              return (
                <tr key={u.id} style={{ borderBottom: '1px solid #F3F4F6', cursor: 'pointer' }}
                  onClick={() => setSelectedUser(u)}>
                  <td style={{ padding: '12px' }}>
                    <div style={{ fontWeight: 'bold', color: '#111827' }}>{u.nome_completo || '(sem nome)'}</div>
                    <div style={{ fontSize: '12px', color: '#9CA3AF' }}>{u.id.slice(0, 8)}...</div>
                  </td>
                  <td style={{ padding: '12px' }}>
                    <span style={{ fontWeight: 'bold', color: '#374151' }}>{activeSub?.plans?.name || u.plano || 'Free'}</span>
                  </td>
                  <td style={{ padding: '12px', textAlign: 'center' }}>
                    {activeSub?.billing_cycle === 'yearly' ? 'Anual' : activeSub?.billing_cycle === 'monthly' ? 'Mensal' : '—'}
                  </td>
                  <td style={{ padding: '12px', textAlign: 'center' }}>
                    <span style={{
                      padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold',
                      background: badge.bg, color: badge.color
                    }}>{badge.label}</span>
                  </td>
                  <td style={{ padding: '12px', textAlign: 'center', color: '#6B7280' }}>
                    {fmtDate(activeSub?.next_billing_date || activeSub?.current_period_end)}
                  </td>
                  <td style={{ padding: '12px', textAlign: 'center' }}>
                    <button type="button" onClick={e => { e.stopPropagation(); setSelectedUser(u) }}
                      style={{ padding: '6px 12px', background: '#2E7D6B', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}>
                      Detalhes
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pageCount > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '24px' }}>
          <button type="button" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #E5E7EB', background: '#fff', cursor: page === 1 ? 'default' : 'pointer', color: page === 1 ? '#D1D5DB' : '#374151' }}>
            Anterior
          </button>
          <span style={{ padding: '8px 16px', color: '#6B7280' }}>Página {page} de {pageCount}</span>
          <button type="button" onClick={() => setPage(p => Math.min(pageCount, p + 1))} disabled={page === pageCount}
            style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #E5E7EB', background: '#fff', cursor: page === pageCount ? 'default' : 'pointer', color: page === pageCount ? '#D1D5DB' : '#374151' }}>
            Próxima
          </button>
        </div>
      )}

      {/* User Detail Modal */}
      {selectedUser && !actionModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
          onClick={() => setSelectedUser(null)}>
          <div style={{ background: '#fff', borderRadius: '16px', padding: '32px', maxWidth: '600px', width: '100%', maxHeight: '80vh', overflow: 'auto' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ color: '#0E1B2C', fontSize: '20px', fontWeight: 'bold', margin: 0 }}>Detalhes do Usuário</h2>
              <button type="button" onClick={() => setSelectedUser(null)} aria-label="Fechar" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', display: 'inline-flex', alignItems: 'center' }}><X size={20} strokeWidth={2} aria-hidden="true" /></button>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#111827', marginBottom: '4px' }}>{selectedUser.nome_completo}</div>
              <div style={{ fontSize: '13px', color: '#6B7280' }}>ID: {selectedUser.id}</div>
              <div style={{ fontSize: '13px', color: '#6B7280' }}>Cadastro: {fmtDate(selectedUser.criado_em)}</div>
              <div style={{ fontSize: '13px', color: '#6B7280' }}>Plano atual: <strong>{selectedUser.plano || 'free'}</strong></div>
              <div style={{ fontSize: '13px', color: '#6B7280' }}>Tipo: {selectedUser.tipo_usuario || '—'}</div>
            </div>

            {/* Subscription History */}
            <h3 style={{ fontSize: '15px', fontWeight: 'bold', color: '#0E1B2C', margin: '0 0 12px 0' }}>Assinaturas</h3>
            {(selectedUser.subscriptions || []).length === 0 ? (
              <p style={{ color: '#9CA3AF', fontSize: '14px' }}>Nenhuma assinatura registrada</p>
            ) : (
              <div style={{ marginBottom: '20px' }}>
                {(selectedUser.subscriptions || []).map((sub, i) => {
                  const badge = STATUS_BADGES[sub.status] || { label: sub.status, bg: '#F3F4F6', color: '#6B7280' }
                  return (
                    <div key={i} style={{ padding: '10px', borderRadius: '8px', background: '#F9FAFB', marginBottom: '8px', border: '1px solid #E5E7EB' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 'bold', color: '#374151' }}>{sub.plans?.name || '—'}</span>
                        <span style={{ padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: 'bold', background: badge.bg, color: badge.color }}>{badge.label}</span>
                      </div>
                      <div style={{ fontSize: '12px', color: '#6B7280', marginTop: '4px' }}>
                        {sub.billing_cycle === 'yearly' ? 'Anual' : 'Mensal'}
                        {sub.current_period_end && ` · até ${fmtDate(sub.current_period_end)}`}
                        {sub.gratuidade_motivo && ` · Motivo: ${sub.gratuidade_motivo}`}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Admin Actions */}
            <h3 style={{ fontSize: '15px', fontWeight: 'bold', color: '#0E1B2C', margin: '0 0 12px 0' }}>Ações</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <button type="button" onClick={() => { setActionModal('gratuidade'); setActionForm({}) }}
                style={{ padding: '10px', background: '#F0F6F3', color: '#2E7D6B', border: '1px solid #2E7D6B20', borderRadius: '8px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer' }}>
                Conceder Gratuidade
              </button>
              <button type="button" onClick={() => { setActionModal('change_plan'); setActionForm({}) }}
                style={{ padding: '10px', background: '#EEF6F3', color: '#2E7D6B', border: '1px solid #2E7D6B20', borderRadius: '8px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer' }}>
                Alterar Plano
              </button>
              <button type="button" onClick={() => { setActionModal('cancel_subscription'); setActionForm({}) }}
                style={{ padding: '10px', background: '#FAEEE9', color: '#B4533A', border: '1px solid #B4533A20', borderRadius: '8px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer' }}>
                Cancelar Assinatura
              </button>
              <button type="button" onClick={() => { setActionModal('mark_paid'); setActionForm({}) }}
                style={{ padding: '10px', background: '#F0F6F3', color: '#2E7D6B', border: '1px solid #2E7D6B20', borderRadius: '8px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer' }}>
                Marcar Fatura Paga
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Action Modals */}
      {actionModal === 'gratuidade' && selectedUser && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 110, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: '#fff', borderRadius: '16px', padding: '32px', maxWidth: '480px', width: '100%' }}>
            <h3 style={{ color: '#0E1B2C', fontSize: '18px', fontWeight: 'bold', margin: '0 0 16px 0' }}>
              Conceder Gratuidade — {selectedUser.nome_completo}
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <label style={{ fontSize: '13px', color: '#374151', fontWeight: 'bold' }}>
                Plano
                <select value={actionForm.plan_slug || 'profissional'} onChange={e => setActionForm(f => ({ ...f, plan_slug: e.target.value }))}
                  style={{ display: 'block', width: '100%', padding: '8px', border: '1px solid #E5E7EB', borderRadius: '8px', marginTop: '4px' }}>
                  <option value="simples">Simples</option>
                  <option value="profissional">Profissional</option>
                </select>
              </label>
              <label style={{ fontSize: '13px', color: '#374151', fontWeight: 'bold' }}>
                Duração
                <select value={actionForm.duration_months || ''} onChange={e => setActionForm(f => ({ ...f, duration_months: e.target.value }))}
                  style={{ display: 'block', width: '100%', padding: '8px', border: '1px solid #E5E7EB', borderRadius: '8px', marginTop: '4px' }}>
                  <option value="">Indeterminado</option>
                  <option value="1">1 mês</option>
                  <option value="3">3 meses</option>
                  <option value="6">6 meses</option>
                  <option value="12">12 meses</option>
                </select>
              </label>
              <label style={{ fontSize: '13px', color: '#374151', fontWeight: 'bold' }}>
                Motivo interno *
                <input value={actionForm.motivo || ''} onChange={e => setActionForm(f => ({ ...f, motivo: e.target.value }))}
                  placeholder="Ex: Parceiro estratégico, Beta tester..."
                  style={{ display: 'block', width: '100%', padding: '8px', border: '1px solid #E5E7EB', borderRadius: '8px', marginTop: '4px', boxSizing: 'border-box' }} />
              </label>
            </div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '20px', justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setActionModal(null)} style={{ padding: '10px 20px', background: '#F3F4F6', color: '#374151', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>Cancelar</button>
              <button type="button" disabled={actionLoading || !actionForm.motivo} onClick={() => execAction('gratuidade', {
                plan_slug: actionForm.plan_slug || 'profissional',
                duration_months: actionForm.duration_months ? parseInt(actionForm.duration_months) : null,
                motivo: actionForm.motivo,
              })} style={{
                padding: '10px 20px', background: !actionForm.motivo ? '#D1D5DB' : '#2E7D6B', color: '#fff',
                border: 'none', borderRadius: '8px', cursor: !actionForm.motivo ? 'not-allowed' : 'pointer', fontWeight: 'bold'
              }}>{actionLoading ? 'Salvando...' : 'Conceder Gratuidade'}</button>
            </div>
          </div>
        </div>
      )}

      {actionModal === 'change_plan' && selectedUser && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 110, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: '#fff', borderRadius: '16px', padding: '32px', maxWidth: '480px', width: '100%' }}>
            <h3 style={{ color: '#0E1B2C', fontSize: '18px', fontWeight: 'bold', margin: '0 0 16px 0' }}>
              Alterar Plano — {selectedUser.nome_completo}
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <label style={{ fontSize: '13px', color: '#374151', fontWeight: 'bold' }}>
                Novo Plano
                <select value={actionForm.plan_slug || ''} onChange={e => setActionForm(f => ({ ...f, plan_slug: e.target.value }))}
                  style={{ display: 'block', width: '100%', padding: '8px', border: '1px solid #E5E7EB', borderRadius: '8px', marginTop: '4px' }}>
                  <option value="">Selecione...</option>
                  <option value="free">Free</option>
                  <option value="simples">Simples</option>
                  <option value="profissional">Profissional</option>
                </select>
              </label>
              <label style={{ fontSize: '13px', color: '#374151', fontWeight: 'bold' }}>
                Motivo *
                <input value={actionForm.motivo || ''} onChange={e => setActionForm(f => ({ ...f, motivo: e.target.value }))}
                  placeholder="Ex: Upgrade manual, correção..."
                  style={{ display: 'block', width: '100%', padding: '8px', border: '1px solid #E5E7EB', borderRadius: '8px', marginTop: '4px', boxSizing: 'border-box' }} />
              </label>
            </div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '20px', justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setActionModal(null)} style={{ padding: '10px 20px', background: '#F3F4F6', color: '#374151', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>Cancelar</button>
              <button type="button" disabled={actionLoading || !actionForm.plan_slug || !actionForm.motivo} onClick={() => execAction('change_plan', {
                plan_slug: actionForm.plan_slug,
                motivo: actionForm.motivo,
              })} style={{
                padding: '10px 20px', background: (!actionForm.plan_slug || !actionForm.motivo) ? '#D1D5DB' : '#2E7D6B', color: '#fff',
                border: 'none', borderRadius: '8px', cursor: (!actionForm.plan_slug || !actionForm.motivo) ? 'not-allowed' : 'pointer', fontWeight: 'bold'
              }}>{actionLoading ? 'Salvando...' : 'Alterar Plano'}</button>
            </div>
          </div>
        </div>
      )}

      {actionModal === 'cancel_subscription' && selectedUser && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 110, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: '#fff', borderRadius: '16px', padding: '32px', maxWidth: '480px', width: '100%' }}>
            <h3 style={{ color: '#B4533A', fontSize: '18px', fontWeight: 'bold', margin: '0 0 16px 0' }}>
              Cancelar Assinatura — {selectedUser.nome_completo}
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <label style={{ fontSize: '13px', color: '#374151', fontWeight: 'bold' }}>
                Tipo de cancelamento
                <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', color: '#374151', cursor: 'pointer' }}>
                    <input type="radio" name="immediate" value="true" checked={actionForm.immediate !== 'false'}
                      onChange={() => setActionForm(f => ({ ...f, immediate: 'true' }))} /> Imediato
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', color: '#374151', cursor: 'pointer' }}>
                    <input type="radio" name="immediate" value="false"
                      onChange={() => setActionForm(f => ({ ...f, immediate: 'false' }))} /> Ao final do período
                  </label>
                </div>
              </label>
              <label style={{ fontSize: '13px', color: '#374151', fontWeight: 'bold' }}>
                Motivo *
                <input value={actionForm.motivo || ''} onChange={e => setActionForm(f => ({ ...f, motivo: e.target.value }))}
                  placeholder="Ex: Inadimplência, Solicitação do cliente..."
                  style={{ display: 'block', width: '100%', padding: '8px', border: '1px solid #E5E7EB', borderRadius: '8px', marginTop: '4px', boxSizing: 'border-box' }} />
              </label>
            </div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '20px', justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setActionModal(null)} style={{ padding: '10px 20px', background: '#F3F4F6', color: '#374151', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>Voltar</button>
              <button type="button" disabled={actionLoading || !actionForm.motivo} onClick={() => {
                setConfirmModal({
                  title: 'Confirmar Cancelamento',
                  message: `Tem certeza que deseja cancelar a assinatura de ${selectedUser.nome_completo}? ${actionForm.immediate !== 'false' ? 'O acesso será cortado imediatamente.' : 'O acesso continua até o final do período.'}`,
                  onConfirm: () => { setConfirmModal(null); execAction('cancel_subscription', { immediate: actionForm.immediate !== 'false', motivo: actionForm.motivo }) }
                })
              }} style={{
                padding: '10px 20px', background: !actionForm.motivo ? '#D1D5DB' : '#B4533A', color: '#fff',
                border: 'none', borderRadius: '8px', cursor: !actionForm.motivo ? 'not-allowed' : 'pointer', fontWeight: 'bold'
              }}>{actionLoading ? 'Cancelando...' : 'Cancelar Assinatura'}</button>
            </div>
          </div>
        </div>
      )}

      {actionModal === 'mark_paid' && selectedUser && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 110, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: '#fff', borderRadius: '16px', padding: '32px', maxWidth: '480px', width: '100%' }}>
            <h3 style={{ color: '#2E7D6B', fontSize: '18px', fontWeight: 'bold', margin: '0 0 16px 0' }}>
              Marcar Fatura como Paga — {selectedUser.nome_completo}
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <label style={{ fontSize: '13px', color: '#374151', fontWeight: 'bold' }}>
                Data do pagamento
                <input type="date" value={actionForm.paid_date || new Date().toISOString().split('T')[0]}
                  onChange={e => setActionForm(f => ({ ...f, paid_date: e.target.value }))}
                  style={{ display: 'block', width: '100%', padding: '8px', border: '1px solid #E5E7EB', borderRadius: '8px', marginTop: '4px', boxSizing: 'border-box' }} />
              </label>
              <label style={{ fontSize: '13px', color: '#374151', fontWeight: 'bold' }}>
                Método de pagamento
                <select value={actionForm.paid_method || 'pix_manual'} onChange={e => setActionForm(f => ({ ...f, paid_method: e.target.value }))}
                  style={{ display: 'block', width: '100%', padding: '8px', border: '1px solid #E5E7EB', borderRadius: '8px', marginTop: '4px' }}>
                  <option value="pix_manual">PIX manual</option>
                  <option value="transferencia">Transferência</option>
                  <option value="dinheiro">Dinheiro</option>
                  <option value="outro">Outro</option>
                </select>
              </label>
              <label style={{ fontSize: '13px', color: '#374151', fontWeight: 'bold' }}>
                Observação
                <input value={actionForm.observation || ''} onChange={e => setActionForm(f => ({ ...f, observation: e.target.value }))}
                  placeholder="Ex: Depósito confirmado pelo banco..."
                  style={{ display: 'block', width: '100%', padding: '8px', border: '1px solid #E5E7EB', borderRadius: '8px', marginTop: '4px', boxSizing: 'border-box' }} />
              </label>
            </div>
            <p style={{ fontSize: '12px', color: '#9CA3AF', marginTop: '12px' }}>
              Nota: para usar esta função, primeiro crie uma fatura para o usuário na tabela invoices.
            </p>
            <div style={{ display: 'flex', gap: '8px', marginTop: '16px', justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setActionModal(null)} style={{ padding: '10px 20px', background: '#F3F4F6', color: '#374151', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>Cancelar</button>
              <button type="button" disabled={actionLoading} onClick={() => execAction('mark_paid', {
                invoice_id: actionForm.invoice_id,
                paid_date: actionForm.paid_date || new Date().toISOString(),
                paid_method: actionForm.paid_method || 'pix_manual',
                observation: actionForm.observation,
              })} style={{
                padding: '10px 20px', background: '#2E7D6B', color: '#fff',
                border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold'
              }}>{actionLoading ? 'Salvando...' : 'Confirmar Pagamento'}</button>
            </div>
          </div>
        </div>
      )}

      {confirmModal && (
        <ConfirmModal open={true} title={confirmModal.title} message={confirmModal.message}
          variant="danger" confirmLabel="Confirmar" cancelLabel="Cancelar"
          onConfirm={confirmModal.onConfirm} onCancel={() => setConfirmModal(null)} />
      )}
    </AppShell>
  )
}
