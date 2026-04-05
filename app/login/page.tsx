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
    <div className="min-h-screen bg-gradient-to-br from-[#1E3A5F] via-[#2d5a8e] to-[#1E3A5F] flex items-center justify-center font-[Arial,sans-serif] p-5">
      <div className={`bg-white rounded-2xl px-9 py-10 w-full ${isSignUp && signUpStep === 2 ? 'max-w-[520px]' : 'max-w-[420px]'} shadow-2xl transition-all duration-300`}>
        <div className="text-center mb-6">
          <div className="text-[40px] mb-1">☯</div>
          <h1 className="text-[#1E3A5F] text-[26px] font-bold m-0">FengShui Studio</h1>
          <p className="text-purple-600 text-[13px] mt-1 mb-0">
            {isSignUp ? (signUpStep === 2 ? 'Dados profissionais' : 'Crie sua conta') : 'Plataforma para Consultores e Usuários'}
          </p>
        </div>

        {!isSignUp && (
          <div className="flex bg-gray-100 rounded-lg p-1 mb-6">
            <button onClick={() => { setIsSignUp(false); setMessage('') }} className="flex-1 p-2 border-none rounded-md cursor-pointer text-sm font-bold bg-white text-[#1E3A5F] shadow">
              Entrar
            </button>
            <button onClick={() => { setIsSignUp(true); setMessage(''); setSignUpStep(1) }} className="flex-1 p-2 border-none rounded-md cursor-pointer text-sm font-bold bg-transparent text-gray-500">
              Cadastrar
            </button>
          </div>
        )}

        {isSignUp && !signUpDone && (
          <div className="flex bg-gray-100 rounded-lg p-1 mb-6">
            <button onClick={() => { setIsSignUp(false); setMessage(''); setSignUpStep(1) }} className="flex-1 p-2 border-none rounded-md cursor-pointer text-sm font-bold bg-transparent text-gray-500">
              Entrar
            </button>
            <button className="flex-1 p-2 border-none rounded-md text-sm font-bold bg-white text-[#1E3A5F] shadow">
              Cadastrar
            </button>
          </div>
        )}

        {/* ── SIGN UP DONE ──────────────────────────────────── */}
        {signUpDone ? (
          <div className="text-center">
            <div className="text-5xl mb-4">✉️</div>
            <h2 className="text-[#1E3A5F] text-lg font-bold mb-3 mt-0">
              Verifique seu e-mail
            </h2>
            <p className="text-gray-700 text-sm mb-2">
              Enviamos um link de confirmação para:
            </p>
            <p className="text-purple-600 text-[15px] font-bold mb-4">
              {email}
            </p>
            <div className="bg-amber-100 border border-[#FDE68A] rounded-lg px-4 py-3 mb-5 text-left">
              <p className="text-amber-800 text-[13px] mb-1.5 mt-0 font-bold">
                Não recebeu o e-mail?
              </p>
              <ul className="text-amber-800 text-[13px] m-0 pl-4">
                <li>Verifique a pasta de <strong>spam/lixo eletrônico</strong></li>
                <li>Aguarde alguns minutos e tente reenviar</li>
                <li>Confirme se o e-mail digitado está correto</li>
              </ul>
            </div>
            <button onClick={handleResendConfirmation} disabled={resending} className={`w-full p-3 ${resending ? 'bg-gray-400 cursor-not-allowed' : 'bg-purple-600 cursor-pointer'} text-white border-none rounded-lg text-[15px] font-bold mb-3`}>
              {resending ? 'Reenviando...' : 'Reenviar e-mail de confirmação'}
            </button>
            <button onClick={resetSignUp} className="w-full p-3 bg-gray-100 text-gray-700 border-none rounded-lg text-sm cursor-pointer">
              Voltar para o login
            </button>
          </div>

        /* ── LOGIN FORM ──────────────────────────────────── */
        ) : !isSignUp ? (
          <form onSubmit={handleLogin}>
            <div className="mb-4">
              <label htmlFor="login-email" className="block text-gray-700 text-[13px] font-bold mb-1">E-mail</label>
              <input id="login-email" type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="seu@email.com" required className="w-full py-3 px-3.5 border border-gray-300 rounded-lg text-[15px] outline-none box-border" />
            </div>
            <div className="mb-6">
              <label htmlFor="login-senha" className="block text-gray-700 text-[13px] font-bold mb-1">Senha</label>
              <input id="login-senha" type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="Sua senha" required className="w-full py-3 px-3.5 border border-gray-300 rounded-lg text-[15px] outline-none box-border" />
            </div>
            <div className="text-right -mt-4 mb-5">
              <a href="/esqueci-senha" className="text-purple-600 text-[13px] no-underline">Esqueci minha senha</a>
            </div>
            <button type="submit" disabled={loading} className={`w-full py-3.5 ${loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-purple-600 cursor-pointer'} text-white border-none rounded-lg text-base font-bold`}>
              {loading ? 'Aguarde...' : 'Entrar'}
            </button>
          </form>

        /* ── SIGN UP STEP 1 ──────────────────────────────── */
        ) : signUpStep === 1 ? (
          <form onSubmit={handleStep1}>
            <div className="mb-3.5">
              <label htmlFor="signup-nome" className="block text-gray-700 text-[13px] font-bold mb-1">Nome completo</label>
              <input id="signup-nome" type="text" value={name} onChange={e => setName(e.target.value)}
                placeholder="Seu nome completo" required className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm outline-none box-border" />
            </div>
            <div className="mb-3.5">
              <label htmlFor="signup-email" className="block text-gray-700 text-[13px] font-bold mb-1">E-mail</label>
              <input id="signup-email" type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="seu@email.com" required className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm outline-none box-border" />
            </div>
            <div className="mb-3.5">
              <label htmlFor="signup-senha" className="block text-gray-700 text-[13px] font-bold mb-1">Senha</label>
              <input id="signup-senha" type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres" required className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm outline-none box-border" />
            </div>

            {/* User type selector */}
            <div className="mb-5">
              <label className="block text-gray-700 text-[13px] font-bold mb-1">Tipo de usuário</label>
              <div className="flex flex-col gap-1.5">
                {TIPOS_USUARIO.map(tipo => (
                  <label key={tipo.id} onClick={() => setTipoUsuario(tipo.id)} className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg cursor-pointer border-2 transition-all duration-200 ${tipoUsuario === tipo.id ? 'border-purple-600 bg-purple-50' : 'border-gray-200 bg-white'}`}>
                    <div className={`w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center shrink-0 ${tipoUsuario === tipo.id ? 'border-purple-600' : 'border-gray-300'}`}>
                      {tipoUsuario === tipo.id && (
                        <div className="w-2.5 h-2.5 rounded-full bg-purple-600" />
                      )}
                    </div>
                    <div>
                      <span className="text-gray-900 text-sm font-bold">{tipo.label}</span>
                      <span className="text-gray-400 text-xs ml-1.5">{tipo.desc}</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <button type="submit" disabled={loading} className={`w-full py-3.5 ${loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-purple-600 cursor-pointer'} text-white border-none rounded-lg text-base font-bold`}>
              {loading ? 'Aguarde...' : isProfessional ? 'Próximo: dados profissionais' : 'Criar conta'}
            </button>
          </form>

        /* ── SIGN UP STEP 2: Professional Details ────────── */
        ) : (
          <form onSubmit={handleStep2}>
            <div className="bg-purple-50 rounded-lg px-3.5 py-2.5 mb-4 flex items-center gap-2">
              <span className="text-lg">
                {tipoUsuario === 'arquiteto' ? '🏗️' : tipoUsuario === 'feng_shui' ? '☯' : tipoUsuario === 'decorador' ? '🎨' : '💼'}
              </span>
              <span className="text-purple-600 text-[13px] font-bold">
                {TIPOS_USUARIO.find(t => t.id === tipoUsuario)?.label}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label htmlFor="signup-profissao" className="block text-gray-700 text-[13px] font-bold mb-1">Profissão *</label>
                <input id="signup-profissao" type="text" value={profForm.profissao}
                  onChange={e => setProfForm({ ...profForm, profissao: e.target.value })}
                  placeholder="Ex: Arquiteto, Consultor" required className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm outline-none box-border" />
              </div>
              <div>
                <label htmlFor="signup-area-atuacao" className="block text-gray-700 text-[13px] font-bold mb-1">Área de atuação *</label>
                <input id="signup-area-atuacao" type="text" value={profForm.area_atuacao}
                  onChange={e => setProfForm({ ...profForm, area_atuacao: e.target.value })}
                  placeholder="Ex: Residencial, Comercial" required className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm outline-none box-border" />
              </div>
            </div>

            <div className="mb-3">
              <label htmlFor="signup-registro" className="block text-gray-700 text-[13px] font-bold mb-1">Registro profissional</label>
              <input id="signup-registro" type="text" value={profForm.registro_profissional}
                onChange={e => setProfForm({ ...profForm, registro_profissional: e.target.value })}
                placeholder="Ex: CAU A12345-6, CREA 12345" className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm outline-none box-border" />
            </div>

            <div className="grid grid-cols-2 gap-3 mb-5">
              <div>
                <label htmlFor="signup-linkedin" className="block text-gray-700 text-[13px] font-bold mb-1">LinkedIn (portfolio)</label>
                <input id="signup-linkedin" type="url" value={profForm.linkedin}
                  onChange={e => setProfForm({ ...profForm, linkedin: e.target.value })}
                  placeholder="https://linkedin.com/in/..." className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm outline-none box-border" />
              </div>
              <div>
                <label htmlFor="signup-instagram" className="block text-gray-700 text-[13px] font-bold mb-1">Instagram (portfolio)</label>
                <input id="signup-instagram" type="text" value={profForm.instagram}
                  onChange={e => setProfForm({ ...profForm, instagram: e.target.value })}
                  placeholder="@seuperfil" className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm outline-none box-border" />
              </div>
            </div>

            <div className="flex gap-2.5">
              <button type="button" onClick={() => setSignUpStep(1)} className="py-3.5 px-5 bg-gray-100 text-gray-700 border-none rounded-lg text-sm cursor-pointer">
                Voltar
              </button>
              <button type="submit" disabled={loading} className={`flex-1 py-3.5 ${loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-purple-600 cursor-pointer'} text-white border-none rounded-lg text-base font-bold`}>
                {loading ? 'Aguarde...' : 'Criar conta'}
              </button>
            </div>
          </form>
        )}

        {message && (() => {
          const isError = message.includes('Erro') || message.includes('incorretos') || message.includes('já está cadastrado')
          return (
            <div className={`mt-5 px-4 py-3 rounded-lg text-sm text-center ${isError ? 'bg-red-50 border border-[#FECACA] text-red-600' : 'bg-green-50 border border-[#BBF7D0] text-green-700'}`}>
              {message}
            </div>
          )
        })()}

        <p className="text-center text-gray-400 text-xs mt-6 mb-0">
          FengShui Studio 2026 - CollabZ Consultoria
        </p>
      </div>
    </div>
  )
}

export default function Login() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#1E3A5F]">
        <div className="text-center">
          <div className="text-5xl mb-4">☯</div>
          <p className="text-white text-base font-[Arial,sans-serif]">Carregando...</p>
        </div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  )
}
