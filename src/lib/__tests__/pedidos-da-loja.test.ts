import { describe, expect, it } from 'vitest'
import {
  estadoDoPedido, pedidoRendeuReceita, rotuloDoEstado, type EventoDoPedido,
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

describe('rotuloDoEstado', () => {
  it('fala português para o vendedor', () => {
    expect(rotuloDoEstado('iniciado')).toBe('Aguardando pagamento')
    expect(rotuloDoEstado('reembolsado')).toBe('Reembolsado')
  })
})
