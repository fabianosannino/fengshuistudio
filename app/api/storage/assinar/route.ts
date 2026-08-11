/**
 * POST /api/storage/assinar — URLs assinadas para imagens dos buckets privados.
 *
 * Body: `{ bucket: 'imoveis-fotos' | 'clientes-fotos', valores: string[] }`
 * Resposta: `{ urls: { [valorOriginal]: string } }` — só entram os valores que
 * o usuário pode ver. Um valor ausente na resposta é uma negativa, não um erro
 * de rede, e a tela mostra o espaço vazio em vez de uma imagem quebrada.
 *
 * Aceita o valor **como está gravado** (URL pública legada ou path) porque o
 * banco tem as duas formas — ver `src/lib/storage-imagens.ts`.
 *
 * ## Ownership
 *
 * Nunca derivada do corpo: o `user.id` vem da sessão e o vínculo é o path.
 * - `clientes-fotos`: primeira pasta = id do usuário.
 * - `imoveis-fotos`: primeira pasta = id da consulta, conferida contra
 *   `consultas.consultor_id`. Uma consulta por lote, não uma por foto.
 *
 * É a mesma regra das policies de `storage.objects` (20260724_hotfix), aqui
 * repetida no servidor de propósito: a URL assinada é gerada com privilégio e
 * não passa mais por RLS depois de emitida.
 */

import { NextResponse } from 'next/server'
import { createRouteHandlerClient } from '../../../../src/lib/supabase-route'
import { rateLimit, ipDaRequisicao } from '../../../../src/lib/rate-limit'
import { logger } from '../../../../src/lib/logger'
import {
  BUCKET_CLIENTES,
  BUCKET_IMOVEIS,
  TTL_URL_ASSINADA_SEGUNDOS,
  caminhoDoObjeto,
  pastaRaiz,
} from '../../../../src/lib/storage-imagens'

const ROUTE = '/api/storage/assinar'
const BUCKETS_PERMITIDOS = [BUCKET_IMOVEIS, BUCKET_CLIENTES]

/** Teto por requisição: o relatório é a tela com mais imagens de uma vez. */
const MAX_VALORES = 100

export async function POST(request: Request) {
  const { success } = await rateLimit(ipDaRequisicao(request), { limit: 120, windowMs: 60_000 })
  if (!success) {
    return NextResponse.json(
      { error: 'Muitas requisições. Tente novamente em alguns instantes.' },
      { status: 429, headers: { 'Retry-After': '60' } }
    )
  }

  const supabase = await createRouteHandlerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  let body: { bucket?: string; valores?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }

  const bucket = body.bucket
  if (!bucket || !BUCKETS_PERMITIDOS.includes(bucket)) {
    return NextResponse.json({ error: 'bucket inválido' }, { status: 400 })
  }

  if (!Array.isArray(body.valores)) {
    return NextResponse.json({ error: 'valores deve ser uma lista' }, { status: 400 })
  }
  if (body.valores.length > MAX_VALORES) {
    return NextResponse.json({ error: `Máximo de ${MAX_VALORES} imagens por requisição` }, { status: 400 })
  }

  // Valor original → path. Guardamos o par porque a resposta é indexada pelo
  // valor que a tela tem em mãos, não pelo path.
  const porPath = new Map<string, string[]>()
  for (const valor of body.valores) {
    if (typeof valor !== 'string') continue
    const path = caminhoDoObjeto(valor, bucket)
    if (!path) continue
    const jaVistos = porPath.get(path)
    if (jaVistos) jaVistos.push(valor)
    else porPath.set(path, [valor])
  }

  if (porPath.size === 0) {
    return NextResponse.json({ urls: {} })
  }

  const permitidos = await filtrarPorPosse(supabase, bucket, [...porPath.keys()], user.id)
  if (permitidos.length === 0) {
    return NextResponse.json({ urls: {} })
  }

  const { data: assinadas, error } = await supabase.storage
    .from(bucket)
    .createSignedUrls(permitidos, TTL_URL_ASSINADA_SEGUNDOS)

  if (error) {
    logger.error('Falha ao assinar URLs de storage', {
      route: ROUTE, userId: user.id, bucket, error: error.message,
    })
    return NextResponse.json({ error: 'Não foi possível carregar as imagens' }, { status: 500 })
  }

  const urls: Record<string, string> = {}
  for (const item of assinadas ?? []) {
    if (!item.signedUrl || !item.path) continue
    for (const valorOriginal of porPath.get(item.path) ?? []) {
      urls[valorOriginal] = item.signedUrl
    }
  }

  return NextResponse.json({ urls })
}

/**
 * Filtra os paths que este usuário pode ver, pela pasta raiz.
 */
async function filtrarPorPosse(
  supabase: Awaited<ReturnType<typeof createRouteHandlerClient>>,
  bucket: string,
  paths: string[],
  userId: string
): Promise<string[]> {
  if (bucket === BUCKET_CLIENTES) {
    return paths.filter(path => pastaRaiz(path) === userId)
  }

  // imoveis-fotos: a pasta raiz é o id da consulta.
  const consultas = new Set<string>()
  for (const path of paths) {
    const raiz = pastaRaiz(path)
    if (raiz) consultas.add(raiz)
  }
  if (consultas.size === 0) return []

  const { data, error } = await supabase
    .from('consultas')
    .select('id')
    .eq('consultor_id', userId)
    .in('id', [...consultas])

  if (error) {
    // Sem a lista de consultas não dá para provar posse de nada. Negar é a
    // única saída correta — assinar "na dúvida" é o furo que estamos fechando.
    logger.error('Falha ao verificar posse das consultas', {
      route: ROUTE, userId, error: error.message,
    })
    return []
  }

  const permitidas = new Set((data ?? []).map(c => String(c.id)))
  return paths.filter(path => {
    const raiz = pastaRaiz(path)
    return raiz !== null && permitidas.has(raiz)
  })
}
