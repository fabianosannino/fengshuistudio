'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '../../src/lib/supabase'
import AppShell from '../components/AppShell'

// Categorias de produtos Feng Shui com produtos de afiliados
const CATEGORIAS_PRODUTOS = [
  {
    id: 'espelhos',
    nome: 'Espelhos',
    icon: '🪞',
    cor: '#1D4ED8',
    descricao: 'Espelhos concavos, convexos e Ba Gua para harmonizacao',
    produtos: [
      { nome: 'Espelho Concavo Ba Gua', desc: 'Espelho concavo octogonal para protecao e desvio de energia negativa', tag: 'Protecao', preco: 'A partir de R$ 29,90' },
      { nome: 'Espelho Convexo Ba Gua', desc: 'Espelho convexo para distribuir e expandir energia positiva', tag: 'Expansao', preco: 'A partir de R$ 34,90' },
      { nome: 'Espelho Plano Octogonal', desc: 'Espelho Ba Gua plano para neutralizar energias', tag: 'Equilíbrio', preco: 'A partir de R$ 24,90' },
    ]
  },
  {
    id: 'cristais',
    nome: 'Cristais e Pedras',
    icon: '💎',
    cor: '#7C3AED',
    descricao: 'Cristais para ativacao energetica dos setores do Ba Gua',
    produtos: [
      { nome: 'Cristal Multifacetado', desc: 'Cristal de pendurar para dispersar energia estagnada e trazer luz', tag: 'Ativacao', preco: 'A partir de R$ 19,90' },
      { nome: 'Quartzo Rosa', desc: 'Pedra do amor e relacionamentos para o setor Sudoeste', tag: 'Relacionamento', preco: 'A partir de R$ 15,90' },
      { nome: 'Obsidiana Negra', desc: 'Pedra de protecao para entrada e setor Carreira', tag: 'Protecao', preco: 'A partir de R$ 22,90' },
      { nome: 'Citrino', desc: 'Pedra da prosperidade e abundancia para o setor Sudeste', tag: 'Prosperidade', preco: 'A partir de R$ 18,90' },
      { nome: 'Ametista', desc: 'Cristal de sabedoria e espiritualidade para meditacao', tag: 'Espiritualidade', preco: 'A partir de R$ 25,90' },
    ]
  },
  {
    id: 'fontes',
    nome: 'Fontes de Agua',
    icon: '⛲',
    cor: '#0EA5E9',
    descricao: 'Fontes para ativar o elemento agua e prosperidade',
    produtos: [
      { nome: 'Fonte de Mesa Bambu', desc: 'Fonte decorativa de mesa com bambu e pedras naturais', tag: 'Prosperidade', preco: 'A partir de R$ 89,90' },
      { nome: 'Fonte Cascata Ceramica', desc: 'Fonte de ceramica com cascata para sala ou escritorio', tag: 'Harmonia', preco: 'A partir de R$ 129,90' },
      { nome: 'Mini Aquario Decorativo', desc: 'Aquario pequeno para ativar setor Carreira e riqueza', tag: 'Carreira', preco: 'A partir de R$ 79,90' },
    ]
  },
  {
    id: 'plantas',
    nome: 'Plantas e Vasos',
    icon: '🌿',
    cor: '#15803D',
    descricao: 'Plantas vivas e artificiais para purificacao e ativacao',
    produtos: [
      { nome: 'Bambu da Sorte', desc: 'Bambu da sorte em vaso de ceramica para prosperidade', tag: 'Prosperidade', preco: 'A partir de R$ 29,90' },
      { nome: 'Espada de Sao Jorge', desc: 'Planta protetora para entrada e areas de passagem', tag: 'Protecao', preco: 'A partir de R$ 19,90' },
      { nome: 'Lirio da Paz', desc: 'Planta purificadora de ar para ambientes internos', tag: 'Purificacao', preco: 'A partir de R$ 24,90' },
    ]
  },
  {
    id: 'sinos',
    nome: 'Sinos de Vento e Mobiles',
    icon: '🎐',
    cor: '#B45309',
    descricao: 'Sinos e mobiles metalicos para ativacao do elemento metal',
    produtos: [
      { nome: 'Sino de Vento 5 Tubos', desc: 'Sino de vento em aluminio com 5 tubos para energia metal', tag: 'Metal', preco: 'A partir de R$ 39,90' },
      { nome: 'Sino de Vento Bambu', desc: 'Sino em bambu para elemento madeira e setor Familia', tag: 'Madeira', preco: 'A partir de R$ 34,90' },
      { nome: 'Mobile Cristal Facetado', desc: 'Mobile com cristais facetados para dispersar energia', tag: 'Ativacao', preco: 'A partir de R$ 49,90' },
    ]
  },
  {
    id: 'velas',
    nome: 'Velas e Incensos',
    icon: '🕯️',
    cor: '#DC2626',
    descricao: 'Velas e incensos para ativar o elemento fogo',
    produtos: [
      { nome: 'Kit Velas Aromaticas 7 Chakras', desc: 'Kit com 7 velas aromaticas para ativacao dos chakras', tag: 'Fogo', preco: 'A partir de R$ 59,90' },
      { nome: 'Incensario Cascata', desc: 'Incensario de ceramica em formato cascata com cones', tag: 'Purificacao', preco: 'A partir de R$ 44,90' },
      { nome: 'Difusor de Oleos Essenciais', desc: 'Difusor ultrasonico para aromaterapia e harmonia', tag: 'Harmonia', preco: 'A partir de R$ 69,90' },
    ]
  },
  {
    id: 'decoracao',
    nome: 'Decoracao e Simbolos',
    icon: '🏮',
    cor: '#BE185D',
    descricao: 'Objetos decorativos e simbolos para ativacao dos setores',
    produtos: [
      { nome: 'Sapo da Fortuna', desc: 'Sapo de tres pernas com moeda para prosperidade', tag: 'Prosperidade', preco: 'A partir de R$ 34,90' },
      { nome: 'Par de Elefantes', desc: 'Par de elefantes decorativos para protecao e sabedoria', tag: 'Protecao', preco: 'A partir de R$ 49,90' },
      { nome: 'Buda Decorativo', desc: 'Estatueta de Buda para meditacao e serenidade', tag: 'Espiritualidade', preco: 'A partir de R$ 39,90' },
      { nome: 'Moedas Chinesas I-Ching', desc: 'Conjunto de moedas amarradas com fita vermelha', tag: 'Abundancia', preco: 'A partir de R$ 14,90' },
    ]
  },
]

function ProdutosContent() {
  const searchParams = useSearchParams()
  const categoriaParam = searchParams.get('categoria')
  const [loading, setLoading] = useState(true)
  const [categoriaAtiva, setCategoriaAtiva] = useState(categoriaParam || 'espelhos')
  const [produtosAfiliados, setProdutosAfiliados] = useState<any[]>([])
  const [filtroBusca, setFiltroBusca] = useState('')

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/login'; return }

      // Try to load custom affiliate products from database
      const { data } = await supabase
        .from('produtos_afiliados')
        .select('*')
        .eq('ativo', true)
        .order('categoria, nome')

      if (data && data.length > 0) {
        setProdutosAfiliados(data)
      }

      setLoading(false)
    }
    load()
  }, [])

  const categoriaData = CATEGORIAS_PRODUTOS.find(c => c.id === categoriaAtiva)

  // Merge DB products with defaults
  const dbProdutosCat = produtosAfiliados.filter(p => p.categoria === categoriaAtiva)
  const produtosExibir = dbProdutosCat.length > 0
    ? dbProdutosCat
    : (categoriaData?.produtos || [])

  const filteredProdutos = filtroBusca
    ? produtosExibir.filter(p =>
        (p.nome || '').toLowerCase().includes(filtroBusca.toLowerCase()) ||
        (p.desc || p.descricao || '').toLowerCase().includes(filtroBusca.toLowerCase()) ||
        (p.tag || '').toLowerCase().includes(filtroBusca.toLowerCase())
      )
    : produtosExibir

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F9FAFB', fontFamily: 'Arial, sans-serif' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>☯</div>
          <p style={{ color: '#7C3AED', fontSize: '16px' }}>Carregando produtos...</p>
        </div>
      </div>
    )
  }

  return (
    <AppShell currentPage="produtos">

      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ color: '#1E3A5F', fontSize: '24px', fontWeight: 'bold', margin: '0 0 4px 0' }}>
          Produtos Recomendados
        </h1>
        <p style={{ color: '#6B7280', fontSize: '15px', margin: '0' }}>
          Produtos para harmonizacao e ativacao dos setores do Ba Gua
        </p>
      </div>

      {/* Info banner */}
      <div style={{
        background: 'linear-gradient(135deg, #7C3AED, #1E3A5F)',
        borderRadius: '12px', padding: '16px 24px', marginBottom: '24px',
        display: 'flex', alignItems: 'center', gap: '12px'
      }}>
        <span style={{ fontSize: '24px' }}>💡</span>
        <p style={{ color: 'rgba(255,255,255,0.9)', fontSize: '13px', margin: '0' }}>
          Os produtos listados sao recomendacoes baseadas em praticas de Feng Shui.
          Ao clicar em &quot;Ver produto&quot;, voce sera redirecionado para a loja parceira.
        </p>
      </div>

      {/* Search */}
      <div style={{ marginBottom: '20px' }}>
        <input
          type="text"
          value={filtroBusca}
          onChange={e => setFiltroBusca(e.target.value)}
          placeholder="Buscar produtos..."
          style={{ width: '100%', maxWidth: '400px', padding: '10px 14px', border: '1px solid #D1D5DB', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: '24px' }}>

        {/* Category sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {CATEGORIAS_PRODUTOS.map(cat => (
            <button key={cat.id} onClick={() => { setCategoriaAtiva(cat.id); setFiltroBusca('') }} style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              padding: '12px 14px', borderRadius: '10px', border: 'none', cursor: 'pointer',
              background: categoriaAtiva === cat.id ? '#1E3A5F' : '#ffffff',
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
              <h2 style={{ color: '#1E3A5F', fontSize: '20px', fontWeight: 'bold', margin: '0 0 4px 0' }}>
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
                        background: `${categoriaData?.cor || '#7C3AED'}15`,
                        color: categoriaData?.cor || '#7C3AED',
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
                        padding: '8px 16px', background: '#7C3AED', color: '#fff',
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
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F9FAFB', fontFamily: 'Arial, sans-serif' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>☯</div>
          <p style={{ color: '#7C3AED', fontSize: '16px' }}>Carregando produtos...</p>
        </div>
      </div>
    }>
      <ProdutosContent />
    </Suspense>
  )
}
