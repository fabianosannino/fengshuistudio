import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * O `matcher` decide em quais caminhos o middleware roda — e onde ele roda,
 * roda a checagem de sessão.
 *
 * Não dá para importar `config` de `middleware.ts` aqui: o módulo cria o
 * cliente do Supabase no topo e exigiria as variáveis de ambiente. Então o
 * teste lê o padrão do arquivo. É frágil de um jeito honesto: se alguém mudar
 * o formato da linha, o teste falha em vez de passar sobre a regra errada.
 */
function padraoDoMatcher(): RegExp {
  const fonte = readFileSync(resolve(import.meta.dirname, '../middleware.ts'), 'utf8')
  const linha = fonte.match(/^\s*'(\/\(\(\?!.*)',$/m)
  if (!linha) throw new Error('matcher não encontrado em middleware.ts')
  return new RegExp(`^${linha[1].replace(/\\\\/g, '\\')}$`)
}

const rodaOMiddleware = (caminho: string) => padraoDoMatcher().test(caminho)

describe('matcher do middleware', () => {
  it('não roda em robots.txt nem sitemap.xml', () => {
    // Os dois respondiam redirect para o login. O buscador pede `robots.txt`,
    // recebe página de login e não indexa nada — inclusive o `sitemap.xml` que
    // lista as páginas de marketing.
    expect(rodaOMiddleware('/robots.txt')).toBe(false)
    expect(rodaOMiddleware('/sitemap.xml')).toBe(false)
  })

  it('não roda nos estáticos do Next nem em imagem', () => {
    for (const caminho of [
      '/_next/static/chunk.js', '/_next/image', '/favicon.ico',
      '/manifest.json', '/sw.js', '/icons/logo.png', '/foto.webp',
    ]) {
      expect(rodaOMiddleware(caminho), caminho).toBe(false)
    }
  })

  it('continua rodando nas rotas de página e de API', () => {
    // A exceção precisa ser estreita: se ela abrisse demais, o middleware
    // deixaria de proteger tela autenticada.
    for (const caminho of ['/dashboard', '/clientes', '/api/planos', '/perfil', '/precos']) {
      expect(rodaOMiddleware(caminho), caminho).toBe(true)
    }
  })

  it('a exceção é por nome, não por extensão', () => {
    // `.txt`/`.xml` genérico abriria qualquer rota futura terminada assim.
    expect(rodaOMiddleware('/dados-privados.txt')).toBe(true)
    expect(rodaOMiddleware('/relatorio.xml')).toBe(true)
  })
})
