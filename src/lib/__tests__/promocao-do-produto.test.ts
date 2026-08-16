import { describe, expect, it } from 'vitest'
import {
  precoVigente, descontoEmPorcento, situacaoDaPromocao, recusaDaPromocao,
  MENSAGEM_DA_RECUSA, type ProdutoComPreco,
} from '../promocao-do-produto'

/**
 * Este módulo decide **quanto o cartão do comprador é debitado**. Errar aqui
 * não produz tela feia: produz cobrança errada, e a descoberta vem por
 * contestação.
 *
 * Os dois erros têm formatos opostos e ambos são silenciosos. Cobrar o cheio
 * durante a campanha faz o comprador pagar o que o anúncio dizia que não
 * pagaria. Cobrar o promocional depois dela faz a plataforma vender abaixo do
 * preço por tempo indefinido, e nada avisa — a venda acontece normalmente.
 *
 * Por isso os casos aqui são as **bordas** da janela, não o meio dela.
 */

const AGORA = new Date('2026-08-16T12:00:00Z')

function emHoras(horas: number): string {
  return new Date(AGORA.getTime() + horas * 60 * 60 * 1000).toISOString()
}

function produto(over: Partial<ProdutoComPreco> = {}): ProdutoComPreco {
  return {
    preco_centavos: 10_000,
    promocao_preco_centavos: 6_000,
    promocao_inicio: emHoras(-1),
    promocao_fim: emHoras(1),
    ...over,
  }
}

describe('precoVigente — dentro e fora da janela', () => {
  it('dentro, cobra o promocional e guarda o cheio para riscar', () => {
    const v = precoVigente(produto(), AGORA)

    expect(v.centavos).toBe(6_000)
    expect(v.emPromocao).toBe(true)
    expect(v.precoCheioCentavos).toBe(10_000)
    expect(v.terminaEm).toBe(emHoras(1))
  })

  it('antes de começar, cobra o cheio — a campanha agendada não vale ainda', () => {
    const v = precoVigente(produto({ promocao_inicio: emHoras(1), promocao_fim: emHoras(2) }), AGORA)

    expect(v.centavos).toBe(10_000)
    expect(v.emPromocao).toBe(false)
  })

  it('depois de terminar, volta ao cheio sozinha', () => {
    /*
     * O caso que uma coluna `em_promocao` erraria: nada rodou, ninguém virou
     * booleano nenhum, e o preço já é o cheio de novo. É a razão de o dado
     * gravado ser a janela e não o estado.
     */
    const v = precoVigente(produto({ promocao_inicio: emHoras(-3), promocao_fim: emHoras(-1) }), AGORA)

    expect(v.centavos).toBe(10_000)
    expect(v.emPromocao).toBe(false)
    expect(v.precoCheioCentavos).toBeNull()
  })

  it('o instante de abertura já está dentro', () => {
    const v = precoVigente(produto({ promocao_inicio: AGORA.toISOString() }), AGORA)
    expect(v.emPromocao).toBe(true)
  })

  it('o instante de fechamento já está fora', () => {
    // «Até» significa antes de. A fronteira precisa de lado escolhido, e a
    // alternativa é discutir milissegundos com quem viu o anúncio.
    const v = precoVigente(produto({ promocao_fim: AGORA.toISOString() }), AGORA)
    expect(v.emPromocao).toBe(false)
    expect(v.centavos).toBe(10_000)
  })

  it('o mesmo produto responde diferente conforme quando se pergunta', () => {
    // É a propriedade inteira do módulo: nada no produto mudou entre as três
    // chamadas, e as três respostas estão certas.
    const p = produto({ promocao_inicio: emHoras(1), promocao_fim: emHoras(3) })

    expect(precoVigente(p, AGORA).emPromocao).toBe(false)
    expect(precoVigente(p, new Date(AGORA.getTime() + 2 * 3600_000)).emPromocao).toBe(true)
    expect(precoVigente(p, new Date(AGORA.getTime() + 4 * 3600_000)).emPromocao).toBe(false)
  })
})

describe('precoVigente — linha malformada não impede a venda', () => {
  it('sem promoção nenhuma, cobra o cheio', () => {
    const v = precoVigente({ preco_centavos: 4_900 }, AGORA)

    expect(v.centavos).toBe(4_900)
    expect(v.emPromocao).toBe(false)
    expect(v.terminaEm).toBeNull()
  })

  it('promoção pela metade é ignorada, não é erro', () => {
    /*
     * O banco recusa gravar assim (constraint `produtos_promocao_completa`).
     * Se uma linha escapar por outro caminho, o produto ainda tem preço — e
     * recusar a venda por causa de uma campanha malformada seria trocar um
     * defeito de cadastro por uma loja que não vende.
     */
    for (const parcial of [
      { promocao_inicio: null },
      { promocao_fim: null },
      { promocao_preco_centavos: null },
    ]) {
      const v = precoVigente(produto(parcial), AGORA)
      expect(v.emPromocao, JSON.stringify(parcial)).toBe(false)
      expect(v.centavos).toBe(10_000)
    }
  })

  it('data impossível não vira NaN no valor cobrado', () => {
    // `new Date('qualquer coisa').getTime()` é NaN, e toda comparação com NaN é
    // falsa — sem esta guarda, a janela «não fechada» deixaria passar.
    const v = precoVigente(produto({ promocao_inicio: 'ontem à tarde' }), AGORA)
    expect(v.centavos).toBe(10_000)
    expect(Number.isFinite(v.centavos)).toBe(true)
  })

  it('promoção que não desconta cobra o menor e não risca nada', () => {
    for (const preco of [10_000, 12_000]) {
      const v = precoVigente(produto({ promocao_preco_centavos: preco }), AGORA)
      expect(v.centavos, String(preco)).toBe(10_000)
      expect(v.emPromocao).toBe(false)
    }
  })
})

describe('descontoEmPorcento', () => {
  it('arredonda o que a tela mostra', () => {
    expect(descontoEmPorcento(precoVigente(produto(), AGORA))).toBe(40)
  })

  it('sem promoção não há desconto a exibir', () => {
    expect(descontoEmPorcento(precoVigente({ preco_centavos: 100 }, AGORA))).toBeNull()
  })
})

describe('situacaoDaPromocao — os três estados que a tela de admin precisa', () => {
  it('distingue agendada de encerrada', () => {
    /*
     * Na vitrine as duas se parecem: nos dois casos o preço é o cheio e não há
     * selo. Confundi-las faz o admin cadastrar de novo uma campanha que já está
     * no ar para semana que vem.
     */
    expect(situacaoDaPromocao(produto({ promocao_inicio: emHoras(1), promocao_fim: emHoras(2) }), AGORA))
      .toBe('agendada')
    expect(situacaoDaPromocao(produto({ promocao_inicio: emHoras(-2), promocao_fim: emHoras(-1) }), AGORA))
      .toBe('encerrada')
  })

  it('rodando é a janela aberta', () => {
    expect(situacaoDaPromocao(produto(), AGORA)).toBe('rodando')
  })

  it('sem as três colunas, não há promoção a situar', () => {
    expect(situacaoDaPromocao({ preco_centavos: 500 }, AGORA)).toBe('sem_promocao')
  })
})

describe('recusaDaPromocao — o que a tela recusa antes do banco', () => {
  const proposta = { precoCentavos: 6_000, inicio: emHoras(1), fim: emHoras(5) }

  it('aceita a campanha agendada para o futuro', () => {
    expect(recusaDaPromocao(proposta, 10_000, AGORA)).toBeNull()
  })

  it('aceita a campanha que já começou e ainda não terminou', () => {
    expect(recusaDaPromocao({ ...proposta, inicio: emHoras(-1) }, 10_000, AGORA)).toBeNull()
  })

  it('recusa a que termina no passado', () => {
    /*
     * O banco aceitaria: as três colunas estão preenchidas e coerentes entre
     * si. Só que a campanha não valeria em momento nenhum, e o admin sairia da
     * tela achando que valeria. O defeito apareceria quando alguém comprasse
     * pelo cheio e reclamasse do anúncio.
     */
    const r = recusaDaPromocao({ ...proposta, inicio: emHoras(-5), fim: emHoras(-1) }, 10_000, AGORA)
    expect(r).toBe('ja_terminou')
  })

  it('recusa janela invertida e janela de duração zero', () => {
    expect(recusaDaPromocao({ ...proposta, inicio: emHoras(5), fim: emHoras(1) }, 10_000, AGORA))
      .toBe('janela_invertida')
    expect(recusaDaPromocao({ ...proposta, inicio: emHoras(3), fim: emHoras(3) }, 10_000, AGORA))
      .toBe('janela_invertida')
  })

  it('recusa preço que não desconta', () => {
    expect(recusaDaPromocao({ ...proposta, precoCentavos: 10_000 }, 10_000, AGORA)).toBe('nao_desconta')
    expect(recusaDaPromocao({ ...proposta, precoCentavos: 11_000 }, 10_000, AGORA)).toBe('nao_desconta')
    expect(recusaDaPromocao({ ...proposta, precoCentavos: 0 }, 10_000, AGORA)).toBe('nao_desconta')
  })

  it('recusa data impossível', () => {
    expect(recusaDaPromocao({ ...proposta, fim: 'sexta que vem' }, 10_000, AGORA))
      .toBe('datas_invalidas')
  })

  it('toda recusa tem mensagem para quem está cadastrando', () => {
    // Recusa sem texto vira «erro» genérico na tela do admin — que é quem pode
    // corrigir, e para quem a informação é acionável, não pista para atacante.
    for (const motivo of Object.keys(MENSAGEM_DA_RECUSA)) {
      expect(MENSAGEM_DA_RECUSA[motivo as keyof typeof MENSAGEM_DA_RECUSA]).toBeTruthy()
    }
  })
})
