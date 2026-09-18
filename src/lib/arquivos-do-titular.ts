import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { BUCKETS_DO_TITULAR } from './dados-do-titular'

const TAMANHO_LOTE = 100
const MAX_PASTAS = 10_000
const MAX_PROFUNDIDADE = 12

/** The roots come from the session and an owned consultation query, never URLs. */
export async function removerArquivosDoTitular(
  client: SupabaseClient, userId: string, consultas: string[], opcoes: { incluirFotosClientes?: boolean } = {},
): Promise<number> {
  const grupos = [
    { bucket: BUCKETS_DO_TITULAR.clientes, raizes: opcoes.incluirFotosClientes === false ? [] : [userId] },
    { bucket: BUCKETS_DO_TITULAR.imoveis, raizes: consultas },
    { bucket: BUCKETS_DO_TITULAR.relatorios, raizes: consultas },
  ]
  let removidos = 0
  for (const { bucket, raizes } of grupos) {
    const storage = client.storage.from(bucket)
    for (const raiz of raizes) {
      if (!raiz || /[/\\%\u0000-\u001f]/.test(raiz) || raiz === '.' || raiz === '..') throw new Error('Raiz de arquivo inválida')
      const pastas = [{ path: raiz, nivel: 0 }]
      const arquivos: string[] = []
      for (let indice = 0; indice < pastas.length; indice++) {
        if (pastas.length > MAX_PASTAS || pastas[indice].nivel > MAX_PROFUNDIDADE) throw new Error('Inventário de arquivos excede o limite')
        const pasta = pastas[indice]
        for (let offset = 0; ; offset += TAMANHO_LOTE) {
          const { data, error } = await storage.list(pasta.path, { limit: TAMANHO_LOTE, offset, sortBy: { column: 'name', order: 'asc' } })
          if (error || !Array.isArray(data)) throw new Error('Inventário de arquivos indisponível')
          for (const item of data) {
            if (!item.name || /[/\\%\u0000-\u001f]/.test(item.name) || item.name === '.' || item.name === '..') throw new Error('Nome de arquivo inválido')
            const path = `${pasta.path}/${item.name}`
            if (item.id) arquivos.push(path)
            else pastas.push({ path, nivel: pasta.nivel + 1 })
          }
          if (data.length < TAMANHO_LOTE) break
        }
      }
      // List every page before deletion: removing during offset pagination skips files.
      for (let inicio = 0; inicio < arquivos.length; inicio += TAMANHO_LOTE) {
        const lote = arquivos.slice(inicio, inicio + TAMANHO_LOTE)
        const { error } = await storage.remove(lote)
        if (error) throw new Error('Remoção de arquivos não confirmada')
        removidos += lote.length
      }
    }
  }
  return removidos
}
