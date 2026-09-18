/** Leitura apenas: confere as quatro combinações contra o mesmo contrato do checkout.
 * Execute com chave restrita de leitura no ambiente: npx vite-node scripts/stripe/conferir-precos.mts
 * Não imprime credenciais nem mensagens cruas do provedor.
 */
import Stripe from 'stripe'
import { COMBINACOES_ASSINATURA, idDoPreco, modoStripe, problemasDoPreco } from '../../src/lib/catalogo-assinaturas'

async function main() {
  const chave = process.env.STRIPE_SECRET_KEY
  const live = modoStripe(chave)
  if (!chave || live === null) throw new Error('Chave de leitura ausente ou modo não reconhecido')
  const stripe = new Stripe(chave)
  const ids = new Set<string>()
  const produtos = new Map<string, string>()
  let erros = 0
  for (const escolha of COMBINACOES_ASSINATURA) {
    const id = idDoPreco(escolha, process.env)
    if (!id || ids.has(id)) { console.error(escolha.variavel, 'ausente, inválida ou repetida'); erros++; continue }
    ids.add(id)
    try {
      const preco = await stripe.prices.retrieve(id, { expand: ['product'] })
      const problemas = problemasDoPreco(preco, escolha, live)
      const produtoId = typeof preco.product === 'string' ? preco.product : preco.product.id
      const anterior = produtos.get(escolha.plan_slug)
      if (anterior && anterior !== produtoId) problemas.push('produtos_diferentes_no_mesmo_plano')
      if ([...produtos].some(([plano, produto]) => plano !== escolha.plan_slug && produto === produtoId)) problemas.push('produto_compartilhado_entre_planos')
      produtos.set(escolha.plan_slug, produtoId)
      const produto = preco.product
      const nome = typeof produto === 'object' && 'name' in produto ? produto.name : 'não expandido'
      console.info(escolha.variavel, problemas.length ? problemas.join(', ') : 'ok', live ? 'live' : 'teste', JSON.stringify({ produto: nome, valorCentavos: preco.unit_amount, moeda: preco.currency, intervalo: preco.recurring?.interval }))
      if (problemas.length) erros++
    } catch { console.error(escolha.variavel, 'não foi possível consultar o preço'); erros++ }
  }
  process.exitCode = erros ? 1 : 0
}
main().catch(() => { console.error('Conferência indisponível; nenhuma configuração foi alterada.'); process.exitCode = 2 })
