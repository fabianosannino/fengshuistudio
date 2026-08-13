/**
 * Minhas vendas — a tela onde o consultor acompanha e estorna.
 *
 * ## Por que ela existe
 *
 * O consultor **não conseguia reembolsar**. O painel Express do Stripe não faz
 * estorno, e o painel da plataforma é da plataforma. A devolução integral em 7
 * dias que o CDC exige era, na prática, impossível para quem não fosse o dono
 * do FengShui Studio.
 *
 * ## O que ela mostra que o Stripe não mostra
 *
 * **O líquido de verdade.** Somado do razão (`pedido_lancamentos`), incluindo
 * a tarifa que não volta no reembolso. Num pedido de R$ 5 devolvido, o
 * consultor fica negativo em R$ 0,59 mesmo com a plataforma devolvendo a
 * comissão inteira — e ele precisa ver esse número **antes** de vender barato
 * com frete, não descobrir no extrato.
 *
 * A situação é derivada dos eventos a cada render. Não há coluna de status
 * para ficar velha (ADR 0030).
 */

'use client'

import { useCallback, useEffect, useState } from 'react'
import AppShell from '../components/AppShell'
import { supabase } from '../../src/lib/supabase'
import { logger } from '../../src/lib/logger'
import {
  estadoDoPedido, pedidoRendeuReceita, rotuloDoEstado, prazoDeArrependimento,
  dentroDoPrazoDeArrependimento,
  type EstadoDoPedido, type EventoDoPedido,
} from '../../src/lib/pedidos-da-loja'
import {
  liquidoDoConsultor, type Lancamento,
} from '../../src/lib/lancamentos-do-pedido'

interface PedidoDaLoja {
  id: string
  numero: string
  tipo: string
  criado_em: string
  total_centavos: number
  comprador_email: string | null
  pedido_itens: { nome: string }[]
  pedido_eventos: EventoDoPedido[]
  pedido_lancamentos: Lancamento[]
}

/** Cor por situação. Estorno e contestação não podem parecer venda boa. */
const CORES_DO_ESTADO: Record<EstadoDoPedido, { fundo: string; texto: string }> = {
  iniciado: { fundo: '#FAF3E0', texto: '#8A6E2F' },
  pago: { fundo: '#F0F6F3', texto: '#2E7D6B' },
  preparando: { fundo: '#F0F6F3', texto: '#2E7D6B' },
  enviado: { fundo: '#F0F6F3', texto: '#2E7D6B' },
  entregue: { fundo: '#F0F6F3', texto: '#2E7D6B' },
  devolucao_solicitada: { fundo: '#FAF3E0', texto: '#8A6E2F' },
  cancelado: { fundo: '#F3F4F6', texto: '#6B7280' },
  reembolsado: { fundo: '#FDECEC', texto: '#A33A3A' },
  contestado: { fundo: '#FDECEC', texto: '#A33A3A' },
  disputa_resolvida: { fundo: '#F3F4F6', texto: '#6B7280' },
}

/** Situações em que ainda faz sentido oferecer o botão de estornar. */
const ESTORNAVEIS: EstadoDoPedido[] = [
  'pago', 'preparando', 'enviado', 'entregue', 'devolucao_solicitada',
]

function reais(centavos: number): string {
  return (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default function MinhasVendas() {
  const [pedidos, setPedidos] = useState<PedidoDaLoja[]>([])
  const [carregando, setCarregando] = useState(true)
  const [confirmando, setConfirmando] = useState<string | null>(null)
  const [estornando, setEstornando] = useState<string | null>(null)
  const [aviso, setAviso] = useState('')

  const carregar = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setCarregando(false); return }

    const { data, error } = await supabase
      .from('pedidos')
      .select(`
        id, numero, tipo, criado_em, total_centavos, comprador_email,
        pedido_itens(nome),
        pedido_eventos(evento, ocorrido_em),
        pedido_lancamentos(tipo, valor_centavos, pagador, recebedor)
      `)
      .eq('vendedor_perfil_id', user.id)
      .order('criado_em', { ascending: false })
      .limit(100)

    if (error) {
      logger.error('Não foi possível carregar as vendas', {
        route: '/vendas', erro: error.message,
      })
      setAviso('Não foi possível carregar suas vendas. Tente recarregar a página.')
    }

    setPedidos(data ?? [])
    setCarregando(false)
  }, [])

  /*
   * Carga de dados no cliente, como nas demais telas do app. Sair deste padrão
   * é migrar para server component / camada de dados — o débito R1 da auditoria
   * de 2026-07-18 —, não reescrever este efeito. A supressão é por sítio, e
   * violação nova continua quebrando o CI.
   */
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { carregar() }, [carregar])

  async function estornar(pedidoId: string) {
    setEstornando(pedidoId)
    setAviso('')

    const res = await fetch('/api/pedidos/estorno', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pedido_id: pedidoId }),
    })

    const dados = await res.json().catch(() => ({}))
    setEstornando(null)
    setConfirmando(null)

    if (!res.ok) {
      setAviso(dados.error ?? 'Não foi possível concluir o estorno.')
      return
    }

    /*
     * «Solicitado», não «estornado». O `reembolsado` só existe quando o webhook
     * confirma que o dinheiro voltou — dizer aqui que já voltou seria afirmar
     * um fato a partir da intenção.
     */
    setAviso('Estorno solicitado. A situação muda para «Reembolsado» assim que o Stripe confirmar.')
    await carregar()
  }

  const pagos = pedidos.filter(p => pedidoRendeuReceita(p.pedido_eventos ?? []))
  const receita = pagos.reduce((s, p) => s + (p.total_centavos || 0), 0)
  const liquidoTotal = pedidos.reduce((s, p) => s + liquidoDoConsultor(p.pedido_lancamentos ?? []), 0)

  return (
    <AppShell currentPage="vendas">
      <div style={{ padding: '24px', maxWidth: '1100px', margin: '0 auto' }}>
        <h1 style={{ color: '#0E1B2C', fontSize: '24px', fontWeight: 'bold', margin: '0 0 4px' }}>
          Minhas vendas
        </h1>
        <p style={{ color: '#6B7280', fontSize: '14px', margin: '0 0 20px' }}>
          Pedidos da sua loja, o que já foi pago e o que foi devolvido.
        </p>

        {aviso && (
          <div style={{
            padding: '12px 16px', background: '#FAF3E0', color: '#8A6E2F',
            borderRadius: '8px', fontSize: '13px', marginBottom: '16px',
          }}>{aviso}</div>
        )}

        {carregando ? (
          <p style={{ color: '#6B7280' }}>Carregando…</p>
        ) : pedidos.length === 0 ? (
          <div style={{ background: '#fff', borderRadius: '12px', padding: '48px', textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
            <p style={{ color: '#6B7280', fontSize: '14px', margin: 0 }}>
              Nenhuma venda ainda. Compartilhe o link da sua loja para começar.
            </p>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 160px', padding: '14px', background: '#F0F6F3', borderRadius: '8px', textAlign: 'center' }}>
                <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#2E7D6B' }}>{reais(receita)}</div>
                <div style={{ fontSize: '11px', color: '#6B7280' }}>Vendido (sem devoluções)</div>
              </div>
              <div style={{ flex: '1 1 160px', padding: '14px', background: '#EAF4F1', borderRadius: '8px', textAlign: 'center' }}>
                <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#2E7D6B' }}>{pagos.length}</div>
                <div style={{ fontSize: '11px', color: '#6B7280' }}>Vendas pagas</div>
              </div>
              <div style={{ flex: '1 1 160px', padding: '14px', background: liquidoTotal < 0 ? '#FDECEC' : '#F0F6F3', borderRadius: '8px', textAlign: 'center' }}>
                <div style={{ fontSize: '20px', fontWeight: 'bold', color: liquidoTotal < 0 ? '#A33A3A' : '#2E7D6B' }}>
                  {reais(liquidoTotal)}
                </div>
                {/* O número que o Stripe não mostra junto: já descontadas as
                    tarifas que não voltam nas devoluções. */}
                <div style={{ fontSize: '11px', color: '#6B7280' }}>Seu líquido</div>
              </div>
            </div>

            <div style={{ background: '#fff', borderRadius: '12px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', minWidth: '760px' }}>
                <thead>
                  <tr>
                    {['Pedido', 'Data', 'Produto', 'Comprador', 'Valor', 'Seu líquido', 'Situação', ''].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '10px', borderBottom: '2px solid #E5E7EB', color: '#6B7280', fontSize: '11px', fontWeight: 'bold' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pedidos.map(pedido => {
                    const eventos = pedido.pedido_eventos ?? []
                    // Derivado a cada render: não há coluna a envelhecer.
                    const estado = estadoDoPedido(eventos)
                    const cores = CORES_DO_ESTADO[estado] ?? CORES_DO_ESTADO.iniciado
                    const liquido = liquidoDoConsultor(pedido.pedido_lancamentos ?? [])
                    const prazo = prazoDeArrependimento(pedido.tipo, eventos)
                    const noPrazo = dentroDoPrazoDeArrependimento(pedido.tipo, eventos)
                    const podeEstornar = ESTORNAVEIS.includes(estado)

                    return (
                      <tr key={pedido.id}>
                        <td style={{ padding: '10px', borderBottom: '1px solid #F3F4F6', color: '#6B7280', fontSize: '12px' }}>{pedido.numero}</td>
                        <td style={{ padding: '10px', borderBottom: '1px solid #F3F4F6', color: '#374151' }}>
                          {new Date(pedido.criado_em).toLocaleDateString('pt-BR')}
                        </td>
                        <td style={{ padding: '10px', borderBottom: '1px solid #F3F4F6', color: '#374151' }}>
                          {pedido.pedido_itens?.[0]?.nome ?? '—'}
                        </td>
                        <td style={{ padding: '10px', borderBottom: '1px solid #F3F4F6', color: '#6B7280', fontSize: '12px' }}>
                          {pedido.comprador_email ?? '—'}
                        </td>
                        <td style={{ padding: '10px', borderBottom: '1px solid #F3F4F6', color: '#0E1B2C', fontWeight: 'bold' }}>
                          {reais(pedido.total_centavos)}
                        </td>
                        <td style={{ padding: '10px', borderBottom: '1px solid #F3F4F6', fontWeight: 'bold', color: liquido < 0 ? '#A33A3A' : '#2E7D6B' }}>
                          {/* Razão vazio é «ainda não sei», não «zero»: o
                              lançamento chega pelo webhook. */}
                          {(pedido.pedido_lancamentos ?? []).length === 0 ? '—' : reais(liquido)}
                        </td>
                        <td style={{ padding: '10px', borderBottom: '1px solid #F3F4F6' }}>
                          <span style={{ padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: 'bold', background: cores.fundo, color: cores.texto }}>
                            {rotuloDoEstado(estado)}
                          </span>
                          {noPrazo && prazo && (
                            <div style={{ fontSize: '10px', color: '#8A6E2F', marginTop: '4px' }}>
                              Arrependimento até {prazo.toLocaleDateString('pt-BR')}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '10px', borderBottom: '1px solid #F3F4F6', textAlign: 'right' }}>
                          {podeEstornar && confirmando !== pedido.id && (
                            <button type="button" onClick={() => { setConfirmando(pedido.id); setAviso('') }} style={{
                              padding: '6px 12px', background: '#fff', color: '#A33A3A', border: '1px solid #E5B4B4',
                              borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer',
                            }}>Estornar</button>
                          )}
                          {confirmando === pedido.id && (
                            <div style={{ textAlign: 'left', background: '#FDECEC', padding: '10px', borderRadius: '8px', minWidth: '240px' }}>
                              <p style={{ margin: '0 0 6px', fontSize: '12px', color: '#0E1B2C' }}>
                                Devolver <strong>{reais(pedido.total_centavos)}</strong> ao comprador.
                              </p>
                              {/* O aviso que evita a surpresa no extrato. */}
                              <p style={{ margin: '0 0 10px', fontSize: '11px', color: '#8A6E2F', lineHeight: 1.4 }}>
                                A plataforma devolve a comissão junto. A tarifa do Stripe
                                não volta e fica com você.
                              </p>
                              <button type="button" disabled={estornando === pedido.id}
                                onClick={() => estornar(pedido.id)} style={{
                                  padding: '6px 12px', background: '#A33A3A', color: '#fff', border: 'none',
                                  borderRadius: '6px', fontSize: '12px', fontWeight: 'bold',
                                  cursor: estornando === pedido.id ? 'default' : 'pointer', marginRight: '8px',
                                }}>{estornando === pedido.id ? 'Estornando…' : 'Confirmar'}</button>
                              <button type="button" onClick={() => setConfirmando(null)} style={{
                                padding: '6px 12px', background: 'transparent', color: '#6B7280',
                                border: 'none', fontSize: '12px', cursor: 'pointer',
                              }}>Cancelar</button>
                            </div>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </AppShell>
  )
}
