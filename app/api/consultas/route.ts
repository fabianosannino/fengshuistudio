import { NextResponse } from 'next/server'
import { createRouteHandlerClient } from '../../../src/lib/supabase-route'
import { rateLimit, ipDaRequisicao } from '../../../src/lib/rate-limit'
import { logger } from '../../../src/lib/logger'
import { planoEfetivo, podeClientes, isProfissional as isProfissionalFn, planoUsuario,
         limiteImoveis, mensagemLimiteImoveis, STATUS_LIBERAM_VAGA } from '../../../src/lib/plano-utils'
const MAX_CONSULTAS_MES_FREE = 3

export async function POST(request: Request) {
  const ip = ipDaRequisicao(request)
  const { success, remaining } = await rateLimit(ip, { limit: 20, windowMs: 60_000 })
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

  // Check profile and plan
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  const isProfessional = isProfissionalFn(profile)
  const plano = planoUsuario(profile)

  // A regra e a mensagem vêm de `plano-utils`, não daqui: quando cada rota
  // escrevia a sua, a API dizia «limite de 1 imóvel ativo» enquanto a tela
  // dizia outra coisa e `podeClientes()` dizia uma terceira.
  const limite = limiteImoveis(plano)
  if (limite !== null) {
    const { count, error: erroContagem } = await supabase
      .from('consultas')
      .select('*', { count: 'exact', head: true })
      .eq('consultor_id', user.id)
      .not('status', 'in', `(${STATUS_LIBERAM_VAGA.join(',')})`)

    if (erroContagem) {
      logger.error('Falha ao contar imóveis do consultor', {
        route: '/api/consultas', userId: user.id, error: erroContagem.message,
      })
      return NextResponse.json({ error: 'Não foi possível verificar seu limite de imóveis.' }, { status: 500 })
    }

    if ((count || 0) >= limite) {
      return NextResponse.json({ error: mensagemLimiteImoveis(plano) }, { status: 403 })
    }
  }


  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }

  const ALLOWED_FIELDS = ['cliente_id', 'nome_imovel', 'tipo_imovel', 'area_total_m2', 'endereco_imovel', 'status', 'num_moradores', 'historico_imovel', 'observacoes_topograficas', 'dados_adicionais'] as const
  const sanitized: Record<string, unknown> = {}
  for (const key of ALLOWED_FIELDS) {
    if (body[key] !== undefined) {
      sanitized[key] = body[key]
    }
  }

  if (!sanitized.cliente_id || typeof sanitized.cliente_id !== 'string') {
    return NextResponse.json({ error: 'cliente_id é obrigatório' }, { status: 400 })
  }

  const { error, data } = await supabase.from('consultas').insert({
    ...sanitized,
    consultor_id: user.id,
  }).select().single()

  if (error) {
    logger.error('Consulta insert error', { route: '/api/consultas', error: error.message })
    return NextResponse.json({ error: 'Erro ao criar consulta. Tente novamente.' }, { status: 400 })
  }

  return NextResponse.json(data)
}
