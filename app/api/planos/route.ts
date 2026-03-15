import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { createRouteHandlerClient } from '../../../src/lib/supabase-route'

function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a.trim())
  const bufB = Buffer.from(b.trim())
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}

export async function POST(request: Request) {
  const supabase = await createRouteHandlerClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  let plano: string
  let chave_ativacao: string | undefined
  try {
    const body = await request.json()
    plano = body.plano
    chave_ativacao = body.chave_ativacao
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
    const validKey = process.env.PRO_ACTIVATION_KEY
    const allowFree = process.env.ALLOW_FREE_UPGRADE === 'true'

    if (allowFree) {
      // Allow free upgrade (testing mode)
    } else if (validKey && chave_ativacao && safeCompare(chave_ativacao, validKey)) {
      // Valid activation key provided
    } else if (chave_ativacao) {
      return NextResponse.json(
        { error: 'Chave de ativação inválida. Verifique e tente novamente.', requiresPayment: true },
        { status: 403 }
      )
    } else {
      return NextResponse.json(
        { error: 'Pagamento necessário. Utilize uma chave de ativação ou aguarde a integração com pagamento.', requiresPayment: true },
        { status: 402 }
      )
    }
  }

  const { error } = await supabase
    .from('profiles')
    .update({ plano })
    .eq('id', user.id)

  if (error) {
    console.error('Planos update error:', error.message)
    return NextResponse.json({ error: 'Erro ao atualizar plano. Tente novamente.' }, { status: 400 })
  }

  return NextResponse.json({ plano })
}
