'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../src/lib/supabase'
import AppShell from '../components/AppShell'
import type { Profile } from '../../src/lib/types'
import type { User } from '@supabase/supabase-js'
import { planoEfetivo } from '../../src/lib/plano-utils'

const PLANOS = [
  {
    id: 'free', nome: 'Free', precoMensal: 0, precoAnual: 0,
    descricao: 'Para conhecer a plataforma', cor: '#6B7280', destaque: false,
    recursos: [
      { nome: 'Cadastro de imóveis', valor: 'Até 3', disponivel: true },
      { nome: 'Análise Baguá', valor: '1 por imóvel', disponivel: true },
      { nome: 'Cadastro de clientes', disponivel: false },
      { nome: 'Relatório PDF', disponivel: false },
      { nome: 'Calendário lunar', disponivel: false },
      { nome: 'Rede de parceiros', disponivel: false },
      { nome: 'Múltiplas análises', disponivel: false },
      { nome: 'Histórico de análises', disponivel: false },
    ]
  },
  {
    id: 'simples', nome: 'Simples', precoMensal: 20, precoAnual: 168,
    descricao: 'Para uso pessoal', cor: '#059669', destaque: false,
    recursos: [
      { nome: 'Cadastro de imóveis', valor: '1 ativo', disponivel: true },
      { nome: 'Análise Baguá', valor: '1 por imóvel', disponivel: true },
      { nome: 'Cadastro de clientes', valor: 'Apenas pessoal', disponivel: false },
      { nome: 'Relatório PDF', valor: 'Com marca d\'água', disponivel: true },
      { nome: 'Calendário lunar', valor: 'Incluído', disponivel: true },
      { nome: 'Rede de parceiros', valor: 'Visualizar', disponivel: true },
      { nome: 'Múltiplas análises', disponivel: false },
      { nome: 'Histórico de análises', disponivel: false },
    ]
  },
  {
    id: 'profissional', nome: 'Profissional', precoMensal: 49, precoAnual: 411.60,
    descricao: 'Para consultores profissionais', cor: '#7C3AED', destaque: true,
    recursos: [
      { nome: 'Cadastro de imóveis', valor: 'Ilimitados', disponivel: true },
      { nome: 'Análise Baguá', valor: 'Múltiplas', disponivel: true },
      { nome: 'Cadastro de clientes', valor: 'Ilimitados', disponivel: true },
      { nome: 'Relatório PDF', valor: 'Sem marca d\'água', disponivel: true },
      { nome: 'Calendário lunar', valor: 'Incluído', disponivel: true },
      { nome: 'Rede de parceiros', valor: 'Completo + serviços', disponivel: true },
      { nome: 'Múltiplas análises', valor: 'Incluído', disponivel: true },
      { nome: 'Histórico de análises', valor: 'Incluído', disponivel: true },
    ]
  }
]

const FEATURES_TABLE = [
  { nome: 'Cadastro de imóveis', free: 'Até 3', simples: '1 ativo', profissional: 'Ilimitado' },
  { nome: 'Cadastro de clientes', free: false, simples: false, profissional: 'Ilimitado' },
  { nome: 'Análise Baguá', free: true, simples: true, profissional: true },
  { nome: 'Relatório PDF', free: false, simples: 'Com marca d\'água', profissional: true },
  { nome: 'Rede de parceiros', free: false, simples: 'Visualizar', profissional: 'Completo + serviços' },
  { nome: 'Calendário lunar', free: false, simples: true, profissional: true },
  { nome: 'Múltiplas análises', free: false, simples: false, profissional: true },
  { nome: 'Histórico de análises', free: false, simples: false, profissional: true },
]

function formatCurrency(val: number): string {
  return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default function Planos() {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [ciclo, setCiclo] = useState<'monthly' | 'yearly'>('monthly')
  const [showKeyInput, setShowKeyInput] = useState(false)
  const [selectedPlanId, setSelectedPlanId] = useState('')
  const [chaveAtivacao, setChaveAtivacao] = useState('')
  const [upgrading, setUpgrading] = useState(false)
  const [subscription, setSubscription] = useState<{ status: string; cancel_at_period_end: boolean; current_period_end: string | null } | null>(null)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/login'; return }
      setUser(user)
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      setProfile(data)

      // Load current subscription
      const { data: subs } = await supabase
        .from('subscriptions')
        .select('status, cancel_at_period_end, current_period_end, billing_cycle')
        .eq('user_id', user.id)
        .in('status', ['active', 'past_due', 'trial', 'gratuidade'])
        .limit(1)
        .single()
      if (subs) setSubscription(subs)

      setLoading(false)
    }
    load()
  }, [])

  const planoAtualEfetivo = planoEfetivo(profile?.plano)

  async function handleSelectPlan(planoId: string) {
    if (planoId === planoAtualEfetivo) return
    if (planoId === 'free') {
      if (!confirm('Tem certeza que deseja voltar para o plano Free? Você perderá acesso aos recursos pagos.')) return
      try {
        const res = await fetch('/api/planos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ plano: 'free' }),
        })
        const data = await res.json()
        if (!res.ok) { setMessage('Erro: ' + data.error); return }
        setProfile(prev => prev ? { ...prev, plano: 'free' } : prev)
        setSubscription(null)
        setMessage('Plano alterado para Free.')
        setTimeout(() => setMessage(''), 4000)
      } catch { setMessage('Erro de conexão.') }
      return
    }
    setSelectedPlanId(planoId)
    setShowKeyInput(true)
    setMessage('')
  }

  async function handleStripeCheckout(planoId: string) {
    setUpgrading(true)
    setMessage('')
    try {
      const res = await fetch('/api/stripe/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan_slug: planoId, billing_cycle: ciclo }),
      })
      const data = await res.json()
      if (!res.ok) { setMessage('Erro: ' + (data.error || 'Erro ao criar checkout')); setUpgrading(false); return }
      if (data.url) {
        window.location.href = data.url
      }
    } catch { setMessage('Erro de conexão.'); setUpgrading(false) }
  }

  async function handleActivateKey() {
    if (!chaveAtivacao.trim()) { setMessage('Digite a chave de ativação.'); return }
    setUpgrading(true)
    setMessage('')
    const targetPlan = selectedPlanId || 'profissional'
    const planLabel = PLANOS.find(p => p.id === targetPlan)?.nome || targetPlan
    try {
      const res = await fetch('/api/planos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plano: targetPlan, chave_ativacao: chaveAtivacao.trim(), billing_cycle: ciclo }),
      })
      const data = await res.json()
      if (!res.ok) { setMessage(data.error || `Erro ao ativar plano ${planLabel}.`); setUpgrading(false); return }
      setProfile(prev => prev ? { ...prev, plano: targetPlan } : prev)
      setShowKeyInput(false)
      setSelectedPlanId('')
      setChaveAtivacao('')
      setMessage(`Parabéns! Seu plano foi atualizado para ${planLabel}!`)
      setTimeout(() => setMessage(''), 5000)
    } catch { setMessage('Erro de conexão.') }
    setUpgrading(false)
  }

  async function handleCancelSubscription() {
    if (!confirm('Tem certeza que deseja cancelar sua assinatura? Você continuará com acesso até o fim do período atual.')) return
    setUpgrading(true)
    try {
      const res = await fetch('/api/subscription/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      const data = await res.json()
      if (!res.ok) { setMessage('Erro: ' + data.error); setUpgrading(false); return }
      setSubscription(prev => prev ? { ...prev, cancel_at_period_end: true } : prev)
      setMessage('Assinatura será cancelada ao final do período atual.')
      setTimeout(() => setMessage(''), 5000)
    } catch { setMessage('Erro de conexão.') }
    setUpgrading(false)
  }

  async function handleManageBilling() {
    setUpgrading(true)
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { setMessage('Erro: ' + data.error); setUpgrading(false); return }
      if (data.url) window.location.href = data.url
    } catch { setMessage('Erro de conexão.'); setUpgrading(false) }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 font-sans">
        <div className="text-center">
          <div className="text-5xl mb-4">☯</div>
          <p className="text-purple-600 text-base">Carregando...</p>
        </div>
      </div>
    )
  }

  const planoAtualLabel = PLANOS.find(p => p.id === planoAtualEfetivo)?.nome || 'Free'
  const planoAtualCor = PLANOS.find(p => p.id === planoAtualEfetivo)?.cor || '#6B7280'

  return (
    <AppShell currentPage="planos">
      <div className="text-center mb-8">
        <h1 className="text-[#1E3A5F] text-[28px] font-bold m-0 mb-2">Escolha seu plano</h1>
        <p className="text-gray-500 text-base m-0 mb-2">
          Seu plano atual: <strong style={{ color: planoAtualCor }}>{planoAtualLabel}</strong>
        </p>

        {/* Subscription status info */}
        {subscription && (
          <div className="mb-4">
            {subscription.cancel_at_period_end && (
              <p className="text-red-600 text-[13px] my-1">
                Cancelamento agendado — acesso até {subscription.current_period_end ? new Date(subscription.current_period_end).toLocaleDateString('pt-BR') : 'fim do período'}
              </p>
            )}
            {subscription.status === 'past_due' && (
              <p className="text-red-600 text-[13px] my-1">
                Pagamento pendente — atualize seu meio de pagamento para manter o acesso
              </p>
            )}
            {subscription.status === 'active' && !subscription.cancel_at_period_end && planoAtualEfetivo !== 'free' && (
              <div className="flex gap-2 justify-center mt-2">
                <button onClick={handleManageBilling} disabled={upgrading}
                  className="px-4 py-1.5 bg-gray-100 text-gray-700 border border-gray-300 rounded-md text-xs cursor-pointer">
                  Gerenciar pagamento
                </button>
                <button onClick={handleCancelSubscription} disabled={upgrading}
                  className="px-4 py-1.5 bg-red-50 text-red-600 border border-red-200 rounded-md text-xs cursor-pointer">
                  Cancelar assinatura
                </button>
              </div>
            )}
          </div>
        )}

        {/* Toggle Mensal / Anual */}
        <div className="inline-flex bg-gray-100 rounded-[10px] p-1">
          <button onClick={() => setCiclo('monthly')}
            className={`px-6 py-2.5 rounded-lg border-none text-sm font-bold cursor-pointer transition-all duration-200 ${ciclo === 'monthly' ? 'bg-purple-600 text-white' : 'bg-transparent text-gray-500'}`}>
            Mensal
          </button>
          <button onClick={() => setCiclo('yearly')}
            className={`px-6 py-2.5 rounded-lg border-none text-sm font-bold cursor-pointer transition-all duration-200 ${ciclo === 'yearly' ? 'bg-purple-600 text-white' : 'bg-transparent text-gray-500'}`}>
            Anual <span className="bg-green-700 text-white px-2 py-0.5 rounded-[10px] text-[11px] ml-1.5">-30%</span>
          </button>
        </div>
      </div>

      {message && (() => {
        const isError = message.includes('Erro') || message.includes('inválida') || message.includes('Digite')
        return (
          <div className={`mb-6 px-4 py-3 rounded-lg text-sm text-center ${isError ? 'bg-red-50 border border-red-200 text-red-600' : 'bg-green-50 border border-green-200 text-green-700'}`}>
            {message}
          </div>
        )
      })()}

      {/* Plan Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mb-12 max-w-[1100px] mx-auto">
        {PLANOS.map(plano => {
          const isAtual = planoAtualEfetivo === plano.id
          const precoExibir = ciclo === 'yearly' && plano.precoAnual > 0
            ? plano.precoAnual / 12
            : plano.precoMensal
          const totalAnual = plano.precoAnual
          const economiAnual = (plano.precoMensal * 12) - plano.precoAnual

          return (
            <div key={plano.id}
              className={`bg-white rounded-2xl p-8 relative overflow-hidden ${plano.destaque ? 'shadow-lg shadow-purple-200 border-2 border-purple-600' : 'shadow-sm border border-gray-200'}`}>
              {plano.destaque && (
                <div className="absolute top-3 -right-7 bg-purple-600 text-white px-10 py-1 text-[11px] font-bold rotate-45">
                  POPULAR
                </div>
              )}
              <div className="mb-6">
                <h2 className="text-[22px] font-bold m-0 mb-1" style={{ color: plano.cor }}>{plano.nome}</h2>
                <p className="text-gray-400 text-sm m-0 mb-4">{plano.descricao}</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-gray-900 text-4xl font-bold">
                    {precoExibir === 0 ? 'R$ 0' : formatCurrency(precoExibir)}
                  </span>
                  {plano.precoMensal > 0 && <span className="text-gray-400 text-sm">/mês</span>}
                </div>
                {ciclo === 'yearly' && totalAnual > 0 && (
                  <div className="mt-1">
                    <span className="text-gray-500 text-[13px]">
                      {formatCurrency(totalAnual)}/ano
                    </span>
                    <span className="text-green-700 text-xs font-bold ml-2">
                      Economia de {formatCurrency(economiAnual)}
                    </span>
                  </div>
                )}
              </div>
              <div className="mb-6">
                {plano.recursos.map((rec, i) => (
                  <div key={i}
                    className={`flex items-center gap-2.5 py-2 ${i < plano.recursos.length - 1 ? 'border-b border-gray-100' : ''}`}>
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${rec.disponivel ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-300'}`}>
                      {rec.disponivel ? '✓' : '✕'}
                    </span>
                    <span className="text-gray-700 text-sm flex-1">{rec.nome}</span>
                    {rec.valor && <span className={`text-[13px] font-bold ${rec.disponivel ? 'text-gray-900' : 'text-gray-300'}`}>{rec.valor}</span>}
                  </div>
                ))}
              </div>

              {/* Action buttons */}
              {isAtual ? (
                <button disabled
                  className="w-full py-3.5 bg-gray-200 text-gray-400 border-none rounded-[10px] text-[15px] font-bold cursor-default">
                  Plano atual
                </button>
              ) : plano.id === 'free' ? (
                <button onClick={() => handleSelectPlan('free')}
                  className="w-full py-3.5 bg-white text-gray-500 border-2 border-gray-200 rounded-[10px] text-[15px] font-bold cursor-pointer">
                  Mudar para Free
                </button>
              ) : (
                <div className="flex flex-col gap-2">
                  <button onClick={() => handleStripeCheckout(plano.id)} disabled={upgrading}
                    className={`w-full py-3.5 rounded-[10px] text-[15px] font-bold ${upgrading
                      ? 'bg-gray-400 text-white cursor-not-allowed'
                      : plano.destaque
                        ? 'bg-purple-600 text-white border-none cursor-pointer'
                        : 'bg-white text-purple-600 border-2 border-purple-600 cursor-pointer'
                    }`}>
                    {upgrading ? 'Redirecionando...' : `Assinar ${ciclo === 'yearly' ? 'Anual' : 'Mensal'}`}
                  </button>
                  <button onClick={() => handleSelectPlan(plano.id)}
                    className="w-full py-2 bg-transparent text-gray-400 border-none text-xs cursor-pointer underline">
                    Tenho uma chave de ativação
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Activation Key Panel */}
      {showKeyInput && (() => {
        const targetPlan = PLANOS.find(p => p.id === selectedPlanId)
        const targetNome = targetPlan?.nome || 'Profissional'
        const targetCor = targetPlan?.cor || '#7C3AED'
        return (
          <div className="bg-white rounded-xl px-8 py-7 max-w-[500px] mx-auto mb-10 text-center"
            style={{ boxShadow: `0 4px 20px ${targetCor}25`, border: `2px solid ${targetCor}` }}>
            <div className="text-[32px] mb-3">🔑</div>
            <h3 className="text-[#1E3A5F] text-lg font-bold m-0 mb-2">
              Ativar Plano {targetNome}
            </h3>
            <p className="text-gray-500 text-sm m-0 mb-5">
              Digite sua chave de ativação para liberar o plano {targetNome}
            </p>
            <div className="flex gap-2.5 mb-4">
              <input type="text" value={chaveAtivacao} onChange={e => setChaveAtivacao(e.target.value)}
                placeholder="XXXX-XXXX-XXXX-XXXX" onKeyDown={e => e.key === 'Enter' && handleActivateKey()}
                className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-lg text-[15px] outline-none text-center tracking-widest font-bold" />
              <button onClick={handleActivateKey} disabled={upgrading}
                className={`px-6 py-3 text-white border-none rounded-lg text-[15px] font-bold whitespace-nowrap ${upgrading ? 'bg-gray-400 cursor-not-allowed' : 'cursor-pointer'}`}
                style={{ background: upgrading ? undefined : targetCor }}>
                {upgrading ? 'Ativando...' : 'Ativar'}
              </button>
            </div>
            <button onClick={() => { setShowKeyInput(false); setSelectedPlanId(''); setChaveAtivacao(''); setMessage('') }}
              className="bg-transparent border-none text-gray-400 text-[13px] cursor-pointer">
              Cancelar
            </button>
          </div>
        )
      })()}

      {/* Feature Comparison Table */}
      <div className="bg-white rounded-2xl p-8 shadow-sm max-w-[900px] mx-auto mb-10">
        <h3 className="text-[#1E3A5F] text-xl font-bold m-0 mb-5 text-center">
          Comparação de funcionalidades
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="text-left px-2 py-3 border-b-2 border-gray-200 text-gray-500">Funcionalidade</th>
                <th className="text-center px-2 py-3 border-b-2 border-gray-200 text-gray-500">Free</th>
                <th className="text-center px-2 py-3 border-b-2 border-gray-200 text-emerald-600">Simples</th>
                <th className="text-center px-2 py-3 border-b-2 border-gray-200 text-purple-600">Profissional</th>
              </tr>
            </thead>
            <tbody>
              {FEATURES_TABLE.map((feat, i) => (
                <tr key={i}>
                  <td className="px-2 py-2.5 border-b border-gray-100 text-gray-700">{feat.nome}</td>
                  {(['free', 'simples', 'profissional'] as const).map(plan => {
                    const val = feat[plan]
                    return (
                      <td key={plan} className="text-center px-2 py-2.5 border-b border-gray-100">
                        {val === true ? <span className="text-green-700 font-bold">✓</span>
                          : val === false ? <span className="text-gray-300">—</span>
                          : <span className="text-gray-700 text-[13px]">{val}</span>}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-xl px-8 py-6 shadow-sm text-center max-w-[900px] mx-auto">
        <p className="text-gray-500 text-sm m-0 mb-1">
          Dúvidas sobre os planos? Entre em contato pelo e-mail
        </p>
        <a href="mailto:suporte@fengshuistudio.com" className="text-purple-600 text-sm font-bold no-underline">
          suporte@fengshuistudio.com
        </a>
      </div>
    </AppShell>
  )
}
