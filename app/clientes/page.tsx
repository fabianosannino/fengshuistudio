'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../src/lib/supabase'
import AppShell from '../components/AppShell'
import Skeleton from '../components/Skeleton'
import Image from 'next/image'
import type { Cliente, Profile } from '../../src/lib/types'
import type { User } from '@supabase/supabase-js'
import { planoEfetivo, podeClientes } from '../../src/lib/plano-utils'

const PAGE_SIZE = 10

export default function Clientes() {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Pick<Profile, 'plano'> | null>(null)
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [currentPage, setCurrentPage] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const [userId, setUserId] = useState<string | null>(null)
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

  const loadClientes = useCallback(async (pageNum: number, uid?: string) => {
    const id = uid || userId
    if (!id) return

    setLoading(true)
    const from = pageNum * PAGE_SIZE
    const to = from + PAGE_SIZE - 1

    const { data, count } = await supabase
      .from('clientes')
      .select('*', { count: 'exact' })
      .eq('consultor_id', id)
      .eq('ativo', true)
      .order('criado_em', { ascending: false })
      .range(from, to)

    setClientes(data || [])
    setTotalCount(count || 0)
    setCurrentPage(pageNum)
    setLoading(false)
  }, [userId])

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/login'; return }
      setUser(user)
      setUserId(user.id)
      const { data: prof } = await supabase
        .from('profiles')
        .select('plano')
        .eq('id', user.id)
        .single()
      setProfile(prof)
      await loadClientes(0, user.id)
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handlePageChange(newPage: number) {
    loadClientes(newPage)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setMessage('')
    try {
      const res = await fetch('/api/clientes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) {
        setMessage(data.error || 'Erro ao salvar cliente.')
      } else {
        // Upload photo if selected
        if (fotoFile && data.id) {
          const fd = new FormData()
          fd.append('foto', fotoFile)
          fd.append('cliente_id', data.id)
          await fetch('/api/clientes/foto', { method: 'POST', body: fd })
        }
        setMessage('Cliente cadastrado com sucesso!')
        setForm({ nome_completo: '', email: '', telefone: '', cep: '', rua: '', numero: '', complemento: '', bairro: '', cidade: '', estado: '', pais: 'Brasil', notas: '' })
        setFotoFile(null)
        setFotoPreview(null)
        setShowForm(false)
        await loadClientes(0)
      }
    } catch {
      setMessage('Erro de conexão ao salvar cliente.')
    }
    setSaving(false)
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    const { name, value } = e.target
    if (name === 'cep') {
      // CEP mask: 00000-000
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

  const totalPages = Math.ceil(totalCount / PAGE_SIZE)

  if (loading && clientes.length === 0) {
    return (
      <AppShell currentPage="clientes">
        <div style={{ marginBottom: '24px' }}>
          <Skeleton width="200px" height="24px" />
          <div style={{ marginTop: '8px' }}><Skeleton width="260px" height="16px" /></div>
        </div>
        <Skeleton variant="list" rows={4} />
      </AppShell>
    )
  }

  return (
    <AppShell currentPage="clientes">

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ color: '#1E3A5F', fontSize: '24px', fontWeight: 'bold', margin: '0 0 4px 0' }}>Meus Clientes</h1>
          <p style={{ color: '#6B7280', fontSize: '15px', margin: '0' }}>{totalCount} cliente(s) cadastrado(s)</p>
        </div>
        <button onClick={() => {
          const p = planoEfetivo(profile?.plano)
          if (!podeClientes(p)) {
            setMessage('Cadastro de clientes disponível no plano Profissional.')
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

      {!podeClientes(planoEfetivo(profile?.plano)) && (
        <div style={{
          marginBottom: '16px', padding: '12px 16px', borderRadius: '8px',
          background: '#FEF3C7', border: '1px solid #FDE68A', color: '#92400E', fontSize: '13px'
        }}>
          Cadastro de clientes externos disponível no plano Profissional.{' '}
          <a href="/planos" style={{ color: '#7C3AED', fontWeight: 'bold' }}>Ver planos</a>
        </div>
      )}

      {message && (
        <div style={{
          marginBottom: '20px', padding: '12px 16px', borderRadius: '8px',
          background: message.includes('Erro') || message.includes('Limite') ? '#FEF2F2' : '#F0FDF4',
          border: `1px solid ${message.includes('Erro') || message.includes('Limite') ? '#FECACA' : '#BBF7D0'}`,
          color: message.includes('Erro') || message.includes('Limite') ? '#DC2626' : '#15803D',
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
            {/* Foto de perfil */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
              <div style={{
                width: '72px', height: '72px', borderRadius: '50%', overflow: 'hidden',
                background: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: '2px dashed #D1D5DB', flexShrink: 0, position: 'relative' as const,
              }}>
                {fotoPreview ? (
                  <Image src={fotoPreview} alt="Preview" fill unoptimized style={{ objectFit: 'cover' }} />
                ) : (
                  <span style={{ color: '#9CA3AF', fontSize: '28px' }}>📷</span>
                )}
              </div>
              <div>
                <label htmlFor="input-foto" style={{ display: 'inline-block', padding: '8px 16px', background: '#F3F4F6', color: '#374151', borderRadius: '6px', fontSize: '13px', cursor: 'pointer', fontWeight: 'bold' }}>
                  {fotoPreview ? 'Trocar foto' : 'Adicionar foto'}
                </label>
                <input id="input-foto" type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFotoChange} style={{ display: 'none' }} />
                {fotoPreview && (
                  <button type="button" onClick={() => { setFotoFile(null); setFotoPreview(null) }} style={{
                    marginLeft: '8px', padding: '8px 12px', background: 'transparent', color: '#DC2626',
                    border: 'none', fontSize: '13px', cursor: 'pointer'
                  }}>Remover</button>
                )}
                <p style={{ color: '#9CA3AF', fontSize: '12px', margin: '4px 0 0 0' }}>JPG, PNG ou WEBP. Máx. 5MB.</p>
              </div>
            </div>

            {/* Dados pessoais */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label htmlFor="input-nome-completo" style={{ display: 'block', color: '#374151', fontSize: '14px', fontWeight: 'bold', marginBottom: '6px' }}>Nome completo *</label>
                <input id="input-nome-completo" name="nome_completo" value={form.nome_completo} onChange={handleChange} required placeholder="Nome do cliente"
                  style={{ width: '100%', padding: '10px 14px', border: '1px solid #D1D5DB', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label htmlFor="input-email" style={{ display: 'block', color: '#374151', fontSize: '14px', fontWeight: 'bold', marginBottom: '6px' }}>E-mail</label>
                <input id="input-email" name="email" value={form.email} onChange={handleChange} type="email" placeholder="email@exemplo.com"
                  style={{ width: '100%', padding: '10px 14px', border: '1px solid #D1D5DB', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label htmlFor="input-telefone" style={{ display: 'block', color: '#374151', fontSize: '14px', fontWeight: 'bold', marginBottom: '6px' }}>Telefone</label>
                <input id="input-telefone" name="telefone" value={form.telefone} onChange={handleChange} placeholder="(11) 99999-9999"
                  style={{ width: '100%', padding: '10px 14px', border: '1px solid #D1D5DB', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
              </div>
            </div>

            {/* Endereço */}
            <h3 style={{ color: '#1E3A5F', fontSize: '15px', fontWeight: 'bold', margin: '20px 0 12px 0', paddingTop: '16px', borderTop: '1px solid #E5E7EB' }}>Endereço</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label htmlFor="input-cep" style={{ display: 'block', color: '#374151', fontSize: '14px', fontWeight: 'bold', marginBottom: '6px' }}>CEP *</label>
                <div style={{ position: 'relative' }}>
                  <input id="input-cep" name="cep" value={form.cep} onChange={handleChange} onBlur={handleCepBlur} required placeholder="00000-000" maxLength={9}
                    style={{ width: '100%', padding: '10px 14px', border: '1px solid #D1D5DB', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
                  {cepLoading && <span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: '#7C3AED', fontSize: '12px' }}>Buscando...</span>}
                </div>
              </div>
              <div>
                <label htmlFor="input-rua" style={{ display: 'block', color: '#374151', fontSize: '14px', fontWeight: 'bold', marginBottom: '6px' }}>Rua / Logradouro *</label>
                <input id="input-rua" name="rua" value={form.rua} onChange={handleChange} required placeholder="Rua, Avenida, etc."
                  style={{ width: '100%', padding: '10px 14px', border: '1px solid #D1D5DB', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label htmlFor="input-numero" style={{ display: 'block', color: '#374151', fontSize: '14px', fontWeight: 'bold', marginBottom: '6px' }}>Número *</label>
                <input id="input-numero" name="numero" value={form.numero} onChange={handleChange} required placeholder="Nº"
                  style={{ width: '100%', padding: '10px 14px', border: '1px solid #D1D5DB', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label htmlFor="input-complemento" style={{ display: 'block', color: '#374151', fontSize: '14px', fontWeight: 'bold', marginBottom: '6px' }}>Complemento</label>
                <input id="input-complemento" name="complemento" value={form.complemento} onChange={handleChange} placeholder="Apto, Bloco..."
                  style={{ width: '100%', padding: '10px 14px', border: '1px solid #D1D5DB', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label htmlFor="input-bairro" style={{ display: 'block', color: '#374151', fontSize: '14px', fontWeight: 'bold', marginBottom: '6px' }}>Bairro *</label>
                <input id="input-bairro" name="bairro" value={form.bairro} onChange={handleChange} required placeholder="Bairro"
                  style={{ width: '100%', padding: '10px 14px', border: '1px solid #D1D5DB', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label htmlFor="input-cidade" style={{ display: 'block', color: '#374151', fontSize: '14px', fontWeight: 'bold', marginBottom: '6px' }}>Cidade *</label>
                <input id="input-cidade" name="cidade" value={form.cidade} onChange={handleChange} required placeholder="Cidade"
                  style={{ width: '100%', padding: '10px 14px', border: '1px solid #D1D5DB', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label htmlFor="select-estado" style={{ display: 'block', color: '#374151', fontSize: '14px', fontWeight: 'bold', marginBottom: '6px' }}>Estado *</label>
                <select id="select-estado" name="estado" value={form.estado} onChange={handleChange} required
                  style={{ width: '100%', padding: '10px 14px', border: '1px solid #D1D5DB', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box', background: '#fff' }}>
                  <option value="">UF</option>
                  {['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'].map(uf => (
                    <option key={uf} value={uf}>{uf}</option>
                  ))}
                </select>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
              <div>
                <label htmlFor="input-pais" style={{ display: 'block', color: '#374151', fontSize: '14px', fontWeight: 'bold', marginBottom: '6px' }}>País *</label>
                <input id="input-pais" name="pais" value={form.pais} onChange={handleChange} required placeholder="Brasil"
                  style={{ width: '100%', padding: '10px 14px', border: '1px solid #D1D5DB', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label htmlFor="input-notas" style={{ display: 'block', color: '#374151', fontSize: '14px', fontWeight: 'bold', marginBottom: '6px' }}>Observações</label>
                <input id="input-notas" name="notas" value={form.notas} onChange={handleChange} placeholder="Anotações sobre o cliente"
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

      {loading ? (
        <Skeleton variant="list" rows={4} />
      ) : totalCount === 0 ? (
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
                  width: '40px', height: '40px', borderRadius: '50%', overflow: 'hidden',
                  background: '#7C3AED', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', color: '#fff', fontWeight: 'bold', fontSize: '16px',
                  flexShrink: 0, position: 'relative' as const,
                }}>
                  {cliente.foto_url ? (
                    <Image src={cliente.foto_url} alt={cliente.nome_completo} fill unoptimized style={{ objectFit: 'cover' }} />
                  ) : (
                    cliente.nome_completo.charAt(0).toUpperCase()
                  )}
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

      {totalPages > 1 && (
        <div style={{
          display: 'flex', justifyContent: 'center', alignItems: 'center',
          gap: '8px', marginTop: '24px',
        }}>
          <button
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
          <button
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

    </AppShell>
  )
}
