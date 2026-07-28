'use client'

import { useEffect, useState, useMemo, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '../../src/lib/supabase'
import { logger } from '../../src/lib/logger'
import AppShell from '../components/AppShell'

interface ProdutoAfiliadoRow {
  id?: string
  categoria?: string
  nome?: string
  desc?: string | null
  descricao?: string | null
  tag?: string | null
  preco?: string | null
  link_afiliado?: string | null
}

/** Forma comum entre produto do banco e produto estático do catálogo */
type ProdutoExibir = {
  nome?: string
  desc?: string | null
  descricao?: string | null
  tag?: string | null
  preco?: string | null
  link_afiliado?: string | null
  categoria?: string
}

// Categorias de produtos Feng Shui com produtos de afiliados
const CATEGORIAS_PRODUTOS = [
  {
    id: 'espelhos',
    nome: 'Espelhos',
    icon: '🪞',
    cor: '#1D4ED8',
    descricao: 'Espelhos côncavos, convexos e Ba Gua para harmonização',
    produtos: [
      { nome: 'Espelho Côncavo Ba Gua', desc: 'Espelho côncavo octogonal para proteção e desvio de energia negativa', tag: 'Proteção', preco: 'A partir de R$ 29,90' },
      { nome: 'Espelho Convexo Ba Gua', desc: 'Espelho convexo para distribuir e expandir energia positiva', tag: 'Expansão', preco: 'A partir de R$ 34,90' },
      { nome: 'Espelho Plano Octogonal', desc: 'Espelho Ba Gua plano para neutralizar energias', tag: 'Equilíbrio', preco: 'A partir de R$ 24,90' },
    ]
  },
  {
    id: 'cristais',
    nome: 'Cristais e Pedras',
    icon: '💎',
    cor: '#2E7D6B',
    descricao: 'Cristais para ativação energética dos setores do Ba Gua',
    produtos: [
      { nome: 'Cristal Multifacetado', desc: 'Cristal de pendurar para dispersar energia estagnada e trazer luz', tag: 'Ativação', preco: 'A partir de R$ 19,90' },
      { nome: 'Quartzo Rosa', desc: 'Pedra do amor e relacionamentos para o setor Sudoeste', tag: 'Relacionamento', preco: 'A partir de R$ 15,90' },
      { nome: 'Obsidiana Negra', desc: 'Pedra de proteção para entrada e setor Carreira', tag: 'Proteção', preco: 'A partir de R$ 22,90' },
      { nome: 'Citrino', desc: 'Pedra da prosperidade e abundância para o setor Sudeste', tag: 'Prosperidade', preco: 'A partir de R$ 18,90' },
      { nome: 'Ametista', desc: 'Cristal de sabedoria e espiritualidade para meditação', tag: 'Espiritualidade', preco: 'A partir de R$ 25,90' },
    ]
  },
  {
    id: 'fontes',
    nome: 'Fontes de Água',
    icon: '⛲',
    cor: '#0EA5E9',
    descricao: 'Fontes para ativar o elemento água e prosperidade',
    produtos: [
      { nome: 'Fonte de Mesa Bambu', desc: 'Fonte decorativa de mesa com bambu e pedras naturais', tag: 'Prosperidade', preco: 'A partir de R$ 89,90' },
      { nome: 'Fonte Cascata Cerâmica', desc: 'Fonte de cerâmica com cascata para sala ou escritório', tag: 'Harmonia', preco: 'A partir de R$ 129,90' },
      { nome: 'Mini Aquário Decorativo', desc: 'Aquário pequeno para ativar setor Carreira e riqueza', tag: 'Carreira', preco: 'A partir de R$ 79,90' },
    ]
  },
  {
    id: 'plantas',
    nome: 'Plantas e Vasos',
    icon: '🌿',
    cor: '#15803D',
    descricao: 'Plantas vivas e artificiais para purificação e ativação',
    produtos: [
      { nome: 'Bambu da Sorte', desc: 'Bambu da sorte em vaso de cerâmica para prosperidade', tag: 'Prosperidade', preco: 'A partir de R$ 29,90' },
      { nome: 'Espada de São Jorge', desc: 'Planta protetora para entrada e áreas de passagem', tag: 'Proteção', preco: 'A partir de R$ 19,90' },
      { nome: 'Lírio da Paz', desc: 'Planta purificadora de ar para ambientes internos', tag: 'Purificação', preco: 'A partir de R$ 24,90' },
    ]
  },
  {
    id: 'sinos',
    nome: 'Sinos de Vento e Mobiles',
    icon: '🎐',
    cor: '#B45309',
    descricao: 'Sinos e móbiles metálicos para ativação do elemento metal',
    produtos: [
      { nome: 'Sino de Vento 5 Tubos', desc: 'Sino de vento em alumínio com 5 tubos para energia metal', tag: 'Metal', preco: 'A partir de R$ 39,90' },
      { nome: 'Sino de Vento Bambu', desc: 'Sino em bambu para elemento madeira e setor Família', tag: 'Madeira', preco: 'A partir de R$ 34,90' },
      { nome: 'Mobile Cristal Facetado', desc: 'Mobile com cristais facetados para dispersar energia', tag: 'Ativação', preco: 'A partir de R$ 49,90' },
    ]
  },
  {
    id: 'velas',
    nome: 'Velas e Incensos',
    icon: '🕯️',
    cor: '#DC2626',
    descricao: 'Velas e incensos para ativar o elemento Fogo',
    produtos: [
      { nome: 'Kit Velas Aromáticas 7 Chakras', desc: 'Kit com 7 velas aromáticas para ativação dos chakras', tag: 'Fogo', preco: 'A partir de R$ 59,90' },
      { nome: 'Incensário Cascata', desc: 'Incensário de cerâmica em formato cascata com cones', tag: 'Purificação', preco: 'A partir de R$ 44,90' },
      { nome: 'Difusor de Óleos Essenciais', desc: 'Difusor ultrassônico para aromaterapia e harmonia', tag: 'Harmonia', preco: 'A partir de R$ 69,90' },
    ]
  },
  {
    id: 'decoracao',
    nome: 'Decoração e Símbolos',
    icon: '🏮',
    cor: '#BE185D',
    descricao: 'Objetos decorativos e símbolos para ativação dos setores',
    produtos: [
      { nome: 'Sapo da Fortuna', desc: 'Sapo de três pernas com moeda para prosperidade', tag: 'Prosperidade', preco: 'A partir de R$ 34,90' },
      { nome: 'Par de Elefantes', desc: 'Par de elefantes decorativos para proteção e sabedoria', tag: 'Proteção', preco: 'A partir de R$ 49,90' },
      { nome: 'Buda Decorativo', desc: 'Estatueta de Buda para meditação e serenidade', tag: 'Espiritualidade', preco: 'A partir de R$ 39,90' },
      { nome: 'Moedas Chinesas I-Ching', desc: 'Conjunto de moedas amarradas com fita vermelha', tag: 'Abundância', preco: 'A partir de R$ 14,90' },
    ]
  },
]

// Extract all unique tags from all products across all categories
const ALL_TAGS = Array.from(
  new Set(
    CATEGORIAS_PRODUTOS.flatMap(cat => cat.produtos.map(p => p.tag))
  )
).sort()

function ProdutosContent() {
  const searchParams = useSearchParams()
  const categoriaParam = searchParams.get('categoria')
  const [loading, setLoading] = useState(true)
  const [categoriaAtiva, setCategoriaAtiva] = useState(categoriaParam || 'espelhos')
  const [produtosAfiliados, setProdutosAfiliados] = useState<ProdutoAfiliadoRow[]>([])
  const [filtroBusca, setFiltroBusca] = useState('')

  // New filter states
  const [searchProd, setSearchProd] = useState('')
  const [filtroTag, setFiltroTag] = useState('todos')
  const [filtroCategoria, setFiltroCategoria] = useState('todos')

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/login'; return }

      // Try to load custom affiliate products from database
      const { data, error } = await supabase
        .from('produtos_afiliados')
        .select('*')
        .eq('ativo', true)
        .order('categoria, nome')

      // O catálogo estático é o piso, não o plano B silencioso: se a consulta
      // falhar, a tela continua útil, mas a falha precisa aparecer no log.
      if (error) {
        logger.error('Falha ao carregar produtos afiliados', {
          route: '/produtos', action: 'select produtos_afiliados', erro: error.message,
        })
      } else if (data && data.length > 0) {
        setProdutosAfiliados(data)
      }

      setLoading(false)
    }
    load()
  }, [])

  // Filtered categories based on filtroCategoria
  const categoriasVisiveis = useMemo(() => {
    if (filtroCategoria === 'todos') return CATEGORIAS_PRODUTOS
    return CATEGORIAS_PRODUTOS.filter(c => c.id === filtroCategoria)
  }, [filtroCategoria])

  // When category filter changes, auto-select first visible category
  useEffect(() => {
    if (filtroCategoria !== 'todos') {
      setCategoriaAtiva(filtroCategoria)
    }
  }, [filtroCategoria])

  const categoriaData = CATEGORIAS_PRODUTOS.find(c => c.id === categoriaAtiva)

  // Merge DB products with defaults
  const dbProdutosCat = produtosAfiliados.filter(p => p.categoria === categoriaAtiva)
  const produtosExibir: ProdutoExibir[] = dbProdutosCat.length > 0
    ? dbProdutosCat
    : (categoriaData?.produtos || [])

  // Apply all filters: searchProd (name), filtroTag, and legacy filtroBusca
  const filteredProdutos = useMemo(() => {
    let result = produtosExibir

    // Filter by product name search
    const searchTerm = searchProd || filtroBusca
    if (searchTerm) {
      result = result.filter(p =>
        (p.nome || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.desc || p.descricao || '').toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // Filter by tag
    if (filtroTag !== 'todos') {
      result = result.filter(p =>
        (p.tag || '').toLowerCase() === filtroTag.toLowerCase()
      )
    }

    return result
  }, [produtosExibir, searchProd, filtroBusca, filtroTag])

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F9FAFB', fontFamily: 'var(--font-figtree), sans-serif' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>☯</div>
          <p style={{ color: '#2E7D6B', fontSize: '16px' }}>Carregando produtos...</p>
        </div>
      </div>
    )
  }

  return (
    <AppShell currentPage="produtos">

      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ color: '#0E1B2C', fontSize: '24px', fontWeight: 'bold', margin: '0 0 4px 0' }}>
          Produtos Recomendados
        </h1>
        <p style={{ color: '#6B7280', fontSize: '15px', margin: '0' }}>
          Produtos para harmonização e ativação dos setores do Ba Gua
        </p>
      </div>

      {/* Info banner */}
      <div style={{
        background: 'linear-gradient(135deg, #2E7D6B, #0E1B2C)',
        borderRadius: '12px', padding: '16px 24px', marginBottom: '24px',
        display: 'flex', alignItems: 'center', gap: '12px'
      }}>
        <span style={{ fontSize: '24px' }}>💡</span>
        <p style={{ color: 'rgba(255,255,255,0.9)', fontSize: '13px', margin: '0' }}>
          Os produtos listados são recomendações baseadas em práticas de Feng Shui.
          Ao clicar em &quot;Ver produto&quot;, você será redirecionado para a loja parceira.
        </p>
      </div>

      {/* Filter Bar */}
      <div style={{
        background: '#ffffff', borderRadius: '12px', padding: '16px 20px',
        boxShadow: '0 1px 4px rgba(0,0,0,0.08)', border: '1px solid #E5E7EB',
        marginBottom: '20px', display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center'
      }}>
        {/* Search by product name */}
        <div style={{ flex: '1 1 240px', minWidth: '200px' }}>
          <input
            type="text"
            value={searchProd}
            onChange={e => setSearchProd(e.target.value)}
            placeholder="Buscar por nome do produto..."
            style={{
              width: '100%', padding: '10px 14px', border: '1px solid #D1D5DB',
              borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box'
            }}
          />
        </div>

        {/* Filter by tag */}
        <div style={{ flex: '0 1 220px', minWidth: '180px' }}>
          <select
            value={filtroTag}
            onChange={e => setFiltroTag(e.target.value)}
            style={{
              width: '100%', padding: '10px 14px', border: '1px solid #D1D5DB',
              borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box',
              background: '#fff', color: filtroTag === 'todos' ? '#9CA3AF' : '#374151'
            }}
          >
            <option value="todos">Todas as situações</option>
            {ALL_TAGS.map(tag => (
              <option key={tag} value={tag.toLowerCase()}>{tag}</option>
            ))}
          </select>
        </div>

        {/* Filter by category */}
        <div style={{ flex: '0 1 220px', minWidth: '180px' }}>
          <select
            value={filtroCategoria}
            onChange={e => setFiltroCategoria(e.target.value)}
            style={{
              width: '100%', padding: '10px 14px', border: '1px solid #D1D5DB',
              borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box',
              background: '#fff', color: filtroCategoria === 'todos' ? '#9CA3AF' : '#374151'
            }}
          >
            <option value="todos">Todas as categorias</option>
            {CATEGORIAS_PRODUTOS.map(cat => (
              <option key={cat.id} value={cat.id}>{cat.icon} {cat.nome}</option>
            ))}
          </select>
        </div>

        {/* Clear filters button */}
        {(searchProd || filtroTag !== 'todos' || filtroCategoria !== 'todos') && (
          <button
            onClick={() => { setSearchProd(''); setFiltroTag('todos'); setFiltroCategoria('todos') }}
            style={{
              padding: '10px 16px', background: '#F3F4F6', color: '#6B7280',
              border: '1px solid #D1D5DB', borderRadius: '8px', fontSize: '13px',
              cursor: 'pointer', fontWeight: 'bold', whiteSpace: 'nowrap'
            }}
          >
            Limpar filtros
          </button>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: '24px' }}>

        {/* Category sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {categoriasVisiveis.map(cat => (
            <button key={cat.id} onClick={() => { setCategoriaAtiva(cat.id); setFiltroBusca('') }} style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              padding: '12px 14px', borderRadius: '10px', border: 'none', cursor: 'pointer',
              background: categoriaAtiva === cat.id ? '#0E1B2C' : '#ffffff',
              color: categoriaAtiva === cat.id ? '#ffffff' : '#374151',
              textAlign: 'left', fontSize: '14px', fontWeight: categoriaAtiva === cat.id ? 'bold' : 'normal',
              boxShadow: categoriaAtiva === cat.id ? 'none' : '0 1px 3px rgba(0,0,0,0.06)',
              width: '100%'
            }}>
              <span style={{ fontSize: '20px' }}>{cat.icon}</span>
              <div>
                <div>{cat.nome}</div>
                <div style={{ fontSize: '11px', color: categoriaAtiva === cat.id ? 'rgba(255,255,255,0.7)' : '#9CA3AF' }}>
                  {cat.produtos.length} produtos
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Products grid */}
        <div>
          {categoriaData && (
            <div style={{ marginBottom: '20px' }}>
              <h2 style={{ color: '#0E1B2C', fontSize: '20px', fontWeight: 'bold', margin: '0 0 4px 0' }}>
                {categoriaData.icon} {categoriaData.nome}
              </h2>
              <p style={{ color: '#6B7280', fontSize: '14px', margin: '0' }}>{categoriaData.descricao}</p>
            </div>
          )}

          {filteredProdutos.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px', color: '#9CA3AF' }}>
              <p style={{ fontSize: '32px', margin: '0 0 8px 0' }}>🔍</p>
              <p>Nenhum produto encontrado</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
              {filteredProdutos.map((produto, i) => (
                <div key={i} style={{
                  background: '#ffffff', borderRadius: '12px', padding: '20px',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
                  border: '1px solid #E5E7EB',
                  display: 'flex', flexDirection: 'column'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <h3 style={{ color: '#111827', fontSize: '15px', fontWeight: 'bold', margin: '0', flex: 1 }}>
                      {produto.nome}
                    </h3>
                    {(produto.tag) && (
                      <span style={{
                        background: `${categoriaData?.cor || '#2E7D6B'}15`,
                        color: categoriaData?.cor || '#2E7D6B',
                        padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold',
                        whiteSpace: 'nowrap', marginLeft: '8px'
                      }}>{produto.tag}</span>
                    )}
                  </div>
                  <p style={{ color: '#6B7280', fontSize: '13px', margin: '0 0 12px 0', flex: 1, lineHeight: '1.4' }}>
                    {produto.desc || produto.descricao}
                  </p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#15803D', fontSize: '14px', fontWeight: 'bold' }}>
                      {produto.preco || ''}
                    </span>
                    {produto.link_afiliado ? (
                      <a href={produto.link_afiliado} target="_blank" rel="noopener noreferrer" style={{
                        padding: '8px 16px', background: '#2E7D6B', color: '#fff',
                        border: 'none', borderRadius: '6px', fontSize: '13px',
                        fontWeight: 'bold', textDecoration: 'none', cursor: 'pointer'
                      }}>Ver produto</a>
                    ) : (
                      <span style={{
                        padding: '8px 16px', background: '#E5E7EB', color: '#9CA3AF',
                        borderRadius: '6px', fontSize: '13px', fontWeight: 'bold'
                      }}>Em breve</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

    </AppShell>
  )
}

export default function Produtos() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F9FAFB', fontFamily: 'var(--font-figtree), sans-serif' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>☯</div>
          <p style={{ color: '#2E7D6B', fontSize: '16px' }}>Carregando produtos...</p>
        </div>
      </div>
    }>
      <ProdutosContent />
    </Suspense>
  )
}
