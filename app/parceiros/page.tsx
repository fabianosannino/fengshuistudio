'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../src/lib/supabase'
import AppShell from '../components/AppShell'
import { planoEfetivo } from '../../src/lib/plano-utils'
import type { Profile } from '../../src/lib/types'
import { Building2, Compass, Palette, Briefcase, Handshake, MapPin, type LucideIcon } from 'lucide-react'

const ESTADOS_BR = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO']
const PAGE_SIZE = 50

const TIPOS_PROFISSIONAL: Record<string, { label: string; iconComp: LucideIcon; cor: string }> = {
  arquiteto: { label: 'Arquiteto(a)', iconComp: Building2, cor: '#1D4ED8' },
  feng_shui: { label: 'Profissional de Feng Shui', iconComp: Compass, cor: '#2E7D6B' },
  decorador: { label: 'Decorador(a)', iconComp: Palette, cor: '#BE185D' },
  outro_profissional: { label: 'Outro Profissional', iconComp: Briefcase, cor: '#6B7280' },
}

export default function Parceiros() {
  const [loading, setLoading] = useState(true)
  const [parceiros, setParceiros] = useState<Profile[]>([])
  const [filtroEstado, setFiltroEstado] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('')
  const [filtroBusca, setFiltroBusca] = useState('')
  const [userPlano, setUserPlano] = useState<string>('')
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/login'; return }

      // Get user plan
      const { data: prof } = await supabase.from('profiles').select('plano').eq('id', user.id).single()
      setUserPlano(prof?.plano || '')

      // Fetch profiles that opted to be visible as partners (paginated)
      const { data, error } = await supabase
        .from('perfis_publicos')
        .select('*')
        .eq('parceiro_visivel', true)
        .order('nome_completo')
        .range(0, PAGE_SIZE - 1)

      // If parceiro_visivel column doesn't exist yet, query returns 400
      // Fallback: fetch nothing (column needs to be created via migration)
      if (error) {
        console.warn('parceiro_visivel query failed — run the migration in supabase/migrations/20260316_fix_all_missing_columns.sql')
      }

      const parceiros = error ? [] : (data || [])
      setParceiros(parceiros)
      setHasMore(parceiros.length === PAGE_SIZE)
      setLoading(false)
    }
    load()
  }, [])

  async function loadMore() {
    const nextPage = page + 1
    const from = nextPage * PAGE_SIZE
    const { data } = await supabase
      .from('perfis_publicos')
      .select('*')
      .eq('parceiro_visivel', true)
      .order('nome_completo')
      .range(from, from + PAGE_SIZE - 1)
    if (data && data.length > 0) {
      setParceiros(prev => [...prev, ...data])
      setPage(nextPage)
      setHasMore(data.length === PAGE_SIZE)
    } else {
      setHasMore(false)
    }
  }

  const filtered = parceiros.filter(p => {
    if (filtroEstado && p.estado !== filtroEstado) return false
    if (filtroTipo && p.tipo_usuario !== filtroTipo) return false
    if (filtroBusca) {
      const busca = filtroBusca.toLowerCase()
      const match = (p.nome_completo || '').toLowerCase().includes(busca) ||
        (p.profissao || '').toLowerCase().includes(busca) ||
        (p.area_atuacao || '').toLowerCase().includes(busca) ||
        (p.cidade || '').toLowerCase().includes(busca)
      if (!match) return false
    }
    return true
  })

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F9FAFB', fontFamily: 'var(--font-figtree), sans-serif' }}>
        <div style={{ textAlign: 'center' }}>
          <img src="/marketing/logo-fengshui.png" alt="" width={48} height={48} style={{ marginBottom: '16px', display: 'inline-block' }} />
          <p style={{ color: '#2E7D6B', fontSize: '16px' }}>Carregando parceiros...</p>
        </div>
      </div>
    )
  }

  const _pPlano = (userPlano || '').toLowerCase().trim()
  const _pIsFree = _pPlano !== 'pro' && _pPlano !== 'profissional' && _pPlano !== 'simples'

  return (
    <AppShell currentPage="parceiros">

      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ color: '#0E1B2C', fontSize: '24px', fontWeight: 'bold', margin: '0 0 4px 0' }}>
          Rede de Parceiros
        </h1>
        <p style={{ color: '#6B7280', fontSize: '15px', margin: '0' }}>
          Encontre profissionais para ajudar com o resultado do seu diagnóstico Feng Shui
        </p>
      </div>

      {/* Free user: info banner */}
      {_pIsFree && (
        <div style={{
          marginBottom: '20px', padding: '14px 20px', borderRadius: '10px',
          background: '#EAF4F1', border: '1px solid #DCEFE9', display: 'flex',
          alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px'
        }}>
          <p style={{ color: '#2E7D6B', fontSize: '13px', margin: 0 }}>
            Para aparecer na rede, faça upgrade para o plano Simples ou Profissional.
          </p>
          <a href="/planos" style={{
            padding: '7px 18px', background: '#2E7D6B', color: '#fff',
            border: 'none', borderRadius: '6px', fontSize: '12px',
            fontWeight: 'bold', textDecoration: 'none'
          }}>Ver planos</a>
        </div>
      )}

      {/* Filters */}
      <div style={{
        background: '#ffffff', borderRadius: '12px', padding: '20px',
        boxShadow: '0 1px 4px rgba(0,0,0,0.08)', marginBottom: '24px',
        display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end'
      }}>
        <div style={{ flex: 1, minWidth: '200px' }}>
          <label htmlFor="input-busca" style={{ display: 'block', color: '#374151', fontSize: '13px', fontWeight: 'bold', marginBottom: '4px' }}>Buscar</label>
          <input
            id="input-busca"
            type="text"
            value={filtroBusca}
            onChange={e => setFiltroBusca(e.target.value)}
            placeholder="Nome, profissao, cidade..."
            style={{ width: '100%', padding: '10px 14px', border: '1px solid #D1D5DB', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
          />
        </div>
        <div style={{ minWidth: '160px' }}>
          <label htmlFor="select-estado" style={{ display: 'block', color: '#374151', fontSize: '13px', fontWeight: 'bold', marginBottom: '4px' }}>Estado</label>
          <select id="select-estado" value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}
            style={{ width: '100%', padding: '10px 14px', border: '1px solid #D1D5DB', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box', background: '#fff' }}>
            <option value="">Todos os estados</option>
            {ESTADOS_BR.map(uf => <option key={uf} value={uf}>{uf}</option>)}
          </select>
        </div>
        <div style={{ minWidth: '200px' }}>
          <label htmlFor="select-tipo-profissional" style={{ display: 'block', color: '#374151', fontSize: '13px', fontWeight: 'bold', marginBottom: '4px' }}>Tipo de profissional</label>
          <select id="select-tipo-profissional" value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}
            style={{ width: '100%', padding: '10px 14px', border: '1px solid #D1D5DB', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box', background: '#fff' }}>
            <option value="">Todos</option>
            {Object.entries(TIPOS_PROFISSIONAL).map(([key, val]) => (
              <option key={key} value={key}>{val.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Results */}
      {filtered.length === 0 ? (
        <div style={{
          background: '#ffffff', borderRadius: '12px', padding: '64px 32px',
          textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.08)'
        }}>
          <Handshake size={44} strokeWidth={1.5} color="#2E7D6B" style={{ margin: '0 auto 16px' }} aria-hidden="true" />
          <h3 style={{ color: '#0E1B2C', fontSize: '18px', marginBottom: '8px' }}>
            {parceiros.length === 0 ? 'Nenhum parceiro cadastrado ainda' : 'Nenhum parceiro encontrado com esses filtros'}
          </h3>
          <p style={{ color: '#6B7280', fontSize: '14px' }}>
            {parceiros.length === 0
              ? 'Em breve teremos profissionais disponíveis para ajudar você'
              : 'Tente ajustar os filtros de busca'
            }
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
          {filtered.slice(0, (page + 1) * PAGE_SIZE).map(parceiro => {
            const tipo = TIPOS_PROFISSIONAL[parceiro.tipo_usuario] || TIPOS_PROFISSIONAL.outro_profissional
            return (
              <div key={parceiro.id} style={{
                background: '#ffffff', borderRadius: '12px', padding: '20px',
                boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
                borderTop: `3px solid ${tipo.cor}`
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '12px' }}>
                  <div style={{
                    width: '48px', height: '48px', borderRadius: '50%',
                    background: tipo.cor, display: 'flex', alignItems: 'center',
                    justifyContent: 'center', flexShrink: 0
                  }}>
                    <tipo.iconComp size={22} strokeWidth={1.75} color="#ffffff" aria-hidden="true" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ color: '#111827', fontSize: '16px', fontWeight: 'bold', margin: '0 0 2px 0' }}>
                      {parceiro.nome_completo}
                    </h3>
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                      <span style={{
                        background: `${tipo.cor}15`, color: tipo.cor,
                        padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold'
                      }}>{tipo.label}</span>
                      {planoEfetivo(parceiro.plano) === 'profissional' && (
                        <span style={{
                          background: 'rgba(46,125,107,0.12)', color: '#2E7D6B',
                          padding: '2px 8px', borderRadius: '12px', fontSize: '10px', fontWeight: 'bold'
                        }}>Profissional</span>
                      )}
                    </div>
                  </div>
                </div>

                {parceiro.profissao && (
                  <p style={{ color: '#374151', fontSize: '13px', margin: '4px 0' }}>
                    <strong>Profissão:</strong> {parceiro.profissao}
                  </p>
                )}
                {parceiro.area_atuacao && (
                  <p style={{ color: '#374151', fontSize: '13px', margin: '4px 0' }}>
                    <strong>Área:</strong> {parceiro.area_atuacao}
                  </p>
                )}
                {parceiro.registro_profissional && (
                  <p style={{ color: '#6B7280', fontSize: '12px', margin: '4px 0' }}>
                    Registro: {parceiro.registro_profissional}
                  </p>
                )}
                {(parceiro.cidade || parceiro.estado) && (
                  <p style={{ color: '#6B7280', fontSize: '13px', margin: '4px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <MapPin size={13} strokeWidth={1.75} aria-hidden="true" /> {parceiro.cidade}{parceiro.estado ? ` - ${parceiro.estado}` : ''}
                  </p>
                )}
                {parceiro.bio && (
                  <p style={{ color: '#6B7280', fontSize: '12px', margin: '8px 0 0 0', lineHeight: '1.4' }}>
                    {parceiro.bio.length > 120 ? parceiro.bio.slice(0, 120) + '...' : parceiro.bio}
                  </p>
                )}

                <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                  {parceiro.linkedin && (
                    <a href={parceiro.linkedin} target="_blank" rel="noopener noreferrer" style={{
                      flex: 1, padding: '8px', background: '#0A66C2', color: '#fff',
                      border: 'none', borderRadius: '6px', fontSize: '12px',
                      fontWeight: 'bold', textDecoration: 'none', textAlign: 'center'
                    }}>LinkedIn</a>
                  )}
                  {parceiro.instagram && (
                    <a href={parceiro.instagram.startsWith('http') ? parceiro.instagram : `https://instagram.com/${parceiro.instagram.replace('@', '')}`}
                      target="_blank" rel="noopener noreferrer" style={{
                      flex: 1, padding: '8px', background: '#E4405F', color: '#fff',
                      border: 'none', borderRadius: '6px', fontSize: '12px',
                      fontWeight: 'bold', textDecoration: 'none', textAlign: 'center'
                    }}>Instagram</a>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {hasMore && (
        <div style={{ textAlign: 'center', marginTop: '24px' }}>
          <button onClick={loadMore} style={{
            padding: '10px 32px', background: '#2E7D6B', color: '#fff',
            border: 'none', borderRadius: '8px', fontSize: '14px',
            fontWeight: 'bold', cursor: 'pointer'
          }}>Carregar mais</button>
        </div>
      )}

    </AppShell>
  )
}
