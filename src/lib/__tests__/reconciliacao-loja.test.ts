import { describe, expect, it } from 'vitest'
import {
  compararVendas, resumirDivergenciasDaLoja,
  type CobrancaNoStripe, type PedidoNoBanco,
} from '../reconciliacao-loja'

function cobranca(over: Partial<CobrancaNoStripe> = {}): CobrancaNoStripe {
  return {
    paymentIntentId: 'pi_1',
    contaConectada: 'acct_1',
    valorCentavos: 500,
    reembolsadoCentavos: 0,
    criadoEm: '2026-08-13T15:45:00Z',
    compradorEmail: 'comprador@exemplo.com',
    ...over,
  }
}

function pedido(over: Partial<PedidoNoBanco> = {}): PedidoNoBanco {
  return {
    id: 'pedido-1',
    numero: 'P260813-F0FD73',
    stripe_payment_intent: 'pi_1',
    total_centavos: 500,
    estado: 'pago',
    ...over,
  }
}

describe('compararVendas', () => {
  it('sem divergência quando os dois lados contam a mesma coisa', () => {
    expect(compararVendas([cobranca()], [pedido()])).toEqual([])
  })

  it('O PIOR CASO: cobrado no Stripe e sem pedido aqui', () => {
    // É o defeito de origem da loja, agora detectável em vez de invisível.
    const [d] = compararVendas([cobranca()], [])
    expect(d.tipo).toBe('venda_ausente_no_banco')
    expect(d.paymentIntentId).toBe('pi_1')
    expect(d.corrigivel).toBe(true)
  })

  it('pedido existe mas nunca recebeu o `pago` — webhook perdido', () => {
    const [d] = compararVendas([cobranca()], [pedido({ estado: 'iniciado' })])
    expect(d.tipo).toBe('pagamento_nao_registrado')
    expect(d.noBanco).toBe('iniciado')
    expect(d.corrigivel).toBe(true)
  })

  it('reembolsado no Stripe e ainda pago aqui', () => {
    const divergencias = compararVendas(
      [cobranca({ reembolsadoCentavos: 500 })],
      [pedido({ estado: 'pago' })]
    )
    expect(divergencias.map(d => d.tipo)).toContain('reembolso_nao_registrado')
  })

  it('reembolso já registrado não vira divergência', () => {
    const divergencias = compararVendas(
      [cobranca({ reembolsadoCentavos: 500 })],
      [pedido({ estado: 'reembolsado' })]
    )
    expect(divergencias).toEqual([])
  })

  it('valores diferentes para a mesma cobrança', () => {
    const divergencias = compararVendas([cobranca({ valorCentavos: 700 })], [pedido()])
    const valor = divergencias.find(d => d.tipo === 'valor_diferente')
    expect(valor?.noStripe).toBe(700)
    expect(valor?.noBanco).toBe(500)
  })

  it('CARRINHO ABANDONADO NÃO É DIVERGÊNCIA', () => {
    // Pedido `iniciado` sem cobrança é normal — o comprador desistiu.
    // Acusá-lo encheria o relatório de ruído que esconderia o que importa.
    expect(compararVendas([], [pedido({ estado: 'iniciado' })])).toEqual([])
  })

  it('mas pedido PAGO sem cobrança no Stripe é acusado, e não é corrigível', () => {
    // Não é dado velho: é dado que não deveria existir. Corrigir sem entender
    // de onde veio apagaria a evidência.
    const [d] = compararVendas([], [pedido({ estado: 'pago' })])
    expect(d.tipo).toBe('pedido_sem_cobranca')
    expect(d.corrigivel).toBe(false)
  })

  it('pedido sem payment_intent é ignorado dos dois lados', () => {
    expect(compararVendas([], [pedido({ stripe_payment_intent: null, estado: 'pago' })])).toEqual([])
  })

  it('a chave é o payment_intent, não a sessão', () => {
    // Sessão expira e some; o `pi_` sobrevive à cobrança inteira, inclusive ao
    // reembolso.
    const divergencias = compararVendas(
      [cobranca({ paymentIntentId: 'pi_outro' })],
      [pedido({ stripe_payment_intent: 'pi_1' })]
    )
    expect(divergencias.map(d => d.tipo).sort()).toEqual(
      ['pedido_sem_cobranca', 'venda_ausente_no_banco']
    )
  })
})

describe('resumirDivergenciasDaLoja', () => {
  it('conta por tipo para caber numa linha de log', () => {
    const resumo = resumirDivergenciasDaLoja(compararVendas(
      [cobranca(), cobranca({ paymentIntentId: 'pi_2' })],
      []
    ))
    expect(resumo).toEqual({ venda_ausente_no_banco: 2 })
  })
})
