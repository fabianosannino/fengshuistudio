/**
 * Confere as variáveis `STRIPE_PRICE_*` contra a API do Stripe.
 *
 *     STRIPE_SECRET_KEY=sk_... npx vite-node scripts/stripe/conferir-precos.mts
 *
 * ## Por que existe
 *
 * O checkout falha em produção com `No such price` quando o ID configurado
 * pertence a um modo (teste/produção) diferente da `STRIPE_SECRET_KEY`. O ID
 * não diz o modo — `price_1Abc…` tem a mesma cara nos dois — e o erro só
 * aparece quando um cliente real tenta assinar. Conferir olho no olho, no
 * painel, é o que já deixou passar um `prod_…` colado no lugar de um `price_…`.
 *
 * Este script pergunta ao Stripe, com a chave que o app usa, se cada preço
 * existe **naquele** modo, se está ativo e se o intervalo bate com o nome da
 * variável — `_MONTHLY` tem que ser mensal.
 *
 * Não escreve nada e não cria nada: só lê.
 *
 * ## Como ler a saída
 *
 * `ok` significa «existe, ativo e coerente com o nome». Qualquer outra coisa é
 * um motivo pelo qual o checkout daquele plano vai falhar — ou, pior, cobrar o
 * valor errado sem erro nenhum.
 */
import Stripe from 'stripe'

/** Nome da variável → o que ela promete ser. */
const ESPERADO = [
  { env: 'STRIPE_PRICE_SIMPLES_MONTHLY', plano: 'simples', intervalo: 'month' },
  { env: 'STRIPE_PRICE_SIMPLES_YEARLY', plano: 'simples', intervalo: 'year' },
  { env: 'STRIPE_PRICE_PRO_MONTHLY', plano: 'profissional', intervalo: 'month' },
  { env: 'STRIPE_PRICE_PRO_YEARLY', plano: 'profissional', intervalo: 'year' },
] as const

const INTERVALO_EM_PORTUGUES: Record<string, string> = { month: 'mensal', year: 'anual' }

interface Achado {
  env: string
  nivel: 'ok' | 'erro' | 'aviso'
  mensagem: string
  /** Produto a que o preço pertence — usado no cruzamento entre planos. */
  produto?: string
}

function moeda(valor: number | null, moedaISO: string): string {
  if (valor === null) return 'valor variável'
  return `${moedaISO.toUpperCase()} ${(valor / 100).toFixed(2)}`
}

async function conferirPreco(
  stripe: Stripe,
  env: string,
  intervaloEsperado: string
): Promise<Achado> {
  const id = process.env[env]

  if (!id) {
    // Ausente não é neutro: `subscribe/route.ts` cai no `STRIPE_PRICE_ID`
    // legado quando a variável específica falta, e aí cobra outro preço.
    return { env, nivel: 'erro', mensagem: 'não definida — o plano cai no fallback `STRIPE_PRICE_ID`' }
  }

  if (id.startsWith('prod_')) {
    return { env, nivel: 'erro', mensagem: `é um ID de produto (${id}); o checkout precisa do preço, que começa com \`price_\`` }
  }

  if (!id.startsWith('price_')) {
    return { env, nivel: 'erro', mensagem: `não parece um ID de preço: ${id}` }
  }

  let preco: Stripe.Price
  try {
    preco = await stripe.prices.retrieve(id, { expand: ['product'] })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    // A causa de longe mais comum é modo trocado — o preço existe, mas no
    // outro catálogo.
    return { env, nivel: 'erro', mensagem: `o Stripe não encontrou ${id} com esta chave. ${msg}` }
  }

  const produto = preco.product as Stripe.Product | Stripe.DeletedProduct
  const nomeProduto = 'name' in produto ? produto.name : `(produto removido: ${produto.id})`

  const problemas: string[] = []
  if (!preco.active) problemas.push('preço arquivado (inativo)')
  if (!preco.recurring) {
    problemas.push('preço avulso — o checkout é `mode: subscription` e exige preço recorrente')
  } else if (preco.recurring.interval !== intervaloEsperado) {
    problemas.push(
      `intervalo é ${INTERVALO_EM_PORTUGUES[preco.recurring.interval] ?? preco.recurring.interval}, ` +
      `mas a variável promete ${INTERVALO_EM_PORTUGUES[intervaloEsperado]}`
    )
  }
  if ('deleted' in produto && produto.deleted) problemas.push('o produto foi removido')

  const descricao = `${nomeProduto} · ${moeda(preco.unit_amount, preco.currency)}` +
    (preco.recurring ? ` / ${INTERVALO_EM_PORTUGUES[preco.recurring.interval] ?? preco.recurring.interval}` : '')

  if (problemas.length > 0) {
    return { env, nivel: 'erro', mensagem: `${descricao} — ${problemas.join('; ')}`, produto: nomeProduto }
  }

  return { env, nivel: 'ok', mensagem: descricao, produto: nomeProduto }
}

async function main() {
  const chave = process.env.STRIPE_SECRET_KEY
  if (!chave) {
    console.error('STRIPE_SECRET_KEY não está no ambiente. Rode com a mesma chave que a Vercel usa.')
    process.exit(2)
  }

  const modo = chave.startsWith('sk_live_') ? 'PRODUÇÃO' : chave.startsWith('sk_test_') ? 'TESTE' : 'DESCONHECIDO'
  console.log(`Chave em modo: ${modo}`)
  console.log('Os preços abaixo precisam existir NESTE modo — catálogos de teste e produção são separados.\n')

  const stripe = new Stripe(chave)

  const achados: Achado[] = []
  for (const { env, intervalo } of ESPERADO) {
    achados.push(await conferirPreco(stripe, env, intervalo))
  }

  for (const a of achados) {
    console.log(`${a.nivel === 'ok' ? 'ok  ' : 'ERRO'} ${a.env}\n     ${a.mensagem}`)
  }

  // ── Cruzamentos que um preço sozinho não revela ────────────────────────────

  const extras: string[] = []

  // Dois planos apontando para o mesmo produto: o Simples cobraria o valor do
  // Profissional, ou vice-versa, sem nenhum erro do Stripe.
  const produtoPorPlano = new Map<string, Set<string>>()
  for (const { env, plano } of ESPERADO) {
    const achado = achados.find(a => a.env === env)
    if (!achado?.produto) continue
    if (!produtoPorPlano.has(plano)) produtoPorPlano.set(plano, new Set())
    produtoPorPlano.get(plano)!.add(achado.produto)
  }
  for (const [plano, produtos] of produtoPorPlano) {
    if (produtos.size > 1) {
      extras.push(`o plano ${plano} aponta para mais de um produto: ${[...produtos].join(', ')}`)
    }
  }
  const [simples, profissional] = [produtoPorPlano.get('simples'), produtoPorPlano.get('profissional')]
  if (simples && profissional) {
    const comuns = [...simples].filter(p => profissional.has(p))
    if (comuns.length > 0) {
      extras.push(`Simples e Profissional apontam para o mesmo produto (${comuns.join(', ')}) — um dos dois vai cobrar o valor errado`)
    }
  }

  // Ids repetidos entre variáveis: mensal e anual com o mesmo preço passa
  // despercebido porque os dois «existem».
  const porId = new Map<string, string[]>()
  for (const { env } of ESPERADO) {
    const id = process.env[env]
    if (!id) continue
    porId.set(id, [...(porId.get(id) ?? []), env])
  }
  for (const [id, envs] of porId) {
    if (envs.length > 1) extras.push(`${envs.join(' e ')} usam o mesmo preço ${id}`)
  }

  // O legado é fallback silencioso de qualquer variável que falte.
  if (process.env.STRIPE_PRICE_ID) {
    extras.push('`STRIPE_PRICE_ID` ainda está definida — é fallback silencioso em `subscribe/route.ts`; remova')
  }

  if (extras.length > 0) {
    console.log('')
    for (const e of extras) console.log(`ERRO ${e}`)
  }

  const falhou = achados.some(a => a.nivel === 'erro') || extras.length > 0
  console.log(falhou ? '\nHá o que corrigir antes do checkout funcionar.' : '\nOs quatro preços conferem.')
  process.exit(falhou ? 1 : 0)
}

main().catch(err => {
  console.error(err instanceof Error ? err.message : String(err))
  process.exit(2)
})
