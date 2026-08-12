import type { MetadataRoute } from 'next'

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
 */
const AREAS_AUTENTICADAS = [
  '/api/',
  '/admin',
  '/dashboard',
  '/clientes',
  '/consultas',
  '/curas',
  '/pagamentos',
  '/perfil',
  '/planos',
  '/produtos',
  '/relatorios',
  '/roda-da-vida',
  '/bagua-planta',
  '/calendario',
  '/demonstracao',
  '/parceiros',
  '/stripe',
]

export default function robots(): MetadataRoute.Robots {
  const baseUrl = 'https://fengshuistudio.vercel.app'

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: AREAS_AUTENTICADAS,
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
