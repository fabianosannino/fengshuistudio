import { describe, expect, it } from 'vitest'
import { emailDeConfirmacao, emailDeDevolucaoSolicitada } from '../emails-do-pedido'
import { escaparHtml } from '../email'

const BASE = {
  numero: 'P260814-09F9B7',
  itens: [{ nome: 'Cristal Teste', quantidade: 1 }],
  totalCentavos: 100,
  arrependimentoAte: '2026-08-21T12:00:00Z',
  linkDoPedido: 'https://app.exemplo/pedido/tok123',
}

describe('emailDeConfirmacao', () => {
  it('leva o link — é o único acesso que o comprador tem', () => {
    // Ele não tem conta. Sem o link no e-mail, fechar a aba pós-pagamento
    // deixava o pedido inalcançável.
    const { html, texto } = emailDeConfirmacao(BASE)
    expect(html).toContain('https://app.exemplo/pedido/tok123')
    expect(texto).toContain('https://app.exemplo/pedido/tok123')
  })

  it('diz até quando dá para desistir', () => {
    const { html, texto } = emailDeConfirmacao(BASE)
    expect(html).toContain('21/08/2026')
    expect(texto).toContain('21/08/2026')
  })

  it('sem prazo, não inventa data', () => {
    // Bem físico não entregue não tem prazo correndo. Escrever uma data ali
    // seria afirmar um direito que ainda não começou.
    const { html, texto } = emailDeConfirmacao({ ...BASE, arrependimentoAte: null })
    expect(html).not.toContain('art.')
    expect(texto).not.toContain('desistir')
  })

  it('NÃO leva número de negócio do vendedor', () => {
    // Comissão e líquido são assunto do vendedor. Mesma regra da projeção
    // pública: lista branca, não lista negra.
    const corpo = JSON.stringify(emailDeConfirmacao(BASE))
    expect(corpo).not.toContain('comissao')
    expect(corpo).not.toContain('líquido')
    expect(corpo).not.toContain('gateway')
  })

  it('escapa o nome do produto', () => {
    // O nome vem do cadastro do consultor. Um `<a>` ali transformaria o nosso
    // aviso em phishing assinado por nós.
    const { html } = emailDeConfirmacao({
      ...BASE,
      itens: [{ nome: '<a href="http://mal.example">Clique</a>', quantidade: 1 }],
    })
    expect(html).not.toContain('<a href="http://mal.example"')
    expect(html).toContain('&lt;a href=')
  })

  it('mostra a quantidade só quando é mais de um', () => {
    expect(emailDeConfirmacao(BASE).html).not.toContain('×')
    expect(emailDeConfirmacao({
      ...BASE, itens: [{ nome: 'Cristal', quantidade: 3 }],
    }).html).toContain('× 3')
  })
})

describe('emailDeDevolucaoSolicitada', () => {
  it('avisa o vendedor com valor e caminho para estornar', () => {
    const { assunto, html } = emailDeDevolucaoSolicitada({
      numero: 'P260814-09F9B7',
      totalCentavos: 100,
      linkDasVendas: 'https://app.exemplo/vendas',
    })
    expect(assunto).toContain('P260814-09F9B7')
    expect(html).toContain('R$&nbsp;1,00'.replace('&nbsp;', ' '))
    expect(html).toContain('https://app.exemplo/vendas')
  })

  it('lembra que a comissão volta junto', () => {
    // O consultor precisa saber disso antes de hesitar em estornar.
    const { html } = emailDeDevolucaoSolicitada({
      numero: 'P1', totalCentavos: 100, linkDasVendas: 'https://app.exemplo/vendas',
    })
    expect(html).toContain('comissão')
  })
})

describe('escaparHtml', () => {
  it('neutraliza os cinco que importam', () => {
    expect(escaparHtml(`<>&"'`)).toBe('&lt;&gt;&amp;&quot;&#39;')
  })

  it('escapa o & primeiro, senão escaparia o próprio escape', () => {
    expect(escaparHtml('&lt;')).toBe('&amp;lt;')
  })
})
