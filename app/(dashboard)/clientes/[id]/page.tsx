'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../../../src/lib/supabase'
import { useRouter, useParams } from 'next/navigation'

export default function ClienteDetalhe() {
  const router = useRouter()
  const params = useParams()
  const [cliente, setCliente] = useState<any>(null)
  const [consultas, setConsultas] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [form, setForm] = useState({
    nome_completo: '',
    email: '',
    telefone: '',
    cidade: '',
    estado: '',
    notas: ''
  })

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/'; return }

      const { data: cli } = await supabase
        .from('clientes')
        .select('*')
        .eq('id', params.id)
        .eq('consultor_id', user.id)
        .single()

      if (!cli) { window.location.href = '/clientes'; return }
      setCliente(cli)
      setForm({
        nome_completo: cli.nome_completo || '',
        email: cli.email || '',
        telefone: cli.telefone || '',
        cidade: cli.cidade || '',
        estado: cli.estado || '',
        notas: cli.notas || ''
      })

      const { data: cons } = await supabase
        .from('consultas')
        .select('*')
        .eq('cliente_id', params.id)
        .eq('consultor_id', user.id)
        .order('criado_em', { ascending: false })

      setConsultas(cons || [])
      setLoading(false)
    }
    load()
  }, [params.id])

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setMessage('')
    const { error } = await supabase
      .from('clientes')
      .update(form)
      .eq('id', params.id)
    if (error) {
      setMessage('Erro ao salvar: ' + error.message)
    } else {
      setCliente({ ...cliente, ...form })
      setEditing(false)
      setMessage('Cliente atualizado com sucesso!')
      setTimeout(() => setMessage(''), 3000)
    }
    setSaving(false)
  }

  async function handleDelete() {
    if (!confirm('Tem certeza que deseja excluir este cliente? As consultas associadas serao mantidas.')) return
    const { error } = await supabase
      .from('clientes')
      .update({ ativo: false })
      .eq('id', params.id)
    if (error) {
      setMessage('Erro ao excluir: ' + error.message)
    } else {
      window.location.href = '/clientes'
    }
  }

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
    <div style={{ minHeight: '100vh', background: '#F9FAFB', fontFamily: 'Arial, sans-serif' }}>
      <header style={{
        background: '#1E3A5F', padding: '0 32px', height: '64px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '28px', cursor: 'pointer' }} onClick={() => window.location.href = '/dashboard'}>☯</span>
          <span style={{ color: '#B8860B', fontSize: '20px', fontWeight: 'bold' }}>FengShui Studio</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span onClick={() => window.location.href = '/dashboard'} style={{ color: 'rgba(255,255,255,0.7)', fontSize: '14px', cursor: 'pointer' }}>Dashboard</span>
          <span onClick={() => window.location.href = '/clientes'} style={{ color: 'rgba(255,255,255,0.7)', fontSize: '14px', cursor: 'pointer' }}>Clientes</span>
          <span onClick={() => window.location.href = '/consultas'} style={{ color: 'rgba(255,255,255,0.7)', fontSize: '14px', cursor: 'pointer' }}>Consultas</span>
          <button onClick={async () => { await supabase.auth.signOut(); window.location.href = '/' }} style={{
            background: 'transparent', border: '1px solid rgba(255,255,255,0.3)',
            color: '#ffffff', padding: '6px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '14px'
          }}>Sair</button>
        </div>
      </header>

      <main style={{ padding: '32px', maxWidth: '900px', margin: '0 auto' }}>

        <div style={{ marginBottom: '24px' }}>
          <span onClick={() => window.location.href = '/clientes'} style={{ color: '#7C3AED', fontSize: '14px', cursor: 'pointer' }}>← Voltar para clientes</span>
        </div>

        {message && (
          <div style={{
            marginBottom: '20px', padding: '12px 16px', borderRadius: '8px',
            background: message.includes('Erro') ? '#FEF2F2' : '#F0FDF4',
            border: `1px solid ${message.includes('Erro') ? '#FECACA' : '#BBF7D0'}`,
            color: message.includes('Erro') ? '#DC2626' : '#15803D', fontSize: '14px'
          }}>{message}</div>
        )}

        {/* Card do cliente - modo visualização */}
        {!editing && (
          <div style={{
            background: '#ffffff', borderRadius: '12px', padding: '28px',
            boxShadow: '0 1px 4px rgba(0,0,0,0.08)', borderLeft: '4px solid #7C3AED',
            marginBottom: '32px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{
                  width: '56px', height: '56px', borderRadius: '50%',
                  background: '#7C3AED', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', color: '#fff', fontWeight: 'bold', fontSize: '22px'
                }}>
                  {cliente.nome_completo?.charAt(0).toUpperCase()}
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
                <button onClick={handleDelete} style={{
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
              {cliente.cidade && (
                <div><span style={{ color: '#9CA3AF', fontSize: '13px' }}>Localidade</span><p style={{ color: '#374151', fontSize: '15px', margin: '4px 0 0 0' }}>📍 {cliente.cidade}{cliente.estado ? ` - ${cliente.estado}` : ''}</p></div>
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

        {/* Card do cliente - modo edição */}
        {editing && (
          <div style={{
            background: '#ffffff', borderRadius: '12px', padding: '28px',
            boxShadow: '0 1px 4px rgba(0,0,0,0.08)', borderTop: '3px solid #7C3AED',
            marginBottom: '32px'
          }}>
            <h2 style={{ color: '#1E3A5F', fontSize: '18px', fontWeight: 'bold', marginTop: '0', marginBottom: '24px' }}>Editar Cliente</h2>
            <form onSubmit={handleSave}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', color: '#374151', fontSize: '14px', fontWeight: 'bold', marginBottom: '6px' }}>Nome completo *</label>
                  <input name="nome_completo" value={form.nome_completo} onChange={handleChange} required
                    style={{ width: '100%', padding: '10px 14px', border: '1px solid #D1D5DB', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ display: 'block', color: '#374151', fontSize: '14px', fontWeight: 'bold', marginBottom: '6px' }}>E-mail</label>
                  <input name="email" value={form.email} onChange={handleChange} type="email"
                    style={{ width: '100%', padding: '10px 14px', border: '1px solid #D1D5DB', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ display: 'block', color: '#374151', fontSize: '14px', fontWeight: 'bold', marginBottom: '6px' }}>Telefone</label>
                  <input name="telefone" value={form.telefone} onChange={handleChange}
                    style={{ width: '100%', padding: '10px 14px', border: '1px solid #D1D5DB', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ display: 'block', color: '#374151', fontSize: '14px', fontWeight: 'bold', marginBottom: '6px' }}>Cidade</label>
                  <input name="cidade" value={form.cidade} onChange={handleChange}
                    style={{ width: '100%', padding: '10px 14px', border: '1px solid #D1D5DB', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ display: 'block', color: '#374151', fontSize: '14px', fontWeight: 'bold', marginBottom: '6px' }}>Estado</label>
                  <select name="estado" value={form.estado} onChange={handleChange}
                    style={{ width: '100%', padding: '10px 14px', border: '1px solid #D1D5DB', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box', background: '#fff' }}>
                    <option value="">Selecione...</option>
                    {['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'].map(uf => (
                      <option key={uf} value={uf}>{uf}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', color: '#374151', fontSize: '14px', fontWeight: 'bold', marginBottom: '6px' }}>Observações</label>
                  <input name="notas" value={form.notas} onChange={handleChange}
                    style={{ width: '100%', padding: '10px 14px', border: '1px solid #D1D5DB', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button type="button" onClick={() => { setEditing(false); setForm({
                  nome_completo: cliente.nome_completo || '',
                  email: cliente.email || '',
                  telefone: cliente.telefone || '',
                  cidade: cliente.cidade || '',
                  estado: cliente.estado || '',
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

        {/* Consultas do cliente */}
        <h2 style={{ color: '#1E3A5F', fontSize: '18px', fontWeight: 'bold', marginBottom: '16px' }}>
          Consultas ({consultas.length})
        </h2>

        {consultas.length === 0 ? (
          <div style={{
            background: '#ffffff', borderRadius: '12px', padding: '48px 32px',
            textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.08)'
          }}>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>📋</div>
            <p style={{ color: '#6B7280', fontSize: '15px', margin: '0' }}>Nenhuma consulta para este cliente ainda.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {consultas.map(c => (
              <div key={c.id} onClick={() => window.location.href = `/consultas/${c.id}`} style={{
                background: '#ffffff', borderRadius: '12px', padding: '16px 20px',
                boxShadow: '0 1px 4px rgba(0,0,0,0.08)', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between'
              }}>
                <div>
                  <p style={{ color: '#111827', fontWeight: 'bold', fontSize: '15px', margin: '0 0 4px 0' }}>{c.nome_imovel || 'Imóvel'}</p>
                  <p style={{ color: '#9CA3AF', fontSize: '13px', margin: '0' }}>
                    📅 {new Date(c.criado_em).toLocaleDateString('pt-BR')}
                    {c.tipo_imovel && ` • ${c.tipo_imovel}`}
                  </p>
                </div>
                <span style={{
                  background: c.status === 'finalizada' ? '#F0FDF4' : c.status === 'em_andamento' ? '#FFF7ED' : '#F3F4F6',
                  color: c.status === 'finalizada' ? '#15803D' : c.status === 'em_andamento' ? '#D97706' : '#6B7280',
                  padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold'
                }}>{c.status === 'finalizada' ? 'Finalizada' : c.status === 'em_andamento' ? 'Em andamento' : 'Rascunho'}</span>
              </div>
            ))}
          </div>
        )}

      </main>
    </div>
  )
}