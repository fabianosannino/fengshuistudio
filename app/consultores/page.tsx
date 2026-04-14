'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../src/lib/supabase'

type Consultor = {
  id: string
  nome_completo: string
  profissao?: string | null
  bio?: string | null
  cidade?: string | null
  estado?: string | null
  instagram?: string | null
  store_slug?: string | null
}

export default function Consultores() {
  const [consultores, setConsultores] = useState<Consultor[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('profiles')
        .select('id, nome_completo, profissao, bio, cidade, estado, instagram, store_slug')
        .eq('parceiro_visivel', true)
        .not('store_slug', 'is', null)
        .order('nome_completo')
      setConsultores((data || []) as Consultor[])
      setLoading(false)
    }
    load()
  }, [])

  const filtered = consultores.filter(c => {
    if (!search.trim()) return true
    const s = search.toLowerCase()
    return (c.nome_completo?.toLowerCase().includes(s) || c.cidade?.toLowerCase().includes(s) || c.profissao?.toLowerCase().includes(s))
  })

  return (
    <div style={{ minHeight: '100vh', background: '#F9FAFB', fontFamily: 'Arial, sans-serif' }}>
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #1E3A5F, #2d5a8e)', padding: '48px 32px', textAlign: 'center', color: '#fff' }}>
        <div style={{ fontSize: '40px', marginBottom: '12px' }}>☯</div>
        <h1 style={{ fontSize: '28px', fontWeight: 'bold', margin: '0 0 8px' }}>Consultores de Feng Shui</h1>
        <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '15px', margin: '0 0 24px', maxWidth: '500px', marginLeft: 'auto', marginRight: 'auto' }}>
          Encontre profissionais certificados para harmonizar seus ambientes
        </p>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por nome, cidade ou especialidade..."
          style={{ padding: '12px 20px', borderRadius: '10px', border: 'none', fontSize: '14px', width: '100%', maxWidth: '400px', boxSizing: 'border-box' }} />
      </div>

      {/* List */}
      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '32px' }}>
        {loading ? (
          <p style={{ textAlign: 'center', color: '#7C3AED' }}>Carregando...</p>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px', background: '#fff', borderRadius: '12px' }}>
            <p style={{ color: '#6B7280' }}>Nenhum consultor encontrado.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(270px, 1fr))', gap: '16px' }}>
            {filtered.map(c => (
              <a key={c.id} href={c.store_slug ? `/loja/${c.store_slug}` : '#'} style={{
                background: '#fff', borderRadius: '12px', padding: '20px', textDecoration: 'none',
                boxShadow: '0 1px 4px rgba(0,0,0,0.08)', border: '1px solid #E5E7EB',
                transition: 'transform 0.2s, box-shadow 0.2s', display: 'block'
              }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#1E3A5F', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', fontWeight: 'bold', marginBottom: '12px' }}>
                  {c.nome_completo?.charAt(0) || '?'}
                </div>
                <h3 style={{ color: '#1E3A5F', fontSize: '16px', fontWeight: 'bold', margin: '0 0 4px' }}>{c.nome_completo}</h3>
                {c.profissao && <p style={{ color: '#7C3AED', fontSize: '13px', margin: '0 0 8px', fontWeight: 'bold' }}>{c.profissao}</p>}
                {c.bio && <p style={{ color: '#6B7280', fontSize: '12px', margin: '0 0 8px', lineHeight: 1.5, maxHeight: '48px', overflow: 'hidden' }}>{c.bio}</p>}
                {c.cidade && <p style={{ color: '#9CA3AF', fontSize: '12px', margin: 0 }}>{c.cidade}{c.estado ? `, ${c.estado}` : ''}</p>}
                {c.store_slug && <div style={{ marginTop: '10px', padding: '6px 12px', background: '#F5F0FF', borderRadius: '6px', fontSize: '12px', color: '#7C3AED', fontWeight: 'bold', textAlign: 'center' }}>Ver serviços →</div>}
              </a>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ textAlign: 'center', padding: '24px', color: '#9CA3AF', fontSize: '12px' }}>
        <a href="/" style={{ color: '#7C3AED', textDecoration: 'none' }}>FengShui Studio</a> — Plataforma para consultores de Feng Shui
      </div>
    </div>
  )
}
