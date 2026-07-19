/**
 * Stripe Product Management Page
 *
 * This page allows connected account owners to:
 * 1. Create new products (e.g., consultation services) with pricing
 * 2. View their existing products
 *
 * Products are created on the connected account (not the platform),
 * so each consultant has their own product catalog.
 */

'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../../src/lib/supabase'
import AppShell from '../../components/AppShell'

interface Product {
  id: string
  name: string
  description: string | null
  price: { id: string; unit_amount: number; currency: string } | null
}

function formatPrice(amount: number, currency: string): string {
  return (amount / 100).toLocaleString('pt-BR', { style: 'currency', currency: currency.toUpperCase() })
}

export default function StripeProducts() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [accountId, setAccountId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [form, setForm] = useState({ name: '', description: '', price: '' })

  async function loadProducts(acctId: string) {
    const res = await fetch(`/api/stripe/products?account_id=${acctId}`)
    if (res.ok) {
      const data = await res.json()
      setProducts(data.products || [])
    }
  }

  useEffect(() => {
    async function load() {
      // Get the user's Stripe account ID
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: profile } = await supabase.from('profiles').select('stripe_account_id').eq('id', user.id).single()
      const acctId = profile?.stripe_account_id
      setAccountId(acctId)
      if (acctId) await loadProducts(acctId)
      setLoading(false)
    }
    load()
  }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name || !form.price) { setMessage('Nome e preço são obrigatórios'); return }
    setSaving(true)
    setMessage('')

    const res = await fetch('/api/stripe/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.name,
        description: form.description || undefined,
        price: parseFloat(form.price.replace(',', '.')),
        currency: 'brl',
      }),
    })
    const data = await res.json()
    if (!res.ok) { setMessage(data.error || 'Erro ao criar produto'); setSaving(false); return }
    setMessage('Produto criado com sucesso!')
    setForm({ name: '', description: '', price: '' })
    setShowForm(false)
    if (accountId) await loadProducts(accountId)
    setSaving(false)
  }

  if (loading) {
    return (
      <AppShell currentPage="stripe/products">
        <div style={{ textAlign: 'center', padding: '60px' }}>
          <p style={{ color: '#7C3AED' }}>Carregando...</p>
        </div>
      </AppShell>
    )
  }

  if (!accountId) {
    return (
      <AppShell currentPage="stripe/products">
        <div style={{ maxWidth: '600px', margin: '0 auto', textAlign: 'center', padding: '60px' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>💳</div>
          <h2 style={{ color: '#1E3A5F' }}>Conta Stripe necessária</h2>
          <p style={{ color: '#6B7280' }}>Crie sua conta Stripe primeiro para gerenciar produtos.</p>
          <a href="/stripe/onboard" style={{ color: '#7C3AED', fontWeight: 'bold' }}>Ir para Onboarding</a>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell currentPage="stripe/products">
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h1 style={{ color: '#1E3A5F', fontSize: '24px', fontWeight: 'bold', margin: 0 }}>Meus Produtos</h1>
          <button onClick={() => setShowForm(!showForm)} style={{
            padding: '10px 20px', background: '#7C3AED', color: '#fff', border: 'none',
            borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer'
          }}>{showForm ? 'Cancelar' : '+ Novo Produto'}</button>
        </div>

        {message && (
          <div style={{
            marginBottom: '16px', padding: '12px', borderRadius: '8px',
            background: message.includes('Erro') ? '#FEF2F2' : '#F0FDF4',
            color: message.includes('Erro') ? '#DC2626' : '#15803D', fontSize: '14px'
          }}>{message}</div>
        )}

        {/* Create Product Form */}
        {showForm && (
          <form onSubmit={handleCreate} style={{
            background: '#fff', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', marginBottom: '24px'
          }}>
            <h3 style={{ color: '#1E3A5F', fontSize: '16px', fontWeight: 'bold', margin: '0 0 16px 0' }}>Novo Produto</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <label style={{ fontSize: '13px', color: '#374151', fontWeight: 'bold' }}>
                Nome do produto *
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Ex: Consulta Feng Shui Residencial"
                  style={{ display: 'block', width: '100%', padding: '10px', border: '1px solid #E5E7EB', borderRadius: '8px', marginTop: '4px', boxSizing: 'border-box' }} />
              </label>
              <label style={{ fontSize: '13px', color: '#374151', fontWeight: 'bold' }}>
                Descrição
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Descrição do serviço ou produto..."
                  style={{ display: 'block', width: '100%', padding: '10px', border: '1px solid #E5E7EB', borderRadius: '8px', marginTop: '4px', boxSizing: 'border-box', minHeight: '80px', resize: 'vertical' }} />
              </label>
              <label style={{ fontSize: '13px', color: '#374151', fontWeight: 'bold' }}>
                Preço (R$) *
                <input type="text" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                  placeholder="Ex: 350,00"
                  style={{ display: 'block', width: '100%', padding: '10px', border: '1px solid #E5E7EB', borderRadius: '8px', marginTop: '4px', boxSizing: 'border-box' }} />
              </label>
            </div>
            <button type="submit" disabled={saving} style={{
              marginTop: '16px', padding: '12px 24px', background: saving ? '#9CA3AF' : '#7C3AED', color: '#fff',
              border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: saving ? 'not-allowed' : 'pointer'
            }}>{saving ? 'Criando...' : 'Criar Produto'}</button>
          </form>
        )}

        {/* Products List */}
        {products.length === 0 ? (
          <div style={{ background: '#fff', borderRadius: '12px', padding: '40px', textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>📦</div>
            <p style={{ color: '#9CA3AF' }}>Nenhum produto cadastrado. Crie seu primeiro produto!</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '12px' }}>
            {products.map(p => (
              <div key={p.id} style={{
                background: '#fff', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center'
              }}>
                <div>
                  <div style={{ fontWeight: 'bold', color: '#111827', fontSize: '16px' }}>{p.name}</div>
                  {p.description && <div style={{ color: '#6B7280', fontSize: '13px', marginTop: '2px' }}>{p.description}</div>}
                </div>
                <div style={{ fontWeight: 'bold', color: '#7C3AED', fontSize: '18px', whiteSpace: 'nowrap' }}>
                  {p.price ? formatPrice(p.price.unit_amount, p.price.currency) : '—'}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Storefront Link */}
        {accountId && products.length > 0 && (
          <div style={{ marginTop: '24px', background: '#F5F3FF', borderRadius: '12px', padding: '16px 20px', textAlign: 'center' }}>
            <p style={{ color: '#7C3AED', fontSize: '14px', margin: '0 0 8px 0', fontWeight: 'bold' }}>Link da sua vitrine</p>
            {/* NOTE: In production, use a user-friendly URL instead of the raw account ID */}
            <code style={{ background: '#fff', padding: '6px 12px', borderRadius: '6px', fontSize: '13px' }}>
              {typeof window !== 'undefined' ? window.location.origin : ''}/store/{accountId}
            </code>
          </div>
        )}
      </div>
    </AppShell>
  )
}
