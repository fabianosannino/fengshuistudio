/**
 * Quem passa sem sessão — e por quê.
 *
 * ## Por que virou módulo
 *
 * Porque a lista estava dentro do middleware, onde não havia teste que a
 * alcançasse, e o que faltava nela era grande: **a loja inteira**.
 *
 * `/pedido/<token>` e `/api/pedidos/publico` não constavam. A loja é
 * construída sobre «o comprador não tem conta» — ele paga como convidado e a
 * posse do token é o que prova o direito de ver. O middleware mandava esse
 * comprador para o login: a página respondia `307 → /login` e a rota, `401`.
 *
 * Ninguém viu porque quem testou estava logado. E o e-mail de confirmação
 * piorou o efeito: ele entrega o único link que o comprador tem, e o link
 * levava à tela de entrada de um app do qual ele não faz parte.
 *
 * Aqui a lista fica testável, e o teste é o que impede a próxima rota pública
 * de nascer fechada.
 */

import { ROTA_CALLBACK_AUTH, ehRotaDeMarketing } from './auth-rotas'

/**
 * Páginas abertas por caminho exato.
 *
 * `/auth/callback` é público por necessidade: é ele quem cria a sessão a
 * partir do link de e-mail. Exigir sessão ali tornaria o fluxo impossível.
 */
export const PAGINAS_PUBLICAS = [
  '/', '/login', '/esqueci-senha', '/redefinir-senha', '/landing',
  '/termos', '/privacidade', '/consultores', ROTA_CALLBACK_AUTH,
] as const

/**
 * Páginas abertas por prefixo, porque levam identificador no caminho.
 *
 * - `/loja/<slug>` e `/store/<acct_…>` — as vitrines dos consultores;
 * - `/pedido/<token>` — o recibo do comprador, cujo token **é** a credencial.
 */
export const PREFIXOS_DE_PAGINA_PUBLICA = ['/loja', '/store', '/pedido'] as const

/**
 * APIs abertas, uma a uma.
 *
 * Nunca por prefixo largo: `/api/pedidos` abriria junto o `/estorno`, que é do
 * vendedor, e o `/minhas-compras`, que é de quem tem conta. Rota pública é
 * decisão individual, e uma lista de nomes é o que obriga a tomá-la.
 */
export const APIS_PUBLICAS = [
  // Webhooks: chegam sem cookie e validam a assinatura na própria rota.
  '/api/stripe/webhooks',
  // Compra na loja do consultor, por comprador anônimo.
  '/api/stripe/checkout',
  '/api/stripe/products',
  // O comprador vê e acompanha o próprio pedido pela posse do token.
  '/api/pedidos/publico',
  // A entrega do bem digital — o acesso é derivado do estado do pedido
  // dentro da rota (ADR 0031); aqui só se garante que a requisição chega.
  '/api/pedidos/arquivo',
  // Vitrine e checkout do catálogo próprio da plataforma (fase 2).
  '/api/loja/produtos',
  '/api/loja/checkout',
  // O clique que mede e encaminha para a loja do parceiro (fase 4).
  '/api/loja/indicacao',
] as const

export function ehPaginaPublica(pathname: string): boolean {
  return (PAGINAS_PUBLICAS as readonly string[]).includes(pathname)
    || ehRotaDeMarketing(pathname)
    || PREFIXOS_DE_PAGINA_PUBLICA.some(prefixo => pathname.startsWith(prefixo))
}

export function ehApiPublica(pathname: string): boolean {
  return (APIS_PUBLICAS as readonly string[]).some(rota => pathname.startsWith(rota))
}
