import { describe, expect, it } from 'vitest'
import {
  produtoParaVitrine, ehDigital, extensaoParaMimeDeProduto, ehIndicacao,
  ehLinkDeIndicacaoSeguro, MIMES_DE_PRODUTO_DIGITAL, type Produto,
} from '../produtos-da-plataforma'

const PRODUTO: Produto = {
  id: 'p1',
  tipo: 'bem_proprio_digital',
  modo_de_venda: 'marketplace',
  nome: 'Guia do Ba Guá',
  descricao: 'PDF com os oito setores',
  preco_centavos: 2990,
  ativo: true,
  arquivo_path: 'p1/9f3c-secreto.pdf',
  arquivo_nome: 'guia-bagua.pdf',
  arquivo_mime: 'application/pdf',
  arquivo_bytes: 1024,
  link_externo: null,
  parceiro: null,
  imagem_path: null,
  promocao_preco_centavos: null,
  promocao_inicio: null,
  promocao_fim: null,
}

/** A vitrine depende do instante — ver `promocao-do-produto`. */
const AGORA = new Date('2026-08-16T12:00:00Z')

describe('produtoParaVitrine', () => {
  it('NÃO leva o caminho do arquivo', () => {
    // O bucket é privado e o path sozinho não baixa nada — mas publicar o
    // endereço do que se cobra para entregar é começar a defesa um passo
    // atrás sem ganhar nada. Lista branca, como em `perfis_publicos`.
    const vitrine = JSON.stringify(produtoParaVitrine(PRODUTO, AGORA))
    expect(vitrine).not.toContain('9f3c-secreto')
    expect(vitrine).not.toContain('arquivo_path')
    expect(vitrine).not.toContain('arquivo_mime')
  })

  it('leva o que a loja precisa mostrar', () => {
    const vitrine = produtoParaVitrine(PRODUTO, AGORA)
    expect(vitrine.nome).toBe('Guia do Ba Guá')
    expect(vitrine.preco_centavos).toBe(2990)
    expect(vitrine.entrega_digital).toBe(true)
  })

  it('o preço que sai já é o vigente, não o cheio', () => {
    /*
     * A integração que importa: a vitrine e o checkout precisam mostrar e
     * cobrar o mesmo número. Isso só se sustenta porque os dois passam por
     * `precoVigente` — este caso é o que quebra se alguém voltar a copiar
     * `produto.preco_centavos` para cá.
     */
    const emCampanha = {
      ...PRODUTO,
      promocao_preco_centavos: 1990,
      promocao_inicio: '2026-08-16T00:00:00Z',
      promocao_fim: '2026-08-17T00:00:00Z',
    }
    const vitrine = produtoParaVitrine(emCampanha, AGORA)

    expect(vitrine.preco_centavos).toBe(1990)
    expect(vitrine.preco_cheio_centavos).toBe(2990)
    expect(vitrine.promocao_termina_em).toBe('2026-08-17T00:00:00Z')
  })

  it('campanha encerrada some sozinha da vitrine', () => {
    const encerrada = {
      ...PRODUTO,
      promocao_preco_centavos: 1990,
      promocao_inicio: '2026-08-01T00:00:00Z',
      promocao_fim: '2026-08-10T00:00:00Z',
    }
    const vitrine = produtoParaVitrine(encerrada, AGORA)

    expect(vitrine.preco_centavos).toBe(2990)
    expect(vitrine.preco_cheio_centavos).toBeNull()
  })

  it('NÃO leva as colunas cruas da promoção', () => {
    // A vitrine mostra o resultado, não a regra. Vazar `promocao_inicio` daria
    // ao cliente material para conferir se o preço «bate» — e a conferência do
    // preço acontece no servidor, sempre.
    const emCampanha = {
      ...PRODUTO,
      promocao_preco_centavos: 1990,
      promocao_inicio: '2026-08-16T00:00:00Z',
      promocao_fim: '2026-08-17T00:00:00Z',
    }
    const json = JSON.stringify(produtoParaVitrine(emCampanha, AGORA))

    expect(json).not.toContain('promocao_preco_centavos')
    expect(json).not.toContain('promocao_inicio')
  })

  it('leva a URL da foto, nunca o path', () => {
    // Mesma razão do `arquivo_path`: o que a tela precisa é do endereço, e o
    // path é detalhe de armazenamento que amarra a página ao bucket.
    const comFoto = { ...PRODUTO, imagem_path: 'p1/abc.webp' }
    const json = JSON.stringify(produtoParaVitrine(comFoto, AGORA))

    expect(json).not.toContain('imagem_path')
    expect(json).toContain('imagem_url')
  })

  it('sem foto, o campo é null e a tela decide o que pôr no lugar', () => {
    // Ausência ≠ string vazia: `null` deixa a tela escolher o espaço reservado,
    // e um `<img src="">` pediria a própria página de volta ao servidor.
    expect(produtoParaVitrine(PRODUTO, AGORA).imagem_url).toBeNull()
  })

  it('campo novo não vaza sozinho', () => {
    // Se alguém acrescentar uma coluna em `produtos`, ela só aparece na
    // vitrine depois de ser escrita aqui — que é quando a decisão é tomada.
    const comCampoNovo = { ...PRODUTO, custo_interno_centavos: 400 } as unknown as Produto
    expect(JSON.stringify(produtoParaVitrine(comCampoNovo, AGORA))).not.toContain('custo_interno')
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

describe('ehLinkDeIndicacaoSeguro', () => {
  /*
   * O destino vem do nosso cadastro, não do cliente — mas cadastro é digitado.
   * A rota de indicação é pública e leva o visitante para fora com o nosso
   * domínio e o nosso HTTPS na origem do clique: é o formato que um phisher
   * pede de presente.
   */
  it('aceita https com host', () => {
    expect(ehLinkDeIndicacaoSeguro('https://loja.exemplo.com.br/produto/1')).toBe(true)
  })

  it('recusa javascript: e data:', () => {
    // Encaminhar isso seria executar código no browser de quem confia na
    // nossa marca.
    expect(ehLinkDeIndicacaoSeguro('javascript:alert(1)')).toBe(false)
    expect(ehLinkDeIndicacaoSeguro('data:text/html,<script>alert(1)</script>')).toBe(false)
  })

  it('recusa http — o visitante sai da nossa página para uma conexão aberta', () => {
    expect(ehLinkDeIndicacaoSeguro('http://loja.exemplo.com.br')).toBe(false)
  })

  it('recusa usuário embutido na URL', () => {
    // `https://loja-boa.com@evil.example` mostra o domínio errado na barra.
    expect(ehLinkDeIndicacaoSeguro('https://loja-boa.com@evil.example/x')).toBe(false)
  })

  it('recusa vazio e lixo', () => {
    expect(ehLinkDeIndicacaoSeguro(null)).toBe(false)
    expect(ehLinkDeIndicacaoSeguro('')).toBe(false)
    expect(ehLinkDeIndicacaoSeguro('loja.exemplo.com.br')).toBe(false)
  })
})

describe('indicação na vitrine', () => {
  const INDICACAO: Produto = {
    ...PRODUTO,
    tipo: 'bem_de_terceiro',
    modo_de_venda: 'indicacao',
    arquivo_path: null,
    link_externo: 'https://loja.exemplo.com.br/produto/1',
    parceiro: 'Loja Exemplo',
  }

  it('NÃO leva o link externo', () => {
    // O clique tem que passar por `/api/loja/indicacao`, que mede antes de
    // encaminhar. Publicar o destino final na vitrine deixaria o navegador ir
    // direto — e a comissão vira palavra contra palavra.
    const vitrine = JSON.stringify(produtoParaVitrine(INDICACAO, AGORA))
    expect(vitrine).not.toContain('loja.exemplo.com.br')
    expect(vitrine).not.toContain('link_externo')
  })

  it('leva quem vende — o comprador precisa saber antes de clicar', () => {
    const vitrine = produtoParaVitrine(INDICACAO, AGORA)
    expect(vitrine.parceiro).toBe('Loja Exemplo')
    expect(vitrine.modo_de_venda).toBe('indicacao')
  })

  it('indicação não é entrega digital nossa', () => {
    expect(produtoParaVitrine(INDICACAO, AGORA).entrega_digital).toBe(false)
  })

  it('ehIndicacao separa os dois trilhos', () => {
    expect(ehIndicacao(INDICACAO)).toBe(true)
    expect(ehIndicacao(PRODUTO)).toBe(false)
  })
})
