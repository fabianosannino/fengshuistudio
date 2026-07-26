'use client'

import { useState } from 'react'
import { supabase } from '../../src/lib/supabase'
import { ROTA_REDEFINIR_SENHA, urlCallbackAuth } from '../../src/lib/auth-rotas'

export default function EsqueciSenha() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [sent, setSent] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    // O link do e-mail precisa passar pelo callback: é ele que troca o código
    // PKCE por sessão antes de entregar o usuário à tela de nova senha.
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: urlCallbackAuth(window.location.origin, ROTA_REDEFINIR_SENHA)
    })

    if (error) {
      setMessage('Erro ao enviar e-mail: ' + error.message)
    } else {
      setSent(true)
      setMessage('E-mail enviado! Verifique sua caixa de entrada e spam.')
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
          <h1 style={{ color: '#1E3A5F', fontSize: '24px', fontWeight: 'bold', margin: '0 0 8px 0' }}>Esqueci minha senha</h1>
          <p style={{ color: '#6B7280', fontSize: '14px', margin: '0' }}>
            {sent ? 'Verifique seu e-mail para redefinir a senha' : 'Digite seu e-mail para receber o link de recuperação'}
          </p>
        </div>

        {!sent ? (
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '24px' }}>
              <label htmlFor="input-email" style={{ display: 'block', color: '#374151', fontSize: '14px', fontWeight: 'bold', marginBottom: '6px' }}>E-mail</label>
              <input id="input-email" type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="seu@email.com" required
                style={{ width: '100%', padding: '12px 14px', border: '1px solid #D1D5DB', borderRadius: '8px', fontSize: '15px', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <button type="submit" disabled={loading} style={{
              width: '100%', padding: '14px',
              background: loading ? '#9CA3AF' : '#7C3AED',
              color: '#ffffff', border: 'none', borderRadius: '8px',
              fontSize: '16px', fontWeight: 'bold',
              cursor: loading ? 'not-allowed' : 'pointer'
            }}>
              {loading ? 'Enviando...' : 'Enviar link de recuperação'}
            </button>
          </form>
        ) : (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>✉️</div>
            <p style={{ color: '#374151', fontSize: '15px', marginBottom: '24px' }}>
              Enviamos um link para <strong>{email}</strong>. Clique no link do e-mail para criar uma nova senha.
            </p>
            <button onClick={() => { setSent(false); setEmail(''); setMessage('') }} style={{
              padding: '10px 24px', background: '#F3F4F6', color: '#374151',
              border: 'none', borderRadius: '8px', fontSize: '14px', cursor: 'pointer'
            }}>Reenviar para outro e-mail</button>
          </div>
        )}

        {message && (
          <div style={{
            marginTop: '20px', padding: '12px 16px', borderRadius: '8px',
            background: message.includes('Erro') ? '#FEF2F2' : '#F0FDF4',
            border: `1px solid ${message.includes('Erro') ? '#FECACA' : '#BBF7D0'}`,
            color: message.includes('Erro') ? '#DC2626' : '#15803D',
            fontSize: '14px', textAlign: 'center'
          }}>{message}</div>
        )}

        <div style={{ textAlign: 'center', marginTop: '24px' }}>
          <a href="/login" style={{ color: '#7C3AED', fontSize: '14px', textDecoration: 'none' }}>← Voltar para o login</a>
        </div>
      </div>
    </div>
  )
}