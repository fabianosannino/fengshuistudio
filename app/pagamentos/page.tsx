'use client'

import { redirecionarParaLogin } from '../../src/lib/auth-rotas'
import { estadoDoPagamento, totaisFinanceiros, diasDeAtraso, reguaDaParcela, APARENCIA } from '../../src/lib/estado-do-pagamento'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../src/lib/supabase'
import AppShell from '../components/AppShell'
import ConfirmModal from '../components/ConfirmModal'
import Skeleton from '../components/Skeleton'
import type { Pagamento, Cliente, Consulta } from '../../src/lib/types'
import type { User } from '@supabase/supabase-js'
import { Wrench, Wallet, User as UserIcon, Home as HomeIcon, Check } from 'lucide-react'

const STATUS_CONFIG: Record<string, { label: string; cor: string; bg: string }> = {
  pendente: { label: 'Pendente', cor: '#8A6E2F', bg: '#FAF3E0' },
  pago: { label: 'Pago', cor: '#2E7D6B', bg: '#F0F6F3' },
  atrasado: { label: 'Atrasado', cor: '#B4533A', bg: '#FAEEE9' },
  cancelado: { label: 'Cancelado', cor: '#6B7280', bg: '#F3F4F6' },
}

const PAGE_SIZE = 10

const METODOS: Record<string, string> = {
  pix: 'Pix',
  cartao: 'Cartão',
  boleto: 'Boleto',
  dinheiro: 'Dinheiro',
  transferencia: 'Transferência',
  outro: 'Outro',
}

export default function Pagamentos() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [currentPage, setCurrentPage] = useState(0)
  const [userId, setUserId] = useState<string | null>(null)
  const [clientes, setClientes] = useState<Pick<Cliente, 'id' | 'nome_completo'>[]>([])
  const [consultas, setConsultas] = useState<Pick<Consulta, 'id' | 'nome_imovel'>[]>([])

  // Modal
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  // Filtros
  const [filtroStatus, setFiltroStatus] = useState<string>('todos')

  // KPI totals (loaded separately, not paginated)
  const [totalRecebido, setTotalRecebido] = useState(0)
  const [totalPendente, setTotalPendente] = useState(0)
  const [totalAtrasado, setTotalAtrasado] = useState(0)
  const [allCount, setAllCount] = useState(0)

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

  const loadPagamentos = useCallback(async (pageNum: number, statusFilter?: string, uid?: string) => {
    const id = uid || userId
    if (!id) return

    setLoading(true)
    const from = pageNum * PAGE_SIZE
    const to = from + PAGE_SIZE - 1
    const filter = statusFilter !== undefined ? statusFilter : filtroStatus

    let query = supabase
      .from('pagamentos')
      .select('*, clientes(nome_completo), consultas(nome_imovel)', { count: 'exact' })
      .eq('consultor_id', id)
      .order('data_vencimento', { ascending: false })

    if (filter !== 'todos') {
      query = query.eq('status', filter)
    }

    const { data, count } = await query.range(from, to)

    setPagamentos(data || [])
    setTotalCount(count || 0)
    setCurrentPage(pageNum)
    setLoading(false)
  }, [userId, filtroStatus])

  const loadKpiTotals = useCallback(async (uid: string) => {
    // Load all pagamentos just for KPI computation (no pagination, only needed fields)
    const { data: allPags, count } = await supabase
      .from('pagamentos')
      .select('valor, status, data_vencimento', { count: 'exact' })
      .eq('consultor_id', uid)

    setAllCount(count || 0)

    if (allPags) {
      // Cada parcela cai em **um** balde. Antes, a soma de pendentes incluía
      // todo `status = 'pendente'` e a de atrasados somava por cima os
      // pendentes com data vencida — a mesma parcela contada duas vezes, e
      // pendente + atrasado dando mais que o contratado.
      const totais = totaisFinanceiros(allPags)
      setTotalRecebido(totais.recebido)
      setTotalPendente(totais.aReceber)
      setTotalAtrasado(totais.vencido)
    }
  }, [])

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { redirecionarParaLogin(); return }
      setUser(user)
      setUserId(user.id)

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

      await Promise.all([
        loadPagamentos(0, 'todos', user.id),
        loadKpiTotals(user.id),
      ])
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handlePageChange(newPage: number) {
    loadPagamentos(newPage)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function handleFiltroChange(newFiltro: string) {
    setFiltroStatus(newFiltro)
    loadPagamentos(0, newFiltro)
  }

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

  function openEdit(pag: Pagamento) {
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
      consultor_id: user!.id,
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

    // Reload current page and KPIs
    await Promise.all([
      loadPagamentos(currentPage, undefined, user!.id),
      loadKpiTotals(user!.id),
    ])

    setShowModal(false)
    resetForm()
    setSaving(false)
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return
    const { error } = await supabase.from('pagamentos').delete().eq('id', deleteTarget)
    if (error) {
      setMessage('Erro ao excluir pagamento: ' + error.message)
      setDeleteTarget(null)
      return
    }
    // Reload current page and KPIs
    await Promise.all([
      loadPagamentos(currentPage, undefined, user!.id),
      loadKpiTotals(user!.id),
    ])
    setDeleteTarget(null)
  }

  async function handleMarcarPago(pag: Pagamento) {
    const hoje = new Date().toISOString().split('T')[0]
    const { error } = await supabase.from('pagamentos').update({
      status: 'pago',
      data_pagamento: hoje,
    }).eq('id', pag.id)
    if (error) {
      setMessage('Erro ao marcar como pago: ' + error.message)
      return
    }
    // Reload current page and KPIs
    await Promise.all([
      loadPagamentos(currentPage, undefined, user!.id),
      loadKpiTotals(user!.id),
    ])
  }

  function formatCurrency(value: number) {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  }

  function formatDate(dateStr: string) {
    if (!dateStr) return '—'
    const d = new Date(dateStr + 'T12:00:00')
    return d.toLocaleDateString('pt-BR')
  }

  // `isVencido` saiu: a regra vive em `estadoDoPagamento`, e ela também cobre
  // o caso inverso — status «atrasado» gravado numa parcela cuja data foi
  // renegociada para o futuro.

  const totalPages = Math.ceil(totalCount / PAGE_SIZE)

  if (loading && pagamentos.length === 0) {
    return (
      <AppShell currentPage="pagamentos">
        <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <Skeleton width="180px" height="24px" />
            <div style={{ marginTop: '8px' }}><Skeleton width="220px" height="14px" /></div>
          </div>
          <Skeleton width="160px" height="44px" borderRadius="8px" />
        </div>
        <Skeleton variant="kpi" />
        <div style={{ marginTop: '24px' }}>
          <Skeleton variant="list" rows={5} />
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell currentPage="pagamentos">
      {/* «Em desenvolvimento» descrevia a tela inteira, inclusive o que já
          funciona — e uma tela que se anuncia como inacabada não é usada. O
          aviso passa a dizer só o que de fato falta: a cobrança automática. */}
      <div style={{
        background: '#FAF3E0', border: '1px solid #EEDFB4', borderRadius: '10px',
        padding: '14px 18px', marginBottom: '24px',
        display: 'flex', gap: '12px', alignItems: 'flex-start',
      }}>
        <Wrench size={20} strokeWidth={1.75} color="#8A6E2F" style={{ flexShrink: 0, marginTop: '1px' }} aria-hidden="true" />
        <div>
          <p style={{ color: '#0E1B2C', fontSize: '13px', fontWeight: 700, margin: '0 0 3px 0' }}>
            O controle é seu; a cobrança ainda não é automática
          </p>
          <p style={{ color: '#6B7280', fontSize: '12px', margin: 0, lineHeight: 1.5 }}>
            Registrar parcelas, acompanhar vencimentos e dar baixa funciona. Link de
            cobrança e baixa automática dependem da conta Stripe conectada — quando ela
            estiver ativa, esta tela emite a cobrança por parcela.
          </p>
        </div>
      </div>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <p style={{ color: '#2E7D6B', fontSize: '12px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 8px 0' }}>Financeiro</p>
          <h1 style={{ color: '#0E1B2C', fontSize: '30px', fontWeight: 600, margin: '0 0 6px 0', letterSpacing: '-0.01em' }}>Pagamentos</h1>
          <p style={{ color: '#6B7280', fontSize: '15px', margin: '0' }}>{allCount} pagamento(s) registrado(s)</p>
        </div>
        <button type="button" onClick={openNew} style={{
          background: '#2E7D6B', color: '#ffffff', border: 'none',
          padding: '12px 24px', borderRadius: '8px', fontSize: '15px',
          fontWeight: 'bold', cursor: 'pointer',
        }}>+ Novo pagamento</button>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div style={{ background: '#F0F6F3', borderRadius: '12px', padding: '20px', borderLeft: '4px solid #2E7D6B' }}>
          <p style={{ color: '#6B7280', fontSize: '13px', margin: '0 0 4px 0' }}>Total Recebido</p>
          <p style={{ color: '#2E7D6B', fontSize: '24px', fontWeight: 'bold', margin: '0' }}>{formatCurrency(totalRecebido)}</p>
        </div>
        <div style={{ background: '#FAF3E0', borderRadius: '12px', padding: '20px', borderLeft: '4px solid #8A6E2F' }}>
          <p style={{ color: '#6B7280', fontSize: '13px', margin: '0 0 4px 0' }}>Total Pendente</p>
          <p style={{ color: '#8A6E2F', fontSize: '24px', fontWeight: 'bold', margin: '0' }}>{formatCurrency(totalPendente)}</p>
        </div>
        <div style={{ background: '#FAEEE9', borderRadius: '12px', padding: '20px', borderLeft: '4px solid #B4533A' }}>
          <p style={{ color: '#6B7280', fontSize: '13px', margin: '0 0 4px 0' }}>Total Atrasado</p>
          <p style={{ color: '#B4533A', fontSize: '24px', fontWeight: 'bold', margin: '0' }}>{formatCurrency(totalAtrasado)}</p>
        </div>
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {['todos', 'pendente', 'pago', 'atrasado', 'cancelado'].map(f => (
          <button type="button" key={f} onClick={() => handleFiltroChange(f)} style={{
            padding: '8px 16px', borderRadius: '20px', fontSize: '13px', fontWeight: 'bold',
            cursor: 'pointer', border: 'none',
            background: filtroStatus === f ? '#0E1B2C' : '#F3F4F6',
            color: filtroStatus === f ? '#ffffff' : '#6B7280',
          }}>
            {f === 'todos' ? 'Todos' : STATUS_CONFIG[f]?.label || f}
          </button>
        ))}
      </div>

      {message && (
        <div style={{
          marginBottom: '16px', padding: '10px 16px', borderRadius: '8px',
          background: '#FAEEE9', border: '1px solid #EBD3C7',
          color: '#B4533A', fontSize: '14px',
        }}>{message}</div>
      )}

      {/* Lista */}
      {loading ? (
        <Skeleton variant="list" rows={5} />
      ) : totalCount === 0 ? (
        <div style={{
          background: '#ffffff', borderRadius: '12px', padding: '64px 32px',
          textAlign: 'center', boxShadow: '0 1px 2px rgba(14,27,44,0.04), 0 10px 28px -16px rgba(14,27,44,0.18)', border: '1px solid rgba(14,27,44,0.06)'
        }}>
          <Wallet size={44} strokeWidth={1.5} color="#2E7D6B" style={{ margin: '0 auto 16px' }} aria-hidden="true" />
          <h3 style={{ color: '#0E1B2C', fontSize: '18px', marginBottom: '8px' }}>Nenhum pagamento encontrado</h3>
          <p style={{ color: '#6B7280', fontSize: '14px', marginBottom: '24px' }}>Registre pagamentos para controlar seu financeiro</p>
          <button type="button" onClick={openNew} style={{
            background: '#2E7D6B', color: '#ffffff', border: 'none',
            padding: '12px 24px', borderRadius: '8px', fontSize: '15px',
            fontWeight: 'bold', cursor: 'pointer'
          }}>Registrar primeiro pagamento</button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {pagamentos.map(pag => {
            const estado = estadoDoPagamento(pag)
            const st = APARENCIA[estado]
            const vencido = estado === 'atrasado'
            const atraso = diasDeAtraso(pag)
            return (
              <div key={pag.id} style={{
                background: '#ffffff', borderRadius: '12px', padding: '16px 20px',
                boxShadow: '0 1px 2px rgba(14,27,44,0.04), 0 10px 28px -16px rgba(14,27,44,0.18)', border: '1px solid rgba(14,27,44,0.06)',
                borderLeft: `4px solid ${vencido ? '#B4533A' : st.cor}`,
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
                      background: st.fundo, color: st.cor,
                      padding: '2px 10px', borderRadius: '20px',
                      fontSize: '11px', fontWeight: 'bold',
                    }}>{st.rotulo}{atraso > 0 ? ` há ${atraso} ${atraso === 1 ? 'dia' : 'dias'}` : ''}</span>
                  </div>
                  <p style={{ color: '#6B7280', fontSize: '13px', margin: '0', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                    {pag.clientes?.nome_completo && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><UserIcon size={13} strokeWidth={1.75} aria-hidden="true" /> {pag.clientes.nome_completo}</span>}
                    {pag.clientes?.nome_completo && pag.consultas?.nome_imovel && <span aria-hidden="true">•</span>}
                    {pag.consultas?.nome_imovel && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><HomeIcon size={13} strokeWidth={1.75} aria-hidden="true" /> {pag.consultas.nome_imovel}</span>}
                  </p>
                  <p style={{ color: '#9CA3AF', fontSize: '12px', margin: '4px 0 0 0' }}>
                    Vence: {formatDate(pag.data_vencimento)}
                    {pag.data_pagamento && ` • Pago em: ${formatDate(pag.data_pagamento)}`}
                    {pag.metodo_pagamento && ` • ${METODOS[pag.metodo_pagamento] || pag.metodo_pagamento}`}
                  </p>
                </div>

                {/* Valor */}
                <div style={{ textAlign: 'right', minWidth: '120px' }}>
                  <p style={{ color: estado === 'pago' ? '#2E7D6B' : '#0E1B2C', fontSize: '20px', fontWeight: 'bold', margin: '0' }}>
                    {formatCurrency(Number(pag.valor))}
                  </p>
                  {/* A régua: três marcos, não cinco. «Enviado» e «aberto»
                      exigiriam link de cobrança com rastreio, que ainda não
                      existe — desenhá-los apagados sugeriria que o produto sabe
                      se o cliente abriu a cobrança. */}
                  <div role="img" aria-label={`Estado: ${st.rotulo}`}
                    style={{ display: 'flex', gap: '3px', marginTop: '6px', justifyContent: 'flex-end' }}>
                    {reguaDaParcela(pag).map((marco, i) => (
                      <span key={i} title={marco.rotulo} style={{
                        height: '4px', width: '28px', borderRadius: '99px',
                        background: marco.cumprido ? '#2E7D6B' : marco.atual ? st.cor : '#EAE5DA',
                      }} />
                    ))}
                  </div>
                </div>

                {/* Ações */}
                <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                  {(estado === 'atrasado' || estado === 'vence_hoje' || estado === 'a_vencer') && (
                    <button type="button" onClick={() => handleMarcarPago(pag)} style={{
                      padding: '6px 14px', background: '#F0F6F3', color: '#2E7D6B',
                      border: '1px solid #DCEAE4', borderRadius: '6px',
                      fontSize: '12px', fontWeight: 'bold', cursor: 'pointer',
                      display: 'inline-flex', alignItems: 'center', gap: '4px',
                    }}><Check size={13} strokeWidth={2.5} aria-hidden="true" /> Pago</button>
                  )}
                  <button type="button" onClick={() => openEdit(pag)} style={{
                    padding: '6px 14px', background: '#F3F4F6', color: '#374151',
                    border: '1px solid #E5E7EB', borderRadius: '6px',
                    fontSize: '12px', cursor: 'pointer',
                  }}>Editar</button>
                  <button type="button" onClick={() => setDeleteTarget(pag.id)} style={{
                    padding: '6px 14px', background: '#FAEEE9', color: '#B4533A',
                    border: '1px solid #EBD3C7', borderRadius: '6px',
                    fontSize: '12px', cursor: 'pointer',
                  }}>Excluir</button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div style={{
          display: 'flex', justifyContent: 'center', alignItems: 'center',
          gap: '8px', marginTop: '24px',
        }}>
          <button type="button"
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 0}
            style={{
              padding: '8px 16px', borderRadius: '8px', border: '1px solid #E5E7EB',
              background: currentPage === 0 ? '#F9FAFB' : '#ffffff',
              color: currentPage === 0 ? '#D1D5DB' : '#374151',
              cursor: currentPage === 0 ? 'not-allowed' : 'pointer',
              fontSize: '13px', fontWeight: 'bold',
            }}
          >← Anterior</button>
          <span style={{ color: '#6B7280', fontSize: '13px' }}>
            Página {currentPage + 1} de {totalPages}
          </span>
          <button type="button"
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage + 1 >= totalPages}
            style={{
              padding: '8px 16px', borderRadius: '8px', border: '1px solid #E5E7EB',
              background: currentPage + 1 >= totalPages ? '#F9FAFB' : '#ffffff',
              color: currentPage + 1 >= totalPages ? '#D1D5DB' : '#374151',
              cursor: currentPage + 1 >= totalPages ? 'not-allowed' : 'pointer',
              fontSize: '13px', fontWeight: 'bold',
            }}
          >Próximo →</button>
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
              <h2 style={{ color: '#0E1B2C', fontSize: '20px', fontWeight: 'bold', margin: '0' }}>
                {editingId ? 'Editar Pagamento' : 'Novo Pagamento'}
              </h2>
              <button type="button" onClick={() => { setShowModal(false); resetForm() }} style={{
                background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#9CA3AF',
              }}>×</button>
            </div>

            {message && (
              <div style={{
                marginBottom: '16px', padding: '10px 16px', borderRadius: '8px',
                background: '#FAEEE9', border: '1px solid #EBD3C7',
                color: '#B4533A', fontSize: '14px',
              }}>{message}</div>
            )}

            <form onSubmit={handleSave}>
              {/* Descrição */}
              <div style={{ marginBottom: '16px' }}>
                <label htmlFor="input-descricao" style={{ display: 'block', color: '#374151', fontSize: '14px', fontWeight: 'bold', marginBottom: '6px' }}>Descrição *</label>
                <input id="input-descricao" value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })}
                  placeholder="Ex: Consulta residencial - João" required
                  style={{ width: '100%', padding: '10px 14px', border: '1px solid #D1D5DB', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
              </div>

              {/* Valor + Status */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <label htmlFor="input-valor" style={{ display: 'block', color: '#374151', fontSize: '14px', fontWeight: 'bold', marginBottom: '6px' }}>Valor (R$) *</label>
                  <input id="input-valor" type="number" step="0.01" min="0" value={form.valor} onChange={e => setForm({ ...form, valor: e.target.value })}
                    placeholder="350.00" required
                    style={{ width: '100%', padding: '10px 14px', border: '1px solid #D1D5DB', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label htmlFor="select-status" style={{ display: 'block', color: '#374151', fontSize: '14px', fontWeight: 'bold', marginBottom: '6px' }}>Status</label>
                  <select id="select-status" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}
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
                  <label htmlFor="input-vencimento" style={{ display: 'block', color: '#374151', fontSize: '14px', fontWeight: 'bold', marginBottom: '6px' }}>Vencimento *</label>
                  <input id="input-vencimento" type="date" value={form.data_vencimento} onChange={e => setForm({ ...form, data_vencimento: e.target.value })}
                    required
                    style={{ width: '100%', padding: '10px 14px', border: '1px solid #D1D5DB', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label htmlFor="input-data-pagamento" style={{ display: 'block', color: '#374151', fontSize: '14px', fontWeight: 'bold', marginBottom: '6px' }}>Data pagamento</label>
                  <input id="input-data-pagamento" type="date" value={form.data_pagamento} onChange={e => setForm({ ...form, data_pagamento: e.target.value })}
                    style={{ width: '100%', padding: '10px 14px', border: '1px solid #D1D5DB', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
                </div>
              </div>

              {/* Método + Cliente */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <label htmlFor="select-metodo-pagamento" style={{ display: 'block', color: '#374151', fontSize: '14px', fontWeight: 'bold', marginBottom: '6px' }}>Método de pagamento</label>
                  <select id="select-metodo-pagamento" value={form.metodo_pagamento} onChange={e => setForm({ ...form, metodo_pagamento: e.target.value })}
                    style={{ width: '100%', padding: '10px 14px', border: '1px solid #D1D5DB', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box', background: '#fff' }}>
                    <option value="">Selecione...</option>
                    {Object.entries(METODOS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="select-cliente" style={{ display: 'block', color: '#374151', fontSize: '14px', fontWeight: 'bold', marginBottom: '6px' }}>Cliente</label>
                  <select id="select-cliente" value={form.cliente_id} onChange={e => setForm({ ...form, cliente_id: e.target.value })}
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
                <label htmlFor="select-consulta" style={{ display: 'block', color: '#374151', fontSize: '14px', fontWeight: 'bold', marginBottom: '6px' }}>Consulta vinculada</label>
                <select id="select-consulta" value={form.consulta_id} onChange={e => setForm({ ...form, consulta_id: e.target.value })}
                  style={{ width: '100%', padding: '10px 14px', border: '1px solid #D1D5DB', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box', background: '#fff' }}>
                  <option value="">Nenhuma</option>
                  {consultas.map(c => (
                    <option key={c.id} value={c.id}>{c.nome_imovel}</option>
                  ))}
                </select>
              </div>

              {/* Observações */}
              <div style={{ marginBottom: '24px' }}>
                <label htmlFor="textarea-observacoes" style={{ display: 'block', color: '#374151', fontSize: '14px', fontWeight: 'bold', marginBottom: '6px' }}>Observações</label>
                <textarea id="textarea-observacoes" value={form.observacoes} onChange={e => setForm({ ...form, observacoes: e.target.value })}
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
                  background: saving ? '#9CA3AF' : '#2E7D6B',
                  color: '#ffffff', border: 'none', borderRadius: '8px',
                  fontSize: '15px', fontWeight: 'bold',
                  cursor: saving ? 'not-allowed' : 'pointer',
                }}>{saving ? 'Salvando...' : editingId ? 'Atualizar' : 'Criar pagamento'}</button>
              </div>
            </form>
          </div>
        </>
      )}

      <ConfirmModal
        open={deleteTarget !== null}
        title="Excluir pagamento"
        message="Tem certeza que deseja excluir este pagamento? Esta ação não pode ser desfeita."
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
        variant="danger"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
      />
    </AppShell>
  )
}
