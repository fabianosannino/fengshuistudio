import { describe, expect, it } from 'vitest'
import { ehPaginaPublica, ehApiPublica } from '../rotas-publicas'

describe('a loja é acessível a quem não tem conta', () => {
  /*
   * Estes testes existem por um defeito que estava em produção: o comprador
   * pagava como convidado, recebia o link do pedido por e-mail e caía na tela
   * de login. A página respondia `307 → /login` e a rota, `401`.
   *
   * Passou despercebido porque quem testou estava logado — que é justamente o
   * estado em que o defeito é invisível.
   */

  it('o recibo do comprador abre sem sessão', () => {
    expect(ehPaginaPublica('/pedido/aBc123')).toBe(true)
    expect(ehApiPublica('/api/pedidos/publico')).toBe(true)
  })

  it('o download do bem digital não exige conta', () => {
    // O acesso é conferido dentro da rota, pelo token e pelo estado do pedido
    // (ADR 0031). O middleware só precisa deixar a requisição chegar.
    expect(ehApiPublica('/api/pedidos/arquivo')).toBe(true)
  })

  it('as vitrines e os checkouts são públicos', () => {
    expect(ehPaginaPublica('/loja/maria-feng-shui')).toBe(true)
    expect(ehPaginaPublica('/store/acct_123')).toBe(true)
    expect(ehApiPublica('/api/stripe/checkout')).toBe(true)
    expect(ehApiPublica('/api/loja/produtos')).toBe(true)
    expect(ehApiPublica('/api/loja/checkout')).toBe(true)
  })

  it('a vitrine da plataforma abre junto com a API que a alimenta', () => {
    /*
     * As duas metades precisam concordar, e discordavam: a API já era pública
     * e a **página** não. O efeito era pior do que uma página fechada — a
     * página redirecionava para o login antes que o fetch chegasse a acontecer,
     * então o catálogo respondia certo para ninguém.
     */
    expect(ehPaginaPublica('/produtos')).toBe(true)
    expect(ehApiPublica('/api/loja/produtos')).toBe(true)
  })

  it('o clique de afiliado abre sem sessão', () => {
    /*
     * O link do afiliado é divulgado para quem ainda não conhece o app.
     * Exigir sessão aqui pediria conta a quem acabou de clicar num anúncio, e
     * o afiliado perderia a atribuição de todo mundo sem cadastro — que é
     * exatamente o público que ele foi contratado para trazer.
     */
    expect(ehApiPublica('/api/afiliado/clique')).toBe(true)
  })

  it('o webhook chega sem cookie', () => {
    expect(ehApiPublica('/api/stripe/webhooks')).toBe(true)
    expect(ehApiPublica('/api/stripe/webhooks/subscriptions')).toBe(true)
  })
})

describe('o que continua fechado', () => {
  it('o estorno é do vendedor, não do comprador', () => {
    // O par do teste acima: seria o preço de abrir `/api/pedidos` por prefixo.
    // Aberto, qualquer um poderia disparar estorno na conta de um consultor.
    expect(ehApiPublica('/api/pedidos/estorno')).toBe(false)
  })

  it('«minhas compras» é de quem tem conta', () => {
    expect(ehApiPublica('/api/pedidos/minhas-compras')).toBe(false)
  })

  it('as rotas de admin não entram por prefixo de loja', () => {
    expect(ehApiPublica('/api/admin/produtos')).toBe(false)
    expect(ehApiPublica('/api/admin/produtos/arquivo')).toBe(false)
    expect(ehPaginaPublica('/admin/produtos')).toBe(false)
  })

  it('os dados do titular exigem sessão — é ela que diz de quem eles são', () => {
    // `/privacidade` é pública por caminho exato (a política), e `meus-dados`
    // vive debaixo dela. Se a lista virasse prefixo, a página que exporta e
    // exclui a conta abriria sem sessão — e a rota é a que apaga clientes.
    expect(ehPaginaPublica('/privacidade')).toBe(true)
    expect(ehPaginaPublica('/privacidade/meus-dados')).toBe(false)
    expect(ehApiPublica('/api/conta/dados')).toBe(false)
  })

  it('o app continua exigindo sessão', () => {
    expect(ehPaginaPublica('/dashboard')).toBe(false)
    expect(ehPaginaPublica('/clientes')).toBe(false)
    expect(ehPaginaPublica('/vendas')).toBe(false)
    expect(ehApiPublica('/api/clientes')).toBe(false)
    expect(ehApiPublica('/api/consultas')).toBe(false)
  })

  it('caminho parecido não passa por acaso', () => {
    // Prefixo é comparado do início: um caminho que apenas *contém* uma rota
    // pública não herda a liberação.
    expect(ehApiPublica('/api/interno/api/loja/produtos')).toBe(false)
    expect(ehPaginaPublica('/relatorios/pedido/123')).toBe(false)
  })
})

describe('indicação (fase 4)', () => {
  it('o clique que encaminha ao parceiro é público', () => {
    // Quem clica na vitrine pode não ter conta — é a mesma premissa do resto
    // da loja, e foi ela que o middleware já defraudou uma vez.
    expect(ehApiPublica('/api/loja/indicacao')).toBe(true)
  })
})
