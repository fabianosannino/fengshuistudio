'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../src/lib/supabase'
import AppShell from '../components/AppShell'
import Skeleton from '../components/Skeleton'
import type { User } from '@supabase/supabase-js'

const PROF_TYPES = ['consultor', 'arquiteto', 'feng_shui', 'decorador', 'outro_profissional']
const ESTADOS_BR = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO']

export default function Perfil() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [tipoUsuario, setTipoUsuario] = useState('')
  const [form, setForm] = useState({
    nome_completo: '', nome_empresa: '', telefone: '',
    cidade: '', estado: '', bio: '', site: '',
    profissao: '', area_atuacao: '', registro_profissional: '',
    linkedin: '', instagram: '', parceiro_visivel: false,
  })

  const isProfessional = PROF_TYPES.includes(tipoUsuario)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/login'; return }
      setUser(user)
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      if (profile) {
        setTipoUsuario(profile.tipo_usuario || profile.role || '')
        setForm({
          nome_completo: profile.nome_completo || '',
          nome_empresa: profile.nome_empresa || '',
          telefone: profile.telefone || '',
          cidade: profile.cidade || '',
          estado: profile.estado || '',
          bio: profile.bio || '',
          site: profile.site || '',
          profissao: profile.profissao || '',
          area_atuacao: profile.area_atuacao || '',
          registro_profissional: profile.registro_profissional || '',
          linkedin: profile.linkedin || '',
          instagram: profile.instagram || '',
          parceiro_visivel: profile.parceiro_visivel || false,
        })
      } else {
        // Fallback to user metadata
        const meta = user.user_metadata || {}
        setTipoUsuario(meta.tipo_usuario || '')
      }
      setLoading(false)
    }
    load()
  }, [])

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    const target = e.target
    if (target instanceof HTMLInputElement && target.type === 'checkbox') {
      setForm({ ...form, [target.name]: target.checked })
    } else {
      setForm({ ...form, [target.name]: target.value })
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setMessage('')

    // Only send professional fields if user is professional
    const updateData: Record<string, string | boolean | null> = {
      nome_completo: form.nome_completo,
      nome_empresa: form.nome_empresa,
      telefone: form.telefone,
      cidade: form.cidade,
      estado: form.estado,
      bio: form.bio,
      site: form.site,
    }

    if (isProfessional) {
      updateData.profissao = form.profissao
      updateData.area_atuacao = form.area_atuacao
      updateData.registro_profissional = form.registro_profissional
      updateData.linkedin = form.linkedin
      updateData.instagram = form.instagram
      updateData.parceiro_visivel = form.parceiro_visivel
    }

    const { error } = await supabase.from('profiles').update(updateData).eq('id', user!.id)
    if (error) { setMessage('Erro ao salvar: ' + error.message) }
    else { setMessage('Perfil atualizado com sucesso!'); setTimeout(() => setMessage(''), 3000) }
    setSaving(false)
  }

  if (loading) {
    return (
      <AppShell currentPage="perfil">
        <div style={{ maxWidth: '700px', margin: '0 auto' }}>
          <Skeleton width="200px" height="24px" />
          <div style={{ marginTop: '24px' }}>
            <Skeleton variant="card" />
          </div>
          <div style={{ marginTop: '20px' }}>
            <Skeleton variant="card" />
          </div>
        </div>
      </AppShell>
    )
  }

  const inputStyle = { width: '100%', padding: '10px 14px', border: '1px solid #D1D5DB', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' as const }

  return (
    <AppShell currentPage="perfil">

      <div style={{ maxWidth: '700px', margin: '0 auto' }}>
        <div style={{ marginBottom: '32px' }}>
          <h1 style={{ color: '#1E3A5F', fontSize: '24px', fontWeight: 'bold', margin: '0 0 4px 0' }}>Meu Perfil</h1>
          <p style={{ color: '#6B7280', fontSize: '15px', margin: '0' }}>
            {isProfessional
              ? 'Seus dados aparecem no relatório PDF enviado ao cliente'
              : 'Gerencie seus dados pessoais'}
          </p>
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
            <span style={{
              background: isProfessional ? 'rgba(124,58,237,0.1)' : 'rgba(184,134,11,0.1)',
              color: isProfessional ? '#7C3AED' : '#B8860B',
              padding: '2px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 'bold'
            }}>
              {isProfessional ? 'Profissional' : 'Pessoal'}
            </span>
            {form.nome_empresa && <p style={{ color: '#7C3AED', fontSize: '13px', margin: '4px 0 0 0' }}>{form.nome_empresa}</p>}
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
          {/* Dados pessoais */}
          <div style={{ background: '#ffffff', borderRadius: '12px', padding: '28px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', marginBottom: '20px' }}>
            <h3 style={{ color: '#1E3A5F', fontSize: '16px', fontWeight: 'bold', margin: '0 0 20px 0' }}>Dados pessoais</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label htmlFor="input-nome-completo" style={{ display: 'block', color: '#374151', fontSize: '14px', fontWeight: 'bold', marginBottom: '6px' }}>Nome completo</label>
                <input id="input-nome-completo" name="nome_completo" value={form.nome_completo} onChange={handleChange} placeholder="Seu nome completo" style={inputStyle} />
              </div>
              <div>
                <label htmlFor="input-telefone" style={{ display: 'block', color: '#374151', fontSize: '14px', fontWeight: 'bold', marginBottom: '6px' }}>Telefone</label>
                <input id="input-telefone" name="telefone" value={form.telefone} onChange={handleChange} placeholder="(11) 99999-9999" style={inputStyle} />
              </div>
              <div>
                <label htmlFor="input-cidade" style={{ display: 'block', color: '#374151', fontSize: '14px', fontWeight: 'bold', marginBottom: '6px' }}>Cidade</label>
                <input id="input-cidade" name="cidade" value={form.cidade} onChange={handleChange} placeholder="Sua cidade" style={inputStyle} />
              </div>
              <div>
                <label htmlFor="select-estado" style={{ display: 'block', color: '#374151', fontSize: '14px', fontWeight: 'bold', marginBottom: '6px' }}>Estado</label>
                <select id="select-estado" name="estado" value={form.estado} onChange={handleChange}
                  style={{ ...inputStyle, background: '#fff' }}>
                  <option value="">Selecione...</option>
                  {ESTADOS_BR.map(uf => <option key={uf} value={uf}>{uf}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Dados profissionais - sempre visivel */}
          <div style={{ background: '#ffffff', borderRadius: '12px', padding: '28px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', marginBottom: '20px' }}>
            <h3 style={{ color: '#1E3A5F', fontSize: '16px', fontWeight: 'bold', margin: '0 0 20px 0' }}>Dados profissionais</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label htmlFor="input-nome-empresa" style={{ display: 'block', color: '#374151', fontSize: '14px', fontWeight: 'bold', marginBottom: '6px' }}>Nome da empresa</label>
                <input id="input-nome-empresa" name="nome_empresa" value={form.nome_empresa} onChange={handleChange} placeholder="Seu consultorio ou empresa" style={inputStyle} />
              </div>
              <div>
                <label htmlFor="input-site" style={{ display: 'block', color: '#374151', fontSize: '14px', fontWeight: 'bold', marginBottom: '6px' }}>Site</label>
                <input id="input-site" name="site" value={form.site} onChange={handleChange} placeholder="www.seusite.com.br" style={inputStyle} />
              </div>
            </div>
            <div>
              <label htmlFor="textarea-bio" style={{ display: 'block', color: '#374151', fontSize: '14px', fontWeight: 'bold', marginBottom: '6px' }}>Bio / Apresentação</label>
              <textarea id="textarea-bio" name="bio" value={form.bio} onChange={handleChange} placeholder="Descreva sua experiência..." rows={4}
                style={{ ...inputStyle, resize: 'vertical' as const }} />
            </div>
          </div>

          {/* Campos exclusivos para profissionais */}
          {isProfessional && (
            <div style={{ background: '#ffffff', borderRadius: '12px', padding: '28px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', marginBottom: '20px' }}>
              <h3 style={{ color: '#7C3AED', fontSize: '16px', fontWeight: 'bold', margin: '0 0 6px 0' }}>Perfil profissional</h3>
              <p style={{ color: '#6B7280', fontSize: '13px', margin: '0 0 20px 0' }}>
                Essas informações ficam visíveis na rede de parceiros para usuários pessoais
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <label htmlFor="input-profissao" style={{ display: 'block', color: '#374151', fontSize: '14px', fontWeight: 'bold', marginBottom: '6px' }}>Profissão</label>
                  <input id="input-profissao" name="profissao" value={form.profissao} onChange={handleChange} placeholder="Ex: Consultor de Feng Shui" style={inputStyle} />
                </div>
                <div>
                  <label htmlFor="input-area-atuacao" style={{ display: 'block', color: '#374151', fontSize: '14px', fontWeight: 'bold', marginBottom: '6px' }}>Área de atuação</label>
                  <input id="input-area-atuacao" name="area_atuacao" value={form.area_atuacao} onChange={handleChange} placeholder="Ex: Residencial e Comercial" style={inputStyle} />
                </div>
                <div>
                  <label htmlFor="input-registro-profissional" style={{ display: 'block', color: '#374151', fontSize: '14px', fontWeight: 'bold', marginBottom: '6px' }}>Registro profissional</label>
                  <input id="input-registro-profissional" name="registro_profissional" value={form.registro_profissional} onChange={handleChange} placeholder="CAU, CREA, etc." style={inputStyle} />
                </div>
                <div>
                  <label htmlFor="input-linkedin" style={{ display: 'block', color: '#374151', fontSize: '14px', fontWeight: 'bold', marginBottom: '6px' }}>LinkedIn</label>
                  <input id="input-linkedin" name="linkedin" value={form.linkedin} onChange={handleChange} placeholder="https://linkedin.com/in/seu-perfil" style={inputStyle} />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label htmlFor="input-instagram" style={{ display: 'block', color: '#374151', fontSize: '14px', fontWeight: 'bold', marginBottom: '6px' }}>Instagram</label>
                  <input id="input-instagram" name="instagram" value={form.instagram} onChange={handleChange} placeholder="@seuperfil ou https://instagram.com/seuperfil" style={inputStyle} />
                </div>
              </div>

              {/* Parceiro visivel toggle */}
              <div style={{
                background: form.parceiro_visivel ? '#F0FDF4' : '#F9FAFB',
                border: `1px solid ${form.parceiro_visivel ? '#BBF7D0' : '#E5E7EB'}`,
                borderRadius: '10px', padding: '16px',
                display: 'flex', alignItems: 'center', gap: '14px'
              }}>
                <label style={{ position: 'relative', display: 'inline-block', width: '48px', height: '26px', flexShrink: 0 }}>
                  <input
                    type="checkbox"
                    name="parceiro_visivel"
                    checked={form.parceiro_visivel}
                    onChange={handleChange}
                    style={{ opacity: 0, width: 0, height: 0 }}
                  />
                  <span style={{
                    position: 'absolute', cursor: 'pointer', inset: 0,
                    background: form.parceiro_visivel ? '#15803D' : '#D1D5DB',
                    borderRadius: '26px', transition: 'background 0.3s',
                  }}>
                    <span style={{
                      position: 'absolute', content: '""', height: '20px', width: '20px',
                      left: form.parceiro_visivel ? '24px' : '3px', bottom: '3px',
                      background: '#ffffff', borderRadius: '50%', transition: 'left 0.3s',
                    }} />
                  </span>
                </label>
                <div>
                  <p style={{ color: '#374151', fontSize: '14px', fontWeight: 'bold', margin: '0 0 2px 0' }}>
                    Aparecer na Rede de Parceiros
                  </p>
                  <p style={{ color: '#6B7280', fontSize: '12px', margin: '0' }}>
                    {form.parceiro_visivel
                      ? 'Seu perfil está visível para usuários pessoais que buscam profissionais'
                      : 'Ative para que usuários pessoais encontrem você na rede de parceiros'}
                  </p>
                </div>
              </div>
            </div>
          )}

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
