/**
 * A visão que o comprador tem do próprio pedido.
 *
 * ## Por que existe um módulo só para isto
 *
 * Porque o que o comprador pode ver é **menos** do que a tabela contém, e a
 * diferença precisa ficar num lugar só. O razão do pedido tem a comissão da
 * plataforma e o líquido do consultor — negócio do vendedor, não do
 * comprador. Montar essa projeção dentro da rota faria cada rota nova ter que
 * lembrar de esconder as mesmas colunas.
 *
 * A regra é a de `perfis_publicos` (ADR 0028) aplicada ao pedido: **lista
 * branca de campos**, não lista negra. Campo novo em `pedidos` não vaza
 * sozinho — é preciso adicioná-lo aqui, e aí a decisão é consciente.
 */

import { estadoDoPedido, prazoDeArrependimento, dentroDoPrazoDeArrependimento,
  rotuloDoEstado, type EventoDoPedido } from './pedidos-da-loja'
import type { Lancamento } from './lancamentos-do-pedido'

export interface PedidoBruto {
  numero: string
  tipo: string
  criado_em: string
  total_centavos: number
  comprador_email: string | null
  token_expira_em?: string | null
  pedido_itens?: { nome: string; quantidade: number; preco_unitario_centavos: number }[]
  pedido_eventos?: EventoDoPedido[]
  pedido_lancamentos?: Lancamento[]
}

export interface PedidoParaOComprador {
  numero: string
  criado_em: string
  situacao: string
  rotulo: string
  total_centavos: number
  devolvido_centavos: number
  itens: { nome: string; quantidade: number; preco_unitario_centavos: number }[]
  /** Só os fatos que dizem respeito a ele. */
  historico: { evento: string; rotulo: string; ocorrido_em: string | null }[]
  arrependimento_ate: string | null
  pode_pedir_devolucao: boolean
  comprador_email_mascarado: string | null
}

/**
 * Eventos que interessam ao comprador.
 *
 * `iniciado` fica de fora de propósito: para ele a compra começou quando
 * pagou, e mostrar um passo anterior ao pagamento só levanta a pergunta «o que
 * é isto?». Os operacionais do vendedor — `preparando` — também não entram
 * enquanto não houver bem físico.
 */
const EVENTOS_VISIVEIS = new Set([
  'pago', 'enviado', 'entregue', 'devolucao_solicitada', 'reembolsado', 'cancelado',
])

/**
 * Mascara o e-mail para confirmação sem reexibir o dado inteiro.
 *
 * Serve para o comprador reconhecer que o pedido é dele. Reimprimir o endereço
 * completo numa página aberta por link não acrescenta nada e amplia o estrago
 * se o link vazar.
 */
export function mascararEmail(email: string | null | undefined): string | null {
  if (!email) return null
  const [usuario, dominio] = email.split('@')
  if (!dominio) return null
  const visivel = usuario.slice(0, 2)
  return `${visivel}${'•'.repeat(Math.max(1, usuario.length - 2))}@${dominio}`
}

/** Quanto já voltou para o comprador, somado do razão. */
export function devolvidoAoComprador(lancamentos: Lancamento[]): number {
  return lancamentos
    .filter(l => l.recebedor === 'comprador' && Number.isFinite(l.valor_centavos))
    .reduce((soma, l) => soma + l.valor_centavos, 0)
}

/**
 * A projeção pública do pedido.
 *
 * Note o que **não** sai daqui: id, vendedor, ids do Stripe, comissão da
 * plataforma, líquido do consultor. Nada disso é assunto de quem comprou.
 */
export function pedidoParaOComprador(
  pedido: PedidoBruto,
  agora: Date = new Date()
): PedidoParaOComprador {
  const eventos = pedido.pedido_eventos ?? []
  const estado = estadoDoPedido(eventos)
  const prazo = prazoDeArrependimento(pedido.tipo, eventos)
  const noPrazo = dentroDoPrazoDeArrependimento(pedido.tipo, eventos, agora)

  const jaPediu = eventos.some(e => e.evento === 'devolucao_solicitada')
  const jaVoltou = estado === 'reembolsado' || estado === 'cancelado'

  return {
    numero: pedido.numero,
    criado_em: pedido.criado_em,
    situacao: estado,
    rotulo: rotuloDoEstado(estado),
    total_centavos: pedido.total_centavos,
    devolvido_centavos: devolvidoAoComprador(pedido.pedido_lancamentos ?? []),
    itens: (pedido.pedido_itens ?? []).map(i => ({
      nome: i.nome, quantidade: i.quantidade, preco_unitario_centavos: i.preco_unitario_centavos,
    })),
    historico: eventos
      .filter(e => EVENTOS_VISIVEIS.has(e.evento))
      .map(e => ({
        evento: e.evento,
        rotulo: rotuloDoEstado(e.evento as never),
        ocorrido_em: e.ocorrido_em ?? null,
      })),
    arrependimento_ate: prazo ? prazo.toISOString() : null,
    // Só dentro do prazo, uma vez, e enquanto o dinheiro não voltou.
    pode_pedir_devolucao: noPrazo && !jaPediu && !jaVoltou,
    comprador_email_mascarado: mascararEmail(pedido.comprador_email),
  }
}

/** `true` quando o link ainda vale. */
export function tokenNoPrazo(expiraEm: string | null | undefined, agora: Date = new Date()): boolean {
  if (!expiraEm) return false
  const fim = Date.parse(expiraEm)
  // Data ilegível recusa o acesso: aqui o erro barato é pedir para o comprador
  // falar com o vendedor, não abrir um pedido para quem não deveria ver.
  if (!Number.isFinite(fim)) return false
  return fim > agora.getTime()
}
