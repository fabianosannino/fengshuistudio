import {
  calcularResultadoAnalise,
  impedimentoParaHistorico,
} from '../../../../../src/lib/calculo-analise'
import { createRouteHandlerClient } from '../../../../../src/lib/supabase-route'
import { createSupabaseAdminClient } from '../../../../../src/lib/supabase-admin'
import {
  idValido,
  hashValido,
  jsonCanonico,
  objeto,
} from '../../../../../src/lib/relatorio-emissao'
import { sha256 } from '../../../../../src/lib/relatorio-fonte'
import {
  lerFonteAnalise,
  lerAnalise,
} from '../../../../../src/lib/historico-analises-servidor'
import {
  CAMPOS_ANALISE,
  PAGINA_ANALISES,
  TABELA_ANALISES,
  VERSAO_MOTOR_ANALISE,
} from '../../../../../src/lib/historico-analises'
import { rateLimit, ipDaRequisicao } from '../../../../../src/lib/rate-limit'
import { logger } from '../../../../../src/lib/logger'

type Contexto = { params: Promise<{ id: string }> }
const resposta = (dados: unknown, status = 200) =>
  Response.json(dados, {
    status,
    headers: { 'Cache-Control': 'private, no-store' },
  })
const falha = () =>
  resposta(
    { error: 'Não foi possível acessar o histórico. Tente novamente.' },
    503,
  )
async function guarda(request: Request, ctx: Contexto) {
  const rate = await rateLimit(ipDaRequisicao(request), {
    limit: 40,
    windowMs: 60_000,
    escopo: `${request.method}:/api/consultas/analises`,
    exigirCompartilhado: true,
  })
  if (rate.indisponivel) return { erro: falha() } as const
  if (!rate.success)
    return {
      erro: resposta({ error: 'Aguarde antes de tentar novamente.' }, 429),
    } as const
  const client = await createRouteHandlerClient(),
    {
      data: { user },
    } = await client.auth.getUser()
  if (!user)
    return { erro: resposta({ error: 'Não autenticado' }, 401) } as const
  const { id } = await ctx.params
  if (!idValido(id))
    return { erro: resposta({ error: 'Consulta inválida' }, 400) } as const
  const r = await client
    .from('consultas')
    .select('id')
    .eq('id', id)
    .eq('consultor_id', user.id)
    .maybeSingle()
  if (r.error) return { erro: falha() } as const
  if (!r.data)
    return {
      erro: resposta({ error: 'Consulta não encontrada' }, 404),
    } as const
  return { client, user, id } as const
}

export async function GET(request: Request, ctx: Contexto) {
  const g = await guarda(request, ctx)
  if (g.erro) return g.erro
  try {
    const params = new URL(request.url).searchParams,
      analise = params.get('analise')
    if (analise !== null) {
      if (!idValido(analise))
        return resposta({ error: 'Análise inválida' }, 400)
      const r = await lerAnalise(g.client, analise, g.id, g.user.id)
      return r
        ? resposta({ analise: r })
        : resposta({ error: 'Análise não encontrada' }, 404)
    }
    const pagina = Number(params.get('pagina') ?? 0)
    if (!Number.isInteger(pagina) || pagina < 0 || pagina > 100)
      return resposta({ error: 'Página inválida' }, 400)
    const [fonte, r] = await Promise.all([
      lerFonteAnalise(g.client, g.id, g.user.id),
      g.client
        .from(TABELA_ANALISES)
        .select(CAMPOS_ANALISE)
        .eq('consulta_id', g.id)
        .eq('consultor_id', g.user.id)
        .order('criado_em', { ascending: false })
        .order('id', { ascending: false })
        .range(pagina * PAGINA_ANALISES, (pagina + 1) * PAGINA_ANALISES),
    ])
    if (r.error || !fonte) return falha()
    return resposta({
      analises: (r.data ?? []).slice(0, PAGINA_ANALISES),
      mais: (r.data?.length ?? 0) > PAGINA_ANALISES,
      atual: {
        nome: fonte.consulta.nome_imovel,
        metodo: fonte.consulta.bagua_entrada?.escola ?? null,
        fonte_sha256: sha256(jsonCanonico(fonte)),
        impedimento: impedimentoParaHistorico(fonte),
      },
    })
  } catch {
    logger.error('Leitura de análises indisponível', {
      route: '/api/consultas/[id]/analises',
    })
    return falha()
  }
}

export async function POST(request: Request, ctx: Contexto) {
  const g = await guarda(request, ctx)
  if (g.erro) return g.erro
  let body: unknown
  try {
    const texto = await request.text()
    if (texto.length > 2048) throw new Error()
    body = JSON.parse(texto)
  } catch {
    return resposta({ error: 'Solicitação inválida' }, 400)
  }
  if (
    !objeto(body) ||
    Object.keys(body).some((k) => !['id', 'fonte_sha256'].includes(k)) ||
    !idValido(body.id) ||
    !hashValido(body.fonte_sha256)
  )
    return resposta({ error: 'Solicitação inválida' }, 400)
  try {
    const anterior = await lerAnalise(g.client, body.id, g.id, g.user.id)
    if (anterior)
      return anterior.fonte_sha256 === body.fonte_sha256
        ? resposta({ analise: anterior })
        : resposta(
            { error: 'Identificador já utilizado para outros dados.' },
            409,
          )
    const fonte = await lerFonteAnalise(g.client, g.id, g.user.id)
    if (!fonte) return resposta({ error: 'Consulta não encontrada' }, 404)
    if (sha256(jsonCanonico(fonte)) !== body.fonte_sha256)
      return resposta(
        {
          error:
            'Os dados mudaram. Atualize a lista e confira a planta antes de salvar.',
        },
        409,
      )
    const impedimento = impedimentoParaHistorico(fonte)
    if (impedimento) return resposta({ error: impedimento }, 409)
    let resultado
    try {
      resultado = calcularResultadoAnalise(fonte)
    } catch {
      return resposta(
        { error: 'Revise a geometria da planta antes de salvar a análise.' },
        409,
      )
    }
    const r = await createSupabaseAdminClient().rpc('registrar_analise', {
      p_id: body.id,
      p_consulta: g.id,
      p_consultor: g.user.id,
      p_hash: body.fonte_sha256,
      p_fonte: fonte,
      p_resultado: resultado,
      p_motor: VERSAO_MOTOR_ANALISE,
    })
    if (r.error) {
      if (['PT409', '23505'].includes(r.error.code))
        return resposta(
          {
            error:
              'Os dados mudaram, o identificador já foi usado ou o limite de versões foi atingido. Atualize a lista.',
          },
          409,
        )
      return falha()
    }
    if (r.data !== body.id) return falha()
    const salva = await lerAnalise(g.client, body.id, g.id, g.user.id)
    if (!salva) return falha()
    return resposta({ analise: salva }, 201)
  } catch {
    logger.error('Registro de análise indisponível', {
      route: '/api/consultas/[id]/analises',
    })
    return falha()
  }
}
