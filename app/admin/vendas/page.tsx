'use client'

/**
 * Vendas da plataforma — as nossas, e o estorno delas.
 *
 * ## Por que uma tela separada de `/vendas`
 *
 * Aquela lista as vendas **do consultor logado**, filtrando por
 * `vendedor_perfil_id = user.id`. Venda de bem próprio não tem vendedor
 * pessoa: `vendedor_perfil_id` é nulo e o vendedor é a plataforma. Ela nunca
 * apareceria ali, por mais admin que fosse quem abrisse.
 *
 * ## O que esta tela conserta
 *
 * Até 16/08 uma venda de bem próprio **não podia ser desfeita pelo sistema**.
 * A rota de estorno recusava (exigia `stripe_account_id`, que é nulo por
 * desenho nessa venda), e não havia tela que a chamasse.
 *
 * Enquanto isso a página do comprador oferecia «Solicitar devolução» e o
 * e-mail de confirmação prometia os 7 dias do CDC, art. 49. O direito era
 * anunciado em dois lugares e não existia em nenhum — e o único contorno era
 * estornar à mão pelo painel do Stripe, que um comprador não tem.
 */

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../../src/lib/supabase'
import { logger } from '../../../src/lib/logger'
import AppShell from '../../components/AppShell'
import ConfirmModal from '../../components/ConfirmModal'
import { estadoDoPedido, type EstadoDoPedido } from '../../../src/lib/pedidos-da-loja'
import { ESTORNAVEIS } from '../../../src/lib/estorno-da-venda'

interface PedidoDaPlataforma {
  id: string
  numero: string
  criado_em: string
  total_centavos: number
  comprador_email: string | null
  pedido_itens?: { nome: string }[]
  pedido_eventos?: { evento: string; ocorrido_em: string }[]
}

const CORES: Record<string, { fundo: string; texto: string }> = {
  pago: { fundo: '#E8F3EF', texto: '#2E7D6B' },
  entregue: { fundo: '#E8F3EF', texto: '#2E7D6B' },
  devolucao_solicitada: { fundo: '#FAF3E0', texto: '#8A6E2F' },
  reembolsado: { fundo: '#F3F4F6', texto: '#6B7280' },
  iniciado: { fundo: '#F3F4F6', texto: '#6B7280' },
  cancelado: { fundo: '#F3F4F6', texto: '#6B7280' },
}

function reais(centavos: number): string {
  return (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default function VendasDaPlataforma() {
  const [pedidos, setPedidos] = useState<PedidoDaPlataforma[]>([])
  const [carregando, setCarregando] = useState(true)
  const [confirmando, setConfirmando] = useState<PedidoDaPlataforma | null>(null)
  const [estornando, setEstornando] = useState<string | null>(null)
  const [aviso, setAviso] = useState('')

  const carregar = useCallback(async () => {
    /*
     * Leitura direta, como no resto do app. A policy de `pedidos` devolve a
     * linha para o dono ou para admin — quem não for admin não vê nada aqui, e
     * a página nem aparece no menu.
     */
    const { data, error } = await supabase
      .from('pedidos')
      .select(`
        id, numero, criado_em, total_centavos, comprador_email,
        pedido_itens(nome),
        pedido_eventos(evento, ocorrido_em)
      `)
      .eq('vendedor_tipo', 'plataforma')
      .order('criado_em', { ascending: false })
      .limit(100)

    if (error) {
      logger.error('Não foi possível carregar as vendas da plataforma', {
        route: '/admin/vendas', erro: error.message,
      })
      setAviso('Não foi possível carregar as vendas. Tente recarregar a página.')
    }

    setPedidos(data ?? [])
    setCarregando(false)
  }, [])

  // Mesmo padrão e mesma dívida das outras telas — ver a nota em `/vendas`.
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
     * um fato a partir da intenção, o mesmo erro de marcar «pago» na tela de
     * sucesso do checkout.
     */
    setAviso('Estorno solicitado. A situação muda para «Reembolsado» assim que o Stripe confirmar.')
    await carregar()
  }

  return (
    <AppShell currentPage="admin/vendas">
      <div style={{ marginBottom: '24px' }}>
        <p style={{ color: '#2E7D6B', fontSize: '12px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 8px 0' }}>Administração</p>
        <h1 style={{ color: '#0E1B2C', fontSize: '30px', fontWeight: 600, margin: '0 0 6px 0' }}>
          Vendas da plataforma
        </h1>
        <p style={{ color: '#6B7280', fontSize: '15px', margin: 0 }}>
          O que vendemos direto, sem consultor no meio. É aqui que se cumpre o
          direito de arrependimento do comprador de bem digital.
        </p>
      </div>

      {aviso && (
        <p style={{ background: '#F3F4F6', color: '#374151', padding: '12px 14px', borderRadius: '8px', fontSize: '14px', marginBottom: '16px' }}>
          {aviso}
        </p>
      )}

      {carregando ? (
        <p style={{ color: '#9CA3AF' }}>Carregando…</p>
      ) : pedidos.length === 0 ? (
        <p style={{ color: '#9CA3AF' }}>Nenhuma venda da plataforma ainda.</p>
      ) : (
        <div style={{ display: 'grid', gap: '12px' }}>
          {pedidos.map(pedido => {
            const estado = estadoDoPedido(pedido.pedido_eventos ?? []) as EstadoDoPedido
            const cor = CORES[estado] ?? { fundo: '#F3F4F6', texto: '#6B7280' }
            const podeEstornar = ESTORNAVEIS.has(estado)

            return (
              <div key={pedido.id} style={{
                background: '#fff', border: '1px solid rgba(14,27,44,0.06)', borderRadius: '12px',
                padding: '16px', display: 'flex', flexWrap: 'wrap', gap: '12px',
                alignItems: 'center', justifyContent: 'space-between',
              }}>
                <div>
                  <strong style={{ color: '#0E1B2C', fontSize: '15px' }}>{pedido.numero}</strong>
                  <div style={{ color: '#6B7280', fontSize: '13px', marginTop: '2px' }}>
                    {(pedido.pedido_itens ?? []).map(i => i.nome).join(', ') || '—'}
                  </div>
                  <div style={{ color: '#9CA3AF', fontSize: '12px', marginTop: '2px' }}>
                    {pedido.comprador_email ?? 'sem e-mail'} ·{' '}
                    {new Date(pedido.criado_em).toLocaleDateString('pt-BR')}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ background: cor.fundo, color: cor.texto, padding: '4px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: 'bold' }}>
                    {estado}
                  </span>
                  <strong style={{ color: '#0E1B2C', fontSize: '16px' }}>
                    {reais(pedido.total_centavos)}
                  </strong>
                  {podeEstornar && (
                    <button type="button"
                      onClick={() => setConfirmando(pedido)}
                      disabled={estornando === pedido.id}
                      style={{
                        padding: '8px 16px', background: '#fff', color: '#A33A3A',
                        border: '1px solid #E5E7EB', borderRadius: '8px',
                        fontSize: '13px', fontWeight: 'bold',
                        cursor: estornando === pedido.id ? 'default' : 'pointer',
                      }}>
                      {estornando === pedido.id ? 'Enviando…' : 'Estornar'}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {confirmando && (
        <ConfirmModal
          open
          variant="danger"
          title="Estornar esta venda?"
          message={
            `Devolver ${reais(confirmando.total_centavos)} ao comprador do pedido ` +
            `${confirmando.numero}. A tarifa do gateway não volta — o prejuízo da ` +
            `devolução é dela. A ação não pode ser desfeita.`
          }
          confirmLabel="Estornar"
          onConfirm={() => estornar(confirmando.id)}
          onCancel={() => setConfirmando(null)}
        />
      )}
    </AppShell>
  )
}
