import { describe, expect, it } from 'vitest'
import {
  pedidoParaOComprador, mascararEmail, devolvidoAoComprador, tokenNoPrazo,
  type PedidoBruto,
} from '../pedido-publico'

const AGORA = new Date('2026-08-15T12:00:00Z')

function pedido(over: Partial<PedidoBruto> = {}): PedidoBruto {
  return {
    numero: 'P260813-F0FD73',
    tipo: 'servico',
    criado_em: '2026-08-13T15:45:00Z',
    total_centavos: 500,
    comprador_email: 'fsannino@gmail.com',
    pedido_itens: [{ nome: 'Espelho Teste', quantidade: 1, preco_unitario_centavos: 500 }],
    pedido_eventos: [
      { evento: 'iniciado', ocorrido_em: '2026-08-13T15:45:15Z' },
      { evento: 'pago', ocorrido_em: '2026-08-13T15:45:55Z' },
    ],
    pedido_lancamentos: [],
    ...over,
  }
}

describe('pedidoParaOComprador', () => {
  it('NÃO expõe o que é do vendedor', () => {
    // Lista branca, não lista negra: campo novo em `pedidos` não vaza sozinho.
    // A comissão da plataforma e o líquido do consultor são negócio do
    // vendedor, e o comprador não tem por que vê-los.
    const visao = pedidoParaOComprador(pedido({
      pedido_lancamentos: [
        { tipo: 'produto', valor_centavos: 500, pagador: 'comprador', recebedor: 'consultor' },
        { tipo: 'comissao_plataforma', valor_centavos: 50, pagador: 'consultor', recebedor: 'plataforma' },
        { tipo: 'tarifa_gateway', valor_centavos: 59, pagador: 'consultor', recebedor: 'gateway' },
      ],
    }), AGORA)

    const serializado = JSON.stringify(visao)
    expect(serializado).not.toContain('comissao')
    expect(serializado).not.toContain('consultor')
    expect(serializado).not.toContain('gateway')
    expect(visao).not.toHaveProperty('id')
    expect(visao).not.toHaveProperty('vendedor_perfil_id')
  })

  it('mostra o que voltou para o comprador, e só isso', () => {
    const visao = pedidoParaOComprador(pedido({
      pedido_eventos: [
        { evento: 'pago', ocorrido_em: '2026-08-13T15:45:55Z' },
        { evento: 'reembolsado', ocorrido_em: '2026-08-13T16:00:47Z' },
      ],
      pedido_lancamentos: [
        { tipo: 'produto', valor_centavos: 500, pagador: 'comprador', recebedor: 'consultor' },
        { tipo: 'reembolso', valor_centavos: 500, pagador: 'consultor', recebedor: 'comprador' },
        { tipo: 'estorno_comissao', valor_centavos: 50, pagador: 'plataforma', recebedor: 'consultor' },
      ],
    }), AGORA)

    // 500 voltaram para ele. Os 50 de estorno de comissão foram entre
    // plataforma e consultor — não são dele e não aparecem.
    expect(visao.devolvido_centavos).toBe(500)
    expect(visao.situacao).toBe('reembolsado')
  })

  it('esconde o `iniciado` — para o comprador a compra começou no pagamento', () => {
    const visao = pedidoParaOComprador(pedido(), AGORA)
    expect(visao.historico.map(h => h.evento)).toEqual(['pago'])
  })

  it('calcula o prazo de arrependimento em vez de guardá-lo', () => {
    const visao = pedidoParaOComprador(pedido(), AGORA)
    expect(visao.arrependimento_ate).toBe('2026-08-20T15:45:55.000Z')
    expect(visao.pode_pedir_devolucao).toBe(true)
  })

  it('fora do prazo não oferece devolução', () => {
    const visao = pedidoParaOComprador(pedido(), new Date('2026-08-25T12:00:00Z'))
    expect(visao.pode_pedir_devolucao).toBe(false)
  })

  it('não deixa pedir duas vezes', () => {
    const visao = pedidoParaOComprador(pedido({
      pedido_eventos: [
        { evento: 'pago', ocorrido_em: '2026-08-13T15:45:55Z' },
        { evento: 'devolucao_solicitada', ocorrido_em: '2026-08-14T10:00:00Z' },
      ],
    }), AGORA)
    expect(visao.pode_pedir_devolucao).toBe(false)
  })

  it('já reembolsado não oferece devolução', () => {
    const visao = pedidoParaOComprador(pedido({
      pedido_eventos: [
        { evento: 'pago', ocorrido_em: '2026-08-13T15:45:55Z' },
        { evento: 'reembolsado', ocorrido_em: '2026-08-14T10:00:00Z' },
      ],
    }), AGORA)
    expect(visao.pode_pedir_devolucao).toBe(false)
  })
})

describe('mascararEmail', () => {
  it('deixa reconhecer sem reimprimir', () => {
    expect(mascararEmail('fsannino@gmail.com')).toBe('fs••••••@gmail.com')
  })

  it('ausência continua ausência', () => {
    expect(mascararEmail(null)).toBeNull()
    expect(mascararEmail('sem arroba')).toBeNull()
  })
})

describe('devolvidoAoComprador', () => {
  it('soma só o que foi para ele', () => {
    expect(devolvidoAoComprador([
      { tipo: 'reembolso', valor_centavos: 300, pagador: 'consultor', recebedor: 'comprador' },
      { tipo: 'estorno_comissao', valor_centavos: 50, pagador: 'plataforma', recebedor: 'consultor' },
    ])).toBe(300)
  })

  it('sem devolução é zero', () => {
    expect(devolvidoAoComprador([])).toBe(0)
  })
})

describe('tokenNoPrazo', () => {
  it('vale antes do prazo e não vale depois', () => {
    expect(tokenNoPrazo('2026-08-20T00:00:00Z', AGORA)).toBe(true)
    expect(tokenNoPrazo('2026-08-01T00:00:00Z', AGORA)).toBe(false)
  })

  it('data ilegível ou ausente RECUSA — aqui o erro barato é fechar', () => {
    // Ao contrário da concessão de plano, onde manter o acesso era o erro
    // barato. Aqui o risco é abrir um pedido para quem não deveria ver.
    expect(tokenNoPrazo(null, AGORA)).toBe(false)
    expect(tokenNoPrazo('não é data', AGORA)).toBe(false)
  })
})

describe('itens baixáveis (fase 2)', () => {
  const DIGITAL: Partial<PedidoBruto> = {
    tipo: 'bem_proprio_digital',
    pedido_itens: [{
      id: 'item-1', nome: 'Guia do Ba Guá', quantidade: 1,
      preco_unitario_centavos: 2990, produto_id: 'produto-1',
    }],
  }

  it('pedido digital pago dá o item como baixável', () => {
    const visao = pedidoParaOComprador(pedido(DIGITAL), AGORA)
    expect(visao.itens[0].baixavel).toBe(true)
    expect(visao.itens[0].id).toBe('item-1')
  })

  it('serviço nunca é baixável, mesmo pago', () => {
    // Não há arquivo do outro lado. Mostrar o botão prometeria uma entrega
    // que não existe — e o clique cairia num 404 sem explicação.
    expect(pedidoParaOComprador(pedido(), AGORA).itens[0].baixavel).toBe(false)
  })

  it('reembolsado deixa de ser baixável', () => {
    // O dinheiro voltou; o acesso acompanha. É `pedidoRendeuReceita` que
    // responde isso, e não uma coluna de liberação que envelheceria sozinha.
    const visao = pedidoParaOComprador(pedido({
      ...DIGITAL,
      pedido_eventos: [
        { evento: 'pago', ocorrido_em: '2026-08-13T15:45:55Z' },
        { evento: 'reembolsado', ocorrido_em: '2026-08-14T10:00:00Z' },
      ],
    }), AGORA)
    expect(visao.itens[0].baixavel).toBe(false)
  })

  it('devolução solicitada AINDA é baixável', () => {
    // Declarado de propósito: o pedido de devolução é pendência do vendedor,
    // não o fim da compra. Enquanto o dinheiro não voltou, ele continua tendo
    // o que pagou. É o estorno que encerra o acesso.
    const visao = pedidoParaOComprador(pedido({
      ...DIGITAL,
      pedido_eventos: [
        { evento: 'pago', ocorrido_em: '2026-08-13T15:45:55Z' },
        { evento: 'devolucao_solicitada', ocorrido_em: '2026-08-14T10:00:00Z' },
      ],
    }), AGORA)
    expect(visao.itens[0].baixavel).toBe(true)
  })

  it('não pago não é baixável', () => {
    const visao = pedidoParaOComprador(pedido({
      ...DIGITAL,
      pedido_eventos: [{ evento: 'iniciado', ocorrido_em: '2026-08-13T15:45:15Z' }],
    }), AGORA)
    expect(visao.itens[0].baixavel).toBe(false)
  })

  it('item sem produto do catálogo não é baixável', () => {
    // Venda antiga, ou item que veio do Stripe do consultor: não há de onde
    // tirar o arquivo.
    const visao = pedidoParaOComprador(pedido({
      ...DIGITAL,
      pedido_itens: [{ id: 'item-1', nome: 'X', quantidade: 1, preco_unitario_centavos: 100 }],
    }), AGORA)
    expect(visao.itens[0].baixavel).toBe(false)
  })

  it('digital pago conta o arrependimento do pagamento', () => {
    // O par do teste em `pedidos-da-loja`: aqui é a tela que precisa mostrar
    // a data, e sem o marco certo ela mostraria «—» para sempre.
    const visao = pedidoParaOComprador(pedido(DIGITAL), AGORA)
    expect(visao.arrependimento_ate).toBe('2026-08-20T15:45:55.000Z')
    expect(visao.pode_pedir_devolucao).toBe(true)
  })
})
