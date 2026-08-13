/**
 * Minhas compras — o que o usuário logado comprou na loja.
 *
 * ## Por que é uma lista, e o detalhe mora em outro lugar
 *
 * O detalhe e a devolução já existem em `/pedido/[token]`, feitos para o
 * comprador **sem conta**. Reimplementá-los aqui daria duas telas dizendo o
 * que se pode fazer com um pedido — e, na primeira mudança de regra, elas
 * discordariam. Esta lista leva para lá.
 *
 * ## Quem aparece aqui
 *
 * Pedidos cujo `comprador_email` bate com o e-mail **confirmado** da sessão. A
 * prova é a autenticação, não o endereço digitado — ver a nota na rota.
 */

'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import AppShell from '../components/AppShell'

interface Compra {
  numero: string
  criado_em: string
  situacao: string
  rotulo: string
  total_centavos: number
  devolvido_centavos: number
  itens: { nome: string; quantidade: number }[]
  arrependimento_ate: string | null
  pode_pedir_devolucao: boolean
  token: string
}

const CORES: Record<string, { fundo: string; texto: string }> = {
  iniciado: { fundo: '#FAF3E0', texto: '#8A6E2F' },
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

export default function MinhasCompras() {
  const [compras, setCompras] = useState<Compra[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')

  const carregar = useCallback(async () => {
    const res = await fetch('/api/pedidos/minhas-compras')
    const dados = await res.json().catch(() => ({}))
    if (!res.ok) setErro(dados.error ?? 'Não foi possível carregar suas compras.')
    else setCompras(dados.compras ?? [])
    setCarregando(false)
  }, [])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { carregar() }, [carregar])

  return (
    <AppShell currentPage="minhas-compras">
      <div style={{ padding: '24px', maxWidth: '900px', margin: '0 auto' }}>
        <h1 style={{ color: '#0E1B2C', fontSize: '24px', fontWeight: 'bold', margin: '0 0 4px' }}>
          Minhas compras
        </h1>
        <p style={{ color: '#6B7280', fontSize: '14px', margin: '0 0 20px' }}>
          O que você comprou de consultores e na loja.
        </p>

        {erro && (
          <div style={{ padding: '12px 16px', background: '#FDECEC', color: '#A33A3A', borderRadius: '8px', fontSize: '13px', marginBottom: '16px' }}>
            {erro}
          </div>
        )}

        {carregando ? (
          <p style={{ color: '#6B7280' }}>Carregando…</p>
        ) : compras.length === 0 ? (
          <div style={{ background: '#fff', borderRadius: '12px', padding: '48px', textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
            <p style={{ color: '#6B7280', fontSize: '14px', margin: '0 0 8px' }}>
              Você ainda não tem compras por aqui.
            </p>
            <p style={{ color: '#9CA3AF', fontSize: '13px', margin: 0 }}>
              Compras aparecem quando você usa o mesmo e-mail desta conta no pagamento.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {compras.map(compra => {
              const cores = CORES[compra.situacao] ?? { fundo: '#F3F4F6', texto: '#6B7280' }
              return (
                <Link key={compra.numero} href={`/pedido/${compra.token}`} style={{ textDecoration: 'none' }}>
                  <div style={{ background: '#fff', borderRadius: '12px', padding: '18px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', border: '1px solid #E5E7EB' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
                      <div>
                        <div style={{ color: '#0E1B2C', fontSize: '15px', fontWeight: 'bold' }}>
                          {compra.itens[0]?.nome ?? 'Pedido'}
                          {compra.itens.length > 1 && ` +${compra.itens.length - 1}`}
                        </div>
                        <div style={{ color: '#9CA3AF', fontSize: '12px', marginTop: '2px' }}>
                          {compra.numero} · {data(compra.criado_em)}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ color: '#0E1B2C', fontSize: '16px', fontWeight: 'bold' }}>
                          {reais(compra.total_centavos)}
                        </div>
                        <span style={{ display: 'inline-block', marginTop: '4px', padding: '2px 10px', borderRadius: '10px', fontSize: '11px', fontWeight: 'bold', background: cores.fundo, color: cores.texto }}>
                          {compra.rotulo}
                        </span>
                      </div>
                    </div>

                    {compra.devolvido_centavos > 0 && (
                      <div style={{ marginTop: '10px', fontSize: '12px', color: '#A33A3A' }}>
                        Devolvido a você: <strong>{reais(compra.devolvido_centavos)}</strong>
                      </div>
                    )}

                    {/* O prazo é o dado que mais evita atrito: o comprador
                        precisa saber até quando pode desistir sem perguntar. */}
                    {compra.pode_pedir_devolucao && compra.arrependimento_ate && (
                      <div style={{ marginTop: '10px', padding: '8px 10px', background: '#FAF3E0', borderRadius: '6px', fontSize: '12px', color: '#8A6E2F' }}>
                        Você pode desistir até {data(compra.arrependimento_ate)} — abra para solicitar.
                      </div>
                    )}
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </AppShell>
  )
}
