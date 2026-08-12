import { NextResponse } from 'next/server'
import { createRouteHandlerClient } from '../../../src/lib/supabase-route'
import { rateLimit, ipDaRequisicao } from '../../../src/lib/rate-limit'
import { logger } from '../../../src/lib/logger'
import { planoUsuario, limiteClientes, mensagemLimiteClientes } from '../../../src/lib/plano-utils'
import { validateEmail, validatePhone } from '../../../src/lib/validation'


export async function POST(request: Request) {
  const ip = ipDaRequisicao(request)
  const { success, remaining } = await rateLimit(ip, { limit: 30, windowMs: 60_000 })
  if (!success) {
    return Response.json(
      { error: 'Muitas requisições. Tente novamente em alguns instantes.' },
      { status: 429, headers: { 'Retry-After': '60' } }
    )
  }

  const supabase = await createRouteHandlerClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  // Check plan
  const { data: profile } = await supabase
    .from('profiles')
    .select('plano, tipo_usuario, role')
    .eq('id', user.id)
    .single()

  const planoDoUsuario = planoUsuario(profile)
  const limiteDeClientes = limiteClientes(planoDoUsuario)

  if (limiteDeClientes !== null) {
    if (limiteDeClientes === 0) {
      return NextResponse.json({ error: mensagemLimiteClientes(planoDoUsuario) }, { status: 403 })
    }

    const { count, error: erroContagem } = await supabase
      .from('clientes')
      .select('*', { count: 'exact', head: true })
      .eq('consultor_id', user.id)
      .eq('ativo', true)

    if (erroContagem) {
      logger.error('Falha ao contar clientes do consultor', {
        route: '/api/clientes', userId: user.id, error: erroContagem.message,
      })
      return NextResponse.json({ error: 'Não foi possível verificar seu limite de clientes.' }, { status: 500 })
    }

    if ((count || 0) >= limiteDeClientes) {
      return NextResponse.json({ error: mensagemLimiteClientes(planoDoUsuario) }, { status: 403 })
    }
  }


  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }

  const { nome_completo, email, telefone, cep, rua, numero, complemento, bairro, cidade, estado, pais, notas } = body as {
    nome_completo?: string; email?: string; telefone?: string;
    cep?: string; rua?: string; numero?: string; complemento?: string; bairro?: string;
    cidade?: string; estado?: string; pais?: string; notas?: string
  }

  if (!nome_completo || typeof nome_completo !== 'string' || nome_completo.trim().length === 0) {
    return NextResponse.json({ error: 'Nome completo é obrigatório' }, { status: 400 })
  }

  if (email && !validateEmail(email)) {
    return NextResponse.json({ error: 'Email inválido' }, { status: 400 })
  }

  if (telefone && !validatePhone(telefone)) {
    return NextResponse.json({ error: 'Telefone inválido' }, { status: 400 })
  }

  const { error, data } = await supabase.from('clientes').insert({
    nome_completo: nome_completo.trim(),
    email: email || null,
    telefone: telefone || null,
    cep: cep || null,
    rua: rua || null,
    numero: numero || null,
    complemento: complemento || null,
    bairro: bairro || null,
    cidade: cidade || null,
    estado: estado || null,
    pais: pais || null,
    notas: notas || null,
    consultor_id: user.id,
    // Explícito de propósito: a coluna é NOT NULL e ficou sem DEFAULT depois da
    // restauração de constraints pós-incidente, derrubando todo cadastro com
    // 23502. O default foi devolvido no banco; dizer aqui também deixa a
    // intenção visível e não deixa a rota depender de um default invisível.
    ativo: true,
  }).select().single()

  if (error) {
    logger.error('Cliente insert error', { route: '/api/clientes', error: error.message, code: error.code, details: error.details })
    return NextResponse.json({ error: 'Erro ao cadastrar cliente.' }, { status: 400 })
  }

  return NextResponse.json(data)
}
