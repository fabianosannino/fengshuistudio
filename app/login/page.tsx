'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '../../src/lib/supabase'

function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [name, setName] = useState('')
  const [signUpDone, setSignUpDone] = useState(false)
  const [resending, setResending] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirect') || '/dashboard'

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

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setMessage('')
    const { error, data } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { nome_completo: name, role: 'consultor' },
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
      setMessage('Este e-mail ja esta cadastrado. Use a aba "Entrar" para fazer login, ou clique em "Esqueci minha senha" para recuperar o acesso.')
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
      options: {
        emailRedirectTo: `${window.location.origin}/login`
      }
    })
    if (error) {
      setMessage('Erro ao reenviar: ' + error.message)
    } else {
      setMessage('E-mail reenviado! Verifique sua caixa de entrada e spam.')
    }
    setResending(false)
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #1E3A5F 0%, #2d5a8e 50%, #1E3A5F 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'Arial, sans-serif', padding: '20px'
    }}>
      <div style={{
        background: '#ffffff', borderRadius: '16px', padding: '48px 40px',
        width: '100%', maxWidth: '420px', boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ fontSize: '48px', marginBottom: '8px' }}>☯</div>
          <h1 style={{ color: '#1E3A5F', fontSize: '28px', fontWeight: 'bold', margin: '0' }}>FengShui Studio</h1>
          <p style={{ color: '#7C3AED', fontSize: '14px', margin: '4px 0 0 0' }}>
            {isSignUp ? 'Crie sua conta de consultor' : 'Plataforma para Consultores'}
          </p>
        </div>

        <div style={{ display: 'flex', background: '#F3F4F6', borderRadius: '8px', padding: '4px', marginBottom: '28px' }}>
          <button onClick={() => { setIsSignUp(false); setMessage('') }} style={{
            flex: 1, padding: '8px', border: 'none', borderRadius: '6px', cursor: 'pointer',
            fontSize: '14px', fontWeight: 'bold',
            background: !isSignUp ? '#ffffff' : 'transparent',
            color: !isSignUp ? '#1E3A5F' : '#6B7280',
            boxShadow: !isSignUp ? '0 1px 4px rgba(0,0,0,0.1)' : 'none'
          }}>Entrar</button>
          <button onClick={() => { setIsSignUp(true); setMessage('') }} style={{
            flex: 1, padding: '8px', border: 'none', borderRadius: '6px', cursor: 'pointer',
            fontSize: '14px', fontWeight: 'bold',
            background: isSignUp ? '#ffffff' : 'transparent',
            color: isSignUp ? '#1E3A5F' : '#6B7280',
            boxShadow: isSignUp ? '0 1px 4px rgba(0,0,0,0.1)' : 'none'
          }}>Cadastrar</button>
        </div>

        {signUpDone ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>✉️</div>
            <h2 style={{ color: '#1E3A5F', fontSize: '18px', fontWeight: 'bold', margin: '0 0 12px 0' }}>
              Verifique seu e-mail
            </h2>
            <p style={{ color: '#374151', fontSize: '14px', marginBottom: '8px' }}>
              Enviamos um link de confirmacao para:
            </p>
            <p style={{ color: '#7C3AED', fontSize: '15px', fontWeight: 'bold', marginBottom: '16px' }}>
              {email}
            </p>
            <div style={{
              background: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: '8px',
              padding: '12px 16px', marginBottom: '20px', textAlign: 'left'
            }}>
              <p style={{ color: '#92400E', fontSize: '13px', margin: '0 0 6px 0', fontWeight: 'bold' }}>
                Nao recebeu o e-mail?
              </p>
              <ul style={{ color: '#92400E', fontSize: '13px', margin: '0', paddingLeft: '16px' }}>
                <li>Verifique a pasta de <strong>spam/lixo eletronico</strong></li>
                <li>Aguarde alguns minutos e tente reenviar</li>
                <li>Confirme se o e-mail digitado esta correto</li>
              </ul>
            </div>
            <button onClick={handleResendConfirmation} disabled={resending} style={{
              width: '100%', padding: '12px',
              background: resending ? '#9CA3AF' : '#7C3AED',
              color: '#ffffff', border: 'none', borderRadius: '8px',
              fontSize: '15px', fontWeight: 'bold',
              cursor: resending ? 'not-allowed' : 'pointer',
              marginBottom: '12px'
            }}>
              {resending ? 'Reenviando...' : 'Reenviar e-mail de confirmacao'}
            </button>
            <button onClick={() => { setSignUpDone(false); setMessage(''); setIsSignUp(false) }} style={{
              width: '100%', padding: '12px', background: '#F3F4F6',
              color: '#374151', border: 'none', borderRadius: '8px',
              fontSize: '14px', cursor: 'pointer'
            }}>
              Voltar para o login
            </button>
          </div>
        ) : (
          <>
            <form onSubmit={isSignUp ? handleSignUp : handleLogin}>
              {isSignUp && (
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', color: '#374151', fontSize: '14px', fontWeight: 'bold', marginBottom: '6px' }}>Nome completo</label>
                  <input type="text" value={name} onChange={e => setName(e.target.value)}
                    placeholder="Seu nome completo" required
                    style={{ width: '100%', padding: '12px 14px', border: '1px solid #D1D5DB', borderRadius: '8px', fontSize: '15px', outline: 'none', boxSizing: 'border-box' }} />
                </div>
              )}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', color: '#374151', fontSize: '14px', fontWeight: 'bold', marginBottom: '6px' }}>E-mail</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="seu@email.com" required
                  style={{ width: '100%', padding: '12px 14px', border: '1px solid #D1D5DB', borderRadius: '8px', fontSize: '15px', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', color: '#374151', fontSize: '14px', fontWeight: 'bold', marginBottom: '6px' }}>Senha</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                  placeholder={isSignUp ? 'Minimo 6 caracteres' : 'Sua senha'} required
                  style={{ width: '100%', padding: '12px 14px', border: '1px solid #D1D5DB', borderRadius: '8px', fontSize: '15px', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              {!isSignUp && (
                <div style={{ textAlign: 'right', marginTop: '-16px', marginBottom: '20px' }}>
                  <a href="/esqueci-senha" style={{ color: '#7C3AED', fontSize: '13px', textDecoration: 'none' }}>Esqueci minha senha</a>
                </div>
              )}
              <button type="submit" disabled={loading} style={{
                width: '100%', padding: '14px',
                background: loading ? '#9CA3AF' : '#7C3AED',
                color: '#ffffff', border: 'none', borderRadius: '8px',
                fontSize: '16px', fontWeight: 'bold',
                cursor: loading ? 'not-allowed' : 'pointer'
              }}>
                {loading ? 'Aguarde...' : isSignUp ? 'Criar conta' : 'Entrar'}
              </button>
            </form>
          </>
        )}

        {message && (() => {
          const isError = message.includes('Erro') || message.includes('incorretos') || message.includes('ja esta cadastrado')
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

        <p style={{ textAlign: 'center', color: '#9CA3AF', fontSize: '12px', marginTop: '32px', marginBottom: '0' }}>
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
