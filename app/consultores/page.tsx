'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../../src/lib/supabase'
import ServicosDoParceiro, {
  agruparPorParceiro, COLUNAS_DA_VITRINE, type ServicoVisivel,
} from '../components/ServicosDoParceiro'

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
  const [servicos, setServicos] = useState<Record<string, ServicoVisivel[]>>({})

  useEffect(() => {
    async function load() {
      /*
       * O filtro `store_slug not null` saiu: ele escondia da vitrine pública
       * todo consultor que ainda não tinha escolhido um apelido de loja —
       * inclusive quem já vendia por `/store/acct_...`. Quem optou por
       * aparecer, aparece; o link da loja é que fica condicionado ao slug.
       */
      const { data } = await supabase
        .from('perfis_publicos')
        .select('id, nome_completo, profissao, bio, cidade, estado, instagram, store_slug')
        .eq('parceiro_visivel', true)
        .order('nome_completo')
      const lista = (data || []) as Consultor[]
      setConsultores(lista)

      // Mesma vitrine de `/parceiros`, e é o ponto de ela ser componente
      // compartilhado: esta é a página que o visitante sem conta vê.
      if (lista.length > 0) {
        const { data: doBanco } = await supabase
          .from('servicos_do_parceiro')
          .select(COLUNAS_DA_VITRINE)
          .in('perfil_id', lista.map(c => c.id))
          .eq('ativo', true)
          .order('ordem')
        setServicos(agruparPorParceiro((doBanco ?? []) as ServicoVisivel[]))
      }

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
    <div style={{ minHeight: '100vh', background: '#F9FAFB', fontFamily: 'var(--font-figtree), sans-serif' }}>
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #0E1B2C, #163A52)', padding: '48px 32px', textAlign: 'center', color: '#fff' }}>
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
          <p style={{ textAlign: 'center', color: '#2E7D6B' }}>Carregando...</p>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px', background: '#fff', borderRadius: '12px' }}>
            <p style={{ color: '#6B7280' }}>Nenhum consultor encontrado.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(270px, 1fr))', gap: '16px' }}>
            {filtered.map(c => (
              /* Card é `div`, não `a`: sem loja não há para onde levar, e um
                 link que não vai a lugar nenhum promete o que não cumpre. O
                 link mora no botão da loja, quando ela existe. */
              <div key={c.id} style={{
                background: '#fff', borderRadius: '12px', padding: '20px',
                boxShadow: '0 1px 4px rgba(0,0,0,0.08)', border: '1px solid #E5E7EB',
                display: 'block'
              }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#0E1B2C', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', fontWeight: 'bold', marginBottom: '12px' }}>
                  {c.nome_completo?.charAt(0) || '?'}
                </div>
                <h3 style={{ color: '#0E1B2C', fontSize: '16px', fontWeight: 'bold', margin: '0 0 4px' }}>{c.nome_completo}</h3>
                {c.profissao && <p style={{ color: '#2E7D6B', fontSize: '13px', margin: '0 0 8px', fontWeight: 'bold' }}>{c.profissao}</p>}
                {c.bio && <p style={{ color: '#6B7280', fontSize: '12px', margin: '0 0 8px', lineHeight: 1.5, maxHeight: '48px', overflow: 'hidden' }}>{c.bio}</p>}
                {c.cidade && <p style={{ color: '#9CA3AF', fontSize: '12px', margin: 0 }}>{c.cidade}{c.estado ? `, ${c.estado}` : ''}</p>}
                <ServicosDoParceiro servicos={servicos[c.id] ?? []} />
                {c.store_slug && (
                  <a href={`/loja/${c.store_slug}`} style={{ display: 'block', marginTop: '10px', padding: '6px 12px', background: '#EAF4F1', borderRadius: '6px', fontSize: '12px', color: '#2E7D6B', fontWeight: 'bold', textAlign: 'center', textDecoration: 'none' }}>Ver loja →</a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ textAlign: 'center', padding: '24px', color: '#9CA3AF', fontSize: '12px' }}>
        <Link href="/" style={{ color: '#2E7D6B', textDecoration: 'none' }}>FengShui Studio</Link> — Plataforma para consultores de Feng Shui
      </div>
    </div>
  )
}
