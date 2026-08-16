import { describe, expect, it } from 'vitest'
import {
  ESTORNAVEIS, faltaParaEstornar, parametrosDoEstorno, quemEstorna,
} from '../estorno-da-venda'

/**
 * O que se testa aqui é o dinheiro voltando — e as duas vendas voltam por
 * caminhos diferentes.
 *
 * O defeito que motivou o módulo não era visível de dentro: a rota recusava
 * toda venda de bem próprio com um 409 genérico, enquanto a página do
 * comprador oferecia «Solicitar devolução» e o e-mail prometia os 7 dias do
 * CDC. Direito anunciado em dois lugares, existente em nenhum.
 *
 * Um teste que só exercitasse a venda do consultor teria passado o tempo todo.
 * Por isso cada caso aqui é escrito em par: o consultor e a plataforma, lado a
 * lado, para que o segundo não possa ser esquecido de novo.
 */

const VENDA_DO_CONSULTOR = {
  stripe_payment_intent: 'pi_consultor',
  stripe_account_id: 'acct_123',
  vendedor_tipo: 'consultor',
}

const VENDA_PROPRIA = {
  stripe_payment_intent: 'pi_plataforma',
  stripe_account_id: null,
  vendedor_tipo: 'plataforma',
}

describe('faltaParaEstornar', () => {
  it('a venda do consultor não tem impedimento', () => {
    expect(faltaParaEstornar(VENDA_DO_CONSULTOR)).toBeNull()
  })

  it('a venda de bem próprio também não — e é esta a correção', () => {
    // `stripe_account_id` nulo é o desenho da venda própria, não dado
    // corrompido. Exigi-lo era recusar por existir corretamente.
    expect(faltaParaEstornar(VENDA_PROPRIA)).toBeNull()
  })

  it('sem cobrança registrada não há o que devolver', () => {
    // O único impedimento real: sem `payment_intent` não existe pagamento a
    // desfazer, e aí o 409 diz a verdade.
    expect(faltaParaEstornar({ stripe_payment_intent: null, stripe_account_id: 'acct_123' }))
      .toBe('cobranca')
    expect(faltaParaEstornar({})).toBe('cobranca')
  })
})

describe('parametrosDoEstorno', () => {
  it('na venda do consultor, o estorno acontece na conta dele', () => {
    const { corpo, opcoes } = parametrosDoEstorno(VENDA_DO_CONSULTOR, 'pedido-1')

    expect(corpo.payment_intent).toBe('pi_consultor')
    expect(opcoes.stripeAccount).toBe('acct_123')
  })

  it('na venda do consultor, a comissão volta sempre', () => {
    // Fixo em `true` e nunca parâmetro: a plataforma não fica com comissão de
    // venda desfeita, e uma regra que depende de alguém marcar uma caixa não é
    // regra.
    const { corpo } = parametrosDoEstorno(VENDA_DO_CONSULTOR, 'pedido-1')
    expect(corpo.refund_application_fee).toBe(true)
  })

  it('na venda de bem próprio, nenhum dos dois vai', () => {
    /*
     * `stripeAccount` precisa estar **ausente**, não nulo: passar `null` ao SDK
     * não é omitir, é pedir uma conta chamada «null».
     *
     * `refund_application_fee` descreveria uma comissão que não houve — não se
     * cobra comissão de si mesmo — e o Stripe recusaria a chamada inteira. O
     * comprador ficaria sem o dinheiro por causa de um campo sobre um fato
     * inexistente.
     */
    const { corpo, opcoes } = parametrosDoEstorno(VENDA_PROPRIA, 'pedido-2')

    expect(corpo.payment_intent).toBe('pi_plataforma')
    expect('refund_application_fee' in corpo).toBe(false)
    expect('stripeAccount' in opcoes).toBe(false)
  })

  it('dois cliques no botão não devolvem duas vezes', () => {
    // A chave é o pedido, não a tentativa: reenviar depois de um timeout tem
    // que ser inofensivo, senão o comprador recebe em dobro e o vendedor paga.
    const primeira = parametrosDoEstorno(VENDA_PROPRIA, 'pedido-2')
    const segunda = parametrosDoEstorno(VENDA_PROPRIA, 'pedido-2')

    expect(primeira.opcoes.idempotencyKey).toBe('estorno-pedido-2')
    expect(segunda.opcoes.idempotencyKey).toBe(primeira.opcoes.idempotencyKey)
  })

  it('pedidos diferentes não compartilham a chave', () => {
    // Chave repetida entre pedidos faria o segundo estorno devolver a resposta
    // do primeiro — sucesso relatado, dinheiro parado.
    const a = parametrosDoEstorno(VENDA_PROPRIA, 'pedido-a')
    const b = parametrosDoEstorno(VENDA_PROPRIA, 'pedido-b')

    expect(a.opcoes.idempotencyKey).not.toBe(b.opcoes.idempotencyKey)
  })
})

describe('quemEstorna', () => {
  it('a venda do consultor é desfeita por ele', () => {
    // O dinheiro é dele, e a policy de `pedidos` já só devolve a linha ao dono.
    expect(quemEstorna(VENDA_DO_CONSULTOR)).toBe('vendedor')
  })

  it('a venda da plataforma exige admin', () => {
    // Aqui o dono da linha é a plataforma e qualquer admin a alcança na
    // leitura. A capacidade é o que separa ler de desfazer.
    expect(quemEstorna(VENDA_PROPRIA)).toBe('admin')
  })

  it('vendedor desconhecido cai no caminho do consultor, não no do admin', () => {
    /*
     * A falha aqui é fechada do lado que importa: o desconhecido **não** ganha
     * o caminho da plataforma, que é o único que pode desfazer venda alheia.
     * Ele cai em `vendedor`, onde a policy de `pedidos` continua exigindo que
     * seja a linha dele — quem não for dono não chega até aqui.
     */
    expect(quemEstorna({ vendedor_tipo: null })).toBe('vendedor')
    expect(quemEstorna({})).toBe('vendedor')
  })
})

describe('ESTORNAVEIS', () => {
  it('inclui o estado que o próprio botão do comprador cria', () => {
    // `devolucao_solicitada` é o que a página do comprador grava ao pedir a
    // devolução. Deixá-lo de fora tornaria o pedido inestornável **por ter
    // sido pedido** — exatamente o oposto do que o botão promete.
    expect(ESTORNAVEIS.has('devolucao_solicitada')).toBe(true)
  })

  it('cobre a venda inteira, do pagamento à entrega', () => {
    expect(ESTORNAVEIS.has('pago')).toBe(true)
    expect(ESTORNAVEIS.has('preparando')).toBe(true)
    expect(ESTORNAVEIS.has('enviado')).toBe(true)
    expect(ESTORNAVEIS.has('entregue')).toBe(true)
  })

  it('não devolve o que nunca foi cobrado nem o que já foi devolvido', () => {
    // `reembolsado` de novo seria pagar duas vezes; `iniciado` e `cancelado`
    // nunca tiveram dinheiro para devolver.
    expect(ESTORNAVEIS.has('reembolsado')).toBe(false)
    expect(ESTORNAVEIS.has('iniciado')).toBe(false)
    expect(ESTORNAVEIS.has('cancelado')).toBe(false)
  })
})
