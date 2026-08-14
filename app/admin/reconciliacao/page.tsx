/**
 * Reconciliação da loja — conferir e corrigir na mão.
 *
 * ## Por que esta tela precisa existir
 *
 * O cron diário do Vercel faz **`GET`**, e o `GET` desta rota é de propósito
 * só relatório: ele não escreve nada. Quem corrige é o `POST` — que, até aqui,
 * não tinha de onde ser chamado. Na prática a reconciliação detectava todo dia
 * e nunca consertava nada, e a única forma de acionar o reparo seria montar um
 * `POST` autenticado à mão.
 *
 * Uma capacidade que existe e não tem por onde ser usada é o mesmo que não
 * existir — só que pior, porque parece coberta.
 */

'use client'

import { useState } from 'react'
import AppShell from '../../components/AppShell'
import { RefreshCw, Wrench } from 'lucide-react'

const ROTA = '/api/admin/reconciliacao-loja'

interface Divergencia {
  tipo: string
  numero?: string
  paymentIntentId: string
  noStripe: string | number | null
  noBanco: string | number | null
  corrigivel: boolean
}

interface Relatorio {
  aplicado: boolean
  contas: number
  cobrancas_no_stripe: number
  pedidos_no_banco: number
  leitura_truncada: boolean
  divergencias: Divergencia[]
  resumo: Record<string, number>
  corrigidas?: Divergencia[]
  sessoes?: { verificadas: number; confirmados: string[] }
}

const ROTULOS: Record<string, string> = {
  venda_ausente_no_banco: 'Cobrada no Stripe, sem pedido aqui',
  pagamento_nao_registrado: 'Paga no Stripe, sem «pago» aqui',
  reembolso_nao_registrado: 'Devolvida no Stripe, ainda paga aqui',
  valor_diferente: 'Valores diferentes',
  pedido_sem_cobranca: 'Pedido pago sem cobrança correspondente',
}

export default function AdminReconciliacao() {
  const [relatorio, setRelatorio] = useState<Relatorio | null>(null)
  const [rodando, setRodando] = useState<'ler' | 'aplicar' | null>(null)
  const [erro, setErro] = useState('')

  async function rodar(metodo: 'GET' | 'POST') {
    setRodando(metodo === 'GET' ? 'ler' : 'aplicar')
    setErro('')
    try {
      const res = await fetch(ROTA, { method: metodo })
      const dados = await res.json().catch(() => ({}))
      if (!res.ok) { setErro(dados.error ?? 'Não foi possível executar.'); return }
      setRelatorio(dados)
    } catch {
      setErro('Não foi possível executar.')
    } finally {
      setRodando(null)
    }
  }

  const cartao = {
    background: '#fff', borderRadius: '12px', padding: '20px',
    boxShadow: '0 1px 4px rgba(0,0,0,0.08)', marginBottom: '16px',
  }
  const botao = (primario: boolean) => ({
    display: 'flex', alignItems: 'center', gap: '7px',
    padding: '10px 18px', borderRadius: '8px', fontSize: '14px', fontWeight: 'bold',
    border: primario ? 'none' : '1px solid #E5E7EB',
    background: primario ? '#0E1B2C' : '#fff',
    color: primario ? '#fff' : '#0E1B2C',
    cursor: rodando ? 'default' : 'pointer',
    opacity: rodando ? 0.6 : 1,
  })

  return (
    <AppShell currentPage="admin/reconciliacao">
      <div style={{ maxWidth: '820px' }}>
        <h1 style={{ color: '#0E1B2C', fontSize: '22px', fontWeight: 'bold', margin: '0 0 4px' }}>
          Reconciliação da loja
        </h1>
        <p style={{ color: '#6B7280', fontSize: '14px', margin: '0 0 20px', lineHeight: 1.6 }}>
          Compara o que o Stripe cobrou com o que este banco registrou. Webhook
          é entrega best-effort: quando um não chega, a venda existe lá e não
          existe aqui — e é isto que traz o pedido de volta.
        </p>

        <div style={{ display: 'flex', gap: '10px', marginBottom: '18px', flexWrap: 'wrap' }}>
          <button type="button" disabled={Boolean(rodando)} onClick={() => rodar('GET')} style={botao(false)}>
            <RefreshCw size={15} /> {rodando === 'ler' ? 'Conferindo…' : 'Conferir'}
          </button>
          <button type="button" disabled={Boolean(rodando)} onClick={() => rodar('POST')} style={botao(true)}>
            <Wrench size={15} /> {rodando === 'aplicar' ? 'Corrigindo…' : 'Corrigir o que dá'}
          </button>
        </div>

        {erro && (
          <p style={{ background: '#FDECEC', color: '#A33A3A', padding: '10px 12px', borderRadius: '8px', fontSize: '13px' }}>
            {erro}
          </p>
        )}

        {relatorio && (
          <>
            <div style={cartao}>
              <p style={{ color: '#374151', fontSize: '14px', margin: 0, lineHeight: 1.8 }}>
                {relatorio.cobrancas_no_stripe} cobranças no Stripe ·{' '}
                {relatorio.pedidos_no_banco} pedidos aqui ·{' '}
                {relatorio.contas} contas conectadas
                {relatorio.leitura_truncada && (
                  <><br /><strong style={{ color: '#8A6E2F' }}>
                    Leitura truncada: há mais cobranças do que o teto por execução.
                  </strong></>
                )}
                {relatorio.sessoes && (
                  <><br />{relatorio.sessoes.verificadas} sessões presas conferidas
                  {relatorio.sessoes.confirmados.length > 0 && (
                    <strong style={{ color: '#2E7D6B' }}>
                      {' '}— confirmadas: {relatorio.sessoes.confirmados.join(', ')}
                    </strong>
                  )}</>
                )}
                {relatorio.corrigidas && (
                  <><br />{relatorio.corrigidas.length} divergências corrigidas por acréscimo de evento.</>
                )}
              </p>
            </div>

            <div style={cartao}>
              <h2 style={{ color: '#0E1B2C', fontSize: '16px', fontWeight: 'bold', margin: '0 0 12px' }}>
                Divergências
              </h2>
              {relatorio.divergencias.length === 0 ? (
                <p style={{ color: '#2E7D6B', fontSize: '14px', margin: 0 }}>
                  Os dois lados contam a mesma coisa.
                </p>
              ) : relatorio.divergencias.map((d, i) => (
                <div key={i} style={{ padding: '10px 0', borderBottom: i < relatorio.divergencias.length - 1 ? '1px solid #F3F4F6' : 'none' }}>
                  <strong style={{ color: '#0E1B2C', fontSize: '14px' }}>
                    {ROTULOS[d.tipo] ?? d.tipo}
                  </strong>
                  <p style={{ color: '#6B7280', fontSize: '13px', margin: '4px 0 0' }}>
                    {d.numero ? `${d.numero} · ` : ''}{d.paymentIntentId}
                    {' · '}Stripe: {String(d.noStripe ?? '—')} · aqui: {String(d.noBanco ?? '—')}
                    {!d.corrigivel && ' · exige investigação humana'}
                  </p>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </AppShell>
  )
}
