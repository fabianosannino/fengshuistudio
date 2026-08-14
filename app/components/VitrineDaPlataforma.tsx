/**
 * Os produtos que **nós** vendemos, no topo da Loja.
 *
 * Ficam separados do catálogo de recomendações logo abaixo, e a separação é a
 * informação principal da tela: ali o clique leva para a loja de outra pessoa
 * e nada passa por aqui; aqui a compra é conosco, com pagamento, recibo,
 * direito de arrependimento e suporte deste lado.
 *
 * Some inteiro quando não há produto publicado. Uma seção vazia com «em breve»
 * ocuparia o topo da loja prometendo o que ainda não existe.
 */

'use client'

import { useEffect, useState } from 'react'
import { Download, ShoppingBag } from 'lucide-react'
import { logger } from '../../src/lib/logger'
import { formatarMoeda } from '../../src/lib/formato'

interface ProdutoNaVitrine {
  id: string
  nome: string
  descricao: string | null
  preco_centavos: number
  entrega_digital: boolean
}

export default function VitrineDaPlataforma() {
  const [produtos, setProdutos] = useState<ProdutoNaVitrine[]>([])
  const [comprando, setComprando] = useState<string | null>(null)
  const [aviso, setAviso] = useState('')

  useEffect(() => {
    async function carregar() {
      try {
        const res = await fetch('/api/loja/produtos')
        if (!res.ok) return
        const dados = await res.json()
        setProdutos(dados.produtos ?? [])
      } catch (err) {
        // Vitrine vazia é o pior desfecho aqui, e ele é aceitável: o resto da
        // página continua servindo. O que não pode é a falha sumir.
        logger.warn('Não foi possível carregar o catálogo da plataforma', { error: String(err) })
      }
    }
    carregar()
  }, [])

  async function comprar(produtoId: string) {
    setComprando(produtoId)
    setAviso('')
    try {
      const res = await fetch('/api/loja/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ produto_id: produtoId }),
      })
      const dados = await res.json().catch(() => ({}))

      if (!res.ok || !dados.url) {
        setAviso(dados.error ?? 'Não foi possível iniciar a compra.')
        setComprando(null)
        return
      }

      window.location.assign(dados.url)
    } catch (err) {
      logger.error('Falha ao iniciar o checkout do bem próprio', { error: String(err) })
      setAviso('Não foi possível iniciar a compra.')
      setComprando(null)
    }
  }

  if (produtos.length === 0) return null

  return (
    <div style={{ marginBottom: '28px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
        <ShoppingBag size={18} color="#2E7D6B" aria-hidden="true" />
        <h2 style={{ color: '#0E1B2C', fontSize: '18px', fontWeight: 600, margin: 0 }}>
          Do FengShui Studio
        </h2>
      </div>
      <p style={{ color: '#6B7280', fontSize: '14px', margin: '0 0 14px' }}>
        Vendidos e entregues por nós. Download imediato após o pagamento, com
        direito de arrependimento de 7 dias.
      </p>

      {aviso && (
        <p style={{ background: '#FDECEC', color: '#A33A3A', padding: '10px 12px', borderRadius: '8px', fontSize: '13px' }}>
          {aviso}
        </p>
      )}

      <div style={{
        display: 'grid', gap: '14px',
        gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
      }}>
        {produtos.map(produto => (
          <div key={produto.id} style={{
            background: '#fff', border: '1px solid rgba(14,27,44,0.06)', borderRadius: '12px',
            padding: '18px', display: 'flex', flexDirection: 'column', gap: '8px',
            boxShadow: '0 1px 2px rgba(14,27,44,0.04)',
          }}>
            <strong style={{ color: '#0E1B2C', fontSize: '15px' }}>{produto.nome}</strong>
            {produto.descricao && (
              <p style={{ color: '#6B7280', fontSize: '13px', margin: 0, lineHeight: 1.5 }}>
                {produto.descricao}
              </p>
            )}
            {produto.entrega_digital && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#2E7D6B', fontSize: '12px' }}>
                <Download size={13} aria-hidden="true" /> Arquivo para download
              </span>
            )}
            <div style={{ marginTop: 'auto', paddingTop: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
              <strong style={{ color: '#0E1B2C', fontSize: '17px' }}>
                {formatarMoeda(produto.preco_centavos / 100)}
              </strong>
              <button type="button" disabled={comprando === produto.id}
                onClick={() => comprar(produto.id)}
                style={{
                  padding: '9px 18px', background: '#2E7D6B', color: '#fff', border: 'none',
                  borderRadius: '8px', fontSize: '14px', fontWeight: 'bold',
                  cursor: comprando === produto.id ? 'default' : 'pointer',
                  opacity: comprando === produto.id ? 0.7 : 1,
                }}>
                {comprando === produto.id ? 'Abrindo…' : 'Comprar'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
