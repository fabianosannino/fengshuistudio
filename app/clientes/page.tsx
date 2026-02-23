'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../src/lib/supabase'
import { useRouter } from 'next/navigation'

export default function Clientes() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [clientes, setClientes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
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
      if (!user) { router.push('/'); return }
      setUser(user)
      const { data: prof } = await supabase
        .from('profiles')
        .select('plano')
        .eq('id', user.id)
        .single()
      setProfile(prof)
      await loadClientes(user.id)
      setLoading(false)
    }
    load()
  }, [router])

  async function loadClientes(userId: string) {
    const { data } = await supabase
      .from('clientes')
      .select('*')
      .eq('consultor_id', userId)
      .eq('ativo', true)
      .order('criado_em', { ascending: false })
    setClientes(data || [])
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setMessage('')
    const { error } = await supabase.from('clientes').insert({
      ...form,
      consultor_id: user.id
    })
    if (error) {
      setMessage('Erro ao salvar: ' + error.message)
    } else {
      setMessage('Cliente cadastrado com sucesso!')
      setForm({ nome_completo: '', email: '', telefone: '', cidade: '', estado: '', notas: '' })
      setShowForm(false)
      await loadClientes(user.id)
      setLoading(false)
    }
    setSaving(false)
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    setForm({ ...form, [e.target.name]: e.target.value })
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
          <span style={{ fontSize: '28px', cursor: 'pointer' }} onClick={() => router.push('/dashboard')}>☯</span>
          <span style={{ color: '#B8860B', fontSize: '20px', fontWeight: 'bold' }}>FengShui Studio</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span onClick={() => router.push('/dashboard')} style={{ color: 'rgba(255,255,255,0.7)', fontSize: '14px', cursor: 'pointer' }}>Dashboard</span>
          <span style={{ color: '#ffffff', fontSize: '14px', fontWeight: 'bold' }}>Clientes</span>
          <button onClick={async () => { await supabase.auth.signOut(); window.location.href = '/' }} style={{
            background: 'transparent', border: '1px solid rgba(255,255,255,0.3)',
            color: '#ffffff', padding: '6px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '14px'
          }}>Sair</button>
        </div>
      </header>

      <main style={{ padding: '32px', maxWidth: '1100px', margin: '0 auto' }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div>
            <h1 style={{ color: '#1E3A5F', fontSize: '24px', fontWeight: 'bold', margin: '0 0 4px 0' }}>Meus Clientes</h1>
            <p style={{ color: '#6B7280', fontSize: '15px', margin: '0' }}>{clientes.length} cliente(s) cadastrado(s)</p>
          </div>
         <button onClick={() => {
            if (profile?.plano !== 'pro' && clientes.length >= 5) {
              setMessage('Limite de 5 clientes no plano Free. Faça upgrade para cadastrar mais.')
              return
            }
            setShowForm(!showForm); setMessage('')
          }} style={{
            background: '#7C3AED', color: '#ffffff', border: 'none',
            padding: '12px 24px', borderRadius: '8px', fontSize: '15px',
            fontWeight: 'bold', cursor: 'pointer'
          }}>
            {showForm ? 'Cancelar' : '+ Novo cliente'}
          </button>
        </div>

        {message && (
          <div style={{
            marginBottom: '20px', padding: '12px 16px', borderRadius: '8px',
            background: message.includes('Erro') ? '#FEF2F2' : '#F0FDF4',
            border: `1px solid ${message.includes('Erro') ? '#FECACA' : '#BBF7D0'}`,
            color: message.includes('Erro') ? '#DC2626' : '#15803D',
            fontSize: '14px'
          }}>{message}</div>
        )}

        {showForm && (
          <div style={{
            background: '#ffffff', borderRadius: '12px', padding: '32px',
            boxShadow: '0 1px 4px rgba(0,0,0,0.08)', marginBottom: '32px',
            borderTop: '3px solid #7C3AED'
          }}>
            <h2 style={{ color: '#1E3A5F', fontSize: '18px', fontWeight: 'bold', marginBottom: '24px', marginTop: '0' }}>
              Novo Cliente
            </h2>
            <form onSubmit={handleSave}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', color: '#374151', fontSize: '14px', fontWeight: 'bold', marginBottom: '6px' }}>Nome completo *</label>
                  <input name="nome_completo" value={form.nome_completo} onChange={handleChange} required placeholder="Nome do cliente"
                    style={{ width: '100%', padding: '10px 14px', border: '1px solid #D1D5DB', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ display: 'block', color: '#374151', fontSize: '14px', fontWeight: 'bold', marginBottom: '6px' }}>E-mail</label>
                  <input name="email" value={form.email} onChange={handleChange} type="email" placeholder="email@exemplo.com"
                    style={{ width: '100%', padding: '10px 14px', border: '1px solid #D1D5DB', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ display: 'block', color: '#374151', fontSize: '14px', fontWeight: 'bold', marginBottom: '6px' }}>Telefone</label>
                  <input name="telefone" value={form.telefone} onChange={handleChange} placeholder="(11) 99999-9999"
                    style={{ width: '100%', padding: '10px 14px', border: '1px solid #D1D5DB', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ display: 'block', color: '#374151', fontSize: '14px', fontWeight: 'bold', marginBottom: '6px' }}>Cidade</label>
                  <input name="cidade" value={form.cidade} onChange={handleChange} placeholder="Cidade"
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
                  <label style={{ display: 'block', color: '#374151', fontSize: '14px', fontWeight: 'bold', marginBottom: '6px' }}>Observacoes</label>
                  <input name="notas" value={form.notas} onChange={handleChange} placeholder="Anotacoes sobre o cliente"
                    style={{ width: '100%', padding: '10px 14px', border: '1px solid #D1D5DB', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
                </div>
              </div>
              <button type="submit" disabled={saving} style={{
                background: saving ? '#9CA3AF' : '#7C3AED', color: '#ffffff', border: 'none',
                padding: '12px 32px', borderRadius: '8px', fontSize: '15px',
                fontWeight: 'bold', cursor: saving ? 'not-allowed' : 'pointer'
              }}>
                {saving ? 'Salvando...' : 'Salvar cliente'}
              </button>
            </form>
          </div>
        )}

        {clientes.length === 0 ? (
          <div style={{
            background: '#ffffff', borderRadius: '12px', padding: '64px 32px',
            textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.08)'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>👤</div>
            <h3 style={{ color: '#1E3A5F', fontSize: '18px', marginBottom: '8px' }}>Nenhum cliente cadastrado</h3>
            <p style={{ color: '#6B7280', fontSize: '14px' }}>Clique em "Novo cliente" para comecar</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
            {clientes.map(cliente => (
              <div key={cliente.id} style={{
                background: '#ffffff', borderRadius: '12px', padding: '20px',
                boxShadow: '0 1px 4px rgba(0,0,0,0.08)', borderLeft: '4px solid #7C3AED'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <div style={{
                    width: '40px', height: '40px', borderRadius: '50%',
                    background: '#7C3AED', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', color: '#fff', fontWeight: 'bold', fontSize: '16px'
                  }}>
                    {cliente.nome_completo.charAt(0).toUpperCase()}
                  </div>
                  <span style={{
                    background: '#F0FDF4', color: '#15803D', padding: '2px 10px',
                    borderRadius: '20px', fontSize: '12px', fontWeight: 'bold'
                  }}>Ativo</span>
                </div>
                <h3 style={{ color: '#111827', fontSize: '16px', fontWeight: 'bold', margin: '0 0 4px 0' }}>
                  {cliente.nome_completo}
                </h3>
                {cliente.email && <p style={{ color: '#6B7280', fontSize: '13px', margin: '2px 0' }}>✉ {cliente.email}</p>}
                {cliente.telefone && <p style={{ color: '#6B7280', fontSize: '13px', margin: '2px 0' }}>📱 {cliente.telefone}</p>}
                {cliente.cidade && <p style={{ color: '#6B7280', fontSize: '13px', margin: '2px 0' }}>📍 {cliente.cidade}{cliente.estado ? ` - ${cliente.estado}` : ''}</p>}
              <div style={{ marginTop: '16px', display: 'flex', gap: '8px' }}>
                  <button onClick={() => window.location.href = `/consultas/nova?cliente_id=${cliente.id}`} style={{
                    flex: 1, padding: '8px', background: '#7C3AED', color: '#fff',
                    border: 'none', borderRadius: '6px', fontSize: '13px',
                    fontWeight: 'bold', cursor: 'pointer'
                  }}>Nova consulta</button>
                  <button onClick={() => window.location.href = `/clientes/${cliente.id}`} style={{
                    padding: '8px 12px', background: '#F3F4F6', color: '#374151',
                    border: 'none', borderRadius: '6px', fontSize: '13px', cursor: 'pointer'
                  }}>Ver</button>
                </div>
              </div>
            ))}
          </div>
        )}

      </main>
    </div>
  )
}