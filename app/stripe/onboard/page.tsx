/**
 * Stripe Onboarding Page
 *
 * This page allows users to:
 * 1. Create a Stripe Connected Account (if they don't have one)
 * 2. Start or resume the Stripe onboarding process
 * 3. View their current onboarding status and capabilities
 * 4. Subscribe to a platform plan
 * 5. Manage their billing via the Stripe Billing Portal
 *
 * The onboarding status is always fetched directly from the Stripe API
 * (not stored in our database) to ensure it's always current.
 */

'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import AppShell from '../../components/AppShell'

interface AccountStatus {
  has_account: boolean
  account_id?: string
  display_name?: string
  ready_to_process_payments?: boolean
  onboarding_complete?: boolean
  requirements_status?: string
  capabilities?: { card_payments?: string }
}

export default function StripeOnboard() {
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<AccountStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [message, setMessage] = useState('')

  // ── Check if returning from Stripe onboarding ──────────────────────────
  const returnAccountId = searchParams.get('accountId')
  const isRefresh = searchParams.get('refresh') === 'true'

  useEffect(() => {
    loadStatus()
    if (isRefresh) {
      setMessage('Link de onboarding expirado. Clique em "Continuar Onboarding" para gerar um novo.')
    }
  }, [])

  async function loadStatus() {
    setLoading(true)
    const params = returnAccountId ? `?accountId=${returnAccountId}` : ''
    const res = await fetch(`/api/stripe/account${params}`)
    if (res.ok) {
      const data = await res.json()
      setStatus(data)
    }
    setLoading(false)
  }

  async function createAccount() {
    setCreating(true)
    setMessage('')
    const res = await fetch('/api/stripe/account', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    const data = await res.json()
    if (!res.ok) { setMessage(data.error || 'Erro ao criar conta'); setCreating(false); return }
    setMessage(data.message)
    await loadStatus()
    setCreating(false)
  }

  async function startOnboarding() {
    setMessage('')
    const res = await fetch('/api/stripe/account-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    const data = await res.json()
    if (!res.ok) { setMessage(data.error || 'Erro'); return }
    // Redirect to Stripe's hosted onboarding page
    window.location.href = data.url
  }

  async function openSubscription() {
    setMessage('')
    const res = await fetch('/api/stripe/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    const data = await res.json()
    if (!res.ok) { setMessage(data.error || 'Erro'); return }
    window.location.href = data.url
  }

  async function openBillingPortal() {
    setMessage('')
    const res = await fetch('/api/stripe/portal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    const data = await res.json()
    if (!res.ok) { setMessage(data.error || 'Erro'); return }
    window.location.href = data.url
  }

  if (loading) {
    return (
      <AppShell currentPage="stripe/onboard">
        <div style={{ textAlign: 'center', padding: '60px' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>☯</div>
          <p style={{ color: '#7C3AED' }}>Carregando...</p>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell currentPage="stripe/onboard">
      <div style={{ maxWidth: '700px', margin: '0 auto' }}>
        <h1 style={{ color: '#1E3A5F', fontSize: '24px', fontWeight: 'bold', margin: '0 0 8px 0' }}>Pagamentos e Assinatura</h1>
        <p style={{ color: '#6B7280', fontSize: '15px', margin: '0 0 24px 0' }}>Gerencie sua conta Stripe e assinatura da plataforma</p>

        {message && (
          <div style={{
            marginBottom: '20px', padding: '12px 16px', borderRadius: '8px',
            background: message.includes('Erro') || message.includes('expirado') ? '#FEF2F2' : '#F0FDF4',
            color: message.includes('Erro') || message.includes('expirado') ? '#DC2626' : '#15803D', fontSize: '14px'
          }}>{message}</div>
        )}

        {/* ── No Account Yet ──────────────────────────────────────────────── */}
        {!status?.has_account && (
          <div style={{ background: '#fff', borderRadius: '16px', padding: '40px', textAlign: 'center', boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>💳</div>
            <h2 style={{ color: '#1E3A5F', fontSize: '20px', fontWeight: 'bold', margin: '0 0 8px 0' }}>Ative pagamentos</h2>
            <p style={{ color: '#6B7280', fontSize: '14px', margin: '0 0 24px 0' }}>
              Conecte sua conta Stripe para receber pagamentos e assinar um plano.
            </p>
            <button onClick={createAccount} disabled={creating} style={{
              padding: '14px 32px', background: creating ? '#9CA3AF' : '#7C3AED', color: '#fff',
              border: 'none', borderRadius: '10px', fontSize: '16px', fontWeight: 'bold',
              cursor: creating ? 'not-allowed' : 'pointer'
            }}>{creating ? 'Criando...' : 'Criar conta Stripe'}</button>
          </div>
        )}

        {/* ── Account Status ──────────────────────────────────────────────── */}
        {status?.has_account && (
          <>
            {/* Status Card */}
            <div style={{ background: '#fff', borderRadius: '16px', padding: '24px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: '#1E3A5F', margin: '0 0 16px 0' }}>Status da Conta Stripe</h3>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                {/* Onboarding Status */}
                <div style={{ padding: '16px', borderRadius: '10px', background: status.onboarding_complete ? '#F0FDF4' : '#FFFBEB' }}>
                  <div style={{ fontSize: '24px', marginBottom: '4px' }}>{status.onboarding_complete ? '✅' : '⏳'}</div>
                  <div style={{ fontSize: '13px', fontWeight: 'bold', color: status.onboarding_complete ? '#15803D' : '#D97706' }}>
                    {status.onboarding_complete ? 'Onboarding completo' : 'Onboarding pendente'}
                  </div>
                  <div style={{ fontSize: '12px', color: '#6B7280' }}>
                    {status.requirements_status === 'currently_due' ? 'Informações necessárias' : status.requirements_status === 'past_due' ? 'Informações atrasadas' : 'Nenhum requisito pendente'}
                  </div>
                </div>

                {/* Payment Capability */}
                <div style={{ padding: '16px', borderRadius: '10px', background: status.ready_to_process_payments ? '#F0FDF4' : '#FEF2F2' }}>
                  <div style={{ fontSize: '24px', marginBottom: '4px' }}>{status.ready_to_process_payments ? '💳' : '🔒'}</div>
                  <div style={{ fontSize: '13px', fontWeight: 'bold', color: status.ready_to_process_payments ? '#15803D' : '#DC2626' }}>
                    {status.ready_to_process_payments ? 'Pagamentos ativos' : 'Pagamentos inativos'}
                  </div>
                  <div style={{ fontSize: '12px', color: '#6B7280' }}>
                    Cartão: {status.capabilities?.card_payments || 'inativo'}
                  </div>
                </div>
              </div>

              <div style={{ fontSize: '13px', color: '#6B7280', padding: '8px 0', borderTop: '1px solid #F3F4F6' }}>
                Conta: <code style={{ background: '#F3F4F6', padding: '2px 6px', borderRadius: '4px' }}>{status.account_id}</code>
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
              {!status.onboarding_complete && (
                <button onClick={startOnboarding} style={{
                  padding: '16px', background: '#7C3AED', color: '#fff', border: 'none', borderRadius: '12px',
                  fontSize: '15px', fontWeight: 'bold', cursor: 'pointer', gridColumn: '1 / -1'
                }}>
                  {status.requirements_status === 'currently_due' ? 'Completar Onboarding' : 'Continuar Onboarding'}
                </button>
              )}

              <button onClick={openSubscription} style={{
                padding: '16px', background: '#059669', color: '#fff', border: 'none', borderRadius: '12px',
                fontSize: '14px', fontWeight: 'bold', cursor: 'pointer'
              }}>
                Assinar Plano
              </button>

              <button onClick={openBillingPortal} style={{
                padding: '16px', background: '#1E3A5F', color: '#fff', border: 'none', borderRadius: '12px',
                fontSize: '14px', fontWeight: 'bold', cursor: 'pointer'
              }}>
                Gerenciar Assinatura
              </button>

              <button onClick={() => window.location.href = '/stripe/products'} style={{
                padding: '16px', background: '#fff', color: '#7C3AED', border: '2px solid #7C3AED', borderRadius: '12px',
                fontSize: '14px', fontWeight: 'bold', cursor: 'pointer'
              }}>
                Gerenciar Produtos
              </button>

              <button onClick={loadStatus} style={{
                padding: '16px', background: '#F3F4F6', color: '#374151', border: '1px solid #E5E7EB', borderRadius: '12px',
                fontSize: '14px', cursor: 'pointer'
              }}>
                Atualizar Status
              </button>
            </div>
          </>
        )}
      </div>
    </AppShell>
  )
}
