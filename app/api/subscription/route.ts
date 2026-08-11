/**
 * User Subscription Status API
 *
 * GET /api/subscription — Get the current user's subscription details
 *
 * Returns the active subscription with plan details, billing info,
 * and any pending notifications.
 */

import { NextResponse } from 'next/server'
import { createRouteHandlerClient } from '../../../src/lib/supabase-route'
import { rateLimit, ipDaRequisicao } from '../../../src/lib/rate-limit'

export async function GET(request: Request) {
  const ip = ipDaRequisicao(request)
  const { success: rateLimitOk } = await rateLimit(ip, { limit: 30, windowMs: 60_000 })
  if (!rateLimitOk) {
    return NextResponse.json({ error: 'Rate limit' }, { status: 429 })
  }

  const supabase = await createRouteHandlerClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  // Get active subscription with plan details
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('*, plans(name, slug, price_monthly, price_yearly)')
    .eq('user_id', user.id)
    .in('status', ['active', 'past_due', 'trial', 'gratuidade'])
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  // Get unread notifications
  const { data: notifications, count: unreadCount } = await supabase
    .from('payment_notifications')
    .select('*', { count: 'exact' })
    .eq('user_id', user.id)
    .is('read_at', null)
    .order('created_at', { ascending: false })
    .limit(5)

  // Get recent invoices
  const { data: invoices } = await supabase
    .from('invoices')
    .select('id, amount, amount_paid, status, due_date, paid_at, description, billing_cycle')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(10)

  return NextResponse.json({
    subscription: subscription || null,
    notifications: notifications || [],
    unreadNotifications: unreadCount || 0,
    invoices: invoices || [],
  })
}
