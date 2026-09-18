import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'

export const LOTE_PORTABILIDADE = 500
export const LOTE_VINCULOS = 100
type Linha = Record<string, unknown>

/** Only trusted callers choose a table/filter. Never take them from a request. */
export async function listarDadosPaginados(
  client: SupabaseClient, tabela: string, coluna: string, valor: string | string[], campos = '*',
): Promise<Linha[]> {
  if (Array.isArray(valor) && valor.length === 0) return []
  const linhas: Linha[] = []
  for (let inicio = 0; ; inicio += LOTE_PORTABILIDADE) {
    let query = client.from(tabela).select(campos).order('id').range(inicio, inicio + LOTE_PORTABILIDADE - 1)
    query = Array.isArray(valor) ? query.in(coluna, valor) : query.eq(coluna, valor)
    const { data, error } = await query
    if (error || !Array.isArray(data)) throw new Error('Leitura de dados indisponível')
    linhas.push(...data as unknown as Linha[])
    if (data.length < LOTE_PORTABILIDADE) return linhas
  }
}

export async function listarDadosDasConsultas(client: SupabaseClient, tabela: string, ids: string[], campos = '*'): Promise<Linha[]> {
  return listarDadosVinculados(client, tabela, 'consulta_id', ids, campos)
}

async function listarDadosVinculados(client: SupabaseClient, tabela: string, coluna: string, ids: string[], campos = '*'): Promise<Linha[]> {
  const linhas: Linha[] = []
  for (let inicio = 0; inicio < ids.length; inicio += LOTE_VINCULOS) {
    linhas.push(...await listarDadosPaginados(client, tabela, coluna, ids.slice(inicio, inicio + LOTE_VINCULOS), campos))
  }
  return linhas
}

const TABELAS_DIRETAS = [
  ['clientes', 'consultor_id'], ['consultas', 'consultor_id'],
  ['subscriptions', 'user_id'], ['invoices', 'user_id'], ['concessoes_de_plano', 'user_id'],
  ['checkouts_assinatura', 'user_id'],
  ['disputas_stripe', 'user_id'],
  ['pagamentos', 'consultor_id'], ['rituais', 'consultor_id'],
  ['consultor_checklist_chi_custom', 'consultor_id'], ['consultor_curas_custom', 'consultor_id'],
  ['payment_notifications', 'user_id'], ['servicos_do_parceiro', 'perfil_id'],
  ['produtos', 'vendedor_perfil_id'], ['relatorio_emissoes', 'consultor_id'],
] as const
const TABELAS_DAS_CONSULTAS = ['fotos_consulta', 'setores_bagua', 'diagnostico_snapshots', 'cronograma_lunar', 'prescricoes'] as const

/** Auth-derived owner only; failures reject the entire export, never an empty success. */
export async function exportarDadosDoTitular(client: SupabaseClient, userId: string, emailVerificado: string | null) {
  const [perfil, ...resultados] = await Promise.all([
    listarDadosPaginados(client, 'profiles', 'id', userId),
    ...TABELAS_DIRETAS.map(([tabela, coluna]) => listarDadosPaginados(client, tabela, coluna, userId)),
  ])
  if (perfil.length !== 1) throw new Error('Perfil indisponível')
  const dados = Object.fromEntries(TABELAS_DIRETAS.map(([tabela], indice) => [tabela, resultados[indice]]))
  const consultas = dados.consultas.map(l => String(l.id))
  const relacionados = await Promise.all(TABELAS_DAS_CONSULTAS.map(t => listarDadosDasConsultas(client, t, consultas)))
  const filhos = Object.fromEntries(TABELAS_DAS_CONSULTAS.map((tabela, indice) => [tabela, relacionados[indice]]))
  const criterios = await listarDadosVinculados(client, 'diagnostico_criterios', 'setor_id', filhos.setores_bagua.map(l => String(l.id)))
  const [compras, vendas] = await Promise.all([
    emailVerificado ? listarDadosPaginados(client, 'pedidos', 'comprador_email', emailVerificado) : [],
    listarDadosPaginados(client, 'pedidos', 'vendedor_perfil_id', userId),
  ])
  return {
    perfil: perfil[0], ...dados,
    // Keep the established names consumed by existing exports.
    assinaturas: dados.subscriptions, faturas: dados.invoices,
    ...filhos, diagnostico_criterios: criterios,
    compras, vendas,
  }
}
