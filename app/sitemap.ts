import type { MetadataRoute } from 'next'
import { ROTAS_MARKETING } from '../src/lib/auth-rotas'

/**
 * O sitemap lista o que um visitante sem sessão realmente alcança.
 *
 * Antes anunciava `/planos`, que é tela de app e redireciona para o login —
 * o buscador seguia o link e indexava a página de login — e omitia `/precos`,
 * que é a página de preços do site. As rotas de marketing agora vêm de
 * `ROTAS_MARKETING`, a mesma lista que o middleware usa para liberar acesso,
 * para que «indexável» e «acessível» não voltem a divergir.
 */
const BASE_URL = 'https://fengshuistudio.vercel.app'

/** Subpáginas de recurso — existem como página, não como rota derivada. */
const SUBPAGINAS_DE_RECURSO = [
  '/recursos/bagua',
  '/recursos/calendario',
  '/recursos/relatorios',
  '/recursos/roda-da-vida',
]

/** Quanto cada rota importa para busca. O que não estiver aqui vale 0.6. */
const PRIORIDADE: Record<string, number> = {
  '/precos': 0.9,
  '/recursos': 0.8,
  '/para-consultores': 0.8,
  '/minha-casa': 0.8,
  '/sobre': 0.6,
  '/rede-de-parceiros': 0.6,
}

export default function sitemap(): MetadataRoute.Sitemap {
  const agora = new Date()

  const paginas: MetadataRoute.Sitemap = [
    { url: BASE_URL, lastModified: agora, changeFrequency: 'weekly', priority: 1.0 },
    { url: `${BASE_URL}/login`, lastModified: agora, changeFrequency: 'monthly', priority: 0.8 },
  ]

  for (const rota of [...ROTAS_MARKETING, ...SUBPAGINAS_DE_RECURSO]) {
    paginas.push({
      url: `${BASE_URL}${rota}`,
      lastModified: agora,
      changeFrequency: 'monthly',
      priority: PRIORIDADE[rota] ?? 0.6,
    })
  }

  for (const rota of ['/termos', '/privacidade']) {
    paginas.push({
      url: `${BASE_URL}${rota}`,
      lastModified: agora,
      changeFrequency: 'yearly',
      priority: 0.3,
    })
  }

  return paginas
}
