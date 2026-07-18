/**
 * Stripe Products API
 *
 * POST /api/stripe/products — Create a product on the connected account
 *   Body: { name, description, price, currency?, account_id? }
 *   Uses the Stripe-Account header to create products on the connected account.
 *
 * GET /api/stripe/products?account_id=acct_xxx — List products for a connected account
 *   Returns active products with their default prices.
 *   Uses the Stripe-Account header to list products on the connected account.
 */

import { NextResponse } from 'next/server'
import stripeClient from '../../../../src/lib/stripe'
import { createRouteHandlerClient } from '../../../../src/lib/supabase-route'
import { logger } from '../../../../src/lib/logger'

export async function POST(request: Request) {
  const supabase = await createRouteHandlerClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  let body: { name?: string; description?: string; price?: number; currency?: string; account_id?: string }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Body inválido' }, { status: 400 }) }

  if (!body.name || !body.price) {
    return NextResponse.json({ error: 'Nome e preço são obrigatórios' }, { status: 400 })
  }

  // ── Get the connected account ID ───────────────────────────────────────
  // Sempre derivado do perfil do usuário autenticado — nunca do body,
  // para impedir criação de produtos na conta de outro consultor.
  const { data: profile } = await supabase.from('profiles').select('stripe_account_id').eq('id', user.id).single()
  const accountId = profile?.stripe_account_id

  if (!accountId) {
    return NextResponse.json({ error: 'Nenhuma conta Stripe vinculada' }, { status: 400 })
  }

  try {
    // ── Create a product on the connected account ────────────────────────
    // The stripeAccount option sends the Stripe-Account header,
    // which tells Stripe to create this product on the connected account
    // (not on the platform account).
    //
    // default_price_data creates a price object automatically:
    // - unit_amount: price in the smallest currency unit (centavos for BRL)
    // - currency: 'brl' for Brazilian Real
    const product = await stripeClient.products.create({
      name: body.name,
      description: body.description || undefined,
      default_price_data: {
        unit_amount: Math.round(body.price * 100), // Convert reais to centavos
        currency: body.currency || 'brl',
      },
    }, {
      stripeAccount: accountId, // Creates product on the connected account
    })

    return NextResponse.json({
      product_id: product.id,
      name: product.name,
      price_id: typeof product.default_price === 'string' ? product.default_price : product.default_price?.id,
      message: 'Produto criado com sucesso',
    })
  } catch (err) {
    logger.error('Stripe product creation error', { route: '/api/stripe/products', error: String(err) })
    return NextResponse.json({ error: `Erro ao criar produto: ${String(err)}` }, { status: 500 })
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const accountId = url.searchParams.get('account_id')

  if (!accountId) {
    return NextResponse.json({ error: 'account_id é obrigatório' }, { status: 400 })
  }

  try {
    // ── List active products on the connected account ────────────────────
    // expand: ['data.default_price'] includes the price object inline
    // so we don't need a separate API call to get pricing information.
    // The stripeAccount option sends the Stripe-Account header.
    const products = await stripeClient.products.list({
      limit: 20,
      active: true,
      expand: ['data.default_price'],
    }, {
      stripeAccount: accountId, // Lists products from the connected account
    })

    return NextResponse.json({
      products: products.data.map(p => ({
        id: p.id,
        name: p.name,
        description: p.description,
        images: p.images,
        price: typeof p.default_price === 'object' && p.default_price ? {
          id: p.default_price.id,
          unit_amount: p.default_price.unit_amount,
          currency: p.default_price.currency,
        } : null,
      })),
    })
  } catch (err) {
    logger.error('Stripe products list error', { route: '/api/stripe/products', error: String(err) })
    return NextResponse.json({ error: `Erro ao listar produtos: ${String(err)}` }, { status: 500 })
  }
}
