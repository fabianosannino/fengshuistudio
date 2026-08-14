import { describe, expect, it } from 'vitest'
import {
  produtoParaVitrine, ehDigital, extensaoParaMimeDeProduto,
  MIMES_DE_PRODUTO_DIGITAL, type Produto,
} from '../produtos-da-plataforma'

const PRODUTO: Produto = {
  id: 'p1',
  tipo: 'bem_proprio_digital',
  nome: 'Guia do Ba Guá',
  descricao: 'PDF com os oito setores',
  preco_centavos: 2990,
  ativo: true,
  arquivo_path: 'p1/9f3c-secreto.pdf',
  arquivo_nome: 'guia-bagua.pdf',
  arquivo_mime: 'application/pdf',
  arquivo_bytes: 1024,
}

describe('produtoParaVitrine', () => {
  it('NÃO leva o caminho do arquivo', () => {
    // O bucket é privado e o path sozinho não baixa nada — mas publicar o
    // endereço do que se cobra para entregar é começar a defesa um passo
    // atrás sem ganhar nada. Lista branca, como em `perfis_publicos`.
    const vitrine = JSON.stringify(produtoParaVitrine(PRODUTO))
    expect(vitrine).not.toContain('9f3c-secreto')
    expect(vitrine).not.toContain('arquivo_path')
    expect(vitrine).not.toContain('arquivo_mime')
  })

  it('leva o que a loja precisa mostrar', () => {
    const vitrine = produtoParaVitrine(PRODUTO)
    expect(vitrine.nome).toBe('Guia do Ba Guá')
    expect(vitrine.preco_centavos).toBe(2990)
    expect(vitrine.entrega_digital).toBe(true)
  })

  it('campo novo não vaza sozinho', () => {
    // Se alguém acrescentar uma coluna em `produtos`, ela só aparece na
    // vitrine depois de ser escrita aqui — que é quando a decisão é tomada.
    const comCampoNovo = { ...PRODUTO, custo_interno_centavos: 400 } as unknown as Produto
    expect(JSON.stringify(produtoParaVitrine(comCampoNovo))).not.toContain('custo_interno')
  })
})

describe('ehDigital', () => {
  it('só o digital entrega por download', () => {
    expect(ehDigital('bem_proprio_digital')).toBe(true)
    expect(ehDigital('bem_proprio_fisico')).toBe(false)
    expect(ehDigital('servico')).toBe(false)
  })
})

describe('extensaoParaMimeDeProduto', () => {
  it('deriva a extensão do MIME, e recusa o que não está na lista', () => {
    // A extensão nunca vem de `file.name`: o nome é escolhido por quem envia,
    // e derivá-lo dali é o caminho conhecido de injeção de extensão.
    expect(extensaoParaMimeDeProduto('application/pdf')).toBe('pdf')
    expect(extensaoParaMimeDeProduto('audio/mpeg')).toBe('mp3')
    expect(extensaoParaMimeDeProduto('text/html')).toBeNull()
    expect(extensaoParaMimeDeProduto('application/x-msdownload')).toBeNull()
  })

  it('todo MIME anunciado tem extensão', () => {
    for (const mime of MIMES_DE_PRODUTO_DIGITAL) {
      expect(extensaoParaMimeDeProduto(mime)).toBeTruthy()
    }
  })
})
