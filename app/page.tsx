'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../src/lib/supabase'

export default function Home() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [name, setName] = useState('')
  const router = useRouter()

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        router.push('/dashboard')
      }
    })
    return () => subscription.unsubscribe()
  }, [router])

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
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { nome_completo: name, role: 'consultor' } }
    })
    if (error) {
      setMessage('Erro ao criar conta: ' + error.message)
    } else {
      setMessage('Conta criada! Verifique seu e-mail para confirmar o cadastro.')
    }
    setLoading(false)
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
              <a href="#" style={{ color: '#7C3AED', fontSize: '13px', textDecoration: 'none' }}>Esqueci minha senha</a>
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

        {message && (
          <div style={{
            marginTop: '20px', padding: '12px 16px', borderRadius: '8px',
            background: message.includes('Erro') || message.includes('incorretos') ? '#FEF2F2' : '#F0FDF4',
            border: `1px solid ${message.includes('Erro') || message.includes('incorretos') ? '#FECACA' : '#BBF7D0'}`,
            color: message.includes('Erro') || message.includes('incorretos') ? '#DC2626' : '#15803D',
            fontSize: '14px', textAlign: 'center'
          }}>
            {message}
          </div>
        )}

        <p style={{ textAlign: 'center', color: '#9CA3AF', fontSize: '12px', marginTop: '32px', marginBottom: '0' }}>
          FengShui Studio 2026 - CollabZ Consultoria
        </p>
      </div>
    </div>
  )
}