/**
 * Reconciliação da loja — o Stripe e o banco contam a mesma venda?
 *
 * ## Por que existe
 *
 * O mesmo motivo da reconciliação das assinaturas: **webhook não é garantia**.
 * Ele pode não chegar, chegar depois da janela de reentrega, ou morrer no meio
 * de um deploy. Quando isso acontece com uma venda, o dinheiro se move e este
 * lado não sabe — que é o defeito de origem da loja inteira.
 *
 * ## O que ela destrava
 *
 * Enquanto não existia, o checkout precisava **recusar a compra** se não
 * conseguisse gravar o pedido: sem forma de recuperar a venda depois, derrubar
 * era a única resposta honesta. Com a reconciliação rodando no cron diário, a
 * venda passa a ser recuperável a partir do Stripe.
 *
 * ## A parte pura fica aqui
 *
 * `compararVendas` não fala com ninguém. É o que permite testar o caso que
 * importa — cobrança no Stripe sem pedido aqui — sem precisar de venda real.
 */

/** O que o Stripe conta sobre uma cobrança da loja. */
export interface CobrancaNoStripe {
  /** `pi_...` — a chave que liga os dois lados. */
  paymentIntentId: string
  /** `null` quando a cobrança foi na conta da plataforma (bem próprio). */
  contaConectada: string | null
  /** Em centavos, como tudo neste projeto. */
  valorCentavos: number
  /** Quanto já foi devolvido. Zero quando não houve reembolso. */
  reembolsadoCentavos: number
  criadoEm: string
  compradorEmail: string | null
}

/** O que o banco guarda. */
export interface PedidoNoBanco {
  id: string
  numero: string
  stripe_payment_intent: string | null
  /** Gravado antes do redirecionamento — sobrevive ao webhook que não veio. */
  stripe_session_id?: string | null
  /** `null` na venda de bem próprio: a cobrança é na conta da plataforma. */
  stripe_account_id?: string | null
  total_centavos: number
  /** Quem vendeu — decide de quem sai a tarifa ao completar o razão. */
  vendedor_tipo?: string | null
  /** Derivado dos eventos antes de comparar — aqui já chega pronto. */
  estado: string
  /**
   * Os **tipos** já lançados no razão deste pedido.
   *
   * Só os tipos, não os valores: completar o razão é responder «o que falta?»,
   * e carregar o razão inteiro de mil pedidos para uma pergunta de presença
   * seria pagar caro por uma resposta booleana.
   */
  lancamentos?: string[]
}

export type TipoDeDivergenciaDaLoja =
  /** Cobrado no Stripe e sem pedido aqui. É o pior caso: venda invisível. */
  | 'venda_ausente_no_banco'
  /** O pedido existe, mas nunca recebeu o `pago`. Webhook perdido. */
  | 'pagamento_nao_registrado'
  /** Devolvido no Stripe e ainda «pago» aqui. */
  | 'reembolso_nao_registrado'
  /** Valores diferentes para a mesma cobrança. */
  | 'valor_diferente'
  /** Pedido pago aqui sem cobrança correspondente no Stripe. */
  | 'pedido_sem_cobranca'

export interface DivergenciaDaLoja {
  tipo: TipoDeDivergenciaDaLoja
  paymentIntentId: string
  pedidoId?: string
  numero?: string
  noStripe: string | number | null
  noBanco: string | number | null
  /**
   * `true` quando a correção é mecânica.
   *
   * `pedido_sem_cobranca` é o único que não é: um pedido pago sem cobrança no
   * Stripe não é dado velho, é dado que não deveria existir. Corrigir sem
   * entender de onde veio apagaria a evidência do problema.
   */
  corrigivel: boolean
}

/** Estados em que o pedido afirma que o dinheiro entrou. */
const AFIRMA_PAGAMENTO = new Set([
  'pago', 'preparando', 'enviado', 'entregue', 'devolucao_solicitada',
])

/**
 * Compara os dois lados e devolve o que não bate.
 *
 * A chave é o `payment_intent`. Não o `session_id`: sessão expira e some, e o
 * `pi_` sobrevive à cobrança inteira, inclusive ao reembolso.
 */
export function compararVendas(
  noStripe: CobrancaNoStripe[],
  noBanco: PedidoNoBanco[]
): DivergenciaDaLoja[] {
  const divergencias: DivergenciaDaLoja[] = []

  const porIntent = new Map<string, PedidoNoBanco>()
  for (const pedido of noBanco) {
    if (pedido.stripe_payment_intent) porIntent.set(pedido.stripe_payment_intent, pedido)
  }

  const vistosNoStripe = new Set<string>()

  for (const cobranca of noStripe) {
    vistosNoStripe.add(cobranca.paymentIntentId)
    const pedido = porIntent.get(cobranca.paymentIntentId)

    if (!pedido) {
      divergencias.push({
        tipo: 'venda_ausente_no_banco',
        paymentIntentId: cobranca.paymentIntentId,
        noStripe: cobranca.valorCentavos,
        noBanco: null,
        corrigivel: true,
      })
      continue
    }

    const comum = {
      paymentIntentId: cobranca.paymentIntentId,
      pedidoId: pedido.id,
      numero: pedido.numero,
    }

    if (!AFIRMA_PAGAMENTO.has(pedido.estado) && pedido.estado !== 'reembolsado') {
      divergencias.push({
        ...comum, tipo: 'pagamento_nao_registrado',
        noStripe: 'pago', noBanco: pedido.estado, corrigivel: true,
      })
    }

    if (cobranca.reembolsadoCentavos > 0 && pedido.estado !== 'reembolsado') {
      divergencias.push({
        ...comum, tipo: 'reembolso_nao_registrado',
        noStripe: cobranca.reembolsadoCentavos, noBanco: pedido.estado, corrigivel: true,
      })
    }

    if (cobranca.valorCentavos !== pedido.total_centavos) {
      divergencias.push({
        ...comum, tipo: 'valor_diferente',
        noStripe: cobranca.valorCentavos, noBanco: pedido.total_centavos, corrigivel: true,
      })
    }
  }

  /*
   * O outro sentido: pedido que afirma pagamento sem cobrança do lado de lá.
   *
   * Pedido `iniciado` sem cobrança é normal — é carrinho abandonado, e
   * acusá-lo encheria o relatório de ruído que esconderia o que importa.
   */
  for (const pedido of noBanco) {
    if (!pedido.stripe_payment_intent) continue
    if (vistosNoStripe.has(pedido.stripe_payment_intent)) continue
    if (!AFIRMA_PAGAMENTO.has(pedido.estado)) continue

    divergencias.push({
      tipo: 'pedido_sem_cobranca',
      paymentIntentId: pedido.stripe_payment_intent,
      pedidoId: pedido.id,
      numero: pedido.numero,
      noStripe: null,
      noBanco: pedido.estado,
      corrigivel: false,
    })
  }

  return divergencias
}

/**
 * Esta cobrança é uma venda da loja?
 *
 * ## O ruído que isto evita
 *
 * A varredura passou a incluir a conta da **plataforma**, porque desde a fase 2
 * vendemos bem próprio nela. Só que na nossa conta cai muito mais coisa do que
 * loja: assinatura, link de pagamento, cobrança manual. Sem esta pergunta,
 * cada uma delas virava um `venda_ausente_no_banco` — todo dia, para sempre.
 *
 * Relatório que acusa o que não é problema é pior do que relatório nenhum:
 * ensina a ignorá-lo, e o dia em que a acusação for verdadeira ela vai passar
 * junto com o resto.
 *
 * A regra: **na nossa conta, venda da loja carrega o `pedido_id`** que o
 * checkout carimba no `payment_intent`. Sem carimbo, não é venda nossa — é
 * assinatura, link de pagamento ou cobrança avulsa, e nenhuma delas deveria
 * ter pedido correspondente.
 *
 * Na conta **conectada** não há carimbo a exigir: ali só existe cobrança da
 * loja, porque o consultor não vende mais nada por ela.
 *
 * **Lacuna declarada:** cobranças na conta da plataforma anteriores ao carimbo
 * ficam de fora. São as de antes da fase 2 — nenhuma é venda da loja, porque a
 * loja não existia. Uma venda nossa sem carimbo, daqui pra frente, seria
 * ignorada; o preço é aceitável porque o carimbo nasce no mesmo lugar que o
 * pedido, e sem pedido o checkout nem redireciona.
 */
export function ehCobrancaDaLoja(
  cobranca: {
    pedidoIdNoMetadata?: string | null
    /**
     * Existe pedido nosso gravado com este `payment_intent`?
     *
     * ## Por que um segundo sinal
     *
     * O carimbo é escrito no Stripe **no instante do checkout**. Quem foi
     * cobrado antes de ele existir no código não o tem, e nunca vai ter — a
     * cobrança está fechada.
     *
     * Aconteceu com `P260814-E97D12`: venda real de bem próprio, paga,
     * conferida, com `payment_intent` gravado aqui. A cobrança dela tem
     * `metadata: {}`, porque o carimbo entrou no código naquela mesma noite,
     * horas depois. A varredura a descartava como «não é da loja», o pedido
     * sobrava sozinho de um lado, e o relatório acusava «pedido pago sem
     * cobrança correspondente» — **toda execução, para sempre**.
     *
     * Relatório que acusa o que não é problema ensina a ser ignorado, e aí o
     * dia em que a acusação for real ela passa junto. Era o defeito que este
     * módulo já tinha corrigido uma vez, voltando por outra porta.
     *
     * Ter um pedido gravado com aquele `pi_` é evidência tão forte quanto o
     * carimbo, e melhor num ponto: vem do **nosso** lado, onde não depende de
     * o Stripe ter sido escrito na hora certa.
     */
    temPedidoNoBanco?: boolean
  },
  contaConectada: string | null
): boolean {
  if (contaConectada) return true
  if (cobranca.temPedidoNoBanco) return true
  return Boolean(cobranca.pedidoIdNoMetadata)
}

/**
 * O pedido que ficou preso em `iniciado` com uma sessão do Stripe do lado de lá.
 *
 * ## O buraco que isto tapa
 *
 * `compararVendas` casa os dois lados pelo `payment_intent` — e o
 * `payment_intent` só é **escrito pelo webhook**. Quando o webhook não chega,
 * o pedido fica sem `pi_`, e sem `pi_` ele não entra na comparação por nenhum
 * dos dois lados: não é «venda ausente no banco» (o pedido existe) nem
 * «pagamento não registrado» (a comparação nunca o alcança).
 *
 * Ou seja: a reconciliação existia justamente para o caso «o webhook não
 * chegou», e era cega para a forma mais comum dele. Aconteceu de verdade em
 * 14/08 — o destino da conta da plataforma não escutava
 * `checkout.session.completed`, o comprador pagou R$ 1,00 e o pedido ficou em
 * `iniciado` para sempre, sem caminho de volta.
 *
 * O que sobra para casar nesse estado é o `stripe_session_id`, gravado **antes**
 * do redirecionamento. Daí esta lista: os pedidos que valem uma pergunta ao
 * Stripe — «esta sessão foi paga?».
 */
export function pedidosParaConferirNoStripe<
  T extends { estado: string; stripe_session_id?: string | null; stripe_payment_intent?: string | null }
>(pedidos: T[]): T[] {
  return pedidos.filter(p =>
    p.estado === 'iniciado'
    && Boolean(p.stripe_session_id)
    // Com `pi_` gravado, o pagamento já foi confirmado por aqui e a
    // comparação normal dá conta — perguntar de novo seria chamada à toa.
    && !p.stripe_payment_intent
  )
}

/**
 * Estados em que a cobrança **aconteceu** — mesmo que tenha sido desfeita.
 *
 * `reembolsado` entra, e é o ponto: a tarifa do gateway não volta no
 * reembolso. O lançamento dela continua devido, e é justamente ele que faz o
 * saldo do vendedor ficar negativo num pedido devolvido — o número que
 * `liquidoDoConsultor` existe para mostrar.
 */
const COBRANCA_ACONTECEU = new Set([...AFIRMA_PAGAMENTO, 'reembolsado'])

/**
 * Pedidos pagos cujo razão está sem a linha de tarifa do gateway.
 *
 * ## Por que a reconciliação, e não o webhook
 *
 * O webhook lê a tarifa da `balance_transaction` logo depois do pagamento — e
 * às vezes o Stripe devolve a cobrança **sem** ela. Medido em 15/08: no pedido
 * `P260815-AF630A` a transação `txn_3U4p3B…` existia com `fee: 43` desde
 * 21:23:34, e a leitura das 21:23:37 não a enxergou. Três segundos depois do
 * fato, e ainda assim ausente.
 *
 * Não é «ainda não foi criada»: é consistência eventual do lado de lá. Duas
 * das cinco vendas próprias caíram nisso.
 *
 * Esperar dentro do webhook seria atrasar o registro do **pagamento** — o fato
 * que importa — para tentar ganhar uma corrida contra a infraestrutura de
 * outra empresa, sem garantia de ganhar. Aqui não há pressa: a execução roda
 * depois, quantas vezes for preciso, e o `registrarLancamento` é idempotente
 * por referência.
 *
 * É a divisão que `lancamentos-do-pedido.ts` já declarava: «lançamento
 * faltando não é detectável só com o razão — exige comparar com o Stripe, o
 * que é reconciliação, e é trabalho de outro módulo».
 *
 * **Lacuna declarada:** cobrança com tarifa genuinamente zero seria listada em
 * toda execução, porque valor zero não vira linha (ausência ≠ zero) e portanto
 * nunca «completa». Custa uma chamada por execução e não corrompe nada. Em BRL
 * no cartão não acontece; se um dia acontecer, aparece como um pedido teimoso
 * no relatório, não como número errado.
 */
export function pedidosComRazaoIncompleto<
  T extends {
    estado: string
    stripe_payment_intent?: string | null
    /** Os tipos já lançados neste pedido. */
    lancamentos?: string[] | null
  }
>(pedidos: T[]): T[] {
  return pedidos.filter(p =>
    COBRANCA_ACONTECEU.has(p.estado)
    // Sem `pi_` não há o que perguntar ao Stripe. Esse pedido é caso da
    // varredura de sessões, que roda antes e pode dar o `pi_` a ele.
    && Boolean(p.stripe_payment_intent)
    && !(p.lancamentos ?? []).includes('tarifa_gateway')
  )
}

/** Contagem por tipo, para o relatório caber numa linha de log. */
export function resumirDivergenciasDaLoja(
  divergencias: DivergenciaDaLoja[]
): Record<string, number> {
  const resumo: Record<string, number> = {}
  for (const d of divergencias) resumo[d.tipo] = (resumo[d.tipo] ?? 0) + 1
  return resumo
}
