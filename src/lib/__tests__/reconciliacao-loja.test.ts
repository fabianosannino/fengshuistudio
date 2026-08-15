import { describe, expect, it } from 'vitest'
import {
  compararVendas, resumirDivergenciasDaLoja, pedidosParaConferirNoStripe, ehCobrancaDaLoja,
  pedidosComRazaoIncompleto,
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

describe('pedidosParaConferirNoStripe', () => {
  /*
   * O ponto cego que existiu: `compararVendas` casa pelo `payment_intent`, e o
   * `pi_` é escrito pelo webhook. Pedido que perdeu o webhook não tem `pi_` e
   * não era alcançado por nenhum dos dois lados da comparação.
   *
   * Aconteceu em 14/08, na primeira venda de bem próprio: o comprador pagou
   * R$ 1,00 e o pedido ficou preso em `iniciado` — sem caminho de volta, porque
   * o Stripe não reenvia o que nunca teve entrega.
   */
  const preso = {
    id: 'p1', numero: 'P260814-E97D12', estado: 'iniciado',
    stripe_session_id: 'cs_live_1', stripe_payment_intent: null, total_centavos: 100,
  }

  it('pega o pedido preso em iniciado com sessão', () => {
    expect(pedidosParaConferirNoStripe([preso]).map(p => p.numero)).toEqual(['P260814-E97D12'])
  })

  it('ignora quem já tem payment_intent', () => {
    // Com `pi_`, a comparação normal alcança o pedido — perguntar de novo ao
    // Stripe seria chamada à toa, e são 50 por execução.
    expect(pedidosParaConferirNoStripe([
      { ...preso, stripe_payment_intent: 'pi_1' },
    ])).toHaveLength(0)
  })

  it('ignora quem já saiu de iniciado', () => {
    expect(pedidosParaConferirNoStripe([{ ...preso, estado: 'pago' }])).toHaveLength(0)
    expect(pedidosParaConferirNoStripe([{ ...preso, estado: 'cancelado' }])).toHaveLength(0)
  })

  it('ignora pedido sem sessão — não há o que perguntar', () => {
    expect(pedidosParaConferirNoStripe([{ ...preso, stripe_session_id: null }])).toHaveLength(0)
  })
})

describe('ehCobrancaDaLoja', () => {
  /*
   * A varredura passou a incluir a conta da plataforma, e na nossa conta cai
   * muito mais do que loja. Sem esta pergunta, a primeira execução acusou uma
   * cobrança de R$ 20,00 que não era venda nenhuma — e acusaria de novo todo
   * dia, para sempre. Relatório que acusa o que não é problema ensina a ser
   * ignorado, e aí o dia em que a acusação for real ela passa junto.
   */
  it('na nossa conta, exige o carimbo do pedido', () => {
    expect(ehCobrancaDaLoja({ pedidoIdNoMetadata: 'pedido-1' }, null)).toBe(true)
    expect(ehCobrancaDaLoja({ pedidoIdNoMetadata: null }, null)).toBe(false)
    expect(ehCobrancaDaLoja({}, null)).toBe(false)
  })

  it('na conta conectada, toda cobrança é da loja', () => {
    // Lá não há assinatura nem link de pagamento: o consultor não vende mais
    // nada por aquela conta. Exigir carimbo ali esconderia venda de verdade.
    expect(ehCobrancaDaLoja({ pedidoIdNoMetadata: null }, 'acct_1')).toBe(true)
  })
})

describe('pedidosComRazaoIncompleto', () => {
  /*
   * O webhook lê a tarifa da `balance_transaction` segundos depois do
   * pagamento, e às vezes o Stripe devolve a cobrança **sem** ela — não por
   * não existir, mas por consistência eventual. Medido em 15/08: a transação
   * do pedido `P260815-AF630A` existia com `fee: 43` três segundos antes da
   * leitura que não a encontrou. Duas de cinco vendas próprias caíram nisso.
   *
   * Esperar dentro do webhook atrasaria o registro do pagamento — o fato que
   * importa — numa corrida que ele não tem como vencer. Daí esta lista.
   */
  const pago = {
    estado: 'pago',
    stripe_payment_intent: 'pi_1',
    lancamentos: ['produto'],
  }

  it('lista o pedido pago sem a linha de tarifa', () => {
    expect(pedidosComRazaoIncompleto([pago])).toHaveLength(1)
  })

  it('ignora quem já tem a tarifa', () => {
    expect(pedidosComRazaoIncompleto([
      { ...pago, lancamentos: ['produto', 'tarifa_gateway'] },
    ])).toHaveLength(0)
  })

  it('ignora pedido sem `pi_` — não há o que perguntar ao Stripe', () => {
    // É caso da varredura de sessões, que roda antes e pode dar o `pi_` a ele.
    expect(pedidosComRazaoIncompleto([{ ...pago, stripe_payment_intent: null }])).toHaveLength(0)
  })

  it('ignora quem nunca foi pago', () => {
    expect(pedidosComRazaoIncompleto([{ ...pago, estado: 'iniciado' }])).toHaveLength(0)
    expect(pedidosComRazaoIncompleto([{ ...pago, estado: 'cancelado' }])).toHaveLength(0)
  })

  it('inclui o pedido reembolsado — a tarifa não volta', () => {
    // É justamente ela que faz o saldo do vendedor ficar negativo num pedido
    // devolvido, que é o número que `liquidoDoConsultor` existe para mostrar.
    expect(pedidosComRazaoIncompleto([{ ...pago, estado: 'reembolsado' }])).toHaveLength(1)
  })

  it('inclui os estados de pós-venda', () => {
    for (const estado of ['preparando', 'enviado', 'entregue', 'devolucao_solicitada']) {
      expect(pedidosComRazaoIncompleto([{ ...pago, estado }]), estado).toHaveLength(1)
    }
  })

  it('trata razão ausente como razão sem tarifa', () => {
    // Pedido pago que não tem lançamento nenhum: o razão está mais incompleto
    // ainda, e a tarifa continua devida.
    expect(pedidosComRazaoIncompleto([{ ...pago, lancamentos: [] }])).toHaveLength(1)
    expect(pedidosComRazaoIncompleto([{ ...pago, lancamentos: undefined }])).toHaveLength(1)
  })
})

describe('ehCobrancaDaLoja — o segundo sinal', () => {
  /*
   * O carimbo é escrito no Stripe no instante do checkout. Quem foi cobrado
   * antes de ele existir no código não o tem, e nunca vai ter — a cobrança
   * está fechada.
   *
   * `P260814-E97D12` é esse caso: venda real de bem próprio, paga e conferida,
   * com `payment_intent` gravado aqui e `metadata: {}` lá. A varredura a
   * descartava, o pedido sobrava sozinho, e o relatório acusava «pedido pago
   * sem cobrança correspondente» em toda execução.
   */

  it('cobrança sem carimbo, mas com pedido nosso, é da loja', () => {
    expect(ehCobrancaDaLoja({
      pedidoIdNoMetadata: null,
      temPedidoNoBanco: true,
    }, null)).toBe(true)
  })

  it('sem carimbo e sem pedido continua de fora', () => {
    // Assinatura, link de pagamento e cobrança avulsa caem na nossa conta e
    // não são loja. Sem nenhum dos dois sinais, acusá-las encheria o
    // relatório do que não é problema — que é como ele deixa de ser lido.
    expect(ehCobrancaDaLoja({
      pedidoIdNoMetadata: null,
      temPedidoNoBanco: false,
    }, null)).toBe(false)
  })

  it('o carimbo sozinho continua bastando', () => {
    // O caminho normal, de toda venda a partir de 14/08: o sinal chega pelo
    // Stripe antes de existir pedido pago do nosso lado.
    expect(ehCobrancaDaLoja({
      pedidoIdNoMetadata: 'pedido-1',
      temPedidoNoBanco: false,
    }, null)).toBe(true)
  })

  it('na conta conectada nenhum dos dois é exigido', () => {
    expect(ehCobrancaDaLoja({}, 'acct_1')).toBe(true)
  })
})
