'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '../../src/lib/supabase'
import { falhaAuth } from '../../src/lib/auth-erros'
import { MailCheck, ClipboardList, Home as HomeIcon } from 'lucide-react'
import { OPCOES_DE_PAPEL, metadadosDoPapel, type Papel } from '../../src/lib/papel-do-usuario'

/**
 * O cadastro pedia profissão, área de atuação, registro e duas redes sociais
 * **antes** de deixar o profissional ver qualquer tela. Nada disso decidia nada
 * no produto — `isProfissional` sempre olhou o plano, não a profissão. O que
 * muda de fato é o papel, e ele agora é a única pergunta que precede a entrada.
 *
 * Profissão, registro e redes passam a ser pedidos no momento em que fazem
 * diferença: quando o consultor opta por aparecer na rede de parceiros.
 */
const ICONE_DO_PAPEL: Record<Papel, typeof ClipboardList> = {
  consultor: ClipboardList,
  pessoal: HomeIcon,
}

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
  const [messageIsError, setMessageIsError] = useState(false)
  const [isSignUp, setIsSignUp] = useState(false)
  const [name, setName] = useState('')
  const [signUpDone, setSignUpDone] = useState(false)
  const [resending, setResending] = useState(false)

  // Passo 1 = nome/e-mail/senha, passo 2 = papel. A conta só é criada no fim.
  const [papel, setPapel] = useState<Papel>('consultor')
  const [signUpStep, setSignUpStep] = useState(1)

  const router = useRouter()
  const searchParams = useSearchParams()
  const rawRedirect = searchParams.get('redirect') || '/dashboard'
  // Prevent open redirect — only allow relative paths
  const redirectTo = rawRedirect.startsWith('/') && !rawRedirect.startsWith('//') && !rawRedirect.includes('://') ? rawRedirect : '/dashboard'

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        router.push(redirectTo)
      }
    })
    return () => subscription.unsubscribe()
  }, [router, redirectTo])

  function limparMensagem() {
    setMessage('')
    setMessageIsError(false)
  }

  function mostrarSucesso(texto: string) {
    setMessage(texto)
    setMessageIsError(false)
  }

  function mostrarAviso(texto: string) {
    setMessage(texto)
    setMessageIsError(true)
  }

  /**
   * Mostra a causa provável da falha, não um chute.
   *
   * Antes, qualquer erro daqui virava «E-mail ou senha incorretos» — inclusive
   * queda de rede e chave de API inválida. `falhaAuth` separa os casos e deixa
   * o detalhe técnico no logger, fora da tela.
   */
  function mostrarFalha(erro: unknown, acao: string) {
    mostrarAviso(falhaAuth(erro, acao).mensagem)
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    limparMensagem()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      mostrarFalha(error, 'signInWithPassword')
      setLoading(false)
    } else {
      mostrarSucesso('Login realizado! Redirecionando...')
    }
  }

  function handleStep1(e: React.FormEvent) {
    e.preventDefault()
    setSignUpStep(2)
    limparMensagem()
  }

  function handleStep2(e: React.FormEvent) {
    e.preventDefault()
    doSignUp()
  }

  async function doSignUp() {
    setLoading(true)
    limparMensagem()
    const metadata: Record<string, string> = {
      nome_completo: name,
      ...metadadosDoPapel(papel),
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
      mostrarFalha(error, 'signUp')
    } else if (
      (data.user && data.user.identities && data.user.identities.length === 0) ||
      (data.user && data.user.email_confirmed_at) ||
      (!data.session && data.user && data.user.created_at &&
        new Date().getTime() - new Date(data.user.created_at).getTime() > 5000)
    ) {
      mostrarAviso('Este e-mail já está cadastrado. Use a aba «Entrar» para fazer login, ou clique em «Esqueci minha senha» para recuperar o acesso.')
    } else {
      setSignUpDone(true)
    }
    setLoading(false)
  }

  async function handleResendConfirmation() {
    setResending(true)
    limparMensagem()
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: `${window.location.origin}/login` }
    })
    if (error) {
      mostrarFalha(error, 'resendConfirmation')
    } else {
      mostrarSucesso('E-mail reenviado! Verifique sua caixa de entrada e spam.')
    }
    setResending(false)
  }

  function resetSignUp() {
    setSignUpDone(false)
    setSignUpStep(1)
    limparMensagem()
    setIsSignUp(false)
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0E1B2C 0%, #163a52 55%, #0E1B2C 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'var(--font-figtree), sans-serif', padding: '20px'
    }}>
      <div style={{
        background: '#ffffff', borderRadius: '16px', padding: '40px 36px',
        width: '100%', maxWidth: '420px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        transition: 'max-width 0.3s ease'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <img src="/marketing/logo-fengshui.png" alt="" width={48} height={48} style={{ marginBottom: '8px', display: 'inline-block' }} />
          <h1 style={{ color: '#0E1B2C', fontSize: '26px', fontWeight: 600, margin: '0', fontFamily: 'var(--font-fraunces), serif' }}>FengShui Studio</h1>
          <p style={{ color: '#2E7D6B', fontSize: '13px', margin: '4px 0 0 0' }}>
            {isSignUp ? (signUpStep === 2 ? 'Falta uma pergunta' : 'Leva menos de um minuto') : 'Plataforma para Consultores e Usuários'}
          </p>
        </div>

        {!isSignUp && (
          <div style={{ display: 'flex', background: '#F3F4F6', borderRadius: '8px', padding: '4px', marginBottom: '24px' }}>
            <button type="button" onClick={() => { setIsSignUp(false); limparMensagem() }} style={{
              flex: 1, padding: '8px', border: 'none', borderRadius: '6px', cursor: 'pointer',
              fontSize: '14px', fontWeight: 'bold',
              background: '#ffffff', color: '#0E1B2C', boxShadow: '0 1px 4px rgba(0,0,0,0.1)'
            }}>Entrar</button>
            <button type="button" onClick={() => { setIsSignUp(true); limparMensagem(); setSignUpStep(1) }} style={{
              flex: 1, padding: '8px', border: 'none', borderRadius: '6px', cursor: 'pointer',
              fontSize: '14px', fontWeight: 'bold',
              background: 'transparent', color: '#6B7280'
            }}>Cadastrar</button>
          </div>
        )}

        {isSignUp && !signUpDone && (
          <div style={{ display: 'flex', background: '#F3F4F6', borderRadius: '8px', padding: '4px', marginBottom: '24px' }}>
            <button type="button" onClick={() => { setIsSignUp(false); limparMensagem(); setSignUpStep(1) }} style={{
              flex: 1, padding: '8px', border: 'none', borderRadius: '6px', cursor: 'pointer',
              fontSize: '14px', fontWeight: 'bold',
              background: 'transparent', color: '#6B7280'
            }}>Entrar</button>
            <button type="button" style={{
              flex: 1, padding: '8px', border: 'none', borderRadius: '6px',
              fontSize: '14px', fontWeight: 'bold',
              background: '#ffffff', color: '#0E1B2C', boxShadow: '0 1px 4px rgba(0,0,0,0.1)'
            }}>Cadastrar</button>
          </div>
        )}

        {/* ── SIGN UP DONE ──────────────────────────────────── */}
        {signUpDone ? (
          <div style={{ textAlign: 'center' }}>
            <MailCheck size={44} strokeWidth={1.5} color="#2E7D6B" style={{ margin: '0 auto 16px' }} aria-hidden="true" />
            <h2 style={{ color: '#0E1B2C', fontSize: '18px', fontWeight: 'bold', margin: '0 0 12px 0' }}>
              Verifique seu e-mail
            </h2>
            <p style={{ color: '#374151', fontSize: '14px', marginBottom: '8px' }}>
              Enviamos um link de confirmação para:
            </p>
            <p style={{ color: '#2E7D6B', fontSize: '15px', fontWeight: 'bold', marginBottom: '16px' }}>
              {email}
            </p>
            <div style={{
              background: '#FAF3E0', border: '1px solid #EEDFB4', borderRadius: '8px',
              padding: '12px 16px', marginBottom: '20px', textAlign: 'left'
            }}>
              <p style={{ color: '#8A6E2F', fontSize: '13px', margin: '0 0 6px 0', fontWeight: 'bold' }}>
                Não recebeu o e-mail?
              </p>
              <ul style={{ color: '#8A6E2F', fontSize: '13px', margin: '0', paddingLeft: '16px' }}>
                <li>Verifique a pasta de <strong>spam/lixo eletrônico</strong></li>
                <li>Aguarde alguns minutos e tente reenviar</li>
                <li>Confirme se o e-mail digitado está correto</li>
              </ul>
            </div>
            <button type="button" onClick={handleResendConfirmation} disabled={resending} style={{
              width: '100%', padding: '12px',
              background: resending ? '#9CA3AF' : '#2E7D6B',
              color: '#ffffff', border: 'none', borderRadius: '8px',
              fontSize: '15px', fontWeight: 'bold',
              cursor: resending ? 'not-allowed' : 'pointer', marginBottom: '12px'
            }}>
              {resending ? 'Reenviando...' : 'Reenviar e-mail de confirmação'}
            </button>
            <button type="button" onClick={resetSignUp} style={{
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
              <a href="/esqueci-senha" style={{ color: '#2E7D6B', fontSize: '13px', textDecoration: 'none' }}>Esqueci minha senha</a>
            </div>
            <button type="submit" disabled={loading} style={{
              width: '100%', padding: '14px',
              background: loading ? '#9CA3AF' : '#2E7D6B',
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

            <button type="submit" disabled={loading} style={{
              width: '100%', padding: '14px',
              background: loading ? '#9CA3AF' : '#2E7D6B',
              color: '#ffffff', border: 'none', borderRadius: '8px',
              fontSize: '16px', fontWeight: 'bold',
              cursor: loading ? 'not-allowed' : 'pointer'
            }}>
              Continuar
            </button>
          </form>

        /* ── SIGN UP PASSO 2: papel ──────────────────────── */
        ) : (
          <form onSubmit={handleStep2}>
            <p style={{
              color: '#C9A227', fontSize: '11px', fontWeight: 700,
              letterSpacing: '0.2em', textTransform: 'uppercase', margin: '0 0 10px',
            }}>Passo 2 de 2</p>
            <h2 style={{
              color: '#0E1B2C', fontSize: '22px', fontWeight: 500, margin: '0 0 6px',
              fontFamily: 'var(--font-fraunces), serif', letterSpacing: '-0.01em',
            }}>Como você vai usar?</h2>
            <p style={{ margin: '0 0 20px', fontSize: '13px', color: '#6B7280' }}>
              Isso define sua tela inicial. Dá para mudar depois, no Perfil.
            </p>

            <div role="radiogroup" aria-label="Como você vai usar" style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
              {OPCOES_DE_PAPEL.map(opcao => {
                const escolhido = papel === opcao.id
                const Icon = ICONE_DO_PAPEL[opcao.id]
                return (
                  <button type="button" key={opcao.id} role="radio" aria-checked={escolhido}
                    onClick={() => setPapel(opcao.id)} style={{
                      textAlign: 'left', cursor: 'pointer', padding: '16px',
                      borderRadius: '12px', background: escolhido ? '#FAF3E0' : '#ffffff',
                      border: escolhido ? '2px solid #C9A227' : '1px solid #E7E1D6',
                    }}>
                    <span style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{
                        width: '36px', height: '36px', borderRadius: '10px', flexShrink: 0,
                        background: escolhido ? 'rgba(201,162,39,0.18)' : '#F3EEE4',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Icon size={19} strokeWidth={1.75} color={escolhido ? '#8A6E2F' : '#6B7280'} aria-hidden="true" />
                      </span>
                      <span style={{ fontSize: '15px', fontWeight: 700, color: '#0E1B2C' }}>{opcao.titulo}</span>
                    </span>
                    <span style={{ display: 'block', fontSize: '13px', color: '#6B7280', lineHeight: 1.5 }}>
                      {opcao.descricao}
                    </span>
                  </button>
                )
              })}
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button type="button" onClick={() => setSignUpStep(1)} style={{
                padding: '14px 20px', background: '#F3EEE4', color: '#0E1B2C',
                border: 'none', borderRadius: '9px', fontSize: '14px', cursor: 'pointer'
              }}>Voltar</button>
              <button type="submit" disabled={loading} style={{
                flex: 1, padding: '14px',
                background: loading ? '#9CA3AF' : '#2E7D6B',
                color: '#ffffff', border: 'none', borderRadius: '9px',
                fontSize: '16px', fontWeight: 'bold',
                cursor: loading ? 'not-allowed' : 'pointer'
              }}>
                {loading ? 'Aguarde...' : 'Criar conta'}
              </button>
            </div>
            <p style={{ margin: '14px 0 0', fontSize: '12px', color: '#9CA3AF', textAlign: 'center' }}>
              Profissão, registro e redes só quando você optar por aparecer na rede de parceiros.
            </p>
          </form>
        )}

        {message && (() => {
          const isError = messageIsError
          return (
            <div style={{
              marginTop: '20px', padding: '12px 16px', borderRadius: '8px',
              background: isError ? '#FAEEE9' : '#F0F6F3',
              border: `1px solid ${isError ? '#EBD3C7' : '#DCEAE4'}`,
              color: isError ? '#B4533A' : '#2E7D6B',
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
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0E1B2C' }}>
        <div style={{ textAlign: 'center' }}>
          <img src="/marketing/logo-fengshui.png" alt="" width={48} height={48} style={{ marginBottom: '16px', display: 'inline-block' }} />
          <p style={{ color: '#ffffff', fontSize: '16px', fontFamily: 'var(--font-figtree), sans-serif' }}>Carregando...</p>
        </div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  )
}
