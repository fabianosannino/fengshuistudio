import { NextResponse } from 'next/server'
import { createRouteHandlerClient } from '../../../../src/lib/supabase-route'
import { rateLimit } from '../../../../src/lib/rate-limit'
import { logger } from '../../../../src/lib/logger'

export async function GET(request: Request) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const { success } = rateLimit(ip, { limit: 30, windowMs: 60_000 })
  if (!success) return Response.json({ error: 'Rate limit' }, { status: 429 })

  const supabase = await createRouteHandlerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { data: adminProfile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()
  if (!adminProfile || adminProfile.role !== 'admin') {
    return NextResponse.json({ error: 'Acesso restrito' }, { status: 403 })
  }

  const url = new URL(request.url)
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'))
  const pageSize = 30

  const { data, count, error } = await supabase
    .from('admin_audit_log')
    .select('*, performer:profiles!admin_audit_log_performed_by_fkey(nome_completo)', { count: 'exact' })
    .order('performed_at', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1)

  if (error) {
    logger.error('Audit log error', { route: '/api/admin/auditoria', error: error.message })
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ logs: data, total: count, page, pageSize })
}
