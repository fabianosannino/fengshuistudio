'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../../src/lib/supabase'
import { useParams } from 'next/navigation'
import Image from 'next/image'
import AppShell from '../../components/AppShell'
import ConfirmModal from '../../components/ConfirmModal'
import Skeleton from '../../components/Skeleton'
import type { Cliente, Consulta } from '../../../src/lib/types'

const STATUS_LABELS: Record<string, { icon: string; label: string; bg: string; color: string }> = {
  sem_analise: { icon: '☯', label: 'Sem análise', bg: '#F3F4F6', color: '#6B7280' },
  em_andamento: { icon: '🔄', label: 'Em andamento', bg: '#FFF7ED', color: '#D97706' },
  finalizada: { icon: '✅', label: 'Concluída', bg: '#F0FDF4', color: '#15803D' },
  arquivada: { icon: '📦', label: 'Arquivada', bg: '#F5F3FF', color: '#7C3AED' },
}

export default function ClienteDetalhe() {
  const params = useParams()
  const [cliente, setCliente] = useState<Cliente | null>(null)
  const [consultas, setConsultas] = useState<Consulta[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [deleteConsultaId, setDeleteConsultaId] = useState<string | null>(null)
  const [finalizarConsultaId, setFinalizarConsultaId] = useState<string | null>(null)
  const [form, setForm] = useState({
    nome_completo: '',
    email: '',
    telefone: '',
    cep: '',
    rua: '',
    numero: '',
    complemento: '',
    bairro: '',
    cidade: '',
    estado: '',
    pais: 'Brasil',
    notas: ''
  })
  const [cepLoading, setCepLoading] = useState(false)
  const [fotoFile, setFotoFile] = useState<File | null>(null)
  const [fotoPreview, setFotoPreview] = useState<string | null>(null)
  const [uploadingFoto, setUploadingFoto] = useState(false)

  async function loadConsultas() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from('consultas')
      .select('*, bagua_entrada')
      .eq('cliente_id', params.id)
      .eq('consultor_id', user.id)
      .order('criado_em', { ascending: false })
    setConsultas(data || [])
  }

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/login'; return }

      // Run both queries in parallel (both use params.id, not each other's results)
      const [cliRes, consRes] = await Promise.all([
        supabase
          .from('clientes')
          .select('*')
          .eq('id', params.id)
          .eq('consultor_id', user.id)
          .single(),
        supabase
          .from('consultas')
          .select('*, bagua_entrada')
          .eq('cliente_id', params.id)
          .eq('consultor_id', user.id)
          .order('criado_em', { ascending: false }),
      ])

      const cli = cliRes.data
      if (!cli) { window.location.href = '/clientes'; return }
      setCliente(cli)
      setForm({
        nome_completo: cli.nome_completo || '',
        email: cli.email || '',
        telefone: cli.telefone || '',
        cep: cli.cep || '',
        rua: cli.rua || '',
        numero: cli.numero || '',
        complemento: cli.complemento || '',
        bairro: cli.bairro || '',
        cidade: cli.cidade || '',
        estado: cli.estado || '',
        pais: cli.pais || 'Brasil',
        notas: cli.notas || ''
      })

      setConsultas(consRes.data || [])
      setLoading(false)
    }
    load()
  }, [params.id])

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    const { name, value } = e.target
    if (name === 'cep') {
      const digits = value.replace(/\D/g, '').slice(0, 8)
      const masked = digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits
      setForm({ ...form, cep: masked })
      return
    }
    setForm({ ...form, [name]: value })
  }

  async function handleCepBlur() {
    const digits = form.cep.replace(/\D/g, '')
    if (digits.length !== 8) return
    setCepLoading(true)
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`)
      const data = await res.json()
      if (!data.erro) {
        setForm(prev => ({
          ...prev,
          rua: data.logradouro || prev.rua,
          bairro: data.bairro || prev.bairro,
          cidade: data.localidade || prev.cidade,
          estado: data.uf || prev.estado,
        }))
      }
    } catch { /* ignore network errors */ }
    setCepLoading(false)
  }

  function handleFotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setMessage('Formato inválido. Use JPG, PNG ou WEBP.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setMessage('Arquivo muito grande. Máximo 5MB.')
      return
    }
    setFotoFile(file)
    setFotoPreview(URL.createObjectURL(file))
  }

  async function handleFotoUpload() {
    if (!fotoFile || !cliente) return
    setUploadingFoto(true)
    const fd = new FormData()
    fd.append('foto', fotoFile)
    fd.append('cliente_id', cliente.id)
    try {
      const res = await fetch('/api/clientes/foto', { method: 'POST', body: fd })
      const data = await res.json()
      if (res.ok) {
        setCliente({ ...cliente, foto_url: data.foto_url })
        setFotoFile(null)
        setFotoPreview(null)
        setMessage('Foto atualizada com sucesso!')
        setTimeout(() => setMessage(''), 3000)
      } else {
        setMessage(data.error || 'Erro ao enviar foto.')
      }
    } catch {
      setMessage('Erro de conexão ao enviar foto.')
    }
    setUploadingFoto(false)
  }

  async function handleFotoRemove() {
    if (!cliente) return
    setUploadingFoto(true)
    try {
      const res = await fetch('/api/clientes/foto', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cliente_id: cliente.id }),
      })
      if (res.ok) {
        setCliente({ ...cliente, foto_url: null })
        setFotoFile(null)
        setFotoPreview(null)
        setMessage('Foto removida com sucesso!')
        setTimeout(() => setMessage(''), 3000)
      }
    } catch {
      setMessage('Erro ao remover foto.')
    }
    setUploadingFoto(false)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setMessage('')

    // Upload new photo if selected
    if (fotoFile) {
      const fd = new FormData()
      fd.append('foto', fotoFile)
      fd.append('cliente_id', params.id as string)
      const fotoRes = await fetch('/api/clientes/foto', { method: 'POST', body: fd })
      const fotoData = await fotoRes.json()
      if (fotoRes.ok) {
        setCliente(prev => prev ? { ...prev, foto_url: fotoData.foto_url } : prev)
      }
    }

    const { error } = await supabase
      .from('clientes')
      .update(form)
      .eq('id', params.id)
    if (error) {
      setMessage('Erro ao salvar: ' + error.message)
    } else {
      setCliente(prev => prev ? { ...prev, ...form } : prev)
      setEditing(false)
      setFotoFile(null)
      setFotoPreview(null)
      setMessage('Cliente atualizado com sucesso!')
      setTimeout(() => setMessage(''), 3000)
    }
    setSaving(false)
  }

  async function handleDelete() {
    const { error } = await supabase
      .from('clientes')
      .update({ ativo: false })
      .eq('id', params.id)
    if (error) {
      setMessage('Erro ao excluir: ' + error.message)
    } else {
      window.location.href = '/clientes'
    }
    setDeleteTarget(null)
  }

  async function handleDeleteConsulta() {
    if (!deleteConsultaId) return
    const { error } = await supabase
      .from('consultas')
      .update({ status: 'deletada' })
      .eq('id', deleteConsultaId)
    if (error) {
      setMessage('Erro ao deletar consulta: ' + error.message)
    } else {
      setMessage('Consulta removida com sucesso!')
      setTimeout(() => setMessage(''), 3000)
      await loadConsultas()
    }
    setDeleteConsultaId(null)
  }

  async function handleFinalizarConsulta() {
    if (!finalizarConsultaId) return
    const { error } = await supabase
      .from('consultas')
      .update({ status: 'finalizada', finalizada_em: new Date().toISOString() })
      .eq('id', finalizarConsultaId)
    if (error) {
      setMessage('Erro ao concluir consulta: ' + error.message)
    } else {
      setMessage('Consulta concluída com sucesso!')
      setTimeout(() => setMessage(''), 3000)
      await loadConsultas()
    }
    setFinalizarConsultaId(null)
  }

  const consultasVisiveis = consultas.filter(c => c.status !== 'deletada')

  if (loading) {
    return (
      <AppShell currentPage="clientes">
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <Skeleton width="150px" height="14px" />
          <div style={{ marginTop: '24px' }}>
            <Skeleton variant="card" />
          </div>
          <div style={{ marginTop: '32px' }}>
            <Skeleton width="180px" height="18px" />
            <div style={{ marginTop: '16px' }}>
              <Skeleton variant="list" rows={3} />
            </div>
          </div>
        </div>
      </AppShell>
    )
  }

  if (!cliente) return null

  return (
    <AppShell currentPage="clientes">
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>

        <div style={{ marginBottom: '24px' }}>
          <button onClick={() => window.location.href = '/clientes'} style={{
            display: 'inline-flex', alignItems: 'center', gap: '4px',
            padding: '6px 14px', background: 'transparent', border: '1px solid #E5E7EB',
            borderRadius: '6px', color: '#6B7280', fontSize: '14px', fontWeight: 400, cursor: 'pointer',
          }}>← Clientes</button>
        </div>

        {message && (
          <div style={{
            marginBottom: '20px', padding: '12px 16px', borderRadius: '8px',
            background: message.includes('Erro') ? '#FEF2F2' : '#F0FDF4',
            border: `1px solid ${message.includes('Erro') ? '#FECACA' : '#BBF7D0'}`,
            color: message.includes('Erro') ? '#DC2626' : '#15803D', fontSize: '14px'
          }}>{message}</div>
        )}

        {!editing && (
          <div style={{
            background: '#ffffff', borderRadius: '12px', padding: '28px',
            boxShadow: '0 1px 4px rgba(0,0,0,0.08)', borderLeft: '4px solid #7C3AED',
            marginBottom: '32px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{
                  width: '56px', height: '56px', borderRadius: '50%', overflow: 'hidden',
                  background: '#7C3AED', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', color: '#fff', fontWeight: 'bold', fontSize: '22px',
                  flexShrink: 0, position: 'relative' as const,
                }}>
                  {cliente.foto_url ? (
                    <Image src={cliente.foto_url} alt={cliente.nome_completo} fill unoptimized style={{ objectFit: 'cover' }} />
                  ) : (
                    cliente.nome_completo?.charAt(0).toUpperCase()
                  )}
                </div>
                <div>
                  <h1 style={{ color: '#1E3A5F', fontSize: '22px', fontWeight: 'bold', margin: '0 0 4px 0' }}>{cliente.nome_completo}</h1>
                  <span style={{
                    background: '#F0FDF4', color: '#15803D', padding: '2px 10px',
                    borderRadius: '20px', fontSize: '12px', fontWeight: 'bold'
                  }}>Ativo</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => setEditing(true)} style={{
                  padding: '8px 20px', background: '#F3F4F6', color: '#374151',
                  border: 'none', borderRadius: '6px', fontSize: '13px', cursor: 'pointer'
                }}>✏️ Editar</button>
                <button onClick={() => setDeleteTarget(params.id as string)} style={{
                  padding: '8px 20px', background: '#FEF2F2', color: '#DC2626',
                  border: '1px solid #FECACA', borderRadius: '6px', fontSize: '13px', cursor: 'pointer'
                }}>🗑️ Excluir</button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              {cliente.email && (
                <div><span style={{ color: '#9CA3AF', fontSize: '13px' }}>E-mail</span><p style={{ color: '#374151', fontSize: '15px', margin: '4px 0 0 0' }}>✉ {cliente.email}</p></div>
              )}
              {cliente.telefone && (
                <div><span style={{ color: '#9CA3AF', fontSize: '13px' }}>Telefone</span><p style={{ color: '#374151', fontSize: '15px', margin: '4px 0 0 0' }}>📱 {cliente.telefone}</p></div>
              )}
              {(cliente.rua || cliente.cidade) && (
                <div style={{ gridColumn: '1 / -1' }}>
                  <span style={{ color: '#9CA3AF', fontSize: '13px' }}>Endereço</span>
                  <p style={{ color: '#374151', fontSize: '15px', margin: '4px 0 0 0' }}>
                    📍 {[
                      cliente.rua && `${cliente.rua}${cliente.numero ? `, ${cliente.numero}` : ''}`,
                      cliente.complemento,
                      cliente.bairro,
                      cliente.cidade && `${cliente.cidade}${cliente.estado ? ` - ${cliente.estado}` : ''}`,
                      cliente.cep && `CEP: ${cliente.cep}`,
                      cliente.pais && cliente.pais !== 'Brasil' ? cliente.pais : null,
                    ].filter(Boolean).join(' · ')}
                  </p>
                </div>
              )}
              {cliente.notas && (
                <div><span style={{ color: '#9CA3AF', fontSize: '13px' }}>Observações</span><p style={{ color: '#374151', fontSize: '15px', margin: '4px 0 0 0' }}>{cliente.notas}</p></div>
              )}
            </div>

            <div style={{ marginTop: '20px' }}>
              <button onClick={() => window.location.href = `/consultas/nova?cliente_id=${cliente.id}`} style={{
                padding: '10px 24px', background: '#7C3AED', color: '#fff',
                border: 'none', borderRadius: '8px', fontSize: '14px',
                fontWeight: 'bold', cursor: 'pointer'
              }}>+ Nova consulta</button>
            </div>
          </div>
        )}

        {editing && (
          <div style={{
            background: '#ffffff', borderRadius: '12px', padding: '28px',
            boxShadow: '0 1px 4px rgba(0,0,0,0.08)', borderTop: '3px solid #7C3AED',
            marginBottom: '32px'
          }}>
            <h2 style={{ color: '#1E3A5F', fontSize: '18px', fontWeight: 'bold', marginTop: '0', marginBottom: '24px' }}>Editar Cliente</h2>
            <form onSubmit={handleSave}>
              {/* Foto de perfil */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
                <div style={{
                  width: '72px', height: '72px', borderRadius: '50%', overflow: 'hidden',
                  background: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: '2px dashed #D1D5DB', flexShrink: 0, position: 'relative' as const,
                }}>
                  {fotoPreview ? (
                    <Image src={fotoPreview} alt="Preview" fill unoptimized style={{ objectFit: 'cover' }} />
                  ) : cliente.foto_url ? (
                    <Image src={cliente.foto_url} alt={cliente.nome_completo} fill unoptimized style={{ objectFit: 'cover' }} />
                  ) : (
                    <span style={{ color: '#9CA3AF', fontSize: '28px' }}>📷</span>
                  )}
                </div>
                <div>
                  <label htmlFor="input-foto-edit" style={{ display: 'inline-block', padding: '8px 16px', background: '#F3F4F6', color: '#374151', borderRadius: '6px', fontSize: '13px', cursor: 'pointer', fontWeight: 'bold' }}>
                    {cliente.foto_url || fotoPreview ? 'Trocar foto' : 'Adicionar foto'}
                  </label>
                  <input id="input-foto-edit" type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFotoChange} style={{ display: 'none' }} />
                  {(cliente.foto_url || fotoPreview) && (
                    <button type="button" onClick={() => {
                      if (fotoPreview) { setFotoFile(null); setFotoPreview(null) }
                      else { handleFotoRemove() }
                    }} disabled={uploadingFoto} style={{
                      marginLeft: '8px', padding: '8px 12px', background: 'transparent', color: '#DC2626',
                      border: 'none', fontSize: '13px', cursor: 'pointer'
                    }}>Remover</button>
                  )}
                  <p style={{ color: '#9CA3AF', fontSize: '12px', margin: '4px 0 0 0' }}>JPG, PNG ou WEBP. Máx. 5MB.</p>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <label htmlFor="input-nome-completo" style={{ display: 'block', color: '#374151', fontSize: '14px', fontWeight: 'bold', marginBottom: '6px' }}>Nome completo *</label>
                  <input id="input-nome-completo" name="nome_completo" value={form.nome_completo} onChange={handleChange} required
                    style={{ width: '100%', padding: '10px 14px', border: '1px solid #D1D5DB', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label htmlFor="input-email" style={{ display: 'block', color: '#374151', fontSize: '14px', fontWeight: 'bold', marginBottom: '6px' }}>E-mail</label>
                  <input id="input-email" name="email" value={form.email} onChange={handleChange} type="email"
                    style={{ width: '100%', padding: '10px 14px', border: '1px solid #D1D5DB', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label htmlFor="input-telefone" style={{ display: 'block', color: '#374151', fontSize: '14px', fontWeight: 'bold', marginBottom: '6px' }}>Telefone</label>
                  <input id="input-telefone" name="telefone" value={form.telefone} onChange={handleChange}
                    style={{ width: '100%', padding: '10px 14px', border: '1px solid #D1D5DB', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
                </div>
              </div>

              {/* Endereço */}
              <div style={{ marginBottom: '16px' }}>
                <h3 style={{ color: '#1E3A5F', fontSize: '15px', fontWeight: 'bold', margin: '8px 0 12px 0' }}>Endereço</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '16px', marginBottom: '12px' }}>
                  <div>
                    <label htmlFor="input-cep" style={{ display: 'block', color: '#374151', fontSize: '14px', fontWeight: 'bold', marginBottom: '6px' }}>CEP</label>
                    <div style={{ position: 'relative' }}>
                      <input id="input-cep" name="cep" value={form.cep} onChange={handleChange} onBlur={handleCepBlur} placeholder="00000-000"
                        style={{ width: '100%', padding: '10px 14px', border: '1px solid #D1D5DB', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
                      {cepLoading && <span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '12px', color: '#9CA3AF' }}>Buscando...</span>}
                    </div>
                  </div>
                  <div>
                    <label htmlFor="input-rua" style={{ display: 'block', color: '#374151', fontSize: '14px', fontWeight: 'bold', marginBottom: '6px' }}>Rua</label>
                    <input id="input-rua" name="rua" value={form.rua} onChange={handleChange}
                      style={{ width: '100%', padding: '10px 14px', border: '1px solid #D1D5DB', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr', gap: '16px', marginBottom: '12px' }}>
                  <div>
                    <label htmlFor="input-numero" style={{ display: 'block', color: '#374151', fontSize: '14px', fontWeight: 'bold', marginBottom: '6px' }}>Número</label>
                    <input id="input-numero" name="numero" value={form.numero} onChange={handleChange}
                      style={{ width: '100%', padding: '10px 14px', border: '1px solid #D1D5DB', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label htmlFor="input-complemento" style={{ display: 'block', color: '#374151', fontSize: '14px', fontWeight: 'bold', marginBottom: '6px' }}>Complemento</label>
                    <input id="input-complemento" name="complemento" value={form.complemento} onChange={handleChange}
                      style={{ width: '100%', padding: '10px 14px', border: '1px solid #D1D5DB', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label htmlFor="input-bairro" style={{ display: 'block', color: '#374151', fontSize: '14px', fontWeight: 'bold', marginBottom: '6px' }}>Bairro</label>
                    <input id="input-bairro" name="bairro" value={form.bairro} onChange={handleChange}
                      style={{ width: '100%', padding: '10px 14px', border: '1px solid #D1D5DB', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '16px' }}>
                  <div>
                    <label htmlFor="input-cidade" style={{ display: 'block', color: '#374151', fontSize: '14px', fontWeight: 'bold', marginBottom: '6px' }}>Cidade</label>
                    <input id="input-cidade" name="cidade" value={form.cidade} onChange={handleChange}
                      style={{ width: '100%', padding: '10px 14px', border: '1px solid #D1D5DB', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label htmlFor="select-estado" style={{ display: 'block', color: '#374151', fontSize: '14px', fontWeight: 'bold', marginBottom: '6px' }}>Estado</label>
                    <select id="select-estado" name="estado" value={form.estado} onChange={handleChange}
                      style={{ width: '100%', padding: '10px 14px', border: '1px solid #D1D5DB', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box', background: '#fff' }}>
                      <option value="">UF</option>
                      {['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'].map(uf => (
                        <option key={uf} value={uf}>{uf}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="input-pais" style={{ display: 'block', color: '#374151', fontSize: '14px', fontWeight: 'bold', marginBottom: '6px' }}>País</label>
                    <input id="input-pais" name="pais" value={form.pais} onChange={handleChange}
                      style={{ width: '100%', padding: '10px 14px', border: '1px solid #D1D5DB', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label htmlFor="input-notas" style={{ display: 'block', color: '#374151', fontSize: '14px', fontWeight: 'bold', marginBottom: '6px' }}>Observações</label>
                <textarea id="input-notas" name="notas" value={form.notas} onChange={handleChange} rows={3}
                  style={{ width: '100%', padding: '10px 14px', border: '1px solid #D1D5DB', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box', resize: 'vertical' }} />
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button type="button" onClick={() => { setEditing(false); setForm({
                  nome_completo: cliente.nome_completo || '',
                  email: cliente.email || '',
                  telefone: cliente.telefone || '',
                  cep: cliente.cep || '',
                  rua: cliente.rua || '',
                  numero: cliente.numero || '',
                  complemento: cliente.complemento || '',
                  bairro: cliente.bairro || '',
                  cidade: cliente.cidade || '',
                  estado: cliente.estado || '',
                  pais: cliente.pais || 'Brasil',
                  notas: cliente.notas || ''
                }) }} style={{
                  padding: '10px 24px', background: '#F3F4F6', color: '#374151',
                  border: 'none', borderRadius: '8px', fontSize: '14px', cursor: 'pointer'
                }}>Cancelar</button>
                <button type="submit" disabled={saving} style={{
                  padding: '10px 32px', background: saving ? '#9CA3AF' : '#7C3AED',
                  color: '#ffffff', border: 'none', borderRadius: '8px',
                  fontSize: '14px', fontWeight: 'bold', cursor: saving ? 'not-allowed' : 'pointer'
                }}>{saving ? 'Salvando...' : 'Salvar alterações'}</button>
              </div>
            </form>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <h2 style={{ color: '#1E3A5F', fontSize: '18px', fontWeight: 'bold', margin: 0 }}>
            Consultas ({consultasVisiveis.length})
          </h2>
          <button onClick={() => window.location.href = `/consultas/nova?clienteId=${cliente.id}`} style={{
            padding: '8px 20px', background: '#7C3AED', color: '#fff',
            border: 'none', borderRadius: '8px', fontSize: '13px',
            fontWeight: 'bold', cursor: 'pointer'
          }}>+ Nova Consulta</button>
        </div>

        {consultasVisiveis.length === 0 ? (
          <div style={{
            background: '#ffffff', borderRadius: '12px', padding: '48px 32px',
            textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.08)'
          }}>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>📋</div>
            <p style={{ color: '#6B7280', fontSize: '15px', margin: '0' }}>Nenhuma consulta para este cliente ainda.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {consultasVisiveis.map(c => {
              const baguaData = c.bagua_entrada
              const baguaFinalizada = !!(baguaData?.finalizada_em)
              const baguaEmAndamento = !!(baguaData?.planta_url) && !baguaFinalizada
              const statusInfo = STATUS_LABELS[c.status] || STATUS_LABELS.sem_analise
              return (
                <div key={c.id} style={{
                  background: '#ffffff', borderRadius: '12px', padding: '16px 20px',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                }}>
                  <div
                    onClick={() => window.location.href = `/consultas/${c.id}`}
                    style={{ cursor: 'pointer', flex: 1 }}
                  >
                    <p style={{ color: '#111827', fontWeight: 'bold', fontSize: '15px', margin: '0 0 4px 0' }}>{c.nome_imovel || 'Imóvel'}</p>
                    <p style={{ color: '#9CA3AF', fontSize: '13px', margin: '0' }}>
                      📅 {new Date(c.criado_em).toLocaleDateString('pt-BR')}
                      {c.tipo_imovel && ` • ${c.tipo_imovel}`}
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span style={{
                      background: baguaFinalizada ? '#F0FDF4' : baguaEmAndamento ? '#FFF7ED' : '#F3F4F6',
                      color: baguaFinalizada ? '#15803D' : baguaEmAndamento ? '#D97706' : '#9CA3AF',
                      padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 'bold'
                    }}>{baguaFinalizada
                        ? `☯ Diagnóstico finalizado em ${new Date(baguaData!.finalizada_em!).toLocaleDateString('pt-BR')}`
                        : baguaEmAndamento ? '☯ Em andamento' : '☯ Sem análise'
                    }</span>
                    <span style={{
                      background: statusInfo.bg,
                      color: statusInfo.color,
                      padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold'
                    }}>{statusInfo.icon} {statusInfo.label}</span>
                    {c.status === 'em_andamento' && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setFinalizarConsultaId(c.id) }}
                        title="Concluir consulta"
                        style={{
                          padding: '4px 10px', background: '#F0FDF4', color: '#15803D',
                          border: '1px solid #BBF7D0', borderRadius: '6px', fontSize: '12px',
                          fontWeight: 'bold', cursor: 'pointer'
                        }}
                      >✅ Concluir</button>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); setDeleteConsultaId(c.id) }}
                      title="Deletar consulta"
                      style={{
                        padding: '4px 8px', background: '#FEF2F2', color: '#DC2626',
                        border: '1px solid #FECACA', borderRadius: '6px', fontSize: '13px',
                        cursor: 'pointer', lineHeight: 1
                      }}
                    >🗑️</button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

      </div>

      <ConfirmModal
        open={deleteTarget !== null}
        title="Excluir cliente"
        message="Tem certeza que deseja excluir este cliente? As consultas associadas serão mantidas."
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <ConfirmModal
        open={deleteConsultaId !== null}
        title="Apagar consulta"
        message="A consulta será removida da visualização. Deseja continuar?"
        confirmLabel="Apagar"
        cancelLabel="Cancelar"
        variant="danger"
        onConfirm={handleDeleteConsulta}
        onCancel={() => setDeleteConsultaId(null)}
      />

      <ConfirmModal
        open={finalizarConsultaId !== null}
        title="Concluir consulta"
        message="A consulta será marcada como concluída. Deseja continuar?"
        confirmLabel="Concluir"
        cancelLabel="Cancelar"
        variant="warning"
        onConfirm={handleFinalizarConsulta}
        onCancel={() => setFinalizarConsultaId(null)}
      />
    </AppShell>
  )
}
