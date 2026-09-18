import type { SupabaseClient } from '@supabase/supabase-js'
import { enumDoPlano, type PlanoEfetivo } from './plano-utils'

/** Instante e titular vêm do banco/sessão. Falha não significa Free. */
export async function obterMeuPlano(client: SupabaseClient): Promise<PlanoEfetivo | null> {
  try {
    const { data, error } = await client.rpc('obter_meu_plano')
    if (error || !['free', 'simples', 'profissional'].includes(data)) return null
    return data as PlanoEfetivo
  } catch { return null }
}

/** Preserva a seleção mínima do chamador; perfil e concessão são independentes. */
export async function carregarPerfilComPlano<T extends object>(
  client: SupabaseClient, consulta: PromiseLike<{ data: T | null; error: unknown }>,
): Promise<{ data: (T & { plano: string }) | null; error: Error | null }> {
  try {
    const [perfil, plano] = await Promise.all([consulta, obterMeuPlano(client)])
    if (perfil.error || !perfil.data || plano === null) return { data: null, error: new Error('Perfil ou plano indisponível.') }
    return { data: { ...perfil.data, plano: enumDoPlano(plano) }, error: null }
  } catch { return { data: null, error: new Error('Perfil ou plano indisponível.') } }
}
