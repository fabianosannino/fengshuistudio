'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../src/lib/supabase'
import AppShell from '../components/AppShell'

export default function Perfil() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [form, setForm] = useState({
    nome_completo: '', nome_empresa: '', telefone: '',
    cidade: '', estado: '', bio: '', site: '',
  })

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/login'; return }
      setUser(user)
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      if (profile) {
        setForm({
          nome_completo: profile.nome_completo || '', nome_empresa: profile.nome_empresa || '',
          telefone: profile.telefone || '', cidade: profile.cidade || '',
          estado: profile.estado || '', bio: profile.bio || '', site: profile.site || '',
        })
      }
      setLoading(false)
    }
    load()
  }, [])

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setMessage('')
    const { error } = await supabase.from('profiles').update(form).eq('id', user.id)
    if (error) { setMessage('Erro ao salvar: ' + error.message) }
    else { setMessage('Perfil atualizado com sucesso!'); setTimeout(() => setMessage(''), 3000) }
    setSaving(false)
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F9FAFB', fontFamily: 'Arial, sans-serif' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>☯</div>
          <p style={{ color: '#7C3AED', fontSize: '16px' }}>Carregando perfil...</p>
        </div>
      </div>
    )
  }

  return (
    <AppShell currentPage="perfil">

      <div style={{ maxWidth: '700px', margin: '0 auto' }}>
        <div style={{ marginBottom: '32px' }}>
          <h1 style={{ color: '#1E3A5F', fontSize: '24px', fontWeight: 'bold', margin: '0 0 4px 0' }}>Meu Perfil</h1>
          <p style={{ color: '#6B7280', fontSize: '15px', margin: '0' }}>Seus dados aparecem no relatório PDF enviado ao cliente</p>
        </div>

        <div style={{ background: '#ffffff', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{
            width: '72px', height: '72px', borderRadius: '50%',
            background: '#7C3AED', display: 'flex', alignItems: 'center',
            justifyContent: 'center', color: '#fff', fontWeight: 'bold', fontSize: '28px'
          }}>
            {form.nome_completo?.charAt(0)?.toUpperCase() || '?'}
          </div>
          <div>
            <p style={{ color: '#1E3A5F', fontWeight: 'bold', fontSize: '18px', margin: '0 0 4px 0' }}>{form.nome_completo || 'Seu nome'}</p>
            <p style={{ color: '#6B7280', fontSize: '14px', margin: '0 0 4px 0' }}>{user?.email}</p>
            {form.nome_empresa && <p style={{ color: '#7C3AED', fontSize: '13px', margin: '0' }}>{form.nome_empresa}</p>}
          </div>
        </div>

        {message && (
          <div style={{
            marginBottom: '20px', padding: '12px 16px', borderRadius: '8px',
            background: message.includes('Erro') ? '#FEF2F2' : '#F0FDF4',
            border: `1px solid ${message.includes('Erro') ? '#FECACA' : '#BBF7D0'}`,
            color: message.includes('Erro') ? '#DC2626' : '#15803D', fontSize: '14px'
          }}>{message}</div>
        )}

        <form onSubmit={handleSave}>
          <div style={{ background: '#ffffff', borderRadius: '12px', padding: '28px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', marginBottom: '20px' }}>
            <h3 style={{ color: '#1E3A5F', fontSize: '16px', fontWeight: 'bold', margin: '0 0 20px 0' }}>Dados pessoais</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', color: '#374151', fontSize: '14px', fontWeight: 'bold', marginBottom: '6px' }}>Nome completo</label>
                <input name="nome_completo" value={form.nome_completo} onChange={handleChange} placeholder="Seu nome completo"
                  style={{ width: '100%', padding: '10px 14px', border: '1px solid #D1D5DB', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', color: '#374151', fontSize: '14px', fontWeight: 'bold', marginBottom: '6px' }}>Telefone</label>
                <input name="telefone" value={form.telefone} onChange={handleChange} placeholder="(11) 99999-9999"
                  style={{ width: '100%', padding: '10px 14px', border: '1px solid #D1D5DB', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', color: '#374151', fontSize: '14px', fontWeight: 'bold', marginBottom: '6px' }}>Cidade</label>
                <input name="cidade" value={form.cidade} onChange={handleChange} placeholder="Sua cidade"
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
            </div>
          </div>

          <div style={{ background: '#ffffff', borderRadius: '12px', padding: '28px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', marginBottom: '20px' }}>
            <h3 style={{ color: '#1E3A5F', fontSize: '16px', fontWeight: 'bold', margin: '0 0 20px 0' }}>Dados profissionais</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label style={{ display: 'block', color: '#374151', fontSize: '14px', fontWeight: 'bold', marginBottom: '6px' }}>Nome da empresa</label>
                <input name="nome_empresa" value={form.nome_empresa} onChange={handleChange} placeholder="Seu consultorio ou empresa"
                  style={{ width: '100%', padding: '10px 14px', border: '1px solid #D1D5DB', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', color: '#374151', fontSize: '14px', fontWeight: 'bold', marginBottom: '6px' }}>Site</label>
                <input name="site" value={form.site} onChange={handleChange} placeholder="www.seusite.com.br"
                  style={{ width: '100%', padding: '10px 14px', border: '1px solid #D1D5DB', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
              </div>
            </div>
            <div>
              <label style={{ display: 'block', color: '#374151', fontSize: '14px', fontWeight: 'bold', marginBottom: '6px' }}>Bio / Apresentacao</label>
              <textarea name="bio" value={form.bio} onChange={handleChange} placeholder="Descreva sua experiencia como consultor de Feng Shui..." rows={4}
                style={{ width: '100%', padding: '10px 14px', border: '1px solid #D1D5DB', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box', resize: 'vertical' }} />
            </div>
          </div>

          <button type="submit" disabled={saving} style={{
            width: '100%', padding: '14px',
            background: saving ? '#9CA3AF' : '#7C3AED',
            color: '#ffffff', border: 'none', borderRadius: '8px',
            fontSize: '15px', fontWeight: 'bold',
            cursor: saving ? 'not-allowed' : 'pointer'
          }}>
            {saving ? 'Salvando...' : 'Salvar perfil'}
          </button>
        </form>
      </div>

    </AppShell>
  )
}