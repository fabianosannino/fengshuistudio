import { NextResponse } from 'next/server'
import { createRouteHandlerClient } from '../../../../../src/lib/supabase-route'
import { carregarFonteRelatorio, sha256 } from '../../../../../src/lib/relatorio-fonte'
import { idValido, jsonCanonico } from '../../../../../src/lib/relatorio-emissao'
import { logger } from '../../../../../src/lib/logger'
import { lerAnalise } from '../../../../../src/lib/historico-analises-servidor'
import { VERSAO_MOTOR_ANALISE } from '../../../../../src/lib/historico-analises'
import { obterMeuPlano } from '../../../../../src/lib/plano-vigente'

export async function GET(request: Request) {
  const client = await createRouteHandlerClient()
  const { data: { user } } = await client.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const id = new URL(request.url).searchParams.get('consulta_id')
  const analiseId = new URL(request.url).searchParams.get('analise')
  if (!idValido(id)) return NextResponse.json({ error: 'Consulta inválida' }, { status: 400 })
  if (analiseId!==null&&!idValido(analiseId)) return NextResponse.json({error:'Análise inválida'},{status:400})
  try {
    if(analiseId){
      const analise=await lerAnalise(client,analiseId,id,user.id)
      if(!analise)return NextResponse.json({error:'Análise não encontrada'},{status:404})
      if(analise.versao_motor!==VERSAO_MOTOR_ANALISE)return NextResponse.json({error:'Consulte os PDFs anteriores ou registre uma versão com o motor atual para emitir novamente.'},{status:409})
      const plano=await obterMeuPlano(client)
      if(plano===null)throw new Error('Plano indisponível')
      return NextResponse.json({fonte:analise.fonte,fonte_sha256:analise.fonte_sha256,analise_id:analise.id,execucoes_metodos:analise.resultado.metodos,plano_atual:plano,referencia_temporal:new Date().toISOString()},{headers:{'Cache-Control':'private, no-store'}})
    }
    const fonte = await carregarFonteRelatorio(client, id, user.id)
    if (!fonte) return NextResponse.json({ error: 'Consulta não encontrada' }, { status: 404 })
    return NextResponse.json({ fonte, fonte_sha256: sha256(jsonCanonico(fonte)), referencia_temporal: new Date().toISOString() }, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    logger.error('Falha ao carregar entradas do relatório', { route: '/api/consultas/relatorio/entrada' })
    return NextResponse.json({ error: 'Não foi possível carregar as entradas do relatório.' }, { status: 503 })
  }
}
