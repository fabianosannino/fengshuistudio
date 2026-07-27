'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../src/lib/supabase'
import { falhaAuth } from '../../src/lib/auth-erros'
import {
  ROTA_ESQUECI_SENHA,
  ROTA_LOGIN,
  SENHA_MIN_CARACTERES,
} from '../../src/lib/auth-rotas'

export default function RedefinirSenha() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [messageIsError, setMessageIsError] = useState(false)
  const [success, setSuccess] = useState(false)
  const [verificando, setVerificando] = useState(true)
  const [sessaoValida, setSessaoValida] = useState(false)

  // A sessão de recuperação é criada por /auth/callback antes desta página
  // carregar. Se não existe sessão, o link é inválido ou já expirou — e o
  // usuário precisa saber disso agora, não depois de digitar a senha nova.
  useEffect(() => {
    let ativo = true

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!ativo) return
      setSessaoValida(Boolean(session))
      setVerificando(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!ativo || !session) return
      setSessaoValida(true)
      setVerificando(false)
    })

    return () => {
      ativo = false
      subscription.unsubscribe()
    }
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < SENHA_MIN_CARACTERES) {
      setMessage(`A senha deve ter no mínimo ${SENHA_MIN_CARACTERES} caracteres.`)
      return
    }
    if (password !== confirmPassword) {
      setMessage('As senhas não coincidem.'); setMessageIsError(true)
      return
    }
    setLoading(true)
    setMessage('')
    setMessageIsError(false)

    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      setMessage(falhaAuth(error, 'updateUser').mensagem)
      setMessageIsError(true)
    } else {
      setSuccess(true)
      setMessage('Senha redefinida com sucesso!')
      setMessageIsError(false)
    }
    setLoading(false)
  }

  const titulo = success ? 'Senha redefinida!' : sessaoValida ? 'Nova senha' : 'Link inválido'
  const subtitulo = success
    ? 'Sua senha foi alterada com sucesso'
    : sessaoValida
      ? 'Crie sua nova senha abaixo'
      : 'Este link de recuperação não é mais válido'

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
        {verificando ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>☯</div>
            <p style={{ color: '#6B7280', fontSize: '15px', margin: 0 }}>Verificando o link…</p>
          </div>
        ) : (
          <>
            <div style={{ textAlign: 'center', marginBottom: '32px' }}>
              <div style={{ fontSize: '48px', marginBottom: '8px' }}>☯</div>
              <h1 style={{ color: '#1E3A5F', fontSize: '24px', fontWeight: 'bold', margin: '0 0 8px 0' }}>
                {titulo}
              </h1>
              <p style={{ color: '#6B7280', fontSize: '14px', margin: '0' }}>{subtitulo}</p>
            </div>

            {success ? (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>✅</div>
                <p style={{ color: '#374151', fontSize: '15px', marginBottom: '24px' }}>
                  Agora você pode fazer login com sua nova senha.
                </p>
                <button onClick={() => window.location.href = ROTA_LOGIN} style={{
                  width: '100%', padding: '14px', background: '#7C3AED',
                  color: '#ffffff', border: 'none', borderRadius: '8px',
                  fontSize: '16px', fontWeight: 'bold', cursor: 'pointer'
                }}>Ir para o login</button>
              </div>
            ) : !sessaoValida ? (
              <div style={{ textAlign: 'center' }}>
                <p style={{ color: '#374151', fontSize: '15px', lineHeight: 1.6, marginBottom: '24px' }}>
                  Links de recuperação valem por pouco tempo e só podem ser usados uma vez.
                  Peça um novo link para continuar.
                </p>
                <button onClick={() => window.location.href = ROTA_ESQUECI_SENHA} style={{
                  width: '100%', padding: '14px', background: '#7C3AED',
                  color: '#ffffff', border: 'none', borderRadius: '8px',
                  fontSize: '16px', fontWeight: 'bold', cursor: 'pointer'
                }}>Pedir novo link</button>
                <div style={{ marginTop: '20px' }}>
                  <a href={ROTA_LOGIN} style={{ color: '#7C3AED', fontSize: '14px', textDecoration: 'none' }}>← Voltar para o login</a>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                <div style={{ marginBottom: '16px' }}>
                  <label htmlFor="input-nova-senha" style={{ display: 'block', color: '#374151', fontSize: '14px', fontWeight: 'bold', marginBottom: '6px' }}>Nova senha</label>
                  <input id="input-nova-senha" type="password" value={password} onChange={e => setPassword(e.target.value)}
                    placeholder={`Mínimo ${SENHA_MIN_CARACTERES} caracteres`} required
                    style={{ width: '100%', padding: '12px 14px', border: '1px solid #D1D5DB', borderRadius: '8px', fontSize: '15px', outline: 'none', boxSizing: 'border-box' }} />
                </div>
                <div style={{ marginBottom: '24px' }}>
                  <label htmlFor="input-confirmar-senha" style={{ display: 'block', color: '#374151', fontSize: '14px', fontWeight: 'bold', marginBottom: '6px' }}>Confirmar senha</label>
                  <input id="input-confirmar-senha" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="Repita a senha" required
                    style={{ width: '100%', padding: '12px 14px', border: '1px solid #D1D5DB', borderRadius: '8px', fontSize: '15px', outline: 'none', boxSizing: 'border-box' }} />
                </div>
                <button type="submit" disabled={loading} style={{
                  width: '100%', padding: '14px',
                  background: loading ? '#9CA3AF' : '#7C3AED',
                  color: '#ffffff', border: 'none', borderRadius: '8px',
                  fontSize: '16px', fontWeight: 'bold',
                  cursor: loading ? 'not-allowed' : 'pointer'
                }}>
                  {loading ? 'Salvando...' : 'Redefinir senha'}
                </button>
              </form>
            )}

            {message && !success && (
              <div style={{
                marginTop: '20px', padding: '12px 16px', borderRadius: '8px',
                background: messageIsError ? '#FEF2F2' : '#F0FDF4',
                border: `1px solid ${messageIsError ? '#FECACA' : '#BBF7D0'}`,
                color: messageIsError ? '#DC2626' : '#15803D',
                fontSize: '14px', textAlign: 'center'
              }}>{message}</div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
