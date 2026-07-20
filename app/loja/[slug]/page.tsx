'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { supabase } from '../../../src/lib/supabase'

interface StoreProfile {
  id: string
  nome_completo: string
  bio?: string | null
  profissao?: string | null
  cidade?: string | null
  estado?: string | null
  instagram?: string | null
  site?: string | null
  stripe_account_id?: string | null
  parceiro_visivel?: boolean
}

interface StoreProduct {
  id: string
  name: string
  description?: string | null
  price?: { id: string; unit_amount: number; currency: string } | null
}

export default function LojaConsultor() {
  const params = useParams()
  const slug = params.slug as string
  const [profile, setProfile] = useState<StoreProfile | null>(null)
  const [products, setProducts] = useState<StoreProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      // Find profile by slug
      const { data: prof } = await supabase
        .from('perfis_publicos')
        .select('id, nome_completo, bio, profissao, cidade, estado, instagram, site, stripe_account_id, parceiro_visivel')
        .eq('store_slug', slug)
        .single()

      if (!prof || !prof.stripe_account_id) {
        setError('Loja não encontrada')
        setLoading(false)
        return
      }
      setProfile(prof)

      // Load products from Stripe
      try {
        const res = await fetch(`/api/stripe/products?account_id=${prof.stripe_account_id}`)
        const data = await res.json()
        if (data.products) setProducts(data.products)
      } catch {}
      setLoading(false)
    }
    load()
  }, [slug])

  async function handleBuy(product: StoreProduct) {
    const price = product.price
    if (!price || !profile) return
    const res = await fetch('/api/stripe/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        account_id: profile.stripe_account_id,
        price_id: price.id,
        success_url: `${window.location.origin}/stripe/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: window.location.href,
      }),
    })
    const data = await res.json()
    if (data.url) window.location.assign(data.url)
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F9FAFB' }}>
      <p style={{ color: '#7C3AED' }}>Carregando loja...</p>
    </div>
  )

  if (error) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F9FAFB', flexDirection: 'column', gap: '12px' }}>
      <div style={{ fontSize: '48px' }}>☯</div>
      <p style={{ color: '#6B7280', fontSize: '16px' }}>{error}</p>
      <Link href="/" style={{ color: '#7C3AED', textDecoration: 'none', fontWeight: 'bold' }}>Voltar ao início</Link>
    </div>
  )

  if (!profile) return null

  return (
    <div style={{ minHeight: '100vh', background: '#F9FAFB', fontFamily: 'Arial, sans-serif' }}>
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #1E3A5F, #2d5a8e)', padding: '40px 32px', textAlign: 'center', color: '#fff' }}>
        <div style={{ fontSize: '48px', marginBottom: '12px' }}>☯</div>
        <h1 style={{ fontSize: '24px', fontWeight: 'bold', margin: '0 0 8px' }}>{profile.nome_completo}</h1>
        {profile.profissao && <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '14px', margin: '0 0 4px' }}>{profile.profissao}</p>}
        {profile.cidade && <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', margin: 0 }}>{profile.cidade}{profile.estado ? `, ${profile.estado}` : ''}</p>}
        {profile.bio && <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px', maxWidth: '500px', margin: '12px auto 0', lineHeight: 1.6 }}>{profile.bio}</p>}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginTop: '16px' }}>
          {profile.instagram && <a href={`https://instagram.com/${profile.instagram.replace('@','')}`} target="_blank" rel="noopener noreferrer" style={{ color: '#B8860B', fontSize: '13px', textDecoration: 'none' }}>@{profile.instagram.replace('@','')}</a>}
          {profile.site && <a href={profile.site} target="_blank" rel="noopener noreferrer" style={{ color: '#B8860B', fontSize: '13px', textDecoration: 'none' }}>{profile.site}</a>}
        </div>
      </div>

      {/* Products */}
      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '32px' }}>
        <h2 style={{ color: '#1E3A5F', fontSize: '20px', fontWeight: 'bold', marginBottom: '20px' }}>Serviços e Produtos</h2>
        {products.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px', background: '#fff', borderRadius: '12px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
            <p style={{ color: '#6B7280' }}>Nenhum produto cadastrado ainda.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '16px' }}>
            {products.map((p) => (
              <div key={p.id} style={{ background: '#fff', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', border: '1px solid #E5E7EB' }}>
                <h3 style={{ color: '#1E3A5F', fontSize: '16px', fontWeight: 'bold', margin: '0 0 8px' }}>{p.name}</h3>
                {p.description && <p style={{ color: '#6B7280', fontSize: '13px', margin: '0 0 12px', lineHeight: 1.5 }}>{p.description}</p>}
                {p.price && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '20px', fontWeight: 'bold', color: '#1E3A5F' }}>
                      {(p.price.unit_amount / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </span>
                    <button onClick={() => handleBuy(p)} style={{
                      padding: '8px 20px', background: '#7C3AED', color: '#fff', border: 'none',
                      borderRadius: '8px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer'
                    }}>Comprar</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ textAlign: 'center', padding: '24px', color: '#9CA3AF', fontSize: '12px' }}>
        Loja hospedada no <Link href="/" style={{ color: '#7C3AED', textDecoration: 'none' }}>FengShui Studio</Link>
      </div>
    </div>
  )
}
