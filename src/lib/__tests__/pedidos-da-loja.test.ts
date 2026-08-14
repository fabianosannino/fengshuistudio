import { describe, expect, it } from 'vitest'
import {
  estadoDoPedido, pedidoRendeuReceita, rotuloDoEstado,
  prazoDeArrependimento, dentroDoPrazoDeArrependimento,
  type EventoDoPedido,
} from '../pedidos-da-loja'

function ev(evento: string, ocorrido_em?: string): EventoDoPedido {
  return { evento, ocorrido_em: ocorrido_em ?? '2026-08-13T12:00:00Z', origem: 'webhook_stripe' }
}

describe('estadoDoPedido', () => {
  it('sem evento nenhum o pedido é iniciado — leitura incompleta não afirma pagamento', () => {
    // Todo pedido nasce com o seu `iniciado`. Lista vazia é leitura parcial,
    // e `iniciado` é o palpite que não afirma nada sobre dinheiro.
    expect(estadoDoPedido([])).toBe('iniciado')
  })

  it('avança conforme os fatos chegam', () => {
    expect(estadoDoPedido([ev('iniciado')])).toBe('iniciado')
    expect(estadoDoPedido([ev('iniciado'), ev('pago')])).toBe('pago')
    expect(estadoDoPedido([ev('iniciado'), ev('pago'), ev('enviado')])).toBe('enviado')
  })

  it('ENTREGA FORA DE ORDEM: pago que chega depois do reembolso não desfaz o reembolso', () => {
    // É a propriedade que o desenho compra. Com coluna `status` sobrescrita,
    // o último write venceria e o pedido voltaria a parecer pago.
    const embaralhado = [ev('reembolsado'), ev('iniciado'), ev('pago')]
    expect(estadoDoPedido(embaralhado)).toBe('reembolsado')
  })

  it('contestação vence o pagamento, não importa a ordem de chegada', () => {
    expect(estadoDoPedido([ev('contestado'), ev('pago')])).toBe('contestado')
    expect(estadoDoPedido([ev('pago'), ev('contestado')])).toBe('contestado')
  })

  it('evento desconhecido não vira estado', () => {
    // Vocabulário novo chegando de um webhook futuro não pode promover o
    // pedido a um estado que o app não sabe interpretar.
    expect(estadoDoPedido([ev('pago'), ev('teletransportado')])).toBe('pago')
  })

  it('duplicata do mesmo evento não muda nada', () => {
    expect(estadoDoPedido([ev('pago'), ev('pago'), ev('pago')])).toBe('pago')
  })
})

describe('pedidoRendeuReceita', () => {
  it('conta o que entrou e não voltou', () => {
    expect(pedidoRendeuReceita([ev('iniciado'), ev('pago')])).toBe(true)
    expect(pedidoRendeuReceita([ev('iniciado'), ev('pago'), ev('entregue')])).toBe(true)
  })

  it('carrinho abandonado não é receita', () => {
    expect(pedidoRendeuReceita([ev('iniciado')])).toBe(false)
  })

  it('reembolsado e contestado saem da conta', () => {
    // Um painel que diz «R$ 400 de receita» somando uma venda estornada é
    // pior do que painel nenhum, porque parece confiável.
    expect(pedidoRendeuReceita([ev('pago'), ev('reembolsado')])).toBe(false)
    expect(pedidoRendeuReceita([ev('pago'), ev('contestado')])).toBe(false)
  })
})

describe('devolucao_solicitada', () => {
  it('supera o pago, porque é pendência do vendedor', () => {
    expect(estadoDoPedido([ev('pago'), ev('devolucao_solicitada')])).toBe('devolucao_solicitada')
  })

  it('mas o reembolso a resolve', () => {
    // Se ficasse acima, o pedido continuaria aparecendo como pendente depois
    // de o dinheiro já ter voltado.
    expect(estadoDoPedido([
      ev('pago'), ev('devolucao_solicitada'), ev('reembolsado'),
    ])).toBe('reembolsado')
  })

  it('pedido com devolução pedida ainda conta como receita — o dinheiro não voltou', () => {
    expect(pedidoRendeuReceita([ev('pago'), ev('devolucao_solicitada')])).toBe(true)
  })
})

describe('prazoDeArrependimento', () => {
  const PAGO = ev('pago', '2026-08-13T12:00:00Z')
  const ENTREGUE = ev('entregue', '2026-08-20T12:00:00Z')

  it('serviço conta do pagamento', () => {
    const prazo = prazoDeArrependimento('servico', [PAGO])
    expect(prazo?.toISOString()).toBe('2026-08-20T12:00:00.000Z')
  })

  it('bem físico conta da ENTREGA, não do pagamento', () => {
    // A diferença é jurídica: o consumidor recebe o produto sete dias depois
    // de pagar, e o prazo dele não pode já ter vencido quando a caixa chega.
    const prazo = prazoDeArrependimento('bem_proprio_fisico', [PAGO, ENTREGUE])
    expect(prazo?.toISOString()).toBe('2026-08-27T12:00:00.000Z')
  })

  it('bem físico sem entrega ainda não tem prazo correndo', () => {
    // `null` é ausência, não prazo vencido. Mostrar «vencido» tiraria do
    // comprador um direito que sequer começou.
    expect(prazoDeArrependimento('bem_proprio_fisico', [PAGO])).toBeNull()
  })

  it('bem DIGITAL conta do pagamento, não da entrega', () => {
    // O defeito que este teste guarda: com um `bem_proprio` só, o e-book caía
    // no ramo do físico e esperava um `entregue` que nunca vem. O prazo ficava
    // nulo para sempre e o comprador nunca conseguia pedir devolução — o
    // direito existiria no CDC e não existiria no app.
    const prazo = prazoDeArrependimento('bem_proprio_digital', [PAGO])
    expect(prazo?.toISOString()).toBe('2026-08-20T12:00:00.000Z')
  })

  it('bem digital baixado não reinicia o prazo', () => {
    // O download registra `entregue`, e isso não pode empurrar a data: no
    // digital o marco é o pagamento, tenha ele baixado hoje ou daqui a um mês.
    const prazo = prazoDeArrependimento('bem_proprio_digital', [PAGO, ENTREGUE])
    expect(prazo?.toISOString()).toBe('2026-08-20T12:00:00.000Z')
  })

  it('sem o marco não há prazo', () => {
    expect(prazoDeArrependimento('servico', [ev('iniciado')])).toBeNull()
  })

  it('data ilegível não vira prazo inventado', () => {
    expect(prazoDeArrependimento('servico', [ev('pago', 'não é data')])).toBeNull()
  })
})

describe('dentroDoPrazoDeArrependimento', () => {
  const PAGO = ev('pago', '2026-08-13T12:00:00Z')

  it('vale no sexto dia e não vale no oitavo', () => {
    expect(dentroDoPrazoDeArrependimento('servico', [PAGO], new Date('2026-08-19T12:00:00Z'))).toBe(true)
    expect(dentroDoPrazoDeArrependimento('servico', [PAGO], new Date('2026-08-21T12:00:00Z'))).toBe(false)
  })

  it('prazo não iniciado devolve false — mas não é a mesma coisa que vencido', () => {
    const eventos = [PAGO]
    expect(dentroDoPrazoDeArrependimento('bem_proprio_fisico', eventos)).toBe(false)
    expect(prazoDeArrependimento('bem_proprio_fisico', eventos)).toBeNull()
  })
})

describe('rotuloDoEstado', () => {
  it('fala português para o vendedor', () => {
    expect(rotuloDoEstado('iniciado')).toBe('Aguardando pagamento')
    expect(rotuloDoEstado('reembolsado')).toBe('Reembolsado')
  })
})
