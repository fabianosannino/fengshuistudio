import 'server-only'
import { createHash } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { jsonCanonico, MAX_ENTRADA_RELATORIO, type FonteRelatorio } from './relatorio-emissao'

export function sha256(valor: string | Uint8Array): string {
  return createHash('sha256').update(valor).digest('hex')
}

/** Allowlist: nunca arquivar tokens, credenciais Stripe ou colunas futuras. */
const COLUNAS_CONSULTA = `id,consultor_id,cliente_id,nome_imovel,tipo_imovel,area_total_m2,
  endereco_imovel,porta_posicao,bagua_imagem,foto_geral_url,fotos_comodos,fotos_antes,fotos_depois,
  bagua_entrada,num_moradores,ano_construcao,ano_reforma_estrutural,historico_imovel,
  observacoes_topograficas,dados_adicionais,status,roda_da_vida,checklist_chi,posicao_comando,
  modelo_pontuacao,peso_geo,criado_em,
  clientes(nome_completo,email,telefone,cidade,estado,data_nascimento,genero)`
const COLUNAS_PERFIL = 'id,nome_completo,plano,tipo_usuario,role,nome_empresa,telefone,profissao,registro_profissional,site,instagram'

export async function carregarFonteRelatorio(client: SupabaseClient, consultaId: string, userId: string): Promise<FonteRelatorio | null> {
  const consulta = await client.from('consultas').select(COLUNAS_CONSULTA).eq('id', consultaId).eq('consultor_id', userId).maybeSingle()
  if (consulta.error) throw new Error('Falha ao ler consulta')
  if (!consulta.data) return null
  const [perfil, setores, evolucao, custom] = await Promise.all([
    client.from('profiles').select(COLUNAS_PERFIL).eq('id', userId).single(),
    client.from('setores_bagua').select('id,consulta_id,nome,numero,elemento,cor_associada,posicao_grid,score_percentual,recomendacoes_custom,comodo_tipo,comodos,diagnostico_criterios(criterio,score,notas,setor_id)')
      .eq('consulta_id', consultaId).order('numero').order('id'),
    client.from('diagnostico_snapshots').select('tipo,scores,criado_em').eq('consulta_id', consultaId).order('criado_em').order('id'),
    client.from('consultor_checklist_chi_custom').select('item_id,label').eq('consultor_id', userId).order('criado_em').order('item_id'),
  ])
  if ([perfil, setores, evolucao, custom].some(r => r.error) || !perfil.data) throw new Error('Falha ao ler entradas do relatório')
  const fonte = {
    consulta: consulta.data, perfil: perfil.data,
    setores: (setores.data ?? []).map(s => ({
      ...s, diagnostico_criterios: [...(s.diagnostico_criterios ?? [])].sort((a, b) => a.criterio.localeCompare(b.criterio)),
    })),
    evolucao: evolucao.data ?? [],
    chi_custom: (custom.data ?? []).map(c => ({ id: c.item_id, label: c.label })),
  } as unknown as FonteRelatorio
  if (Buffer.byteLength(jsonCanonico(fonte)) > MAX_ENTRADA_RELATORIO) throw new Error('Entradas do relatório excedem o limite')
  return fonte
}
