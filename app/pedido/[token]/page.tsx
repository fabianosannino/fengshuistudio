/**
 * A página do pedido para quem comprou.
 *
 * Sem `AppShell` de propósito: quem abre isto não é usuário da plataforma, não
 * tem menu e não deve ver um app do qual não faz parte. É uma página de recibo,
 * aberta por link.
 *
 * O token vai na URL, e é ele que prova o direito de ver — o comprador não tem
 * conta para o RLS reconhecer. Todo o resto é decidido no servidor: esta tela
 * só desenha o que a rota devolveu.
 */

'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

interface PedidoVisivel {
  numero: string
  criado_em: string
  situacao: string
  rotulo: string
  total_centavos: number
  devolvido_centavos: number
  itens: { nome: string; quantidade: number; preco_unitario_centavos: number }[]
  historico: { evento: string; rotulo: string; ocorrido_em: string | null }[]
  arrependimento_ate: string | null
  pode_pedir_devolucao: boolean
  comprador_email_mascarado: string | null
}

const CORES: Record<string, { fundo: string; texto: string }> = {
  pago: { fundo: '#F0F6F3', texto: '#2E7D6B' },
  enviado: { fundo: '#F0F6F3', texto: '#2E7D6B' },
  entregue: { fundo: '#F0F6F3', texto: '#2E7D6B' },
  devolucao_solicitada: { fundo: '#FAF3E0', texto: '#8A6E2F' },
  reembolsado: { fundo: '#FDECEC', texto: '#A33A3A' },
  cancelado: { fundo: '#F3F4F6', texto: '#6B7280' },
}

function reais(centavos: number): string {
  return (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function data(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('pt-BR')
}

export default function PedidoDoComprador() {
  const params = useParams()
  const token = params.token as string

  const [pedido, setPedido] = useState<PedidoVisivel | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [pedindo, setPedindo] = useState(false)
  const [aviso, setAviso] = useState('')

  const carregar = useCallback(async () => {
    const res = await fetch(`/api/pedidos/publico?token=${encodeURIComponent(token)}`)
    const dados = await res.json().catch(() => ({}))
    if (!res.ok) {
      setErro(dados.error ?? 'Não foi possível carregar o pedido.')
    } else {
      setPedido(dados.pedido)
    }
    setCarregando(false)
  }, [token])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { carregar() }, [carregar])

  async function pedirDevolucao() {
    setPedindo(true)
    setAviso('')
    const res = await fetch('/api/pedidos/publico', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
    const dados = await res.json().catch(() => ({}))
    setPedindo(false)

    if (!res.ok) { setAviso(dados.error ?? 'Não foi possível registrar o pedido.'); return }

    setAviso('Devolução solicitada. O vendedor foi avisado e o valor será devolvido integralmente.')
    await carregar()
  }

  const moldura = {
    minHeight: '100vh', background: '#F9FAFB', padding: '32px 16px',
    fontFamily: 'var(--font-figtree), sans-serif',
  }

  if (carregando) {
    return <div style={{ ...moldura, textAlign: 'center' as const, color: '#6B7280' }}>Carregando…</div>
  }

  if (erro || !pedido) {
    return (
      <div style={{ ...moldura, textAlign: 'center' as const }}>
        <div style={{ fontSize: '40px', marginBottom: '12px' }}>☯</div>
        <p style={{ color: '#6B7280' }}>{erro || 'Pedido não encontrado.'}</p>
        <p style={{ color: '#9CA3AF', fontSize: '13px', marginTop: '8px' }}>
          Links de pedido expiram. Se o seu venceu, fale com o vendedor.
        </p>
      </div>
    )
  }

  const cores = CORES[pedido.situacao] ?? { fundo: '#F3F4F6', texto: '#6B7280' }

  return (
    <div style={moldura}>
      <div style={{ maxWidth: '620px', margin: '0 auto' }}>
        <div style={{ background: '#fff', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
            <div>
              <h1 style={{ color: '#0E1B2C', fontSize: '20px', fontWeight: 'bold', margin: '0 0 4px' }}>
                Pedido {pedido.numero}
              </h1>
              <p style={{ color: '#6B7280', fontSize: '13px', margin: 0 }}>
                Feito em {data(pedido.criado_em)}
                {pedido.comprador_email_mascarado && ` · ${pedido.comprador_email_mascarado}`}
              </p>
            </div>
            <span style={{ padding: '4px 12px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold', background: cores.fundo, color: cores.texto }}>
              {pedido.rotulo}
            </span>
          </div>

          <div style={{ marginTop: '20px', borderTop: '1px solid #F3F4F6', paddingTop: '16px' }}>
            {pedido.itens.map((item, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '14px' }}>
                <span style={{ color: '#374151' }}>
                  {item.nome}{item.quantidade > 1 && ` × ${item.quantidade}`}
                </span>
                <span style={{ color: '#0E1B2C', fontWeight: 'bold' }}>
                  {reais(item.preco_unitario_centavos * item.quantidade)}
                </span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #F3F4F6', paddingTop: '10px', marginTop: '10px', fontSize: '15px' }}>
              <strong style={{ color: '#0E1B2C' }}>Total</strong>
              <strong style={{ color: '#0E1B2C' }}>{reais(pedido.total_centavos)}</strong>
            </div>
            {pedido.devolvido_centavos > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '14px', color: '#A33A3A' }}>
                <span>Devolvido a você</span>
                <strong>{reais(pedido.devolvido_centavos)}</strong>
              </div>
            )}
          </div>
        </div>

        {/* O prazo é calculado, não guardado — muda sozinho com o relógio. */}
        {pedido.arrependimento_ate && (
          <div style={{ background: '#fff', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', marginTop: '16px' }}>
            <h2 style={{ color: '#0E1B2C', fontSize: '15px', fontWeight: 'bold', margin: '0 0 8px' }}>
              Direito de arrependimento
            </h2>
            <p style={{ color: '#6B7280', fontSize: '13px', lineHeight: 1.6, margin: '0 0 12px' }}>
              Compras feitas fora da loja física podem ser desfeitas em até 7 dias,
              com devolução integral do que você pagou (CDC, art. 49).
              {' '}Neste pedido, o prazo vai até <strong>{data(pedido.arrependimento_ate)}</strong>.
            </p>

            {aviso && (
              <p style={{ background: '#FAF3E0', color: '#8A6E2F', padding: '10px 12px', borderRadius: '8px', fontSize: '13px', margin: '0 0 12px' }}>
                {aviso}
              </p>
            )}

            {pedido.pode_pedir_devolucao && (
              <button type="button" disabled={pedindo} onClick={pedirDevolucao} style={{
                padding: '10px 20px', background: '#0E1B2C', color: '#fff', border: 'none',
                borderRadius: '8px', fontSize: '14px', fontWeight: 'bold',
                cursor: pedindo ? 'default' : 'pointer',
              }}>{pedindo ? 'Enviando…' : 'Solicitar devolução'}</button>
            )}
          </div>
        )}

        {pedido.historico.length > 0 && (
          <div style={{ background: '#fff', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', marginTop: '16px' }}>
            <h2 style={{ color: '#0E1B2C', fontSize: '15px', fontWeight: 'bold', margin: '0 0 12px' }}>
              Histórico
            </h2>
            {pedido.historico.map((h, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '6px 0', borderBottom: i < pedido.historico.length - 1 ? '1px solid #F3F4F6' : 'none' }}>
                <span style={{ color: '#374151' }}>{h.rotulo}</span>
                <span style={{ color: '#9CA3AF' }}>{data(h.ocorrido_em)}</span>
              </div>
            ))}
          </div>
        )}

        <p style={{ textAlign: 'center', color: '#9CA3AF', fontSize: '12px', marginTop: '20px' }}>
          Guarde este link: é por ele que você acompanha o pedido.
        </p>
      </div>
    </div>
  )
}
