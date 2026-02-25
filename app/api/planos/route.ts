import { NextResponse } from 'next/server'
import { createRouteHandlerClient } from '../../../src/lib/supabase-route'

export async function POST(request: Request) {
  const supabase = await createRouteHandlerClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  let plano: string
  try {
    const body = await request.json()
    plano = body.plano
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }

  if (!plano || !['freemium', 'pro'].includes(plano)) {
    return NextResponse.json({ error: 'Plano inválido' }, { status: 400 })
  }

  // Get current plan
  const { data: profile } = await supabase
    .from('profiles')
    .select('plano')
    .eq('id', user.id)
    .single()

  if (plano === 'pro' && profile?.plano !== 'pro') {
    // In production, this should validate payment through a gateway (Stripe, Mercado Pago, etc.)
    // For now, we block direct upgrade and return a message
    // To enable upgrade for testing, set ALLOW_FREE_UPGRADE=true in environment
    if (process.env.ALLOW_FREE_UPGRADE !== 'true') {
      return NextResponse.json(
        { error: 'Pagamento necessário. Integração com gateway de pagamento em breve.', requiresPayment: true },
        { status: 402 }
      )
    }
  }

  const { error } = await supabase
    .from('profiles')
    .update({ plano })
    .eq('id', user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ plano })
}
