'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../src/lib/supabase'
import AppShell from '../components/AppShell'

const PLANOS = [
  {
    id: 'freemium', nome: 'Free', preco: 'R$ 0', periodo: '/mês',
    descricao: 'Para quem está começando', cor: '#6B7280', destaque: false,
    recursos: [
      { nome: 'Clientes cadastrados', valor: 'Até 5', disponivel: true },
      { nome: 'Consultas por mês', valor: 'Até 3', disponivel: true },
      { nome: 'Diagnóstico Ba Gua', valor: 'Completo', disponivel: true },
      { nome: 'Geração de PDF', valor: '—', disponivel: false },
      { nome: 'Calendário lunar', valor: '—', disponivel: false },
      { nome: 'Suporte prioritário', valor: '—', disponivel: false },
    ]
  },
  {
    id: 'pro', nome: 'Pro', preco: 'R$ 49,90', periodo: '/mês',
    descricao: 'Para consultores profissionais', cor: '#7C3AED', destaque: true,
    recursos: [
      { nome: 'Clientes cadastrados', valor: 'Ilimitados', disponivel: true },
      { nome: 'Consultas por mês', valor: 'Ilimitadas', disponivel: true },
      { nome: 'Diagnóstico Ba Gua', valor: 'Completo', disponivel: true },
      { nome: 'Geração de PDF', valor: 'Sem marca d\'água', disponivel: true },
      { nome: 'Calendário lunar', valor: 'Incluído', disponivel: true },
      { nome: 'Suporte prioritário', valor: 'Via e-mail', disponivel: true },
    ]
  }
]

export default function Planos() {
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/login'; return }
      setUser(user)
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      setProfile(data)
      setLoading(false)
    }
    load()
  }, [])

  async function handleSelectPlan(planoId: string) {
    if (planoId === profile?.plano) return
    if (planoId === 'pro') {
      try {
        const res = await fetch('/api/planos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ plano: 'pro' }),
        })
        const data = await res.json()
        if (!res.ok) {
          if (data.requiresPayment) {
            setMessage('Para fazer upgrade para o plano Pro, é necessário efetuar o pagamento. Em breve a integração com pagamento estará disponível.')
          } else {
            setMessage('Erro ao atualizar plano: ' + data.error)
          }
          return
        }
        setProfile({ ...profile, plano: 'pro' })
        setMessage('Parabéns! Seu plano foi atualizado para Pro!')
        setTimeout(() => setMessage(''), 4000)
      } catch {
        setMessage('Erro de conexão ao atualizar plano.')
      }
    } else {
      if (!confirm('Tem certeza que deseja voltar para o plano Free? Você perderá acesso aos recursos Pro.')) return
      try {
        const res = await fetch('/api/planos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ plano: 'freemium' }),
        })
        const data = await res.json()
        if (!res.ok) {
          setMessage('Erro ao atualizar plano: ' + data.error)
          return
        }
        setProfile({ ...profile, plano: 'freemium' })
        setMessage('Plano alterado para Free.')
        setTimeout(() => setMessage(''), 4000)
      } catch {
        setMessage('Erro de conexão ao atualizar plano.')
      }
    }
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F9FAFB', fontFamily: 'Arial, sans-serif' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>☯</div>
          <p style={{ color: '#7C3AED', fontSize: '16px' }}>Carregando...</p>
        </div>
      </div>
    )
  }

  const planoAtual = profile?.plano || 'freemium'

  return (
    <AppShell currentPage="planos">

      <div style={{ textAlign: 'center', marginBottom: '40px' }}>
        <h1 style={{ color: '#1E3A5F', fontSize: '28px', fontWeight: 'bold', margin: '0 0 8px 0' }}>Escolha seu plano</h1>
        <p style={{ color: '#6B7280', fontSize: '16px', margin: '0' }}>
          Seu plano atual: <strong style={{ color: planoAtual === 'pro' ? '#7C3AED' : '#6B7280' }}>
            {planoAtual === 'pro' ? 'Pro' : 'Free'}
          </strong>
        </p>
      </div>

      {message && (
        <div style={{
          marginBottom: '24px', padding: '12px 16px', borderRadius: '8px',
          background: message.includes('Erro') ? '#FEF2F2' : '#F0FDF4',
          border: `1px solid ${message.includes('Erro') ? '#FECACA' : '#BBF7D0'}`,
          color: message.includes('Erro') ? '#DC2626' : '#15803D',
          fontSize: '14px', textAlign: 'center'
        }}>{message}</div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '40px', maxWidth: '900px', margin: '0 auto 40px' }}>
        {PLANOS.map(plano => {
          const isAtual = planoAtual === plano.id
          return (
            <div key={plano.id} style={{
              background: '#ffffff', borderRadius: '16px', padding: '32px',
              boxShadow: plano.destaque ? '0 4px 20px rgba(124,58,237,0.2)' : '0 1px 4px rgba(0,0,0,0.08)',
              border: plano.destaque ? '2px solid #7C3AED' : '1px solid #E5E7EB',
              position: 'relative', overflow: 'hidden'
            }}>
              {plano.destaque && (
                <div style={{
                  position: 'absolute', top: '12px', right: '-28px',
                  background: '#7C3AED', color: '#fff', padding: '4px 40px',
                  fontSize: '11px', fontWeight: 'bold', transform: 'rotate(45deg)'
                }}>POPULAR</div>
              )}
              <div style={{ marginBottom: '24px' }}>
                <h2 style={{ color: plano.cor, fontSize: '22px', fontWeight: 'bold', margin: '0 0 4px 0' }}>{plano.nome}</h2>
                <p style={{ color: '#9CA3AF', fontSize: '14px', margin: '0 0 16px 0' }}>{plano.descricao}</p>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                  <span style={{ color: '#111827', fontSize: '36px', fontWeight: 'bold' }}>{plano.preco}</span>
                  <span style={{ color: '#9CA3AF', fontSize: '14px' }}>{plano.periodo}</span>
                </div>
              </div>
              <div style={{ marginBottom: '24px' }}>
                {plano.recursos.map((rec, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '8px 0', borderBottom: i < plano.recursos.length - 1 ? '1px solid #F3F4F6' : 'none'
                  }}>
                    <span style={{
                      width: '20px', height: '20px', borderRadius: '50%',
                      background: rec.disponivel ? '#F0FDF4' : '#F3F4F6',
                      color: rec.disponivel ? '#15803D' : '#D1D5DB',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '12px', fontWeight: 'bold', flexShrink: 0
                    }}>{rec.disponivel ? '✓' : '✕'}</span>
                    <span style={{ color: '#374151', fontSize: '14px', flex: 1 }}>{rec.nome}</span>
                    <span style={{ color: rec.disponivel ? '#111827' : '#D1D5DB', fontSize: '14px', fontWeight: 'bold' }}>{rec.valor}</span>
                  </div>
                ))}
              </div>
              <button onClick={() => handleSelectPlan(plano.id)} disabled={isAtual} style={{
                width: '100%', padding: '14px',
                background: isAtual ? '#E5E7EB' : plano.destaque ? '#7C3AED' : '#ffffff',
                color: isAtual ? '#9CA3AF' : plano.destaque ? '#ffffff' : '#7C3AED',
                border: isAtual ? 'none' : plano.destaque ? 'none' : '2px solid #7C3AED',
                borderRadius: '10px', fontSize: '15px', fontWeight: 'bold',
                cursor: isAtual ? 'default' : 'pointer'
              }}>
                {isAtual ? 'Plano atual' : plano.id === 'pro' ? 'Fazer upgrade' : 'Mudar para Free'}
              </button>
            </div>
          )
        })}
      </div>

      <div style={{
        background: '#ffffff', borderRadius: '12px', padding: '24px 32px',
        boxShadow: '0 1px 4px rgba(0,0,0,0.08)', textAlign: 'center', maxWidth: '900px', margin: '0 auto'
      }}>
        <p style={{ color: '#6B7280', fontSize: '14px', margin: '0 0 4px 0' }}>
          Dúvidas sobre os planos? Entre em contato pelo e-mail
        </p>
        <a href="mailto:suporte@fengshuistudio.com" style={{ color: '#7C3AED', fontSize: '14px', fontWeight: 'bold', textDecoration: 'none' }}>
          suporte@fengshuistudio.com
        </a>
      </div>

    </AppShell>
  )
}