'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../src/lib/supabase'

export default function RedefinirSenha() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [success, setSuccess] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setReady(true)
      }
    })
    // Also check if already in recovery mode
    setTimeout(() => setReady(true), 1500)
    return () => subscription.unsubscribe()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 6) {
      setMessage('A senha deve ter no mínimo 6 caracteres.')
      return
    }
    if (password !== confirmPassword) {
      setMessage('As senhas não coincidem.')
      return
    }
    setLoading(true)
    setMessage('')

    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      setMessage('Erro ao redefinir senha: ' + error.message)
    } else {
      setSuccess(true)
      setMessage('Senha redefinida com sucesso!')
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
          <h1 style={{ color: '#1E3A5F', fontSize: '24px', fontWeight: 'bold', margin: '0 0 8px 0' }}>
            {success ? 'Senha redefinida!' : 'Nova senha'}
          </h1>
          <p style={{ color: '#6B7280', fontSize: '14px', margin: '0' }}>
            {success ? 'Sua senha foi alterada com sucesso' : 'Crie sua nova senha abaixo'}
          </p>
        </div>

        {!success ? (
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', color: '#374151', fontSize: '14px', fontWeight: 'bold', marginBottom: '6px' }}>Nova senha</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres" required
                style={{ width: '100%', padding: '12px 14px', border: '1px solid #D1D5DB', borderRadius: '8px', fontSize: '15px', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', color: '#374151', fontSize: '14px', fontWeight: 'bold', marginBottom: '6px' }}>Confirmar senha</label>
              <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Repita a senha" required
                style={{ width: '100%', padding: '12px 14px', border: '1px solid #D1D5DB', borderRadius: '8px', fontSize: '15px', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <button type="submit" disabled={loading || !ready} style={{
              width: '100%', padding: '14px',
              background: loading || !ready ? '#9CA3AF' : '#7C3AED',
              color: '#ffffff', border: 'none', borderRadius: '8px',
              fontSize: '16px', fontWeight: 'bold',
              cursor: loading || !ready ? 'not-allowed' : 'pointer'
            }}>
              {loading ? 'Salvando...' : !ready ? 'Aguarde...' : 'Redefinir senha'}
            </button>
          </form>
        ) : (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>✅</div>
            <p style={{ color: '#374151', fontSize: '15px', marginBottom: '24px' }}>
              Agora você pode fazer login com sua nova senha.
            </p>
            <button onClick={() => window.location.href = '/'} style={{
              width: '100%', padding: '14px', background: '#7C3AED',
              color: '#ffffff', border: 'none', borderRadius: '8px',
              fontSize: '16px', fontWeight: 'bold', cursor: 'pointer'
            }}>Ir para o login</button>
          </div>
        )}

        {message && !success && (
          <div style={{
            marginTop: '20px', padding: '12px 16px', borderRadius: '8px',
            background: message.includes('Erro') || message.includes('coincidem') || message.includes('mínimo') ? '#FEF2F2' : '#F0FDF4',
            border: `1px solid ${message.includes('Erro') || message.includes('coincidem') || message.includes('mínimo') ? '#FECACA' : '#BBF7D0'}`,
            color: message.includes('Erro') || message.includes('coincidem') || message.includes('mínimo') ? '#DC2626' : '#15803D',
            fontSize: '14px', textAlign: 'center'
          }}>{message}</div>
        )}
      </div>
    </div>
  )
}