/**
 * O catálogo real no topo da Loja, em **dois grupos**.
 *
 * A separação é a informação principal da tela, e ela é jurídica antes de ser
 * visual: no que é nosso a plataforma é a vendedora e responde por pagamento,
 * entrega, arrependimento e suporte; na indicação a compra acontece no site do
 * parceiro e nada passa por aqui.
 *
 * Um título só para os dois prometeria uma responsabilidade que não temos, e —
 * no sentido inverso, que é o pior — esconderia a que temos.
 *
 * Cada grupo some sozinho quando está vazio. Uma seção com «em breve» ocuparia
 * o topo da loja prometendo o que ainda não existe.
 */

'use client'

import { useEffect, useState } from 'react'
import { Download, ShoppingBag, ExternalLink } from 'lucide-react'
import { logger } from '../../src/lib/logger'
import { formatarMoeda } from '../../src/lib/formato'

interface ProdutoNaVitrine {
  id: string
  nome: string
  descricao: string | null
  preco_centavos: number
  entrega_digital: boolean
  modo_de_venda: 'marketplace' | 'indicacao'
  parceiro: string | null
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

  /*
   * Os dois grupos não são arrumação de tela — são quem responde pela compra.
   *
   * No que é nosso, a plataforma é a vendedora: pagamento, recibo,
   * arrependimento e suporte deste lado. Na indicação a compra acontece no
   * site do parceiro e nada passa por aqui. Misturar os dois sob o mesmo
   * título prometeria uma responsabilidade que não temos — e, no sentido
   * inverso, esconderia a que temos.
   */
  const nossos = produtos.filter(p => p.modo_de_venda !== 'indicacao')
  const indicados = produtos.filter(p => p.modo_de_venda === 'indicacao')

  const cartao = {
    background: '#fff', border: '1px solid rgba(14,27,44,0.06)', borderRadius: '12px',
    padding: '18px', display: 'flex', flexDirection: 'column' as const, gap: '8px',
    boxShadow: '0 1px 2px rgba(14,27,44,0.04)',
  }
  const grade = {
    display: 'grid', gap: '14px',
    gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
  }

  return (
    <div style={{ marginBottom: '28px' }}>
      {aviso && (
        <p style={{ background: '#FDECEC', color: '#A33A3A', padding: '10px 12px', borderRadius: '8px', fontSize: '13px' }}>
          {aviso}
        </p>
      )}

      {nossos.length > 0 && (
        <div style={{ marginBottom: indicados.length > 0 ? '28px' : 0 }}>
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

          <div style={grade}>
            {nossos.map(produto => (
              <div key={produto.id} style={cartao}>
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
      )}

      {indicados.length > 0 && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
            <ExternalLink size={18} color="#8A6E2F" aria-hidden="true" />
            <h2 style={{ color: '#0E1B2C', fontSize: '18px', fontWeight: 600, margin: 0 }}>
              Indicações
            </h2>
          </div>
          <p style={{ color: '#6B7280', fontSize: '14px', margin: '0 0 14px' }}>
            Produtos de parceiros. <strong>A compra acontece no site deles</strong> —
            pagamento, entrega e trocas são com o parceiro, e o preço pode ter mudado lá.
          </p>

          <div style={grade}>
            {indicados.map(produto => (
              <div key={produto.id} style={cartao}>
                <strong style={{ color: '#0E1B2C', fontSize: '15px' }}>{produto.nome}</strong>
                {produto.parceiro && (
                  <span style={{ color: '#8A6E2F', fontSize: '12px', fontWeight: 'bold' }}>
                    Vendido por {produto.parceiro}
                  </span>
                )}
                {produto.descricao && (
                  <p style={{ color: '#6B7280', fontSize: '13px', margin: 0, lineHeight: 1.5 }}>
                    {produto.descricao}
                  </p>
                )}
                <div style={{ marginTop: 'auto', paddingTop: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                  <span style={{ color: '#6B7280', fontSize: '13px' }}>
                    a partir de {formatarMoeda(produto.preco_centavos / 100)}
                  </span>
                  {/*
                    `<a>`, não `fetch`: o destino é outro site, e deixar o
                    browser seguir o 302 funciona sem JavaScript e preserva o
                    «abrir em nova aba» do usuário. O caminho passa pela nossa
                    rota porque é ela que mede o encaminhamento.
                  */}
                  <a href={`/api/loja/indicacao?produto=${encodeURIComponent(produto.id)}`}
                    target="_blank" rel="noopener noreferrer"
                    style={{
                      padding: '9px 16px', background: '#fff', color: '#0E1B2C',
                      border: '1px solid #E5E7EB', borderRadius: '8px',
                      fontSize: '13px', fontWeight: 'bold', textDecoration: 'none',
                      display: 'flex', alignItems: 'center', gap: '6px',
                    }}>
                    Ver no parceiro <ExternalLink size={13} aria-hidden="true" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
