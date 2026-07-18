import 'server-only'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Client Supabase com service_role — USO EXCLUSIVO NO SERVIDOR.
 *
 * Ignora RLS. Use apenas em fluxos de sistema que não têm sessão de
 * usuário (webhooks do Stripe) ou em escritas privilegiadas já
 * autorizadas pela rota (ex.: ativação de plano após validar a chave).
 * Nunca importe este módulo em componentes client — o import de
 * 'server-only' faz o build falhar se isso acontecer.
 */
export function createSupabaseAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRoleKey) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY não configurada. Adicione ao ambiente do servidor ' +
      '(Vercel > Settings > Environment Variables). Nunca a exponha com prefixo NEXT_PUBLIC_.'
    )
  }

  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
