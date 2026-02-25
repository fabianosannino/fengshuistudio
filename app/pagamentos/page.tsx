'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../src/lib/supabase'
import AppShell from '../components/AppShell'

const STATUS_CONFIG: Record<string, { label: string; cor: string; bg: string }> = {
  pendente: { label: 'Pendente', cor: '#D97706', bg: '#FFFBEB' },
  pago: { label: 'Pago', cor: '#15803D', bg: '#F0FDF4' },
  atrasado: { label: 'Atrasado', cor: '#DC2626', bg: '#FEF2F2' },
  cancelado: { label: 'Cancelado', cor: '#6B7280', bg: '#F3F4F6' },
}

const METODOS: Record<string, string> = {
  pix: 'Pix',
  cartao: 'Cartão',
  boleto: 'Boleto',
  dinheiro: 'Dinheiro',
  transferencia: 'Transferência',
  outro: 'Outro',
}

export default function Pagamentos() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [pagamentos, setPagamentos] = useState<any[]>([])
  const [clientes, setClientes] = useState<any[]>([])
  const [consultas, setConsultas] = useState<any[]>([])

  // Modal
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  // Filtros
  const [filtroStatus, setFiltroStatus] = useState<string>('todos')

  // Form
  const [form, setForm] = useState({
    descricao: '',
    valor: '',
    status: 'pendente',
    data_vencimento: '',
    data_pagamento: '',
    metodo_pagamento: '',
    cliente_id: '',
    consulta_id: '',
    observacoes: '',
  })

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/login'; return }
      setUser(user)

      // Pagamentos
      const { data: pags } = await supabase
        .from('pagamentos')
        .select('*, clientes(nome_completo), consultas(nome_imovel)')
        .eq('consultor_id', user.id)
        .order('data_vencimento', { ascending: false })
      setPagamentos(pags || [])

      // Clientes (para select)
      const { data: cls } = await supabase
        .from('clientes')
        .select('id, nome_completo')
        .eq('consultor_id', user.id)
        .eq('ativo', true)
        .order('nome_completo')
      setClientes(cls || [])

      // Consultas (para select)
      const { data: cons } = await supabase
        .from('consultas')
        .select('id, nome_imovel')
        .eq('consultor_id', user.id)
        .order('criado_em', { ascending: false })
      setConsultas(cons || [])

      setLoading(false)
    }
    load()
  }, [])

  function resetForm() {
    setForm({
      descricao: '', valor: '', status: 'pendente',
      data_vencimento: '', data_pagamento: '',
      metodo_pagamento: '', cliente_id: '', consulta_id: '', observacoes: '',
    })
    setEditingId(null)
  }

  function openNew() {
    resetForm()
    setShowModal(true)
  }

  function openEdit(pag: any) {
    setForm({
      descricao: pag.descricao || '',
      valor: String(pag.valor) || '',
      status: pag.status || 'pendente',
      data_vencimento: pag.data_vencimento || '',
      data_pagamento: pag.data_pagamento || '',
      metodo_pagamento: pag.metodo_pagamento || '',
      cliente_id: pag.cliente_id || '',
      consulta_id: pag.consulta_id || '',
      observacoes: pag.observacoes || '',
    })
    setEditingId(pag.id)
    setShowModal(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setMessage('')

    const payload = {
      consultor_id: user.id,
      descricao: form.descricao,
      valor: parseFloat(form.valor),
      status: form.status,
      data_vencimento: form.data_vencimento,
      data_pagamento: form.data_pagamento || null,
      metodo_pagamento: form.metodo_pagamento || null,
      cliente_id: form.cliente_id || null,
      consulta_id: form.consulta_id || null,
      observacoes: form.observacoes || null,
    }

    if (editingId) {
      const { error } = await supabase.from('pagamentos').update(payload).eq('id', editingId)
      if (error) { setMessage('Erro ao atualizar: ' + error.message); setSaving(false); return }
    } else {
      const { error } = await supabase.from('pagamentos').insert(payload)
      if (error) { setMessage('Erro ao criar: ' + error.message); setSaving(false); return }
    }

    // Reload
    const { data: pags } = await supabase
      .from('pagamentos')
      .select('*, clientes(nome_completo), consultas(nome_imovel)')
      .eq('consultor_id', user.id)
      .order('data_vencimento', { ascending: false })
    setPagamentos(pags || [])

    setShowModal(false)
    resetForm()
    setSaving(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('Deseja excluir este pagamento?')) return
    const { error } = await supabase.from('pagamentos').delete().eq('id', id)
    if (error) {
      setMessage('Erro ao excluir pagamento: ' + error.message)
      return
    }
    setPagamentos(pagamentos.filter(p => p.id !== id))
  }

  async function handleMarcarPago(pag: any) {
    const hoje = new Date().toISOString().split('T')[0]
    const { error } = await supabase.from('pagamentos').update({
      status: 'pago',
      data_pagamento: hoje,
    }).eq('id', pag.id)
    if (error) {
      setMessage('Erro ao marcar como pago: ' + error.message)
      return
    }
    setPagamentos(pagamentos.map(p => p.id === pag.id ? { ...p, status: 'pago', data_pagamento: hoje } : p))
  }

  function formatCurrency(value: number) {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  }

  function formatDate(dateStr: string) {
    if (!dateStr) return '—'
    const d = new Date(dateStr + 'T12:00:00')
    return d.toLocaleDateString('pt-BR')
  }

  function isVencido(pag: any) {
    if (pag.status !== 'pendente') return false
    return new Date(pag.data_vencimento) < new Date(new Date().toISOString().split('T')[0])
  }

  // Filtro
  const pagsFiltrados = filtroStatus === 'todos'
    ? pagamentos
    : pagamentos.filter(p => p.status === filtroStatus)

  // Totais
  const totalRecebido = pagamentos.filter(p => p.status === 'pago').reduce((a, p) => a + Number(p.valor), 0)
  const totalPendente = pagamentos.filter(p => p.status === 'pendente').reduce((a, p) => a + Number(p.valor), 0)
  const totalAtrasado = pagamentos.filter(p => p.status === 'atrasado' || isVencido(p)).reduce((a, p) => a + Number(p.valor), 0)

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F9FAFB', fontFamily: 'Arial, sans-serif' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>☯</div>
          <p style={{ color: '#7C3AED', fontSize: '16px' }}>Carregando...</p>
        </div>
      </div>
    )
  }

  return (
    <AppShell currentPage="pagamentos">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ color: '#1E3A5F', fontSize: '24px', fontWeight: 'bold', margin: '0 0 4px 0' }}>Pagamentos</h1>
          <p style={{ color: '#6B7280', fontSize: '15px', margin: '0' }}>{pagamentos.length} pagamento(s) registrado(s)</p>
        </div>
        <button onClick={openNew} style={{
          background: '#7C3AED', color: '#ffffff', border: 'none',
          padding: '12px 24px', borderRadius: '8px', fontSize: '15px',
          fontWeight: 'bold', cursor: 'pointer',
        }}>+ Novo pagamento</button>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div style={{ background: '#F0FDF4', borderRadius: '12px', padding: '20px', borderLeft: '4px solid #15803D' }}>
          <p style={{ color: '#6B7280', fontSize: '13px', margin: '0 0 4px 0' }}>Total Recebido</p>
          <p style={{ color: '#15803D', fontSize: '24px', fontWeight: 'bold', margin: '0' }}>{formatCurrency(totalRecebido)}</p>
        </div>
        <div style={{ background: '#FFFBEB', borderRadius: '12px', padding: '20px', borderLeft: '4px solid #D97706' }}>
          <p style={{ color: '#6B7280', fontSize: '13px', margin: '0 0 4px 0' }}>Total Pendente</p>
          <p style={{ color: '#D97706', fontSize: '24px', fontWeight: 'bold', margin: '0' }}>{formatCurrency(totalPendente)}</p>
        </div>
        <div style={{ background: '#FEF2F2', borderRadius: '12px', padding: '20px', borderLeft: '4px solid #DC2626' }}>
          <p style={{ color: '#6B7280', fontSize: '13px', margin: '0 0 4px 0' }}>Total Atrasado</p>
          <p style={{ color: '#DC2626', fontSize: '24px', fontWeight: 'bold', margin: '0' }}>{formatCurrency(totalAtrasado)}</p>
        </div>
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {['todos', 'pendente', 'pago', 'atrasado', 'cancelado'].map(f => (
          <button key={f} onClick={() => setFiltroStatus(f)} style={{
            padding: '8px 16px', borderRadius: '20px', fontSize: '13px', fontWeight: 'bold',
            cursor: 'pointer', border: 'none',
            background: filtroStatus === f ? '#1E3A5F' : '#F3F4F6',
            color: filtroStatus === f ? '#ffffff' : '#6B7280',
          }}>
            {f === 'todos' ? 'Todos' : STATUS_CONFIG[f]?.label || f}
          </button>
        ))}
      </div>

      {/* Lista */}
      {pagsFiltrados.length === 0 ? (
        <div style={{
          background: '#ffffff', borderRadius: '12px', padding: '64px 32px',
          textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.08)'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>💰</div>
          <h3 style={{ color: '#1E3A5F', fontSize: '18px', marginBottom: '8px' }}>Nenhum pagamento encontrado</h3>
          <p style={{ color: '#6B7280', fontSize: '14px', marginBottom: '24px' }}>Registre pagamentos para controlar seu financeiro</p>
          <button onClick={openNew} style={{
            background: '#7C3AED', color: '#ffffff', border: 'none',
            padding: '12px 24px', borderRadius: '8px', fontSize: '15px',
            fontWeight: 'bold', cursor: 'pointer'
          }}>Registrar primeiro pagamento</button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {pagsFiltrados.map(pag => {
            const st = STATUS_CONFIG[pag.status] || STATUS_CONFIG.pendente
            const vencido = isVencido(pag)
            return (
              <div key={pag.id} style={{
                background: '#ffffff', borderRadius: '12px', padding: '16px 20px',
                boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
                borderLeft: `4px solid ${vencido ? '#DC2626' : st.cor}`,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                flexWrap: 'wrap', gap: '12px',
              }}>
                {/* Info */}
                <div style={{ flex: 1, minWidth: '200px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                    <h3 style={{ color: '#111827', fontSize: '15px', fontWeight: 'bold', margin: '0' }}>
                      {pag.descricao}
                    </h3>
                    <span style={{
                      background: vencido ? '#FEF2F2' : st.bg,
                      color: vencido ? '#DC2626' : st.cor,
                      padding: '2px 10px', borderRadius: '20px',
                      fontSize: '11px', fontWeight: 'bold',
                    }}>{vencido ? 'Atrasado' : st.label}</span>
                  </div>
                  <p style={{ color: '#6B7280', fontSize: '13px', margin: '0' }}>
                    {pag.clientes?.nome_completo && `👤 ${pag.clientes.nome_completo}`}
                    {pag.consultas?.nome_imovel && ` • 🏠 ${pag.consultas.nome_imovel}`}
                  </p>
                  <p style={{ color: '#9CA3AF', fontSize: '12px', margin: '4px 0 0 0' }}>
                    Vence: {formatDate(pag.data_vencimento)}
                    {pag.data_pagamento && ` • Pago em: ${formatDate(pag.data_pagamento)}`}
                    {pag.metodo_pagamento && ` • ${METODOS[pag.metodo_pagamento] || pag.metodo_pagamento}`}
                  </p>
                </div>

                {/* Valor */}
                <div style={{ textAlign: 'right', minWidth: '120px' }}>
                  <p style={{ color: pag.status === 'pago' ? '#15803D' : '#111827', fontSize: '20px', fontWeight: 'bold', margin: '0' }}>
                    {formatCurrency(Number(pag.valor))}
                  </p>
                </div>

                {/* Ações */}
                <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                  {(pag.status === 'pendente' || pag.status === 'atrasado' || vencido) && (
                    <button onClick={() => handleMarcarPago(pag)} style={{
                      padding: '6px 14px', background: '#F0FDF4', color: '#15803D',
                      border: '1px solid #BBF7D0', borderRadius: '6px',
                      fontSize: '12px', fontWeight: 'bold', cursor: 'pointer',
                    }}>✓ Pago</button>
                  )}
                  <button onClick={() => openEdit(pag)} style={{
                    padding: '6px 14px', background: '#F3F4F6', color: '#374151',
                    border: '1px solid #E5E7EB', borderRadius: '6px',
                    fontSize: '12px', cursor: 'pointer',
                  }}>Editar</button>
                  <button onClick={() => handleDelete(pag.id)} style={{
                    padding: '6px 14px', background: '#FEF2F2', color: '#DC2626',
                    border: '1px solid #FECACA', borderRadius: '6px',
                    fontSize: '12px', cursor: 'pointer',
                  }}>Excluir</button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* MODAL */}
      {showModal && (
        <>
          <div onClick={() => { setShowModal(false); resetForm() }} style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100,
          }} />
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            background: '#ffffff', borderRadius: '16px', padding: '32px',
            width: '100%', maxWidth: '540px', maxHeight: '90vh', overflowY: 'auto',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)', zIndex: 101,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ color: '#1E3A5F', fontSize: '20px', fontWeight: 'bold', margin: '0' }}>
                {editingId ? 'Editar Pagamento' : 'Novo Pagamento'}
              </h2>
              <button onClick={() => { setShowModal(false); resetForm() }} style={{
                background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#9CA3AF',
              }}>×</button>
            </div>

            {message && (
              <div style={{
                marginBottom: '16px', padding: '10px 16px', borderRadius: '8px',
                background: '#FEF2F2', border: '1px solid #FECACA',
                color: '#DC2626', fontSize: '14px',
              }}>{message}</div>
            )}

            <form onSubmit={handleSave}>
              {/* Descrição */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', color: '#374151', fontSize: '14px', fontWeight: 'bold', marginBottom: '6px' }}>Descricao *</label>
                <input value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })}
                  placeholder="Ex: Consulta residencial - Joao" required
                  style={{ width: '100%', padding: '10px 14px', border: '1px solid #D1D5DB', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
              </div>

              {/* Valor + Status */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', color: '#374151', fontSize: '14px', fontWeight: 'bold', marginBottom: '6px' }}>Valor (R$) *</label>
                  <input type="number" step="0.01" min="0" value={form.valor} onChange={e => setForm({ ...form, valor: e.target.value })}
                    placeholder="350.00" required
                    style={{ width: '100%', padding: '10px 14px', border: '1px solid #D1D5DB', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ display: 'block', color: '#374151', fontSize: '14px', fontWeight: 'bold', marginBottom: '6px' }}>Status</label>
                  <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}
                    style={{ width: '100%', padding: '10px 14px', border: '1px solid #D1D5DB', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box', background: '#fff' }}>
                    <option value="pendente">Pendente</option>
                    <option value="pago">Pago</option>
                    <option value="atrasado">Atrasado</option>
                    <option value="cancelado">Cancelado</option>
                  </select>
                </div>
              </div>

              {/* Datas */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', color: '#374151', fontSize: '14px', fontWeight: 'bold', marginBottom: '6px' }}>Vencimento *</label>
                  <input type="date" value={form.data_vencimento} onChange={e => setForm({ ...form, data_vencimento: e.target.value })}
                    required
                    style={{ width: '100%', padding: '10px 14px', border: '1px solid #D1D5DB', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ display: 'block', color: '#374151', fontSize: '14px', fontWeight: 'bold', marginBottom: '6px' }}>Data pagamento</label>
                  <input type="date" value={form.data_pagamento} onChange={e => setForm({ ...form, data_pagamento: e.target.value })}
                    style={{ width: '100%', padding: '10px 14px', border: '1px solid #D1D5DB', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
                </div>
              </div>

              {/* Método + Cliente */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', color: '#374151', fontSize: '14px', fontWeight: 'bold', marginBottom: '6px' }}>Metodo de pagamento</label>
                  <select value={form.metodo_pagamento} onChange={e => setForm({ ...form, metodo_pagamento: e.target.value })}
                    style={{ width: '100%', padding: '10px 14px', border: '1px solid #D1D5DB', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box', background: '#fff' }}>
                    <option value="">Selecione...</option>
                    {Object.entries(METODOS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', color: '#374151', fontSize: '14px', fontWeight: 'bold', marginBottom: '6px' }}>Cliente</label>
                  <select value={form.cliente_id} onChange={e => setForm({ ...form, cliente_id: e.target.value })}
                    style={{ width: '100%', padding: '10px 14px', border: '1px solid #D1D5DB', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box', background: '#fff' }}>
                    <option value="">Nenhum</option>
                    {clientes.map(c => (
                      <option key={c.id} value={c.id}>{c.nome_completo}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Consulta */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', color: '#374151', fontSize: '14px', fontWeight: 'bold', marginBottom: '6px' }}>Consulta vinculada</label>
                <select value={form.consulta_id} onChange={e => setForm({ ...form, consulta_id: e.target.value })}
                  style={{ width: '100%', padding: '10px 14px', border: '1px solid #D1D5DB', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box', background: '#fff' }}>
                  <option value="">Nenhuma</option>
                  {consultas.map(c => (
                    <option key={c.id} value={c.id}>{c.nome_imovel}</option>
                  ))}
                </select>
              </div>

              {/* Observações */}
              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', color: '#374151', fontSize: '14px', fontWeight: 'bold', marginBottom: '6px' }}>Observacoes</label>
                <textarea value={form.observacoes} onChange={e => setForm({ ...form, observacoes: e.target.value })}
                  placeholder="Notas adicionais..." rows={3}
                  style={{ width: '100%', padding: '10px 14px', border: '1px solid #D1D5DB', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box', resize: 'vertical' }} />
              </div>

              {/* Botões */}
              <div style={{ display: 'flex', gap: '12px' }}>
                <button type="button" onClick={() => { setShowModal(false); resetForm() }} style={{
                  flex: 1, padding: '14px', background: '#F3F4F6', color: '#374151',
                  border: 'none', borderRadius: '8px', fontSize: '15px',
                  fontWeight: 'bold', cursor: 'pointer',
                }}>Cancelar</button>
                <button type="submit" disabled={saving} style={{
                  flex: 1, padding: '14px',
                  background: saving ? '#9CA3AF' : '#7C3AED',
                  color: '#ffffff', border: 'none', borderRadius: '8px',
                  fontSize: '15px', fontWeight: 'bold',
                  cursor: saving ? 'not-allowed' : 'pointer',
                }}>{saving ? 'Salvando...' : editingId ? 'Atualizar' : 'Criar pagamento'}</button>
              </div>
            </form>
          </div>
        </>
      )}
    </AppShell>
  )
}
