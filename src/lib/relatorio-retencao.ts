import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { CAMPOS_HISTORICO_RELATORIO, ESPERA_EXCLUSAO_PREPARADA_MS, TABELA_EMISSOES, type EmissaoRelatorio } from './relatorio-emissao'
import { ORIGEM_DOS_PDFS_VERSIONADOS } from './dados-do-titular'

type Linha = EmissaoRelatorio & { pdf_path: string; consultor_id: string; entrada: unknown }
type Arquivo = Pick<Linha, 'id' | 'pdf_path' | 'estado' | 'criado_em'>
const LOTE = 500

/** Pagina: o limite padrão da Data API não pode deixar PDFs fora da exclusão. */
async function listarLinhas<T>(client: SupabaseClient, userId: string, colunas: string, consultaId?: string): Promise<T[]> {
  const todas: T[] = []
  for (let inicio = 0; ; inicio += LOTE) {
    let query = client.from(TABELA_EMISSOES).select(colunas).eq('consultor_id', userId).order('id').range(inicio, inicio + LOTE - 1)
    if (consultaId) query = query.eq('consulta_id', consultaId)
    const { data, error } = await query
    if (error) throw new Error('Falha ao inventariar emissões')
    todas.push(...(data ?? []) as T[])
    if (!data || data.length < LOTE) return todas
  }
}

/** Portabilidade inclui as entradas; limpeza e histórico não carregam esse conteúdo. */
export function listarEmissoesDoTitular(client: SupabaseClient, userId: string): Promise<Linha[]> {
  return listarLinhas<Linha>(client, userId, '*')
}

export async function listarHistoricoRelatorio(client: SupabaseClient, userId: string, consultaId: string): Promise<EmissaoRelatorio[]> {
  const linhas = await listarLinhas<EmissaoRelatorio>(client, userId, CAMPOS_HISTORICO_RELATORIO, consultaId)
  return linhas.sort((a, b) => b.criado_em.localeCompare(a.criado_em) || a.id.localeCompare(b.id))
}

/** Retenção termina por exclusão explícita. Nunca apagar linhas antes dos objetos. */
export async function excluirEmissoesDoTitular(client: SupabaseClient, userId: string, consultaId?: string): Promise<number> {
  const linhas = await listarLinhas<Arquivo>(client, userId, 'id,pdf_path,estado,criado_em', consultaId)
  if (linhas.some(e => e.estado === 'preparada' && Date.now() - new Date(e.criado_em).getTime() < ESPERA_EXCLUSAO_PREPARADA_MS)) {
    throw new Error('Há uma emissão em preparação. Aguarde até 30 minutos antes de excluir os dados.')
  }
  for (let inicio = 0; inicio < linhas.length; inicio += LOTE) {
    const lote = linhas.slice(inicio, inicio + LOTE)
    const arquivos = await client.storage.from(ORIGEM_DOS_PDFS_VERSIONADOS.bucket).remove(lote.map(e => e[ORIGEM_DOS_PDFS_VERSIONADOS.coluna]))
    if (arquivos.error) throw new Error('Falha ao remover os PDFs; histórico preservado para nova tentativa.')
  }
  // Uma transação preserva os vínculos entre revisões. IDs inventariados,
  // não DELETE por proprietário: emissões concorrentes ficam fora da exclusão.
  if (linhas.length) {
    const removidas = await client.rpc('excluir_emissoes_relatorio', { p_consultor: userId, p_ids: linhas.map(e => e.id) })
    if (removidas.error) throw new Error('Falha ao remover o histórico de relatórios.')
  }
  return linhas.length
}
