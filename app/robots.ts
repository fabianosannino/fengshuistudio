import type { MetadataRoute } from 'next'
import { URL_CANONICA } from '../src/lib/auth-rotas'

/**
 * O `robots.txt` que o projeto nunca teve.
 *
 * Sem ele, `/robots.txt` respondia 404 — ou, antes da correção do matcher, um
 * redirect para o login. Um buscador que pede `robots.txt` e recebe página de
 * login não descobre o `sitemap.xml`, e o site inteiro fica dependendo de
 * links externos para ser encontrado.
 *
 * ## O que fica de fora
 *
 * As áreas autenticadas. Elas já exigem sessão, então o buscador não veria
 * conteúdo nenhum — só a página de login, repetida dezenas de vezes sob URLs
 * diferentes. Pedir para não rastrear evita esse ruído no índice.
 *
 * `/loja` e `/consultores` **não** entram na lista: são as vitrines públicas
 * dos consultores, e existem para ser encontradas.
 *
 * ## Esta lista já divergiu duas vezes, nos dois sentidos
 *
 * `/produtos` ficou aqui depois de a vitrine da plataforma virar página
 * pública. O `sitemap.xml` a anunciava com prioridade 0.9 — a mais alta, junto
 * de `/precos` — enquanto este arquivo mandava não rastrear. Uma loja aberta
 * de propósito, pedida ao buscador com a mão direita e retirada com a esquerda.
 *
 * No outro sentido, `/vendas`, `/minhas-compras` e `/pedido` nunca entraram:
 * nasceram com a loja, depois desta lista, e ninguém voltou aqui.
 *
 * `robots.test.ts` guarda o primeiro sentido — nenhuma rota de marketing pode
 * aparecer aqui. O segundo não dá para testar contra nada, porque não existe
 * lista de «tudo que é autenticado» para comparar; é revisão na hora de criar
 * rota nova.
 */
export const AREAS_AUTENTICADAS = [
  '/api/',
  '/admin',
  '/dashboard',
  '/clientes',
  '/consultas',
  '/curas',
  '/pagamentos',
  '/perfil',
  '/planos',
  '/relatorios',
  '/roda-da-vida',
  '/bagua-planta',
  '/calendario',
  '/demonstracao',
  '/parceiros',
  '/stripe',
  // Da loja: o painel do consultor e o do comprador com conta.
  '/vendas',
  '/minhas-compras',
  /*
   * `/pedido/<token>` é público — o token é a credencial (ADR 0030). Mas é o
   * recibo de uma compra, com nome e e-mail de quem comprou, e público «para
   * quem tem o link» não é público «para o índice do Google». Basta o link
   * vazar uma vez, num print ou num e-mail encaminhado, para o recibo ficar
   * pesquisável — e aí a credencial não protege mais nada.
   */
  '/pedido',
  // Fluxos de credencial. `/redefinir-senha` carrega token na URL.
  '/auth/',
  '/esqueci-senha',
  '/redefinir-senha',
]

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: AREAS_AUTENTICADAS,
    },
    sitemap: `${URL_CANONICA}/sitemap.xml`,
  }
}
