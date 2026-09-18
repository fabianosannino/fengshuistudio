import type { ExecucoesMetodos, ExecucaoMetodo } from './execucao-metodos'
export { RESSALVA_XUAN_KONG } from './execucao-metodos'

export interface DadosDoDiagnostico {
  execucoes: ExecucoesMetodos
  /** Quantos dos nove setores já têm avaliação. */
  setoresComScore?: number
  temPoligonoTaiJi?: boolean
}

export interface MetodoSustentado {
  nome: string
  /** Disponível com o escopo atual. Experimental não equivale a sustentado. */
  disponivel: boolean
  estado: ExecucaoMetodo<unknown>['estado']
  oQueFalta?: string
  limitacoes: string[]
}

function doResultado(nome: string, execucao: ExecucaoMetodo<unknown>): MetodoSustentado {
  return {
    nome, estado: execucao.estado, disponivel: execucao.estado === 'calculado',
    oQueFalta: execucao.motivo ?? undefined, limitacoes: execucao.limitacoes,
  }
}

/** O painel usa o resultado real, nunca apenas a presença de campos. */
export function sustentacaoDoDiagnostico(dados: DadosDoDiagnostico): MetodoSustentado[] {
  const setores = dados.setoresComScore ?? 0
  const temSetores = Number.isInteger(setores) && setores > 0 && setores <= 9
  return [
    {
      nome: 'Ba Guá dos 9 setores', disponivel: temSetores,
      estado: temSetores ? 'calculado' : 'incompleto',
      oQueFalta: temSetores ? undefined : 'nenhum setor avaliado ainda',
      limitacoes: temSetores && setores < 9 ? [`Avaliação parcial: ${setores} de 9 setores avaliados.`] : [],
    },
    {
      nome: 'Tai Ji e setores ausentes', disponivel: !!dados.temPoligonoTaiJi,
      estado: dados.temPoligonoTaiJi ? 'calculado' : 'incompleto',
      oQueFalta: dados.temPoligonoTaiJi ? undefined : 'sem contorno auxiliar para o centro geométrico real; as marcações de falta e excesso são calculadas separadamente na grade fixa',
      limitacoes: ['O contorno auxiliar não altera as bordas nem substitui as marcações confirmadas.'],
    },
    doResultado('Kua da Casa · Oito Mansões', dados.execucoes.baZhai),
    doResultado('Estrelas Voadoras', dados.execucoes.feiXing),
    doResultado('Ming Gua do morador', dados.execucoes.mingGua),
  ]
}

export function resumoDaSustentacao(metodos: MetodoSustentado[]): string {
  const disponiveis = metodos.filter(m => m.disponivel).length
  const experimentais = metodos.filter(m => m.estado === 'experimental').length
  const resumo = disponiveis === 0
    ? `Nenhum dos ${metodos.length} métodos está sustentado ainda`
    : `${disponiveis} de ${metodos.length} métodos sustentados no escopo atual`
  return experimentais ? `${resumo} · ${experimentais} experimental` : resumo
}
