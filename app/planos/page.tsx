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
    id: 'simples', nome: 'Simples', precoMensal: 97, precoAnual: 814.80,
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
    id: 'profissional', nome: 'Profissional', precoMensal: 247, precoAnual: 2076,
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
        setMessage('Plano alterado para Free.')
        setTimeout(() => setMessage(''), 4000)
      } catch { setMessage('Erro de conexão.') }
      return
    }
    setSelectedPlanId(planoId)
    setShowKeyInput(true)
    setMessage('')
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

  const planoAtualLabel = PLANOS.find(p => p.id === planoAtualEfetivo)?.nome || 'Free'
  const planoAtualCor = PLANOS.find(p => p.id === planoAtualEfetivo)?.cor || '#6B7280'

  return (
    <AppShell currentPage="planos">
      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        <h1 style={{ color: '#1E3A5F', fontSize: '28px', fontWeight: 'bold', margin: '0 0 8px 0' }}>Escolha seu plano</h1>
        <p style={{ color: '#6B7280', fontSize: '16px', margin: '0 0 24px 0' }}>
          Seu plano atual: <strong style={{ color: planoAtualCor }}>{planoAtualLabel}</strong>
        </p>

        {/* Toggle Mensal / Anual */}
        <div style={{ display: 'inline-flex', background: '#F3F4F6', borderRadius: '10px', padding: '4px' }}>
          <button onClick={() => setCiclo('monthly')} style={{
            padding: '10px 24px', borderRadius: '8px', border: 'none', fontSize: '14px', fontWeight: 'bold',
            background: ciclo === 'monthly' ? '#7C3AED' : 'transparent',
            color: ciclo === 'monthly' ? '#fff' : '#6B7280', cursor: 'pointer', transition: 'all 0.2s'
          }}>Mensal</button>
          <button onClick={() => setCiclo('yearly')} style={{
            padding: '10px 24px', borderRadius: '8px', border: 'none', fontSize: '14px', fontWeight: 'bold',
            background: ciclo === 'yearly' ? '#7C3AED' : 'transparent',
            color: ciclo === 'yearly' ? '#fff' : '#6B7280', cursor: 'pointer', transition: 'all 0.2s'
          }}>
            Anual <span style={{ background: '#15803D', color: '#fff', padding: '2px 8px', borderRadius: '10px', fontSize: '11px', marginLeft: '6px' }}>-30%</span>
          </button>
        </div>
      </div>

      {message && (() => {
        const isError = message.includes('Erro') || message.includes('inválida') || message.includes('Digite')
        return (
          <div style={{
            marginBottom: '24px', padding: '12px 16px', borderRadius: '8px',
            background: isError ? '#FEF2F2' : '#F0FDF4',
            border: `1px solid ${isError ? '#FECACA' : '#BBF7D0'}`,
            color: isError ? '#DC2626' : '#15803D', fontSize: '14px', textAlign: 'center'
          }}>{message}</div>
        )
      })()}

      {/* Plan Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginBottom: '48px', maxWidth: '1100px', margin: '0 auto 48px' }}>
        {PLANOS.map(plano => {
          const isAtual = planoAtualEfetivo === plano.id
          const precoExibir = ciclo === 'yearly' && plano.precoAnual > 0
            ? plano.precoAnual / 12
            : plano.precoMensal
          const totalAnual = plano.precoAnual
          const economiAnual = (plano.precoMensal * 12) - plano.precoAnual

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
                  <span style={{ color: '#111827', fontSize: '36px', fontWeight: 'bold' }}>
                    {precoExibir === 0 ? 'R$ 0' : formatCurrency(precoExibir)}
                  </span>
                  {plano.precoMensal > 0 && <span style={{ color: '#9CA3AF', fontSize: '14px' }}>/mês</span>}
                </div>
                {ciclo === 'yearly' && totalAnual > 0 && (
                  <div style={{ marginTop: '4px' }}>
                    <span style={{ color: '#6B7280', fontSize: '13px' }}>
                      {formatCurrency(totalAnual)}/ano
                    </span>
                    <span style={{ color: '#15803D', fontSize: '12px', fontWeight: 'bold', marginLeft: '8px' }}>
                      Economia de {formatCurrency(economiAnual)}
                    </span>
                  </div>
                )}
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
                    {rec.valor && <span style={{ color: rec.disponivel ? '#111827' : '#D1D5DB', fontSize: '13px', fontWeight: 'bold' }}>{rec.valor}</span>}
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
                {isAtual ? 'Plano atual' : plano.id === 'free' ? 'Mudar para Free' : 'Assinar'}
              </button>
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
          <div style={{
            background: '#ffffff', borderRadius: '12px', padding: '28px 32px',
            boxShadow: `0 4px 20px ${targetCor}25`, border: `2px solid ${targetCor}`,
            maxWidth: '500px', margin: '0 auto 40px', textAlign: 'center'
          }}>
            <div style={{ fontSize: '32px', marginBottom: '12px' }}>🔑</div>
            <h3 style={{ color: '#1E3A5F', fontSize: '18px', fontWeight: 'bold', margin: '0 0 8px 0' }}>
              Ativar Plano {targetNome}
            </h3>
            <p style={{ color: '#6B7280', fontSize: '14px', margin: '0 0 20px 0' }}>
              Digite sua chave de ativação para liberar o plano {targetNome}
            </p>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
              <input type="text" value={chaveAtivacao} onChange={e => setChaveAtivacao(e.target.value)}
                placeholder="XXXX-XXXX-XXXX-XXXX" onKeyDown={e => e.key === 'Enter' && handleActivateKey()}
                style={{
                  flex: 1, padding: '12px 16px', border: '2px solid #E5E7EB', borderRadius: '8px',
                  fontSize: '15px', outline: 'none', textAlign: 'center', letterSpacing: '2px', fontWeight: 'bold'
                }} />
              <button onClick={handleActivateKey} disabled={upgrading} style={{
                padding: '12px 24px', background: upgrading ? '#9CA3AF' : targetCor, color: '#ffffff',
                border: 'none', borderRadius: '8px', fontSize: '15px', fontWeight: 'bold',
                cursor: upgrading ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap'
              }}>{upgrading ? 'Ativando...' : 'Ativar'}</button>
            </div>
            <p style={{ color: '#9CA3AF', fontSize: '12px', margin: '0 0 12px 0' }}>
              Pagamento online em breve. Use uma chave de ativação para acessar agora.
            </p>
            <button onClick={() => { setShowKeyInput(false); setSelectedPlanId(''); setChaveAtivacao(''); setMessage('') }}
              style={{ background: 'none', border: 'none', color: '#9CA3AF', fontSize: '13px', cursor: 'pointer' }}>
              Cancelar
            </button>
          </div>
        )
      })()}

      {/* Feature Comparison Table */}
      <div style={{ background: '#ffffff', borderRadius: '16px', padding: '32px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', maxWidth: '900px', margin: '0 auto 40px' }}>
        <h3 style={{ color: '#1E3A5F', fontSize: '20px', fontWeight: 'bold', margin: '0 0 20px 0', textAlign: 'center' }}>
          Comparação de funcionalidades
        </h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '12px 8px', borderBottom: '2px solid #E5E7EB', color: '#6B7280' }}>Funcionalidade</th>
                <th style={{ textAlign: 'center', padding: '12px 8px', borderBottom: '2px solid #E5E7EB', color: '#6B7280' }}>Free</th>
                <th style={{ textAlign: 'center', padding: '12px 8px', borderBottom: '2px solid #E5E7EB', color: '#059669' }}>Simples</th>
                <th style={{ textAlign: 'center', padding: '12px 8px', borderBottom: '2px solid #E5E7EB', color: '#7C3AED' }}>Profissional</th>
              </tr>
            </thead>
            <tbody>
              {FEATURES_TABLE.map((feat, i) => (
                <tr key={i}>
                  <td style={{ padding: '10px 8px', borderBottom: '1px solid #F3F4F6', color: '#374151' }}>{feat.nome}</td>
                  {(['free', 'simples', 'profissional'] as const).map(plan => {
                    const val = feat[plan]
                    return (
                      <td key={plan} style={{ textAlign: 'center', padding: '10px 8px', borderBottom: '1px solid #F3F4F6' }}>
                        {val === true ? <span style={{ color: '#15803D', fontWeight: 'bold' }}>✓</span>
                          : val === false ? <span style={{ color: '#D1D5DB' }}>—</span>
                          : <span style={{ color: '#374151', fontSize: '13px' }}>{val}</span>}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Standalone Key Activation */}
      {!showKeyInput && (
        <div style={{
          background: '#ffffff', borderRadius: '12px', padding: '24px 32px',
          boxShadow: '0 1px 4px rgba(0,0,0,0.08)', maxWidth: '600px', margin: '0 auto 32px', textAlign: 'center'
        }}>
          <div style={{ fontSize: '24px', marginBottom: '8px' }}>🔑</div>
          <h4 style={{ color: '#1E3A5F', fontSize: '16px', fontWeight: 'bold', margin: '0 0 8px 0' }}>Tem uma chave de ativação?</h4>
          <p style={{ color: '#6B7280', fontSize: '13px', margin: '0 0 16px 0' }}>Digite abaixo para ativar seu plano diretamente</p>
          <div style={{ display: 'flex', gap: '10px', maxWidth: '400px', margin: '0 auto' }}>
            <input type="text" value={chaveAtivacao} onChange={e => setChaveAtivacao(e.target.value)}
              placeholder="XXXX-XXXX-XXXX-XXXX" onKeyDown={e => {
                if (e.key === 'Enter' && chaveAtivacao.trim()) {
                  setSelectedPlanId('profissional')
                  handleActivateKey()
                }
              }}
              style={{
                flex: 1, padding: '10px 14px', border: '1px solid #E5E7EB', borderRadius: '8px',
                fontSize: '14px', textAlign: 'center', letterSpacing: '2px', fontWeight: 'bold'
              }} />
            <button onClick={() => {
              if (chaveAtivacao.trim()) { setSelectedPlanId('profissional'); handleActivateKey() }
              else { setMessage('Digite a chave de ativação.') }
            }} style={{
              padding: '10px 20px', background: '#7C3AED', color: '#fff', border: 'none',
              borderRadius: '8px', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer'
            }}>Ativar</button>
          </div>
        </div>
      )}

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
