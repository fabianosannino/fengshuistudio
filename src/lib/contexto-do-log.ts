/** Explicit telemetry schema. Unknown fields and arbitrary provider errors stay out. */
const ROTAS = new Set([
  ...['admin/auditoria', 'admin/chaves', 'admin/produtos', 'admin/produtos/arquivo', 'admin/produtos/imagem',
    'admin/promover', 'admin/reconciliacao', 'admin/reconciliacao-loja', 'admin/relatorios', 'admin/subscriptions',
    'afiliado/clique', 'clientes', 'clientes/foto', 'consultas', 'consultas/[id]', 'consultas/bagua-planta',
    'consultas/fotos', 'consultas/relatorio', 'consultas/relatorio/entrada', 'consultas/relatorio/preparar',
    'conta/dados', 'declinacao', 'loja/checkout', 'loja/indicacao', 'loja/produtos', 'pedidos/arquivo',
    'pedidos/estorno', 'pedidos/minhas-compras', 'pedidos/publico', 'planos', 'storage/assinar',
    'stripe/account', 'stripe/account-link', 'stripe/checkout', 'stripe/portal', 'stripe/products',
    'stripe/subscribe', 'stripe/webhooks', 'stripe/webhooks/subscriptions', 'subscription', 'subscription/cancel',
  ].map(rota => `/api/${rota}`),
  '/admin/vendas', '/auth/callback', '/bagua-planta', '/clientes', '/perfil', '/consultas/[id]',
  '/consultas/[id]/relatorio', '/consultas/[id]/vistoria', '/curas', '/dashboard', '/parceiros', '/planos', '/produtos', '/vendas',
  'auth-rotas', 'rate-limit', 'FlowLayout', 'assinarValores', 'useUrlsAssinadas', 'relatorio', 'TabFluxoChi', 'error-boundary', 'global-error',
])
const ACOES = new Set(['sem-upstash', 'incr', 'list', 'generate', 'insert admin_audit_log', 'exchangeCodeForSession',
  'recomecarAnalise', 'salvarRascunho', 'salvarSetor', 'salvarTudo', 'normalizar-cores', 'load-custom',
  'delete-custom', 'insert-custom', 'marcar-cura', 'select subscriptions', 'select produtos_afiliados',
  'insert', 'update', 'delete', 'upsert', 'select', 'signInWithPassword', 'signUp', 'signInWithOAuth',
  'resetPasswordForEmail', 'updateUser', 'registrar a indicação de afiliado', 'insert-notification-cancelamento'])
const CAUSAS_AUTH = new Set(['rede-indisponivel', 'servico-indisponivel', 'limite-de-tentativas',
  'email-nao-confirmado', 'credenciais-invalidas', 'conta-ja-existe', 'senha-fraca', 'desconhecida'])
const ESTADOS = new Set(['pending', 'requires_action', 'succeeded', 'failed', 'canceled', 'paid', 'unpaid',
  'no_payment_required', 'active', 'trialing', 'past_due', 'paused', 'incomplete', 'incomplete_expired',
  'won', 'lost', 'warning_closed', 'prevented', 'needs_response', 'under_review', 'warning_needs_response',
  'warning_under_review', 'repetido', 'criada', 'atualizada', 'falhou', 'em_andamento', 'processado', 'falha'])
const TIPOS = new Set(['produto', 'frete', 'comissao_plataforma', 'tarifa_gateway', 'reembolso', 'frete_devolucao',
  'estorno_comissao', 'bem_proprio_digital', 'bem_proprio_fisico', 'bem_de_terceiro', 'servico',
  'iniciado', 'pago', 'cancelado', 'preparando', 'enviado', 'entregue', 'devolucao_solicitada',
  'reembolsado', 'contestado', 'disputa_resolvida', 'reembolso_conferido',
  'account.updated', 'checkout.session.completed', 'checkout.session.async_payment_succeeded',
  'checkout.session.async_payment_failed', 'customer.subscription.created', 'customer.subscription.updated',
  'customer.subscription.deleted', 'invoice.paid', 'invoice.payment_failed', 'invoice_payment.paid',
  'charge.refunded', 'refund.created', 'refund.updated', 'refund.failed', 'charge.dispute.created',
  'charge.dispute.updated', 'charge.dispute.closed', 'application_fee.refunded', 'application_fee.refund.updated'])
const CODIGOS = new Set(['23505', '23503', '23514', '42501', 'P0001', '22023', '42P01', '42703',
  '57014', '08000', '08006', 'PGRST116', 'PGRST204', 'PGRST301', 'ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT'])
const PROBLEMAS_CATALOGO = new Set(['preco_inativo', 'ambiente', 'valor_ou_moeda',
  'recorrencia', 'valor_variavel', 'produto_invalido', 'produto_nao_verificado', 'produto_inativo', 'preco_duplicado'])
const PLANOS = new Set(['free', 'simples', 'profissional'])
const CICLOS = new Set(['monthly', 'yearly'])
const DIVERGENCIAS = ['ausente_no_banco', 'ausente_no_stripe', 'status_diferente', 'valor_diferente', 'ciclo_diferente',
  'cancelamento_diferente', 'venda_ausente_no_banco', 'pagamento_nao_registrado', 'reembolso_nao_registrado', 'pedido_sem_cobranca']
const CONTADORES = ['corrigidas', 'currentlyDueCount', 'razoesCompletados', 'sessoesConfirmadas', 'total', 'trocas']
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function propriedades(valor: unknown): Record<string, PropertyDescriptor> {
  try { return valor && typeof valor === 'object' ? Object.getOwnPropertyDescriptors(valor) : {} } catch { return {} }
}

type ContextoSeguro = Record<string, string | number | boolean | string[] | Record<string, number>>
export function contextoDoLog(contexto: unknown): ContextoSeguro {
  const dados = propriedades(contexto)
  const valor = (nome: string): unknown => dados[nome]?.value
  const resultado: ContextoSeguro = {}
  for (const nome of ['route', 'rota', 'origem']) {
    const original = valor(nome)
    const rota = typeof original === 'string' ? original.split(/[?#]/, 1)[0] : ''
    if (ROTAS.has(rota)) resultado[nome] = rota
  }
  for (const [campo, valores] of [['action', ACOES], ['status', ESTADOS], ['statusDoStripe', ESTADOS],
    ['estado', ESTADOS], ['situacao', ESTADOS], ['tipo', TIPOS], ['type', TIPOS], ['evento', TIPOS], ['code', CODIGOS],
    ['plano', PLANOS], ['ciclo', CICLOS], ['causa', CAUSAS_AUTH]] as const) {
    const item = valor(campo)
    if (typeof item === 'string' && valores.has(item)) resultado[campo] = item
  }
  const status = valor('status')
  if (typeof status === 'number' && Number.isInteger(status) && status >= 100 && status <= 599) resultado.status = status
  for (const campo of CONTADORES) {
    const item = valor(campo)
    if (typeof item === 'number' && Number.isSafeInteger(item) && item >= 0) resultado[campo] = item
  }
  for (const campo of ['correlationId', 'emissaoId']) {
    const item = valor(campo)
    if (typeof item === 'string' && UUID.test(item)) resultado[campo] = item
  }
  const evento = valor('eventId')
  if (typeof evento === 'string' && /^evt_[a-zA-Z0-9]{1,128}$/.test(evento)) resultado.eventId = evento
  const digest = valor('digest')
  if (typeof digest === 'string' && /^[0-9]{1,16}$/.test(digest)) resultado.digest = digest
  const problemas = valor('problemas')
  if (Array.isArray(problemas)) {
    const campos = propriedades(problemas)
    const codigos: string[] = []
    for (let indice = 0; indice < 20; indice++) {
      const codigo = campos[indice]?.value
      if (typeof codigo === 'string' && PROBLEMAS_CATALOGO.has(codigo)) codigos.push(codigo)
    }
    resultado.problemas = codigos
  }
  const resumo = propriedades(valor('resumo'))
  const contagens: Record<string, number> = {}
  for (const campo of DIVERGENCIAS) {
    const quantidade = resumo[campo]?.value
    if (typeof quantidade === 'number' && Number.isSafeInteger(quantidade) && quantidade >= 0) contagens[campo] = quantidade
  }
  if (Object.keys(contagens).length) resultado.resumo = contagens
  // Presence is useful; raw errors, stack, SQL, URLs, payloads and personal IDs are not.
  if (['error', 'erro', 'causa', 'detalhe'].some(campo => Object.hasOwn(dados, campo))) resultado.erro_presente = true
  return resultado
}
