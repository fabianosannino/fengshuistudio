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

import { Suspense, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import AppShell from '../../components/AppShell'
import { supabase } from '../../../src/lib/supabase'

interface OnboardProfile {
  store_slug?: string | null
}



interface AccountStatus {
  has_account: boolean
  account_id?: string
  display_name?: string
  ready_to_process_payments?: boolean
  onboarding_complete?: boolean
  requirements_status?: string
  capabilities?: { card_payments?: string; pix_payments?: string }
  charges_enabled?: boolean
}

export default function StripeOnboardPage() {
  return (
    <Suspense fallback={<AppShell currentPage="stripe/onboard"><div style={{ textAlign: 'center', padding: '60px' }}><p style={{ color: '#2E7D6B' }}>Carregando...</p></div></AppShell>}>
      <StripeOnboard />
    </Suspense>
  )
}

function StripeOnboard() {
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<AccountStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [message, setMessage] = useState(() =>
    // `refresh=true` já está na URL no primeiro render — nasce no estado, em
    // vez de um efeito que injeta a mensagem no render seguinte.
    searchParams.get('refresh') === 'true'
      ? 'Link de onboarding expirado. Clique em "Continuar Onboarding" para gerar um novo.'
      : ''
  )
  const [profile, setProfile] = useState<OnboardProfile | null>(null)

  // ── Check if returning from Stripe onboarding ──────────────────────────
  const returnAccountId = searchParams.get('accountId')

  const loadStatus = useCallback(async () => {
    setLoading(true)
    const params = returnAccountId ? `?accountId=${returnAccountId}` : ''
    const res = await fetch(`/api/stripe/account${params}`)
    if (res.ok) {
      const data = await res.json()
      setStatus(data)
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()
      setProfile(profileData)

    }

    setLoading(false)
  }, [returnAccountId])

  useEffect(() => {
    /*
     * Carga de dados no cliente: a função liga o spinner de forma síncrona.
     * Sair deste padrão é migrar para server component / camada de dados —
     * o débito R1 registrado na auditoria de 2026-07-18 —, não reescrever
     * este efeito. A supressão é por sítio, e nova violação quebra o CI.
     */
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadStatus()
  }, [loadStatus])

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
          <p style={{ color: '#2E7D6B' }}>Carregando...</p>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell currentPage="stripe/onboard">
      <div style={{ maxWidth: '700px', margin: '0 auto' }}>
        <h1 style={{ color: '#0E1B2C', fontSize: '24px', fontWeight: 'bold', margin: '0 0 8px 0' }}>Pagamentos e Assinatura</h1>
        <p style={{ color: '#6B7280', fontSize: '15px', margin: '0 0 24px 0' }}>Gerencie sua conta Stripe e assinatura da plataforma</p>

        {message && (
          <div style={{
            marginBottom: '20px', padding: '12px 16px', borderRadius: '8px',
            background: message.includes('Erro') || message.includes('expirado') ? '#FAEEE9' : '#F0F6F3',
            color: message.includes('Erro') || message.includes('expirado') ? '#B4533A' : '#2E7D6B', fontSize: '14px'
          }}>{message}</div>
        )}

        {/* ── No Account Yet ──────────────────────────────────────────────── */}
        {!status?.has_account && (
          <div style={{ background: '#fff', borderRadius: '16px', padding: '40px', textAlign: 'center', boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>💳</div>
            <h2 style={{ color: '#0E1B2C', fontSize: '20px', fontWeight: 'bold', margin: '0 0 8px 0' }}>Ative pagamentos</h2>
            <p style={{ color: '#6B7280', fontSize: '14px', margin: '0 0 24px 0' }}>
              Conecte sua conta Stripe para receber pagamentos e assinar um plano.
            </p>
            <button type="button" onClick={createAccount} disabled={creating} style={{
              padding: '14px 32px', background: creating ? '#9CA3AF' : '#2E7D6B', color: '#fff',
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
              <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: '#0E1B2C', margin: '0 0 16px 0' }}>Status da Conta Stripe</h3>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                {/* Onboarding Status */}
                <div style={{ padding: '16px', borderRadius: '10px', background: status.onboarding_complete ? '#F0F6F3' : '#FAF3E0' }}>
                  <div style={{ fontSize: '24px', marginBottom: '4px' }}>{status.onboarding_complete ? '✅' : '⏳'}</div>
                  <div style={{ fontSize: '13px', fontWeight: 'bold', color: status.onboarding_complete ? '#2E7D6B' : '#8A6E2F' }}>
                    {status.onboarding_complete ? 'Onboarding completo' : 'Onboarding pendente'}
                  </div>
                  <div style={{ fontSize: '12px', color: '#6B7280' }}>
                    {status.requirements_status === 'currently_due' ? 'Informações necessárias' : status.requirements_status === 'past_due' ? 'Informações atrasadas' : 'Nenhum requisito pendente'}
                  </div>
                </div>

                {/* Payment Capability */}
                <div style={{ padding: '16px', borderRadius: '10px', background: status.ready_to_process_payments ? '#F0F6F3' : '#FAEEE9' }}>
                  <div style={{ fontSize: '24px', marginBottom: '4px' }}>{status.ready_to_process_payments ? '💳' : '🔒'}</div>
                  <div style={{ fontSize: '13px', fontWeight: 'bold', color: status.ready_to_process_payments ? '#2E7D6B' : '#B4533A' }}>
                    {status.ready_to_process_payments ? 'Pagamentos ativos' : 'Pagamentos inativos'}
                  </div>
                  <div style={{ fontSize: '12px', color: '#6B7280' }}>
                    Cartão: {status.capabilities?.card_payments || 'inativo'}
                  </div>
                  {/* O Pix aparece aqui porque «só cartão no checkout» era um
                      fato sem explicação: a capacidade pode estar pendente de
                      informação que só o consultor tem. */}
                  <div style={{ fontSize: '12px', color: '#6B7280' }}>
                    Pix: {status.capabilities?.pix_payments === 'active'
                      ? 'ativo'
                      : status.capabilities?.pix_payments === 'pending'
                        ? 'aguardando o Stripe'
                        : 'inativo — complete o cadastro'}
                  </div>
                </div>
              </div>

              <div style={{ fontSize: '13px', color: '#6B7280', padding: '8px 0', borderTop: '1px solid #F3F4F6' }}>
                Conta: <code style={{ background: '#F3F4F6', padding: '2px 6px', borderRadius: '4px' }}>{status.account_id}</code>
              </div>

              {profile?.store_slug && (
                <div style={{ marginTop: '12px', padding: '10px 14px', background: '#EAF4F1', borderRadius: '8px', border: '1px solid #DCEFE9' }}>
                  <div style={{ fontSize: '12px', color: '#2E7D6B', fontWeight: 'bold', marginBottom: '4px' }}>Link da sua loja:</div>
                  <div style={{ fontSize: '13px', color: '#374151' }}>
                    {typeof window !== 'undefined' ? window.location.origin : ''}/loja/{profile.store_slug}
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
              {!status.onboarding_complete && (
                <button type="button" onClick={startOnboarding} style={{
                  padding: '16px', background: '#2E7D6B', color: '#fff', border: 'none', borderRadius: '12px',
                  fontSize: '15px', fontWeight: 'bold', cursor: 'pointer', gridColumn: '1 / -1'
                }}>
                  {status.requirements_status === 'currently_due' ? 'Completar Onboarding' : 'Continuar Onboarding'}
                </button>
              )}

              <button type="button" onClick={openSubscription} style={{
                padding: '16px', background: '#059669', color: '#fff', border: 'none', borderRadius: '12px',
                fontSize: '14px', fontWeight: 'bold', cursor: 'pointer'
              }}>
                Assinar Plano
              </button>

              <button type="button" onClick={openBillingPortal} style={{
                padding: '16px', background: '#0E1B2C', color: '#fff', border: 'none', borderRadius: '12px',
                fontSize: '14px', fontWeight: 'bold', cursor: 'pointer'
              }}>
                Gerenciar Assinatura
              </button>

              <button type="button" onClick={() => window.location.href = '/stripe/products'} style={{
                padding: '16px', background: '#fff', color: '#2E7D6B', border: '2px solid #2E7D6B', borderRadius: '12px',
                fontSize: '14px', fontWeight: 'bold', cursor: 'pointer'
              }}>
                Gerenciar Produtos
              </button>

              <button type="button" onClick={loadStatus} style={{
                padding: '16px', background: '#F3F4F6', color: '#374151', border: '1px solid #E5E7EB', borderRadius: '12px',
                fontSize: '14px', cursor: 'pointer'
              }}>
                Atualizar Status
              </button>
            </div>

            {/* Vendas: a lista vive em /vendas, não aqui.
                Duas telas mostrando a mesma coisa é o começo de duas verdades
                — e esta página é sobre a conta Stripe, não sobre pedidos. */}
            {status?.charges_enabled && (
              <div style={{ background: '#ffffff', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', marginTop: '20px' }}>
                <h3 style={{ color: '#0E1B2C', fontSize: '16px', fontWeight: 'bold', margin: '0 0 8px 0' }}>Vendas</h3>
                <p style={{ color: '#6B7280', fontSize: '13px', margin: '0 0 16px' }}>
                  Acompanhe os pedidos, o que já foi pago e o que foi devolvido — e estorne quando precisar.
                </p>
                <Link href="/vendas" style={{
                  display: 'inline-block', padding: '10px 20px', background: '#2E7D6B', color: '#fff',
                  borderRadius: '8px', fontSize: '14px', fontWeight: 'bold', textDecoration: 'none',
                }}>Ver minhas vendas</Link>
              </div>
            )}
          </>
        )}
      </div>
    </AppShell>
  )
}
