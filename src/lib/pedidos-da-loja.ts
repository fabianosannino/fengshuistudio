/**
 * O pedido da loja — e por que ele não tem coluna `status`.
 *
 * ## O defeito que originou este módulo
 *
 * `store_orders` existia desde abril e nunca recebeu uma linha: o checkout da
 * loja criava a sessão no Stripe e terminava ali, sem nenhum tratamento de
 * `checkout.session.completed`. Uma venda movia dinheiro e não deixava registro
 * deste lado — o mesmo formato do defeito da assinatura antes da reconciliação.
 *
 * ## O estado é resultado, não campo
 *
 * Um pedido muda por caminhos independentes — pagamento, envio, reembolso,
 * contestação — e cada um chega por uma origem diferente, às vezes fora de
 * ordem. Uma coluna que guarda só o último valor não sabe dizer quem escreveu,
 * quando, nem o que havia antes.
 *
 * `pedido_eventos` é append-only; `estadoDoPedido` deriva. É o ADR 0027
 * aplicado ao pedido, e a terceira vez que este projeto troca campo gravado por
 * cálculo — depois de «atrasado» e do plano.
 *
 * ## A propriedade que isso compra
 *
 * **Entrega fora de ordem deixa de corromper.** O estado sai da precedência
 * entre os eventos, não da ordem em que chegaram: um `pago` que chega depois
 * de um `reembolsado` não desfaz o reembolso. Com coluna sobrescrita, desfaria
 * — e ninguém saberia, porque não sobraria histórico para comparar.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { logger } from './logger'

export type EstadoDoPedido =
  | 'iniciado' | 'pago' | 'cancelado' | 'preparando' | 'enviado'
  | 'entregue' | 'devolucao_solicitada' | 'reembolsado' | 'contestado'
  | 'disputa_resolvida'

export type OrigemDoEvento =
  | 'webhook_stripe' | 'vendedor' | 'comprador' | 'admin' | 'sistema'

export interface EventoDoPedido {
  evento: string
  ocorrido_em?: string | null
  origem?: OrigemDoEvento | string
  referencia?: string | null
  motivo?: string | null
}

/**
 * Precedência entre estados. O estado corrente é o **maior** já alcançado.
 *
 * Não é a ordem cronológica: é a ordem de irreversibilidade. Um pedido que já
 * foi contestado não volta a ser «pago» porque um webhook atrasado chegou
 * depois — a contestação continua sendo o fato mais forte sobre ele.
 *
 * `cancelado` fica acima de `entregue` de propósito: cancelamento só existe
 * antes do pagamento, então na prática ele nunca disputa com os de cima. Ficar
 * alto garante que, se algum dia disputar, o desfecho negativo prevaleça — que
 * é o erro barato dos dois.
 */
const PRECEDENCIA: Record<EstadoDoPedido, number> = {
  iniciado: 0,
  pago: 10,
  preparando: 20,
  enviado: 30,
  entregue: 40,
  // Abaixo de `reembolsado` de propósito: o pedido de devolução é uma
  // pendência do vendedor, e o estorno a resolve. Acima, o pedido continuaria
  // aparecendo como pendente depois de pago de volta.
  devolucao_solicitada: 45,
  cancelado: 50,
  reembolsado: 60,
  contestado: 70,
  disputa_resolvida: 80,
}

function forcaDe(evento: string): number {
  return PRECEDENCIA[evento as EstadoDoPedido] ?? -1
}

/**
 * O estado corrente do pedido.
 *
 * Sem nenhum evento devolve `iniciado` — todo pedido nasce com o seu, gravado
 * pela rota de checkout antes do redirecionamento. Uma lista vazia significa
 * leitura incompleta, não pedido novo; devolver `iniciado` é o palpite
 * conservador, porque é o estado que não afirma nada sobre dinheiro.
 */
export function estadoDoPedido(eventos: EventoDoPedido[]): EstadoDoPedido {
  let melhor: EstadoDoPedido = 'iniciado'

  for (const evento of eventos) {
    if (forcaDe(evento.evento) > forcaDe(melhor)) melhor = evento.evento as EstadoDoPedido
  }

  return melhor
}

/** Sete dias do CDC art. 49, em milissegundos. */
const PRAZO_DE_ARREPENDIMENTO_MS = 7 * 24 * 60 * 60 * 1000

/**
 * Tipos cujo prazo começa na **entrega**, porque há uma caixa chegando.
 *
 * O que fica de fora — serviço e bem digital — conta do pagamento, e a
 * diferença não é de estilo: um e-book tratado como bem físico esperaria um
 * evento `entregue` que nunca acontece, o prazo ficaria `null` para sempre e o
 * comprador nunca conseguiria pedir devolução. O direito existiria no CDC e
 * não existiria no app.
 */
const TIPOS_COM_REMESSA = new Set(['bem_proprio_fisico', 'bem_de_terceiro'])

/**
 * Até quando o comprador pode se arrepender — derivado, nunca gravado.
 *
 * A origem da contagem muda com o que foi vendido, e a diferença é jurídica,
 * não estética:
 *
 * | o que | conta a partir de |
 * |---|---|
 * | bem físico | a entrega — é quando ele recebe |
 * | bem digital | o pagamento |
 * | serviço | a contratação, aqui representada pelo pagamento |
 *
 * Devolve `null` quando o marco ainda não aconteceu: pedido físico não
 * entregue não tem prazo correndo, e isso é ausência, não prazo zero.
 * Mostrá-lo como «vencido» tiraria do comprador um direito que sequer começou.
 */
export function prazoDeArrependimento(
  tipo: string,
  eventos: EventoDoPedido[]
): Date | null {
  const marco = TIPOS_COM_REMESSA.has(tipo)
    ? eventos.find(e => e.evento === 'entregue')
    : eventos.find(e => e.evento === 'pago')

  if (!marco?.ocorrido_em) return null

  const inicio = Date.parse(marco.ocorrido_em)
  if (!Number.isFinite(inicio)) return null

  return new Date(inicio + PRAZO_DE_ARREPENDIMENTO_MS)
}

/**
 * `true` enquanto o arrependimento do art. 49 está no prazo.
 *
 * Prazo ainda não iniciado devolve `false` — não porque o direito não exista,
 * mas porque ele não está **correndo**. Quem chama deve distinguir os dois com
 * `prazoDeArrependimento`, que devolve `null` nesse caso.
 */
export function dentroDoPrazoDeArrependimento(
  tipo: string,
  eventos: EventoDoPedido[],
  agora: Date = new Date()
): boolean {
  const prazo = prazoDeArrependimento(tipo, eventos)
  return prazo !== null && prazo.getTime() > agora.getTime()
}

/** `true` quando o dinheiro entrou e não voltou. */
export function pedidoRendeuReceita(eventos: EventoDoPedido[]): boolean {
  const estado = estadoDoPedido(eventos)
  return forcaDe(estado) >= PRECEDENCIA.pago && forcaDe(estado) < PRECEDENCIA.reembolsado
}

/** Rótulo em português para a tela do vendedor. */
export function rotuloDoEstado(estado: EstadoDoPedido): string {
  const rotulos: Record<EstadoDoPedido, string> = {
    iniciado: 'Aguardando pagamento',
    pago: 'Pago',
    cancelado: 'Cancelado',
    preparando: 'Em preparo',
    enviado: 'Enviado',
    entregue: 'Entregue',
    devolucao_solicitada: 'Devolução solicitada',
    reembolsado: 'Reembolsado',
    contestado: 'Contestado',
    disputa_resolvida: 'Disputa resolvida',
  }
  return rotulos[estado] ?? estado
}

// ── Escrita ──────────────────────────────────────────────────────────────────

const PEDIDOS = 'pedidos'
const ITENS = 'pedido_itens'
const EVENTOS = 'pedido_eventos'

/** Código do Postgres para violação de unicidade. */
const VIOLACAO_DE_UNICIDADE = '23505'

export type TipoDePedido =
  | 'servico' | 'bem_proprio_digital' | 'bem_proprio_fisico' | 'bem_de_terceiro'

export interface PedidoParaCriar {
  tipo: TipoDePedido
  vendedorTipo: 'consultor' | 'plataforma' | 'terceiro'
  vendedorPerfilId?: string | null
  stripeAccountId?: string | null
  totalCentavos: number
  taxaPlataformaCentavos: number
  item: {
    nome: string
    descricao?: string | null
    precoUnitarioCentavos: number
    quantidade: number
    stripePriceId?: string | null
    /**
     * Só no catálogo próprio, e só para saber **qual arquivo entregar**. O
     * item continua sendo fotografia: nome e preço permanecem copiados, e
     * nenhuma tela lê o produto vivo para exibir o que foi comprado.
     */
    produtoId?: string | null
  }
}

/**
 * Cria o pedido em `iniciado`, com o item fotografado, **antes** do
 * redirecionamento para o Stripe.
 *
 * Nasce antes do pagamento por uma razão só: o webhook precisa de onde
 * escrever. Se o pedido só existisse na confirmação, o handler teria que
 * reconstruir a venda a partir do que o Stripe devolve — e passaria a existir
 * um caminho em que a reconstrução falha e a venda some, que é exatamente o
 * defeito que este módulo conserta.
 *
 * Devolve o id, ou `null` quando não deu para gravar. **Quem chama deve
 * abortar o checkout nesse caso** — ver a nota na rota.
 */
export async function criarPedidoIniciado(
  supabase: SupabaseClient,
  pedido: PedidoParaCriar,
  origemDoLog: string
): Promise<{ id: string; tokenPublico: string } | null> {
  const { data, error } = await supabase
    .from(PEDIDOS)
    .insert({
      tipo: pedido.tipo,
      vendedor_tipo: pedido.vendedorTipo,
      vendedor_perfil_id: pedido.vendedorPerfilId ?? null,
      stripe_account_id: pedido.stripeAccountId ?? null,
      total_centavos: pedido.totalCentavos,
      taxa_plataforma_centavos: pedido.taxaPlataformaCentavos,
    })
    // O token vem de volta na mesma escrita: é ele que monta o link do
    // comprador, e uma segunda consulta só para lê-lo abriria um caminho em
    // que o pedido existe e o link não.
    .select('id, token_publico')
    .single()

  if (error || !data) {
    logger.error('Não foi possível criar o pedido', {
      origem: origemDoLog, error: error?.message,
    })
    return null
  }

  const { error: erroDoItem } = await supabase.from(ITENS).insert({
    pedido_id: data.id,
    nome: pedido.item.nome,
    descricao: pedido.item.descricao ?? null,
    preco_unitario_centavos: pedido.item.precoUnitarioCentavos,
    quantidade: pedido.item.quantidade,
    stripe_price_id: pedido.item.stripePriceId ?? null,
    produto_id: pedido.item.produtoId ?? null,
  })

  if (erroDoItem) {
    logger.error('Não foi possível gravar o item do pedido', {
      origem: origemDoLog, pedidoId: data.id, error: erroDoItem.message,
    })
    return null
  }

  await registrarEvento(supabase, {
    pedidoId: data.id,
    evento: 'iniciado',
    origem: 'sistema',
  }, origemDoLog)

  return { id: data.id, tokenPublico: data.token_publico }
}

/** Guarda o `session_id` depois que o Stripe o devolve. */
export async function anotarSessaoDoPedido(
  supabase: SupabaseClient,
  pedidoId: string,
  sessionId: string,
  origemDoLog: string
): Promise<boolean> {
  const { error } = await supabase
    .from(PEDIDOS)
    .update({ stripe_session_id: sessionId })
    .eq('id', pedidoId)

  if (error) {
    // Não é fatal: o `pedido_id` vai no `metadata` da sessão, e o webhook
    // procura por ele primeiro. O `session_id` é o caminho reserva.
    logger.warn('Não foi possível anotar a sessão no pedido', {
      origem: origemDoLog, pedidoId, error: error.message,
    })
    return false
  }
  return true
}

/**
 * Acrescenta um evento. Nunca atualiza nada — a tabela tem trigger que recusa.
 *
 * Idempotente por `referencia`: o mesmo `evt_...` não entra duas vezes. Isso
 * importa porque `reivindicarEvento` devolve `retomado` quando uma tentativa
 * anterior morreu no meio, e o handler roda de novo de propósito.
 */
export async function registrarEvento(
  supabase: SupabaseClient,
  evento: {
    pedidoId: string
    evento: EstadoDoPedido
    origem: OrigemDoEvento
    referencia?: string | null
    ocorridoEm?: string | null
    motivo?: string | null
    dados?: Record<string, unknown> | null
  },
  origemDoLog: string
): Promise<boolean> {
  const { error } = await supabase.from(EVENTOS).insert({
    pedido_id: evento.pedidoId,
    evento: evento.evento,
    origem: evento.origem,
    referencia: evento.referencia ?? null,
    ocorrido_em: evento.ocorridoEm ?? new Date().toISOString(),
    motivo: evento.motivo ?? null,
    dados: evento.dados ?? null,
  })

  if (!error) return true

  if (error.code === VIOLACAO_DE_UNICIDADE) {
    logger.info('Evento do pedido já registrado — reentrega descartada', {
      origem: origemDoLog, pedidoId: evento.pedidoId, evento: evento.evento,
    })
    return true
  }

  logger.error('Não foi possível registrar o evento do pedido', {
    origem: origemDoLog, pedidoId: evento.pedidoId, evento: evento.evento,
    error: error.message,
  })
  return false
}

/**
 * Acha o pedido de uma sessão do Stripe.
 *
 * Procura pelo `pedido_id` do `metadata` primeiro, e só depois pelo
 * `session_id`. A ordem é deliberada: o `metadata` é gravado **na criação da
 * sessão**, enquanto o `session_id` depende de um `update` posterior que pode
 * ter falhado. O caminho mais confiável vem antes.
 */
export async function acharPedidoDaSessao(
  supabase: SupabaseClient,
  sessao: { id?: string | null; metadata?: Record<string, string> | null },
  origemDoLog: string
): Promise<string | null> {
  const doMetadata = sessao.metadata?.pedido_id
  if (doMetadata) return doMetadata

  if (!sessao.id) return null

  const { data, error } = await supabase
    .from(PEDIDOS)
    .select('id')
    .eq('stripe_session_id', sessao.id)
    .maybeSingle()

  if (error) {
    logger.error('Não foi possível procurar o pedido da sessão', {
      origem: origemDoLog, sessionId: sessao.id, error: error.message,
    })
    return null
  }

  if (!data) {
    logger.warn('Sessão paga sem pedido correspondente', {
      origem: origemDoLog, sessionId: sessao.id,
    })
    return null
  }

  return data.id
}

/**
 * Confirma o pagamento: grava o que só o Stripe sabe e acrescenta o `pago`.
 *
 * As colunas atualizadas aqui — e-mail do comprador, `payment_intent` — são
 * fatos que **não existiam** quando o pedido nasceu, não estado. Estado
 * continua saindo dos eventos.
 */
export async function confirmarPagamento(
  supabase: SupabaseClient,
  confirmacao: {
    pedidoId: string
    compradorEmail?: string | null
    compradorNome?: string | null
    paymentIntent?: string | null
    totalCentavos?: number | null
    referencia: string
    ocorridoEm?: string | null
  },
  origemDoLog: string
): Promise<boolean> {
  const campos: Record<string, unknown> = {}
  if (confirmacao.compradorEmail) campos.comprador_email = confirmacao.compradorEmail
  if (confirmacao.compradorNome) campos.comprador_nome = confirmacao.compradorNome
  if (confirmacao.paymentIntent) campos.stripe_payment_intent = confirmacao.paymentIntent
  // O total pago é o do Stripe, não o estimado na criação: cupom e imposto
  // podem ter mudado o valor entre o redirecionamento e o cartão.
  if (typeof confirmacao.totalCentavos === 'number') campos.total_centavos = confirmacao.totalCentavos

  if (Object.keys(campos).length > 0) {
    const { error } = await supabase.from(PEDIDOS).update(campos).eq('id', confirmacao.pedidoId)
    if (error) {
      logger.error('Não foi possível completar os dados do pedido pago', {
        origem: origemDoLog, pedidoId: confirmacao.pedidoId, error: error.message,
      })
      // Segue para o evento assim mesmo: registrar que **foi pago** vale mais
      // do que o e-mail do comprador, e perder o `pago` por causa do e-mail
      // seria trocar o fato importante pelo acessório.
    }
  }

  return registrarEvento(supabase, {
    pedidoId: confirmacao.pedidoId,
    evento: 'pago',
    origem: 'webhook_stripe',
    referencia: confirmacao.referencia,
    ocorridoEm: confirmacao.ocorridoEm ?? null,
  }, origemDoLog)
}

/**
 * Os valores do pedido, para montar o razão.
 *
 * Lido do banco e não do Stripe porque `frete_centavos` e
 * `taxa_plataforma_centavos` são decisões nossas, tomadas no checkout — o
 * Stripe só sabe o total.
 */
export async function valoresDoPedido(
  supabase: SupabaseClient,
  pedidoId: string,
  origemDoLog: string
): Promise<{
  total: number
  frete: number
  taxa: number
  contaConectada: string | null
  vendedor: 'consultor' | 'plataforma'
} | null> {
  const { data, error } = await supabase
    .from(PEDIDOS)
    .select('total_centavos, frete_centavos, taxa_plataforma_centavos, stripe_account_id, vendedor_tipo')
    .eq('id', pedidoId)
    .maybeSingle()

  if (error || !data) {
    logger.error('Não foi possível ler os valores do pedido', {
      origem: origemDoLog, pedidoId, error: error?.message,
    })
    return null
  }

  return {
    total: data.total_centavos ?? 0,
    frete: data.frete_centavos ?? 0,
    taxa: data.taxa_plataforma_centavos ?? 0,
    contaConectada: data.stripe_account_id ?? null,
    // `terceiro` ainda não existe como vendedor (fase 4). Até lá, tudo o que
    // não é consultor é venda nossa — e o razão precisa de uma das quatro
    // partes, não de um rótulo novo por fase.
    vendedor: data.vendedor_tipo === 'consultor' ? 'consultor' : 'plataforma',
  }
}

/**
 * Tudo o que a confirmação por e-mail precisa, numa consulta.
 *
 * Devolve `null` também quando a confirmação **já saiu** — o chamador não tem
 * o que decidir nesse caso, e devolver os dados junto com um booleano só
 * convidaria alguém a ignorá-lo.
 */
export async function pedidoParaConfirmar(
  supabase: SupabaseClient,
  pedidoId: string,
  origemDoLog: string
): Promise<{
  numero: string
  tipo: string
  compradorEmail: string | null
  totalCentavos: number
  tokenPublico: string
  itens: { nome: string; quantidade: number }[]
  eventos: EventoDoPedido[]
} | null> {
  const { data, error } = await supabase
    .from(PEDIDOS)
    .select(`numero, tipo, comprador_email, total_centavos, token_publico,
             confirmacao_enviada_em,
             pedido_itens(nome, quantidade), pedido_eventos(evento, ocorrido_em)`)
    .eq('id', pedidoId)
    .maybeSingle()

  if (error || !data) {
    logger.error('Não foi possível ler o pedido para confirmação', {
      origem: origemDoLog, pedidoId, error: error?.message,
    })
    return null
  }

  if (data.confirmacao_enviada_em) return null
  if (!data.comprador_email) return null

  return {
    numero: data.numero,
    tipo: data.tipo,
    compradorEmail: data.comprador_email,
    totalCentavos: data.total_centavos ?? 0,
    tokenPublico: data.token_publico,
    itens: data.pedido_itens ?? [],
    eventos: data.pedido_eventos ?? [],
  }
}

/**
 * Marca a confirmação como enviada.
 *
 * Depois do envio, não antes: marcar antes trocaria «pode ter chegado duas
 * vezes» por «pode não ter chegado nenhuma», e o segundo é pior — o comprador
 * ficaria sem o único link que tem para o pedido.
 */
export async function marcarConfirmacaoEnviada(
  supabase: SupabaseClient,
  pedidoId: string,
  origemDoLog: string
): Promise<void> {
  const { error } = await supabase
    .from(PEDIDOS)
    .update({ confirmacao_enviada_em: new Date().toISOString() })
    .eq('id', pedidoId)

  if (error) {
    logger.warn('Não foi possível marcar a confirmação como enviada', {
      origem: origemDoLog, pedidoId, error: error.message,
    })
  }
}

/** Acha o pedido de uma cobrança, para reembolso e contestação. */
export async function acharPedidoDoPagamento(
  supabase: SupabaseClient,
  paymentIntent: string,
  origemDoLog: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from(PEDIDOS)
    .select('id')
    .eq('stripe_payment_intent', paymentIntent)
    .maybeSingle()

  if (error) {
    logger.error('Não foi possível procurar o pedido do pagamento', {
      origem: origemDoLog, paymentIntent, error: error.message,
    })
    return null
  }

  return data?.id ?? null
}
