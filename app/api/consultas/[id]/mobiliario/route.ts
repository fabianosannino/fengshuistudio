import { createRouteHandlerClient } from '../../../../../src/lib/supabase-route'
import { idValido, objeto, jsonCanonico } from '../../../../../src/lib/relatorio-emissao'
import { sha256 } from '../../../../../src/lib/relatorio-fonte'
import { referenciaDaAnalise } from '../../../../../src/lib/analise-bagua'
import { cadastroVazio, validarItensMobiliario, setorDoPonto, type CadastroMobiliario } from '../../../../../src/lib/mobiliario'
import { rateLimit, ipDaRequisicao } from '../../../../../src/lib/rate-limit'
import { logger } from '../../../../../src/lib/logger'
import type { BaguaEntrada } from '../../../../../src/lib/types'
import { lerOrientacao } from '../../../../../src/lib/orientacao'

const headers = { 'Cache-Control': 'private, no-store' }
const resposta = (v: unknown, status = 200) => Response.json(v, { status, headers })
type Contexto = { params: Promise<{ id: string }> }
async function atender(request: Request, ctx: Contexto, gravar: boolean) {
  const { id } = await ctx.params
  if (!idValido(id)) return resposta({ error: 'Consulta inválida.' }, 400)
  const limite = await rateLimit(ipDaRequisicao(request), { limit: 40, windowMs: 60_000, escopo: 'mobiliario', exigirCompartilhado: true })
  if (limite.indisponivel) return resposta({ error: 'Proteção temporariamente indisponível.' }, 503)
  if (!limite.success) return resposta({ error: 'Muitas requisições.' }, 429)
  const client = await createRouteHandlerClient()
  const { data: { user } } = await client.auth.getUser()
  if (!user) return resposta({ error: 'Não autenticado.' }, 401)
  try {
    const r = await client.from('consultas').select('id,nome_imovel,bagua_entrada,mobiliario').eq('id', id).eq('consultor_id', user.id).maybeSingle()
    if (r.error) throw new Error('leitura')
    if (!r.data) return resposta({ error: 'Consulta não encontrada.' }, 404)
    const be: BaguaEntrada = r.data.bagua_entrada ?? {}
    const plantaHash = sha256(jsonCanonico({ geometria: referenciaDaAnalise(be), orientacao: lerOrientacao(be), declinacao: be.declinacao_magnetica ?? null }))
    const cadastro = (r.data.mobiliario ?? cadastroVazio()) as CadastroMobiliario
    if (!gravar) return resposta({ nome: r.data.nome_imovel, planta: be, planta_sha256: plantaHash, cadastro })
    let body: unknown
    try { const texto = await request.text(); if (texto.length > 200_000) throw new Error(); body = JSON.parse(texto) } catch { return resposta({ error: 'Cadastro inválido ou muito grande.' }, 400) }
    if (!objeto(body) || Object.keys(body).some(k => !['revisao', 'planta_sha256', 'itens'].includes(k)) || !Number.isSafeInteger(body.revisao) || Number(body.revisao) < 0 || !validarItensMobiliario(body.itens)) return resposta({ error: 'Revise ambientes, setores, datas, direções e referências. Limite: 150 itens.' }, 400)
    if (body.revisao !== cadastro.revisao || body.planta_sha256 !== plantaHash) return resposta({ error: 'Os dados ou a planta mudaram. Recarregue o cadastro antes de salvar; sua edição continua na tela.' }, 409)
    if (body.itens.some(m => m.posicao && setorDoPonto(m.posicao, be) !== m.setor)) return resposta({ error: 'Uma posição não corresponde ao setor. Revise a localização na planta.' }, 400)
    const novo: CadastroMobiliario = { versao: 1, revisao: cadastro.revisao + 1, referencia_planta: plantaHash, itens: body.itens }
    const escrito = await client.rpc('salvar_mobiliario_consulta', { p_consulta: id, p_revisao: cadastro.revisao, p_entrada: r.data.bagua_entrada, p_cadastro: novo })
    if (escrito.error) throw new Error('escrita')
    if (!escrito.data) return resposta({ error: 'Outro salvamento alterou os dados. Recarregue para revisar as diferenças.' }, 409)
    return resposta({ cadastro: novo })
  } catch {
    logger.error('Cadastro de mobiliário indisponível', { action: gravar ? 'salvarMobiliario' : 'lerMobiliario' })
    return resposta({ error: 'Não foi possível acessar o cadastro. Tente novamente; sua edição não foi descartada.' }, 503)
  }
}
export const GET = (request: Request, ctx: Contexto) => atender(request, ctx, false)
export const PUT = (request: Request, ctx: Contexto) => atender(request, ctx, true)
