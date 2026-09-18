import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  jsonCanonico,
  MAX_ENTRADA_RELATORIO,
  type FonteRelatorio,
} from './relatorio-emissao'
import {
  CAMPOS_ANALISE,
  TABELA_ANALISES,
  type AnaliseSalva,
} from './historico-analises'
import { sha256 } from './relatorio-fonte'

export async function lerFonteAnalise(
  client: SupabaseClient,
  consulta: string,
  usuario: string,
): Promise<FonteRelatorio | null> {
  const r = await client.rpc('ler_fonte_analise', {
    p_consulta: consulta,
    p_consultor: usuario,
  })
  if (r.error) throw new Error('Fonte indisponível')
  if (!r.data) return null
  if (Buffer.byteLength(jsonCanonico(r.data)) > MAX_ENTRADA_RELATORIO)
    throw new Error('Fonte excessiva')
  return r.data as FonteRelatorio
}

export async function lerAnalise(
  client: SupabaseClient,
  id: string,
  consulta: string,
  usuario: string,
): Promise<AnaliseSalva | null> {
  const r = await client
    .from(TABELA_ANALISES)
    .select(`${CAMPOS_ANALISE},fonte,resultado`)
    .eq('id', id)
    .eq('consulta_id', consulta)
    .eq('consultor_id', usuario)
    .maybeSingle()
  if (r.error) throw new Error('Histórico indisponível')
  if (r.data && sha256(jsonCanonico(r.data.fonte)) !== r.data.fonte_sha256)
    throw new Error('Integridade da fonte divergente')
  return r.data as AnaliseSalva | null
}
