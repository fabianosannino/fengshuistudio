'use client'

import { logger } from '../../src/lib/logger'
import { OPCOES_DE_PAPEL, papelDoUsuario, type Papel } from '../../src/lib/papel-do-usuario'
import { redirecionarParaLogin, SENHA_MIN_CARACTERES } from '../../src/lib/auth-rotas'
import { useEffect, useState } from 'react'
import { supabase } from '../../src/lib/supabase'
import AppShell from '../components/AppShell'
import VitrineDeServicos from '../components/VitrineDeServicos'
import Skeleton from '../components/Skeleton'
import { planoEfetivo, planoLabel, isProfissional as isProfissionalFn, PROF_TYPES } from '../../src/lib/plano-utils'
import type { User } from '@supabase/supabase-js'
import { Lock } from 'lucide-react'
const ESTADOS_BR = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO']

export default function Perfil() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [tipoUsuario, setTipoUsuario] = useState('')
  const [plano, setPlano] = useState('')
  const [form, setForm] = useState({
    nome_completo: '', nome_empresa: '', telefone: '',
    cidade: '', estado: '', bio: '', site: '',
    papel: 'consultor' as Papel,
    profissao: '', area_atuacao: '', registro_profissional: '',
    linkedin: '', instagram: '', parceiro_visivel: false,
    store_slug: '',
  })

  const isProfessional = isProfissionalFn({ plano, tipo_usuario: tipoUsuario, role: tipoUsuario })

  // ── Alterar senha ──
  const [senhaForm, setSenhaForm] = useState({ atual: '', nova: '', confirmar: '' })
  const [senhaSaving, setSenhaSaving] = useState(false)
  const [senhaMsg, setSenhaMsg] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)

  async function handleAlterarSenha(e: React.FormEvent) {
    e.preventDefault()
    setSenhaMsg(null)
    if (senhaForm.nova.length < SENHA_MIN_CARACTERES) {
      setSenhaMsg({ tipo: 'erro', texto: `A nova senha precisa de pelo menos ${SENHA_MIN_CARACTERES} caracteres.` })
      return
    }
    if (senhaForm.nova !== senhaForm.confirmar) {
      setSenhaMsg({ tipo: 'erro', texto: 'A confirmação não confere com a nova senha.' })
      return
    }
    if (senhaForm.nova === senhaForm.atual) {
      setSenhaMsg({ tipo: 'erro', texto: 'A nova senha deve ser diferente da atual.' })
      return
    }
    if (!user?.email) return
    setSenhaSaving(true)
    // Reautentica antes de trocar: confirma que quem está na sessão conhece a senha atual.
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: senhaForm.atual,
    })
    if (authError) {
      setSenhaMsg({ tipo: 'erro', texto: 'Senha atual incorreta.' })
      setSenhaSaving(false)
      return
    }
    const { error } = await supabase.auth.updateUser({ password: senhaForm.nova })
    if (error) {
      setSenhaMsg({ tipo: 'erro', texto: 'Não foi possível alterar a senha. Tente novamente.' })
    } else {
      setSenhaMsg({ tipo: 'ok', texto: 'Senha alterada com sucesso!' })
      setSenhaForm({ atual: '', nova: '', confirmar: '' })
    }
    setSenhaSaving(false)
  }

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { redirecionarParaLogin(); return }
      setUser(user)
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      if (profile) {
        const p = profile as Record<string, unknown>
        setTipoUsuario((p.tipo_usuario || p.role || '') as string)
        setPlano((p.plano || '') as string)
        setForm({
          nome_completo: (p.nome_completo || '') as string,
          nome_empresa: (p.nome_empresa || '') as string,
          telefone: (p.telefone || '') as string,
          cidade: (p.cidade || '') as string,
          estado: (p.estado || '') as string,
          bio: (p.bio || '') as string,
          site: (p.site || '') as string,
          papel: papelDoUsuario(p),
          profissao: (p.profissao || '') as string,
          area_atuacao: (p.area_atuacao || '') as string,
          registro_profissional: (p.registro_profissional || '') as string,
          linkedin: (p.linkedin || '') as string,
          instagram: (p.instagram || '') as string,
          parceiro_visivel: (p.parceiro_visivel || false) as boolean,
          store_slug: (p.store_slug || '') as string,
        })
      } else {
        // Fallback to user metadata
        const meta = user.user_metadata || {}
        setTipoUsuario(meta.tipo_usuario || '')
        setForm(f => ({ ...f, papel: papelDoUsuario(meta) }))
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

    const basicData: Record<string, string | boolean | null> = {
      // Só `tipo_usuario`: `role` é protegida por trigger e exige service_role.
      // `papelDoUsuario` lê `tipo_usuario` primeiro, então isto basta.
      tipo_usuario: form.papel,
      nome_completo: form.nome_completo,
      nome_empresa: form.nome_empresa,
      telefone: form.telefone,
      cidade: form.cidade,
      estado: form.estado,
      bio: form.bio,
      site: form.site,
      store_slug: form.store_slug,
    }

    const profData: Record<string, string | boolean | null> = {
      profissao: form.profissao,
      area_atuacao: form.area_atuacao,
      registro_profissional: form.registro_profissional,
      linkedin: form.linkedin,
      instagram: form.instagram,
      parceiro_visivel: form.parceiro_visivel,
    }

    const isPaidPlan = planoEfetivo(plano) !== 'free'
    const updateData = isProfessional
      ? { ...basicData, ...profData }
      : isPaidPlan
        ? { ...basicData, parceiro_visivel: form.parceiro_visivel }
        : basicData

    const { error } = await supabase.from('profiles').update(updateData).eq('id', user!.id)

    if (error) {
      const isSchemaError = error.message?.includes('column') && error.message?.includes('schema cache')

      if (isSchemaError && isProfessional) {
        // Fallback: save only basic fields if professional columns are missing
        logger.warn('Colunas profissionais ausentes no banco; salvando só os dados básicos', {
          route: '/perfil', error: error.message,
        })
        const { error: fallbackError } = await supabase.from('profiles').update(basicData).eq('id', user!.id)
        if (fallbackError) {
          logger.error('Falha ao salvar o perfil mesmo sem os campos profissionais', {
            route: '/perfil', error: fallbackError.message,
          })
          setMessage('Não foi possível salvar as alterações. Tente novamente ou entre em contato com o suporte.')
        } else {
          setMessage('Dados básicos salvos. Os campos profissionais exigem atualização do banco de dados — execute a migration em supabase/migrations/.')
        }
      } else {
        logger.error('Falha ao salvar o perfil', { route: '/perfil', error: error.message })
        setMessage('Não foi possível salvar as alterações. Tente novamente ou entre em contato com o suporte.')
      }
    } else {
      setMessage('Perfil atualizado com sucesso!')
      setTimeout(() => setMessage(''), 3000)
    }
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
          <p style={{ color: '#2E7D6B', fontSize: '12px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 8px 0' }}>Conta</p>
          <h1 style={{ color: '#0E1B2C', fontSize: '30px', fontWeight: 600, margin: '0 0 6px 0', letterSpacing: '-0.01em' }}>Meu Perfil</h1>
          <p style={{ color: '#6B7280', fontSize: '15px', margin: '0' }}>
            {isProfessional
              ? 'Seus dados aparecem no relatório PDF enviado ao cliente'
              : 'Gerencie seus dados pessoais'}
          </p>
        </div>

        <div style={{ background: '#ffffff', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 2px rgba(14,27,44,0.04), 0 10px 28px -16px rgba(14,27,44,0.18)', border: '1px solid rgba(14,27,44,0.06)', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{
            width: '72px', height: '72px', borderRadius: '50%',
            background: '#2E7D6B', display: 'flex', alignItems: 'center',
            justifyContent: 'center', color: '#fff', fontWeight: 'bold', fontSize: '28px'
          }}>
            {form.nome_completo?.charAt(0)?.toUpperCase() || '?'}
          </div>
          <div>
            <p style={{ color: '#0E1B2C', fontWeight: 'bold', fontSize: '18px', margin: '0 0 4px 0' }}>{form.nome_completo || 'Seu nome'}</p>
            <p style={{ color: '#6B7280', fontSize: '14px', margin: '0 0 4px 0' }}>{user?.email}</p>
            <span style={{
              background: (isProfessional || planoEfetivo(plano) === 'profissional') ? 'rgba(201,162,39,0.1)' : planoEfetivo(plano) === 'simples' ? 'rgba(59,130,246,0.1)' : 'rgba(184,134,11,0.1)',
              color: (isProfessional || planoEfetivo(plano) === 'profissional') ? '#2E7D6B' : planoEfetivo(plano) === 'simples' ? '#2E7D6B' : '#C9A227',
              padding: '2px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 'bold'
            }}>
              {isProfessional ? 'Profissional' : planoLabel(plano)}
            </span>
            {form.nome_empresa && <p style={{ color: '#2E7D6B', fontSize: '13px', margin: '4px 0 0 0' }}>{form.nome_empresa}</p>}
          </div>
        </div>

        {message && (
          <div style={{
            marginBottom: '20px', padding: '12px 16px', borderRadius: '8px',
            background: message.includes('Erro') ? '#FAEEE9' : '#F0F6F3',
            border: `1px solid ${message.includes('Erro') ? '#EBD3C7' : '#DCEAE4'}`,
            color: message.includes('Erro') ? '#B4533A' : '#2E7D6B', fontSize: '14px'
          }}>{message}</div>
        )}

        <form onSubmit={handleSave}>
          {/* Dados pessoais */}
          <div style={{ background: '#ffffff', borderRadius: '12px', padding: '28px', boxShadow: '0 1px 2px rgba(14,27,44,0.04), 0 10px 28px -16px rgba(14,27,44,0.18)', border: '1px solid rgba(14,27,44,0.06)', marginBottom: '20px' }}>
            <h3 style={{ color: '#0E1B2C', fontSize: '16px', fontWeight: 'bold', margin: '0 0 20px 0' }}>Dados pessoais</h3>
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

          {/* Papel: define a tela inicial e o menu. É a única pergunta que o
              cadastro faz depois de nome/e-mail/senha, e precisa ser reversível
              — quem escolhe errado ficaria preso na home errada. */}
          <div style={{ background: '#ffffff', borderRadius: '12px', padding: '28px', boxShadow: '0 1px 2px rgba(14,27,44,0.04), 0 10px 28px -16px rgba(14,27,44,0.18)', border: '1px solid rgba(14,27,44,0.06)', marginBottom: '20px' }}>
            <h3 style={{ color: '#0E1B2C', fontSize: '16px', fontWeight: 'bold', margin: '0 0 6px 0' }}>Como você usa o FengShui Studio</h3>
            <p style={{ color: '#6B7280', fontSize: '13px', margin: '0 0 16px 0' }}>
              Define sua tela inicial e o menu. Nada é apagado ao trocar.
            </p>
            <div role="radiogroup" aria-label="Como você usa o FengShui Studio" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              {OPCOES_DE_PAPEL.map(opcao => {
                const escolhido = form.papel === opcao.id
                return (
                  <button type="button" key={opcao.id} role="radio" aria-checked={escolhido}
                    onClick={() => setForm(f => ({ ...f, papel: opcao.id }))} style={{
                      textAlign: 'left', cursor: 'pointer', padding: '14px 16px', borderRadius: '12px',
                      background: escolhido ? '#FAF3E0' : '#ffffff',
                      border: escolhido ? '2px solid #C9A227' : '1px solid #E7E1D6',
                    }}>
                    <span style={{ display: 'block', fontSize: '14px', fontWeight: 700, color: '#0E1B2C', marginBottom: '4px' }}>{opcao.titulo}</span>
                    <span style={{ display: 'block', fontSize: '12px', color: '#6B7280', lineHeight: 1.5 }}>{opcao.descricao}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Dados profissionais - sempre visivel */}
          <div style={{ background: '#ffffff', borderRadius: '12px', padding: '28px', boxShadow: '0 1px 2px rgba(14,27,44,0.04), 0 10px 28px -16px rgba(14,27,44,0.18)', border: '1px solid rgba(14,27,44,0.06)', marginBottom: '20px' }}>
            <h3 style={{ color: '#0E1B2C', fontSize: '16px', fontWeight: 'bold', margin: '0 0 20px 0' }}>Dados profissionais</h3>
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
            <div style={{ background: '#ffffff', borderRadius: '12px', padding: '28px', boxShadow: '0 1px 2px rgba(14,27,44,0.04), 0 10px 28px -16px rgba(14,27,44,0.18)', border: '1px solid rgba(14,27,44,0.06)', marginBottom: '20px' }}>
              <h3 style={{ color: '#2E7D6B', fontSize: '16px', fontWeight: 'bold', margin: '0 0 6px 0' }}>Perfil profissional</h3>
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

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', color: '#374151', fontSize: '14px', fontWeight: 'bold', marginBottom: '6px' }}>URL da sua loja</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ color: '#9CA3AF', fontSize: '13px' }}>fengshuistudio.com.br/loja/</span>
                  <input name="store_slug" value={form.store_slug} onChange={handleChange}
                    placeholder="seu-nome" style={inputStyle} />
                </div>
                <p style={{ color: '#9CA3AF', fontSize: '11px', marginTop: '4px' }}>Use letras minúsculas, números e hífens. Ex: joao-silva</p>
              </div>

            </div>
          )}

          {/* Parceiro visivel toggle — available for all paid plans (Simples + Profissional) */}
          {planoEfetivo(plano) !== 'free' && (
            <div style={{ background: '#ffffff', borderRadius: '12px', padding: '28px', boxShadow: '0 1px 2px rgba(14,27,44,0.04), 0 10px 28px -16px rgba(14,27,44,0.18)', border: '1px solid rgba(14,27,44,0.06)', marginBottom: '20px' }}>
              <h3 style={{ color: '#2E7D6B', fontSize: '16px', fontWeight: 'bold', margin: '0 0 6px 0' }}>Rede de Parceiros</h3>
              <p style={{ color: '#6B7280', fontSize: '13px', margin: '0 0 20px 0' }}>
                Apareça na listagem de parceiros para outros usuários da plataforma
              </p>
              <div style={{
                background: form.parceiro_visivel ? '#F0F6F3' : '#F9FAFB',
                border: `1px solid ${form.parceiro_visivel ? '#DCEAE4' : '#E5E7EB'}`,
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
                    background: form.parceiro_visivel ? '#2E7D6B' : '#D1D5DB',
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
                      ? 'Seu perfil está visível para outros usuários que buscam profissionais'
                      : 'Ative para que outros usuários encontrem você na rede de parceiros'}
                  </p>
                </div>
              </div>

              {/* A vitrine só faz sentido para quem optou por aparecer — sem
                  isso, seriam serviços cadastrados que ninguém vê. */}
              {form.parceiro_visivel && user?.id && (
                <VitrineDeServicos perfilId={user.id} />
              )}
            </div>
          )}

          <button type="submit" disabled={saving} style={{
            width: '100%', padding: '14px',
            background: saving ? '#9CA3AF' : '#2E7D6B',
            color: '#ffffff', border: 'none', borderRadius: '8px',
            fontSize: '15px', fontWeight: 'bold',
            cursor: saving ? 'not-allowed' : 'pointer'
          }}>
            {saving ? 'Salvando...' : 'Salvar perfil'}
          </button>
        </form>

        {/* ── Alterar senha ─────────────────────────────────────────────── */}
        <form onSubmit={handleAlterarSenha} style={{ marginTop: '24px' }}>
          <div style={{ background: '#fff', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 2px rgba(14,27,44,0.04), 0 10px 28px -16px rgba(14,27,44,0.18)', border: '1px solid rgba(14,27,44,0.06)' }}>
            <h3 style={{ color: '#0E1B2C', fontSize: '16px', fontWeight: 'bold', margin: '0 0 6px 0', display: 'flex', alignItems: 'center', gap: '8px' }}><Lock size={16} strokeWidth={1.75} aria-hidden="true" /> Alterar senha</h3>
            <p style={{ color: '#6B7280', fontSize: '13px', margin: '0 0 20px 0' }}>
              Mínimo de {SENHA_MIN_CARACTERES} caracteres. Você continuará conectado após a troca.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label htmlFor="input-senha-atual" style={{ display: 'block', color: '#374151', fontSize: '14px', fontWeight: 'bold', marginBottom: '6px' }}>Senha atual</label>
                <input id="input-senha-atual" type="password" autoComplete="current-password" required
                  value={senhaForm.atual} onChange={e => setSenhaForm({ ...senhaForm, atual: e.target.value })}
                  style={{ width: '100%', padding: '10px 14px', border: '1px solid #D1D5DB', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label htmlFor="input-senha-nova" style={{ display: 'block', color: '#374151', fontSize: '14px', fontWeight: 'bold', marginBottom: '6px' }}>Nova senha</label>
                <input id="input-senha-nova" type="password" autoComplete="new-password" required minLength={SENHA_MIN_CARACTERES}
                  value={senhaForm.nova} onChange={e => setSenhaForm({ ...senhaForm, nova: e.target.value })}
                  style={{ width: '100%', padding: '10px 14px', border: '1px solid #D1D5DB', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label htmlFor="input-senha-confirmar" style={{ display: 'block', color: '#374151', fontSize: '14px', fontWeight: 'bold', marginBottom: '6px' }}>Confirmar nova senha</label>
                <input id="input-senha-confirmar" type="password" autoComplete="new-password" required minLength={SENHA_MIN_CARACTERES}
                  value={senhaForm.confirmar} onChange={e => setSenhaForm({ ...senhaForm, confirmar: e.target.value })}
                  style={{ width: '100%', padding: '10px 14px', border: '1px solid #D1D5DB', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
              </div>
            </div>
            {senhaMsg && (
              <p style={{
                margin: '0 0 14px 0', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: 'bold',
                background: senhaMsg.tipo === 'ok' ? '#F0F6F3' : '#FAEEE9',
                color: senhaMsg.tipo === 'ok' ? '#2E7D6B' : '#B4533A',
              }}>{senhaMsg.texto}</p>
            )}
            <button type="submit" disabled={senhaSaving} style={{
              padding: '12px 28px',
              background: senhaSaving ? '#9CA3AF' : '#0E1B2C',
              color: '#ffffff', border: 'none', borderRadius: '8px',
              fontSize: '14px', fontWeight: 'bold',
              cursor: senhaSaving ? 'not-allowed' : 'pointer'
            }}>
              {senhaSaving ? 'Alterando...' : 'Alterar senha'}
            </button>
          </div>
        </form>
      </div>

    </AppShell>
  )
}
