import { describe, expect, it } from 'vitest'
import { AREAS_AUTENTICADAS } from '../../../app/robots'
import { ROTAS_MARKETING, PREFIXO_RECURSOS, URL_CANONICA } from '../auth-rotas'

/**
 * O `robots.txt` e o `sitemap.xml` falam com o mesmo leitor, e por um tempo
 * disseram coisas opostas.
 *
 * `/produtos` estava nas duas listas: anunciada no sitemap com prioridade 0.9 e
 * proibida aqui. E o robots apontava o sitemap para `fengshuistudio.vercel.app`
 * depois de o sitemap já ter sido corrigido para o domínio da marca — ou seja,
 * o arquivo que aponta para o sitemap desfazia a correção do sitemap.
 *
 * Os dois defeitos têm a mesma forma: nada quebra, ninguém vê, e o efeito só
 * aparece no índice de busca semanas depois.
 */

function proibida(rota: string): boolean {
  return AREAS_AUTENTICADAS.some(prefixo => rota.startsWith(prefixo))
}

describe('robots × sitemap', () => {
  it('nenhuma rota de marketing é proibida ao buscador', () => {
    // O caso que existiu: `/produtos` pública, no sitemap, e bloqueada aqui.
    for (const rota of ROTAS_MARKETING) {
      expect(proibida(rota), rota).toBe(false)
    }
  })

  it('as subpáginas de recurso também passam', () => {
    for (const rota of ['bagua', 'calendario', 'relatorios', 'roda-da-vida']) {
      expect(proibida(`${PREFIXO_RECURSOS}${rota}`), rota).toBe(false)
    }
  })

  it('o sitemap é anunciado no domínio da marca', () => {
    // Pedir o robots no domínio certo e receber o sitemap de outro host é
    // convidar o buscador a indexar o endereço de infraestrutura.
    expect(URL_CANONICA).toBe('https://www.fengshuistudio.com.br')
    expect(URL_CANONICA).not.toContain('vercel.app')
  })
})

describe('o que continua fora do índice', () => {
  it('as telas de app', () => {
    for (const rota of ['/dashboard', '/clientes', '/consultas', '/perfil', '/admin/vendas']) {
      expect(proibida(rota), rota).toBe(true)
    }
  })

  it('as telas da loja que dependem de conta', () => {
    // Nasceram depois desta lista e ficaram de fora dela até 16/08.
    expect(proibida('/vendas')).toBe(true)
    expect(proibida('/minhas-compras')).toBe(true)
  })

  it('o recibo do comprador, mesmo sendo público por token', () => {
    /*
     * Público «para quem tem o link» não é público «para o índice». O recibo
     * traz nome e e-mail de quem comprou; indexado, deixa de depender do token
     * e passa a depender de ninguém procurar.
     */
    expect(proibida('/pedido/abc123')).toBe(true)
  })

  it('as vitrines dos consultores continuam indexáveis', () => {
    // `/loja` e `/consultores` existem para ser encontradas — é o contrário do
    // resto desta lista, e por isso precisa de caso próprio.
    expect(proibida('/loja/maria')).toBe(false)
    expect(proibida('/consultores')).toBe(false)
  })
})
