import type { BaguaEntrada } from './types'
import { grausConfirmados } from './orientacao'
import { jsonCanonico } from './relatorio-emissao'
import type { Secao } from './formato-do-relatorio'

export const VERSAO_ANALISE_BAGUA = 'bagua-2.0.0'

/** Só entradas que mudam a associação espacial; não timestamps ou UI. */
export function referenciaDaAnalise(be: BaguaEntrada): { versao: string; entrada: string } {
  const campos = ['escola', 'planta_url', 'rotacao', 'bordas', 'lh', 'lv', 'tai_ji_poligono', 'marcacoes', 'metragem_real'] as const
  const dados = Object.fromEntries(campos.map(campo => [campo, be[campo] ?? null]))
  if (be.escola === 'bussola') {
    dados.fachada = grausConfirmados(be)
    dados.referencia = be.orientacao_referencia ?? null
  }
  return { versao: VERSAO_ANALISE_BAGUA, entrada: jsonCanonico(dados) }
}

export function estadoDaAnalise(be?: BaguaEntrada | null): 'legado' | 'atual' | 'desatualizada' {
  if (!be?.analise_referencia) return 'legado'
  const atual = referenciaDaAnalise(be)
  return atual.versao === be.analise_referencia.versao && atual.entrada === be.analise_referencia.entrada ? 'atual' : 'desatualizada'
}

/** Não impede relatórios gerais nem muda PDFs já emitidos. */
export function impedimentoDaAnalise(be: BaguaEntrada | null | undefined, secoes: Partial<Record<Secao, boolean>>): string | null {
  const dependentes: Secao[] = ['completo', 'bagua', 'curas', 'plano_acao', 'divergencias', 'proximos_passos']
  if (!dependentes.some(secao => secoes[secao])) return null
  if (be?.escola === 'bussola' && grausConfirmados(be) === null) return 'Confirme a fachada e a referência de Norte na planta antes de emitir as seções de análise.'
  const estado = estadoDaAnalise(be)
  if (estado === 'desatualizada' || (be?.escola === 'bussola' && estado === 'legado')) {
    return 'A análise da planta precisa ser revisada e finalizada com o método atual. Os relatórios anteriores continuam disponíveis no histórico.'
  }
  return null
}

export function introducaoDoMetodo(escola?: string): string {
  if (escola === 'bussola') return 'Este relatório reúne o diagnóstico do imóvel pela Escola da Bússola. A orientação confirmada fundamenta o Ba Guá e o Ba Zhai. O mapa de Estrelas Voadoras, quando presente, é experimental e simplificado; não substitui uma carta clássica completa.'
  if (escola === 'btb') return 'Este relatório apresenta o diagnóstico do imóvel pela escola BTB, com o Ba Guá alinhado à parede da entrada. Essa leitura não depende de bússola. Inclui os levantamentos e as recomendações selecionados pelo consultor.'
  return 'Este relatório apresenta os levantamentos selecionados pelo consultor. A escola do diagnóstico ainda não foi informada.'
}
