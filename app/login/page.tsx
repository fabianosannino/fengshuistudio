'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '../../src/lib/supabase'

const TIPOS_USUARIO = [
  { id: 'pessoal', label: 'Pessoal', desc: 'Uso para minha residência' },
  { id: 'arquiteto', label: 'Arquiteto(a)', desc: 'Profissional de arquitetura' },
  { id: 'feng_shui', label: 'Profissional de Feng Shui', desc: 'Consultor(a) de Feng Shui' },
  { id: 'decorador', label: 'Decorador(a)', desc: 'Profissional de decoração' },
  { id: 'outro_profissional', label: 'Outro profissional', desc: 'Outro tipo de profissional' },
]

const inputStyle = {
  width: '100%', padding: '10px 14px', border: '1px solid #D1D5DB',
  borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' as const,
}

const labelStyle = {
  display: 'block', color: '#374151', fontSize: '13px', fontWeight: 'bold' as const, marginBottom: '4px',
}

function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [name, setName] = useState('')
  const [signUpDone, setSignUpDone] = useState(false)
  const [resending, setResending] = useState(false)

  // New: user type & professional fields
  const [tipoUsuario, setTipoUsuario] = useState('pessoal')
  const [signUpStep, setSignUpStep] = useState(1) // 1 = basic, 2 = professional details
  const [profForm, setProfForm] = useState({
    profissao: '',
    area_atuacao: '',
    registro_profissional: '',
    linkedin: '',
    instagram: '',
  })

  const router = useRouter()
  const searchParams = useSearchParams()
  const rawRedirect = searchParams.get('redirect') || '/dashboard'
  // Prevent open redirect — only allow relative paths
  const redirectTo = rawRedirect.startsWith('/') && !rawRedirect.startsWith('//') && !rawRedirect.includes('://') ? rawRedirect : '/dashboard'

  const isProfessional = tipoUsuario !== 'pessoal'

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        router.push(redirectTo)
      }
    })
    return () => subscription.unsubscribe()
  }, [router, redirectTo])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setMessage('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setMessage('E-mail ou senha incorretos. Tente novamente.')
      setLoading(false)
    } else {
      setMessage('Login realizado! Redirecionando...')
    }
  }

  function handleStep1(e: React.FormEvent) {
    e.preventDefault()
    if (isProfessional) {
      setSignUpStep(2)
      setMessage('')
    } else {
      doSignUp()
    }
  }

  function handleStep2(e: React.FormEvent) {
    e.preventDefault()
    doSignUp()
  }

  async function doSignUp() {
    setLoading(true)
    setMessage('')
    const metadata: Record<string, string> = {
      nome_completo: name,
      tipo_usuario: tipoUsuario,
      role: isProfessional ? 'consultor' : 'pessoal',
    }
    if (isProfessional) {
      metadata.profissao = profForm.profissao
      metadata.area_atuacao = profForm.area_atuacao
      metadata.registro_profissional = profForm.registro_profissional
      metadata.linkedin = profForm.linkedin
      metadata.instagram = profForm.instagram
    }

    const { error, data } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: metadata,
        emailRedirectTo: `${window.location.origin}/login`
      }
    })
    if (error) {
      setMessage('Erro ao criar conta: ' + error.message)
    } else if (
      (data.user && data.user.identities && data.user.identities.length === 0) ||
      (data.user && data.user.email_confirmed_at) ||
      (!data.session && data.user && data.user.created_at &&
        new Date().getTime() - new Date(data.user.created_at).getTime() > 5000)
    ) {
      setMessage('Este e-mail já está cadastrado. Use a aba "Entrar" para fazer login, ou clique em "Esqueci minha senha" para recuperar o acesso.')
    } else {
      setSignUpDone(true)
    }
    setLoading(false)
  }

  async function handleResendConfirmation() {
    setResending(true)
    setMessage('')
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: `${window.location.origin}/login` }
    })
    if (error) {
      setMessage('Erro ao reenviar: ' + error.message)
    } else {
      setMessage('E-mail reenviado! Verifique sua caixa de entrada e spam.')
    }
    setResending(false)
  }

  function resetSignUp() {
    setSignUpDone(false)
    setSignUpStep(1)
    setMessage('')
    setIsSignUp(false)
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #1E3A5F 0%, #2d5a8e 50%, #1E3A5F 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'Arial, sans-serif', padding: '20px'
    }}>
      <div style={{
        background: '#ffffff', borderRadius: '16px', padding: '40px 36px',
        width: '100%', maxWidth: isSignUp && signUpStep === 2 ? '520px' : '420px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        transition: 'max-width 0.3s ease'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{ fontSize: '40px', marginBottom: '4px' }}>☯</div>
          <h1 style={{ color: '#1E3A5F', fontSize: '26px', fontWeight: 'bold', margin: '0' }}>FengShui Studio</h1>
          <p style={{ color: '#7C3AED', fontSize: '13px', margin: '4px 0 0 0' }}>
            {isSignUp ? (signUpStep === 2 ? 'Dados profissionais' : 'Crie sua conta') : 'Plataforma para Consultores e Usuários'}
          </p>
        </div>

        {!isSignUp && (
          <div style={{ display: 'flex', background: '#F3F4F6', borderRadius: '8px', padding: '4px', marginBottom: '24px' }}>
            <button onClick={() => { setIsSignUp(false); setMessage('') }} style={{
              flex: 1, padding: '8px', border: 'none', borderRadius: '6px', cursor: 'pointer',
              fontSize: '14px', fontWeight: 'bold',
              background: '#ffffff', color: '#1E3A5F', boxShadow: '0 1px 4px rgba(0,0,0,0.1)'
            }}>Entrar</button>
            <button onClick={() => { setIsSignUp(true); setMessage(''); setSignUpStep(1) }} style={{
              flex: 1, padding: '8px', border: 'none', borderRadius: '6px', cursor: 'pointer',
              fontSize: '14px', fontWeight: 'bold',
              background: 'transparent', color: '#6B7280'
            }}>Cadastrar</button>
          </div>
        )}

        {isSignUp && !signUpDone && (
          <div style={{ display: 'flex', background: '#F3F4F6', borderRadius: '8px', padding: '4px', marginBottom: '24px' }}>
            <button onClick={() => { setIsSignUp(false); setMessage(''); setSignUpStep(1) }} style={{
              flex: 1, padding: '8px', border: 'none', borderRadius: '6px', cursor: 'pointer',
              fontSize: '14px', fontWeight: 'bold',
              background: 'transparent', color: '#6B7280'
            }}>Entrar</button>
            <button style={{
              flex: 1, padding: '8px', border: 'none', borderRadius: '6px',
              fontSize: '14px', fontWeight: 'bold',
              background: '#ffffff', color: '#1E3A5F', boxShadow: '0 1px 4px rgba(0,0,0,0.1)'
            }}>Cadastrar</button>
          </div>
        )}

        {/* ── SIGN UP DONE ──────────────────────────────────── */}
        {signUpDone ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>✉️</div>
            <h2 style={{ color: '#1E3A5F', fontSize: '18px', fontWeight: 'bold', margin: '0 0 12px 0' }}>
              Verifique seu e-mail
            </h2>
            <p style={{ color: '#374151', fontSize: '14px', marginBottom: '8px' }}>
              Enviamos um link de confirmação para:
            </p>
            <p style={{ color: '#7C3AED', fontSize: '15px', fontWeight: 'bold', marginBottom: '16px' }}>
              {email}
            </p>
            <div style={{
              background: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: '8px',
              padding: '12px 16px', marginBottom: '20px', textAlign: 'left'
            }}>
              <p style={{ color: '#92400E', fontSize: '13px', margin: '0 0 6px 0', fontWeight: 'bold' }}>
                Não recebeu o e-mail?
              </p>
              <ul style={{ color: '#92400E', fontSize: '13px', margin: '0', paddingLeft: '16px' }}>
                <li>Verifique a pasta de <strong>spam/lixo eletrônico</strong></li>
                <li>Aguarde alguns minutos e tente reenviar</li>
                <li>Confirme se o e-mail digitado está correto</li>
              </ul>
            </div>
            <button onClick={handleResendConfirmation} disabled={resending} style={{
              width: '100%', padding: '12px',
              background: resending ? '#9CA3AF' : '#7C3AED',
              color: '#ffffff', border: 'none', borderRadius: '8px',
              fontSize: '15px', fontWeight: 'bold',
              cursor: resending ? 'not-allowed' : 'pointer', marginBottom: '12px'
            }}>
              {resending ? 'Reenviando...' : 'Reenviar e-mail de confirmação'}
            </button>
            <button onClick={resetSignUp} style={{
              width: '100%', padding: '12px', background: '#F3F4F6',
              color: '#374151', border: 'none', borderRadius: '8px',
              fontSize: '14px', cursor: 'pointer'
            }}>
              Voltar para o login
            </button>
          </div>

        /* ── LOGIN FORM ──────────────────────────────────── */
        ) : !isSignUp ? (
          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: '16px' }}>
              <label htmlFor="login-email" style={labelStyle}>E-mail</label>
              <input id="login-email" type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="seu@email.com" required style={{ ...inputStyle, padding: '12px 14px', fontSize: '15px' }} />
            </div>
            <div style={{ marginBottom: '24px' }}>
              <label htmlFor="login-senha" style={labelStyle}>Senha</label>
              <input id="login-senha" type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="Sua senha" required style={{ ...inputStyle, padding: '12px 14px', fontSize: '15px' }} />
            </div>
            <div style={{ textAlign: 'right', marginTop: '-16px', marginBottom: '20px' }}>
              <a href="/esqueci-senha" style={{ color: '#7C3AED', fontSize: '13px', textDecoration: 'none' }}>Esqueci minha senha</a>
            </div>
            <button type="submit" disabled={loading} style={{
              width: '100%', padding: '14px',
              background: loading ? '#9CA3AF' : '#7C3AED',
              color: '#ffffff', border: 'none', borderRadius: '8px',
              fontSize: '16px', fontWeight: 'bold',
              cursor: loading ? 'not-allowed' : 'pointer'
            }}>
              {loading ? 'Aguarde...' : 'Entrar'}
            </button>
          </form>

        /* ── SIGN UP STEP 1 ──────────────────────────────── */
        ) : signUpStep === 1 ? (
          <form onSubmit={handleStep1}>
            <div style={{ marginBottom: '14px' }}>
              <label htmlFor="signup-nome" style={labelStyle}>Nome completo</label>
              <input id="signup-nome" type="text" value={name} onChange={e => setName(e.target.value)}
                placeholder="Seu nome completo" required style={inputStyle} />
            </div>
            <div style={{ marginBottom: '14px' }}>
              <label htmlFor="signup-email" style={labelStyle}>E-mail</label>
              <input id="signup-email" type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="seu@email.com" required style={inputStyle} />
            </div>
            <div style={{ marginBottom: '14px' }}>
              <label htmlFor="signup-senha" style={labelStyle}>Senha</label>
              <input id="signup-senha" type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres" required style={inputStyle} />
            </div>

            {/* User type selector */}
            <div style={{ marginBottom: '20px' }}>
              <label style={labelStyle}>Tipo de usuário</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {TIPOS_USUARIO.map(tipo => (
                  <label key={tipo.id} onClick={() => setTipoUsuario(tipo.id)} style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '10px 12px', borderRadius: '8px', cursor: 'pointer',
                    border: `2px solid ${tipoUsuario === tipo.id ? '#7C3AED' : '#E5E7EB'}`,
                    background: tipoUsuario === tipo.id ? '#F5F0FF' : '#ffffff',
                    transition: 'all 0.2s'
                  }}>
                    <div style={{
                      width: '18px', height: '18px', borderRadius: '50%',
                      border: `2px solid ${tipoUsuario === tipo.id ? '#7C3AED' : '#D1D5DB'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                    }}>
                      {tipoUsuario === tipo.id && (
                        <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#7C3AED' }} />
                      )}
                    </div>
                    <div>
                      <span style={{ color: '#111827', fontSize: '14px', fontWeight: 'bold' }}>{tipo.label}</span>
                      <span style={{ color: '#9CA3AF', fontSize: '12px', marginLeft: '6px' }}>{tipo.desc}</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <button type="submit" disabled={loading} style={{
              width: '100%', padding: '14px',
              background: loading ? '#9CA3AF' : '#7C3AED',
              color: '#ffffff', border: 'none', borderRadius: '8px',
              fontSize: '16px', fontWeight: 'bold',
              cursor: loading ? 'not-allowed' : 'pointer'
            }}>
              {loading ? 'Aguarde...' : isProfessional ? 'Próximo: dados profissionais' : 'Criar conta'}
            </button>
          </form>

        /* ── SIGN UP STEP 2: Professional Details ────────── */
        ) : (
          <form onSubmit={handleStep2}>
            <div style={{
              background: '#F5F0FF', borderRadius: '8px', padding: '10px 14px',
              marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px'
            }}>
              <span style={{ fontSize: '18px' }}>
                {tipoUsuario === 'arquiteto' ? '🏗️' : tipoUsuario === 'feng_shui' ? '☯' : tipoUsuario === 'decorador' ? '🎨' : '💼'}
              </span>
              <span style={{ color: '#7C3AED', fontSize: '13px', fontWeight: 'bold' }}>
                {TIPOS_USUARIO.find(t => t.id === tipoUsuario)?.label}
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
              <div>
                <label htmlFor="signup-profissao" style={labelStyle}>Profissão *</label>
                <input id="signup-profissao" type="text" value={profForm.profissao}
                  onChange={e => setProfForm({ ...profForm, profissao: e.target.value })}
                  placeholder="Ex: Arquiteto, Consultor" required style={inputStyle} />
              </div>
              <div>
                <label htmlFor="signup-area-atuacao" style={labelStyle}>Área de atuação *</label>
                <input id="signup-area-atuacao" type="text" value={profForm.area_atuacao}
                  onChange={e => setProfForm({ ...profForm, area_atuacao: e.target.value })}
                  placeholder="Ex: Residencial, Comercial" required style={inputStyle} />
              </div>
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label htmlFor="signup-registro" style={labelStyle}>Registro profissional</label>
              <input id="signup-registro" type="text" value={profForm.registro_profissional}
                onChange={e => setProfForm({ ...profForm, registro_profissional: e.target.value })}
                placeholder="Ex: CAU A12345-6, CREA 12345" style={inputStyle} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
              <div>
                <label htmlFor="signup-linkedin" style={labelStyle}>LinkedIn (portfolio)</label>
                <input id="signup-linkedin" type="url" value={profForm.linkedin}
                  onChange={e => setProfForm({ ...profForm, linkedin: e.target.value })}
                  placeholder="https://linkedin.com/in/..." style={inputStyle} />
              </div>
              <div>
                <label htmlFor="signup-instagram" style={labelStyle}>Instagram (portfolio)</label>
                <input id="signup-instagram" type="text" value={profForm.instagram}
                  onChange={e => setProfForm({ ...profForm, instagram: e.target.value })}
                  placeholder="@seuperfil" style={inputStyle} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button type="button" onClick={() => setSignUpStep(1)} style={{
                padding: '14px 20px', background: '#F3F4F6', color: '#374151',
                border: 'none', borderRadius: '8px', fontSize: '14px', cursor: 'pointer'
              }}>Voltar</button>
              <button type="submit" disabled={loading} style={{
                flex: 1, padding: '14px',
                background: loading ? '#9CA3AF' : '#7C3AED',
                color: '#ffffff', border: 'none', borderRadius: '8px',
                fontSize: '16px', fontWeight: 'bold',
                cursor: loading ? 'not-allowed' : 'pointer'
              }}>
                {loading ? 'Aguarde...' : 'Criar conta'}
              </button>
            </div>
          </form>
        )}

        {message && (() => {
          const isError = message.includes('Erro') || message.includes('incorretos') || message.includes('já está cadastrado')
          return (
            <div style={{
              marginTop: '20px', padding: '12px 16px', borderRadius: '8px',
              background: isError ? '#FEF2F2' : '#F0FDF4',
              border: `1px solid ${isError ? '#FECACA' : '#BBF7D0'}`,
              color: isError ? '#DC2626' : '#15803D',
              fontSize: '14px', textAlign: 'center'
            }}>
              {message}
            </div>
          )
        })()}

        <p style={{ textAlign: 'center', color: '#9CA3AF', fontSize: '12px', marginTop: '24px', marginBottom: '0' }}>
          FengShui Studio 2026 - CollabZ Consultoria
        </p>
      </div>
    </div>
  )
}

export default function Login() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1E3A5F' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>☯</div>
          <p style={{ color: '#ffffff', fontSize: '16px', fontFamily: 'Arial, sans-serif' }}>Carregando...</p>
        </div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  )
}
