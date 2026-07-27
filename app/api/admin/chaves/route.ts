import { NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { createRouteHandlerClient } from '../../../../src/lib/supabase-route'
import { rateLimit } from '../../../../src/lib/rate-limit'
import { logger } from '../../../../src/lib/logger'

// Characters without ambiguous glyphs (no 0, O, I, 1)
const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function generateKey(): string {
  const segments: string[] = []
  // PRO-XXXX-XXXX-XXXX
  segments.push('PRO')
  for (let s = 0; s < 3; s++) {
    let seg = ''
    const bytes = randomBytes(4)
    for (let i = 0; i < 4; i++) {
      seg += CHARS[bytes[i] % CHARS.length]
    }
    segments.push(seg)
  }
  return segments.join('-')
}

async function verifyAdmin(supabase: Awaited<ReturnType<typeof createRouteHandlerClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()
  if (!profile || profile.role !== 'admin') return null
  return { user, profile }
}

// GET — list keys with optional filters
export async function GET(request: Request) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const { success } = rateLimit(ip, { limit: 30, windowMs: 60_000 })
  if (!success) return Response.json({ error: 'Rate limit' }, { status: 429 })

  const supabase = await createRouteHandlerClient()
  const admin = await verifyAdmin(supabase)
  if (!admin) return NextResponse.json({ error: 'Acesso restrito' }, { status: 403 })

  const url = new URL(request.url)
  const status = url.searchParams.get('status')
  const search = url.searchParams.get('search')
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'))
  const pageSize = 20

  let query = supabase
    .from('activation_keys')
    .select('*, used_by_profile:profiles!activation_keys_used_by_fkey(id, nome_completo)', { count: 'exact' })
    .order('created_at', { ascending: false })

  if (status && status !== 'all') {
    query = query.eq('status', status)
  }

  if (search) {
    // Limit search length to prevent abuse; strip special SQL characters
    const sanitized = search.slice(0, 50).replace(/[%_\\]/g, '')
    if (sanitized.length > 0) {
      query = query.ilike('key', `%${sanitized}%`)
    }
  }

  query = query.range((page - 1) * pageSize, page * pageSize - 1)

  const { data, count, error } = await query
  if (error) {
    logger.error('Admin keys list error', { route: '/api/admin/chaves', action: 'list', error: error.message })
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  // Also get summary counts
  const [
    { count: totalCount },
    { count: availableCount },
    { count: usedCount },
    { count: expiredCount },
    { count: cancelledCount },
  ] = await Promise.all([
    supabase.from('activation_keys').select('*', { count: 'exact', head: true }),
    supabase.from('activation_keys').select('*', { count: 'exact', head: true }).eq('status', 'available'),
    supabase.from('activation_keys').select('*', { count: 'exact', head: true }).eq('status', 'used'),
    supabase.from('activation_keys').select('*', { count: 'exact', head: true }).eq('status', 'expired'),
    supabase.from('activation_keys').select('*', { count: 'exact', head: true }).eq('status', 'cancelled'),
  ])

  return NextResponse.json({
    keys: data,
    total: count,
    page,
    pageSize,
    summary: {
      total: totalCount || 0,
      available: availableCount || 0,
      used: usedCount || 0,
      expired: expiredCount || 0,
      cancelled: cancelledCount || 0,
    },
  })
}

// POST — generate new keys
export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const { success } = rateLimit(ip, { limit: 10, windowMs: 60_000 })
  if (!success) return Response.json({ error: 'Rate limit' }, { status: 429 })

  const supabase = await createRouteHandlerClient()
  const admin = await verifyAdmin(supabase)
  if (!admin) return NextResponse.json({ error: 'Acesso restrito' }, { status: 403 })

  let body: { quantidade?: number; plan_type?: string; expires_at?: string | null; note?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }

  const quantidade = Math.min(Math.max(1, body.quantidade || 1), 100)
  const plan_type = body.plan_type || 'pro'
  const expires_at = body.expires_at || null
  const note = body.note || null

  const keys: { key: string; plan_type: string; status: string; expires_at: string | null; note: string | null; created_by: string }[] = []
  for (let i = 0; i < quantidade; i++) {
    keys.push({
      key: generateKey(),
      plan_type,
      status: 'available',
      expires_at,
      note,
      created_by: admin.user.id,
    })
  }

  const { data, error } = await supabase.from('activation_keys').insert(keys).select()
  if (error) {
    logger.error('Admin key generation error', { route: '/api/admin/chaves', action: 'generate', error: error.message })
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  // Audit log
  const { error: erroAuditoria } = await supabase.from('admin_audit_log').insert({
    action: 'generate_keys',
    target_type: 'activation_key',
    details: { quantidade, plan_type, expires_at, note, key_ids: data?.map(k => k.id) },
    performed_by: admin.user.id,
    // Sem carimbo de tempo a trilha não serve para nada: a coluna não
    // tinha default e as linhas antigas ficaram NULL (renderizadas como 1970).
    performed_at: new Date().toISOString(),
  })
  if (erroAuditoria) {
    logger.error('Falha ao gravar log de auditoria', {
      route: '/api/admin/chaves', action: 'insert admin_audit_log', error: erroAuditoria.message,
    })
  }

  return NextResponse.json({ keys: data })
}

// PATCH — cancel a key
export async function PATCH(request: Request) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const { success } = rateLimit(ip, { limit: 20, windowMs: 60_000 })
  if (!success) return Response.json({ error: 'Rate limit' }, { status: 429 })

  const supabase = await createRouteHandlerClient()
  const admin = await verifyAdmin(supabase)
  if (!admin) return NextResponse.json({ error: 'Acesso restrito' }, { status: 403 })

  let body: { id: string; action: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }

  if (body.action === 'cancel') {
    const { error } = await supabase
      .from('activation_keys')
      .update({ status: 'cancelled' })
      .eq('id', body.id)
      .eq('status', 'available')

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    const { error: erroAuditoria } = await supabase.from('admin_audit_log').insert({
      action: 'cancel_key',
      target_type: 'activation_key',
      target_id: body.id,
      details: {},
      performed_by: admin.user.id,
      // Sem carimbo de tempo a trilha não serve para nada: a coluna não
      // tinha default e as linhas antigas ficaram NULL (renderizadas como 1970).
      performed_at: new Date().toISOString(),
    })
    if (erroAuditoria) {
      logger.error('Falha ao gravar log de auditoria', {
        route: '/api/admin/chaves', action: 'insert admin_audit_log', error: erroAuditoria.message,
      })
    }

    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: 'Ação inválida' }, { status: 400 })
}
