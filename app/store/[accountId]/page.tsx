/**
 * Public Storefront Page
 *
 * This page displays products from a specific connected account
 * and allows customers to purchase them.
 *
 * URL: /store/[accountId]
 *
 * NOTE: In production, you should use a user-friendly identifier
 * (like a username or slug) instead of the raw Stripe account ID.
 * The account ID is used here for simplicity in this demo.
 * You could add a 'store_slug' column to profiles and look up the
 * account ID from that.
 */

'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

interface Product {
  id: string
  name: string
  description: string | null
  images: string[]
  price: { id: string; unit_amount: number; currency: string } | null
}

function formatPrice(amount: number, currency: string): string {
  return (amount / 100).toLocaleString('pt-BR', { style: 'currency', currency: currency.toUpperCase() })
}

export default function Storefront() {
  const params = useParams()
  // NOTE: In a real application, use a user-friendly slug instead of the account ID.
  // You would look up the account ID from a database mapping.
  const accountId = params.accountId as string

  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [purchasing, setPurchasing] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/stripe/products?account_id=${accountId}`)
      if (res.ok) {
        const data = await res.json()
        setProducts(data.products || [])
      }
      setLoading(false)
    }
    load()
  }, [accountId])

  async function handleBuy(product: Product) {
    if (!product.price) return
    setPurchasing(product.id)

    // ── Create a Checkout Session for this product ──────────────────────
    // This uses Direct Charges: the charge is created on the connected account
    // and the platform collects an application fee automatically.
    const res = await fetch('/api/stripe/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        account_id: accountId,
        price_id: product.price.id,
        quantity: 1,
      }),
    })
    const data = await res.json()
    if (res.ok && data.url) {
      // Redirect to Stripe Checkout
      window.location.assign(data.url)
    } else {
      alert(data.error || 'Erro ao processar compra')
      setPurchasing(null)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F9FAFB', fontFamily: 'var(--font-figtree), sans-serif' }}>
      {/* Header */}
      <header style={{
        background: '#0E1B2C', padding: '20px 32px', display: 'flex', alignItems: 'center', gap: '12px'
      }}>
        <span style={{ fontSize: '28px' }}>☯</span>
        <span style={{ color: '#C9A227', fontSize: '20px', fontWeight: 'bold' }}>FengShui Studio</span>
        <span style={{ color: 'rgba(255,255,255,0.5)', marginLeft: '8px', fontSize: '14px' }}>Vitrine de Serviços</span>
      </header>

      <main style={{ maxWidth: '900px', margin: '0 auto', padding: '32px 24px' }}>
        <h1 style={{ color: '#0E1B2C', fontSize: '28px', fontWeight: 'bold', margin: '0 0 8px 0' }}>Serviços Disponíveis</h1>
        <p style={{ color: '#6B7280', fontSize: '15px', margin: '0 0 32px 0' }}>
          Escolha um serviço de consultoria Feng Shui e faça o pagamento seguro via Stripe.
        </p>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px' }}>
            <p style={{ color: '#2E7D6B' }}>Carregando produtos...</p>
          </div>
        ) : products.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px', background: '#fff', borderRadius: '16px' }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>📦</div>
            <p style={{ color: '#9CA3AF', fontSize: '16px' }}>Nenhum serviço disponível no momento.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
            {products.map(product => (
              <div key={product.id} style={{
                background: '#fff', borderRadius: '16px', overflow: 'hidden',
                boxShadow: '0 2px 12px rgba(0,0,0,0.08)', display: 'flex', flexDirection: 'column'
              }}>
                {/* Product Image or Placeholder */}
                <div style={{
                  height: '120px', background: 'linear-gradient(135deg, #2E7D6B, #0E1B2C)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  <span style={{ fontSize: '48px', opacity: 0.4 }}>☯</span>
                </div>

                <div style={{ padding: '20px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <h3 style={{ color: '#111827', fontSize: '18px', fontWeight: 'bold', margin: '0 0 8px 0' }}>{product.name}</h3>
                  {product.description && (
                    <p style={{ color: '#6B7280', fontSize: '14px', margin: '0 0 16px 0', flex: 1 }}>{product.description}</p>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto' }}>
                    <span style={{ fontSize: '24px', fontWeight: 'bold', color: '#2E7D6B' }}>
                      {product.price ? formatPrice(product.price.unit_amount, product.price.currency) : 'Preço sob consulta'}
                    </span>
                    {product.price && (
                      <button type="button" onClick={() => handleBuy(product)} disabled={purchasing === product.id} style={{
                        padding: '10px 24px', background: purchasing === product.id ? '#9CA3AF' : '#2E7D6B',
                        color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold',
                        cursor: purchasing === product.id ? 'not-allowed' : 'pointer', fontSize: '14px'
                      }}>
                        {purchasing === product.id ? 'Processando...' : 'Comprar'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        <div style={{ textAlign: 'center', marginTop: '48px', padding: '20px', color: '#9CA3AF', fontSize: '13px' }}>
          Pagamento seguro processado via <strong>Stripe</strong>. Seus dados financeiros nunca são armazenados em nossos servidores.
        </div>
      </main>
    </div>
  )
}
