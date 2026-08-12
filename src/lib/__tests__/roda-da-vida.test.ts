import { describe, expect, it } from 'vitest'
import {
  areaRespondida, mediaDaArea, notasDaArea, areasRespondidas,
  mediaGeral, progressoDaRoda, paresComparaveis,
} from '../roda-da-vida'

const CHAVES = ['saude', 'familia', 'carreira', 'dinheiro']

describe('areaRespondida', () => {
  it('reconhece resposta em array e em número legado', () => {
    expect(areaRespondida([7, 8, 6, 7, 9])).toBe(true)
    expect(areaRespondida(7)).toBe(true)
  })

  it('não confunde ausência com resposta', () => {
    for (const vazio of [null, undefined, []]) {
      expect(areaRespondida(vazio as never), JSON.stringify(vazio)).toBe(false)
    }
  })

  it('zero é resposta, não ausência', () => {
    // Alguém pode avaliar uma área da própria vida como 0. Tratar isso como
    // «não respondeu» apagaria justamente o dado mais grave.
    expect(areaRespondida(0)).toBe(true)
    expect(areaRespondida([0, 0, 0, 0, 0])).toBe(true)
  })
})

describe('mediaDaArea', () => {
  it('devolve null para área não respondida — nunca 5', () => {
    // Era o defeito: `return 5` fazia uma roda intocada exibir «Média: 5.0».
    // Cinco é o meio da escala, então o erro parecia uma vida mediana.
    expect(mediaDaArea(null)).toBeNull()
    expect(mediaDaArea(undefined)).toBeNull()
    expect(mediaDaArea([])).toBeNull()
  })

  it('considera só as posições preenchidas', () => {
    // Responder 3 das 5 perguntas dá a média das 3, não das 5 com dois zeros.
    expect(mediaDaArea([9, 9, 9, null as never, undefined as never])).toBe(9)
  })

  it('média simples do array completo', () => {
    expect(mediaDaArea([2, 4, 6, 8, 10])).toBe(6)
  })

  it('aceita o número legado', () => {
    expect(mediaDaArea(7)).toBe(7)
  })
})

describe('notasDaArea', () => {
  it('marca com null as perguntas sem resposta', () => {
    expect(notasDaArea([8, 6])).toEqual([8, 6, null, null, null])
  })

  it('área sem resposta nenhuma vira lista de null', () => {
    expect(notasDaArea(null)).toEqual([null, null, null, null, null])
  })

  it('número legado repete o valor real, não um presumido', () => {
    expect(notasDaArea(4)).toEqual([4, 4, 4, 4, 4])
  })
})

describe('mediaGeral e progresso', () => {
  it('a média ignora as áreas não respondidas', () => {
    const respostas = { saude: [10, 10, 10, 10, 10], familia: [6, 6, 6, 6, 6] }
    // Média das duas respondidas = 8. Antes, as duas ausentes entravam como 5
    // e puxavam o resultado para 6.5.
    expect(mediaGeral(respostas, CHAVES)).toBe(8)
  })

  it('roda intocada não tem média', () => {
    expect(mediaGeral({}, CHAVES)).toBeNull()
  })

  it('o progresso diz quantas faltam, em vez de preencher o buraco', () => {
    const p = progressoDaRoda({ saude: [7, 7, 7, 7, 7] }, CHAVES)
    expect(p).toMatchObject({ respondidas: 1, total: 4, completa: false })
    expect(p.texto).toBe('1 de 4 áreas respondidas')
  })

  it('declara quando nada foi respondido', () => {
    expect(progressoDaRoda({}, CHAVES).texto).toBe('Nenhuma das 4 áreas respondida')
  })

  it('reconhece a roda completa', () => {
    const cheia = Object.fromEntries(CHAVES.map(k => [k, [5, 5, 5, 5, 5]]))
    expect(progressoDaRoda(cheia, CHAVES).completa).toBe(true)
  })
})

describe('areasRespondidas', () => {
  it('preserva a ordem das chaves recebidas', () => {
    const respostas = { dinheiro: [3], saude: [8] }
    expect(areasRespondidas(respostas, CHAVES)).toEqual(['saude', 'dinheiro'])
  })
})

describe('paresComparaveis', () => {
  it('só compara quando os dois lados existem', () => {
    // Cruzar o Ba Guá com uma área não respondida produz divergência
    // inventada — pior que divergência nenhuma.
    const pares = paresComparaveis(
      { saude: [8, 8, 8, 8, 8], familia: null },
      { saude: 60, familia: 90, carreira: 40 },
      CHAVES
    )
    expect(pares).toHaveLength(1)
    expect(pares[0].chave).toBe('saude')
  })

  it('a diferença é imóvel menos vida', () => {
    const [par] = paresComparaveis({ saude: 5 }, { saude: 80 }, ['saude'])
    expect(par.diferenca).toBe(75)
  })

  it('área respondida sem score de setor não entra', () => {
    expect(paresComparaveis({ saude: [7] }, {}, ['saude'])).toHaveLength(0)
  })
})
