/**
 * Payment/Subscription Success Page
 *
 * Users are redirected here after a successful Stripe Checkout.
 * The session_id query parameter can be used to retrieve details
 * about the completed payment or subscription.
 */

'use client'

import { useSearchParams } from 'next/navigation'

export default function StripeSuccess() {
  const searchParams = useSearchParams()
  const sessionId = searchParams.get('session_id')
  const type = searchParams.get('type')

  const isSubscription = type === 'subscription'

  return (
    <div style={{
      minHeight: '100vh', background: '#F9FAFB', fontFamily: 'Arial, sans-serif',
      display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>
      <div style={{
        background: '#fff', borderRadius: '20px', padding: '48px', textAlign: 'center',
        maxWidth: '500px', width: '100%', boxShadow: '0 4px 20px rgba(0,0,0,0.08)'
      }}>
        <div style={{
          width: '80px', height: '80px', borderRadius: '50%', background: '#F0FDF4',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 24px', fontSize: '40px'
        }}>✅</div>

        <h1 style={{ color: '#15803D', fontSize: '24px', fontWeight: 'bold', margin: '0 0 12px 0' }}>
          {isSubscription ? 'Assinatura ativada!' : 'Pagamento confirmado!'}
        </h1>

        <p style={{ color: '#6B7280', fontSize: '15px', margin: '0 0 24px 0', lineHeight: '1.6' }}>
          {isSubscription
            ? 'Sua assinatura foi ativada com sucesso. Aproveite todos os recursos do seu plano!'
            : 'Seu pagamento foi processado com sucesso. Obrigado pela confiança!'}
        </p>

        {sessionId && (
          <p style={{ color: '#9CA3AF', fontSize: '12px', margin: '0 0 24px 0' }}>
            ID da sessão: <code style={{ background: '#F3F4F6', padding: '2px 6px', borderRadius: '4px' }}>{sessionId.slice(0, 20)}...</code>
          </p>
        )}

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
          <a href="/dashboard" style={{
            padding: '12px 24px', background: '#7C3AED', color: '#fff',
            borderRadius: '8px', textDecoration: 'none', fontWeight: 'bold', fontSize: '14px'
          }}>Ir para o Dashboard</a>
          <a href="/stripe/onboard" style={{
            padding: '12px 24px', background: '#F3F4F6', color: '#374151',
            borderRadius: '8px', textDecoration: 'none', fontWeight: 'bold', fontSize: '14px'
          }}>Minha Conta</a>
        </div>
      </div>
    </div>
  )
}
