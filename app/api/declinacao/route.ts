import { NextResponse } from 'next/server'
import { createRouteHandlerClient } from '../../../src/lib/supabase-route'
import { rateLimit } from '../../../src/lib/rate-limit'
import { logger } from '../../../src/lib/logger'
import { declinacaoAutomatica, explicarFalha } from '../../../src/lib/declinacao-automatica'

/**
 * Declinação magnética de um ponto, via WMM oficial embutido no pacote
 * `geomagnetism` (ver `src/lib/declinacao-automatica.ts`).
 *
 * Por que é rota de servidor e não cálculo no cliente: o pacote é CommonJS e
 * carrega ~4 arquivos JSON de coeficientes. No bundle do cliente isso é peso
 * morto numa página que já carrega canvas, mapa e PDF.
 *
 * Não recebe nada além de lat/lon/data — nenhum dado do imóvel ou do cliente
 * trafega aqui, então não há PII para registrar em log.
 */

// A data limita a variação secular; sem ela o resultado seria de "hoje" no
// servidor, que é razoável, mas explicitar é melhor que assumir.
function dataDoParam(bruto: string | null): Date | null {
  if (!bruto) return new Date()
  const d = new Date(bruto)
  return Number.isNaN(d.getTime()) ? null : d
}

export async function GET(request: Request) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const { success } = rateLimit(ip, { limit: 60, windowMs: 60_000 })
  if (!success) {
    return NextResponse.json(
      { error: 'Muitas requisições. Tente novamente em alguns instantes.' },
      { status: 429, headers: { 'Retry-After': '60' } },
    )
  }

  // Exige sessão: é recurso de consultor, não endpoint público de geofísica.
  const supabase = await createRouteHandlerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const url = new URL(request.url)
  const lat = Number(url.searchParams.get('lat'))
  const lon = Number(url.searchParams.get('lon'))
  const data = dataDoParam(url.searchParams.get('data'))
  if (!data) {
    return NextResponse.json({ error: 'Data inválida' }, { status: 400 })
  }

  const r = declinacaoAutomatica(lat, lon, data)

  if (!r.ok) {
    // 422 e não 500: a entrada é sintaticamente válida, o modelo é que não
    // atende (fora da janela de validade, latitude polar). O cliente deve
    // cair para a entrada manual, não tratar como falha do servidor.
    const status = r.motivo === 'coordenada-invalida' ? 400 : 422
    logger.info('Declinação automática indisponível', {
      route: '/api/declinacao', motivo: r.motivo,
    })
    return NextResponse.json(
      { error: explicarFalha(r.motivo), motivo: r.motivo },
      { status },
    )
  }

  return NextResponse.json({
    declinacao: r.declinacao,
    modelo: r.modelo,
    validoAte: r.validoAte,
  })
}
