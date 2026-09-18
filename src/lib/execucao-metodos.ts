import { calcularMingGua, normalizarGenero, type MingGua } from './ming-gua'
import { calcularKuaDaCasa } from './oito-mansoes'
import { calcularEstrelasVoadoras, type MapaEstrelasVoadoras } from './estrelas-voadoras'
import { grausConfirmados, lerOrientacao, type DadosOrientacao } from './orientacao'
import { ANO_MINIMO_CONSTRUCAO, ANO_MAXIMO_CONSTRUCAO, periodoDaConsulta, reformaIncoerente, type PeriodoDoImovel } from './periodo-do-imovel'
import { avaliarAnoSolar, avisoAnoSolar, VERSAO_ANO_SOLAR } from './ano-solar'

/** Versionar também VERSOES_RELATORIO ao mudar cálculo, entrada ou classificação. */
export const CONTRATOS_METODOS = {
  baZhai: { metodo: 'ba-zhai', variante: 'assento-octantes', versao: '1.0.0' },
  mingGua: { metodo: 'ming-gua', variante: 'ano-solar-li-chun', versao: '1.0.0', versaoEfemeride: VERSAO_ANO_SOLAR },
  feiXing: { metodo: 'fei-xing', variante: 'oito-octantes-experimental', versao: '1.0.0' },
} as const

export const RESSALVA_XUAN_KONG =
  'Mapa experimental simplificado por oito octantes. Não é uma carta clássica completa: não implementa as regras de voo das 24 Montanhas, estrelas de substituição nem todas as combinações. Não use sozinho para prescrições; valide com um profissional da escola adotada.'

type Identificacao = typeof CONTRATOS_METODOS[keyof typeof CONTRATOS_METODOS]
export type ExecucaoMetodo<T> = Identificacao & { limitacoes: string[] } & (
  | { estado: 'calculado' | 'experimental'; resultado: T; motivo: null }
  | { estado: 'incompleto' | 'indeterminado' | 'nao_aplicavel'; resultado: null; motivo: string }
)

export interface DadosParaMetodos {
  bagua_entrada?: (DadosOrientacao & { escola?: string; data_construcao?: string }) | null
  ano_construcao?: number | null
  ano_reforma_estrutural?: number | null
  clientes?: { data_nascimento?: string | null; genero?: string | null } | null
}

export interface ExecucoesMetodos {
  baZhai: ExecucaoMetodo<MingGua>
  mingGua: ExecucaoMetodo<MingGua>
  feiXing: ExecucaoMetodo<{ mapa: MapaEstrelasVoadoras; periodo: PeriodoDoImovel }>
}

function pendencia<T>(id: Identificacao, estado: 'incompleto' | 'indeterminado' | 'nao_aplicavel', motivo: string): ExecucaoMetodo<T> {
  return { ...id, estado, resultado: null, motivo, limitacoes: [] }
}

function calcular<T>(id: Identificacao, resultado: T, limitacoes: string[] = [], experimental = false): ExecucaoMetodo<T> {
  // Os motores antigos compartilham tabelas de direções; cada registro é independente.
  return { ...id, estado: experimental ? 'experimental' : 'calculado', resultado: structuredClone(resultado), motivo: null, limitacoes }
}

function executarMingGua(cliente: DadosParaMetodos['clientes']): ExecucaoMetodo<MingGua> {
  const id = CONTRATOS_METODOS.mingGua
  if (!cliente?.data_nascimento) return pendencia(id, 'incompleto', 'sem data de nascimento no cliente')
  if (!cliente.genero) return pendencia(id, 'incompleto', 'sem gênero informado no cliente')
  if (!normalizarGenero(cliente.genero)) return pendencia(id, 'indeterminado', 'gênero não reconhecido pela variante de cálculo adotada')
  const resultado = calcularMingGua(cliente.data_nascimento, cliente.genero)
  if (!resultado) return pendencia(id, 'indeterminado', avisoAnoSolar(cliente.data_nascimento) || 'data de nascimento inválida ou fora do intervalo suportado (ano solar de 1900 a 2099)')
  return calcular(id, resultado, ['Refere-se ao cliente cadastrado; os demais moradores ainda não são avaliados individualmente.'])
}

function anoValido(ano: number): boolean {
  return Number.isInteger(ano) && ano >= ANO_MINIMO_CONSTRUCAO && ano <= ANO_MAXIMO_CONSTRUCAO
}

function executarFeiXing(dados: DadosParaMetodos, graus: number): ExecucoesMetodos['feiXing'] {
  const id = CONTRATOS_METODOS.feiXing
  const anos = [dados.ano_construcao, dados.ano_reforma_estrutural]
  if (anos.some(ano => ano != null && !anoValido(ano))) {
    return pendencia(id, 'indeterminado', `ano do imóvel inválido; informe um inteiro entre ${ANO_MINIMO_CONSTRUCAO} e ${ANO_MAXIMO_CONSTRUCAO}`)
  }
  if (reformaIncoerente({ anoConstrucao: dados.ano_construcao, anoReformaEstrutural: dados.ano_reforma_estrutural })) {
    return pendencia(id, 'indeterminado', 'a reforma estrutural é anterior à construção; corrija os anos do imóvel')
  }
  // O ano legado só é aceito se vier de uma data ISO; não aceitar prefixos arbitrários.
  const legado = dados.bagua_entrada?.data_construcao
  if (anos.every(ano => ano == null) && legado) {
    const valido = /^\d{4}-\d{2}-\d{2}$/.test(legado)
      && avaliarAnoSolar(legado).estado !== 'invalido' && anoValido(Number(legado.slice(0, 4)))
    if (!valido) return pendencia(id, 'indeterminado', 'ano de construção legado inválido; informe o ano do imóvel')
  }
  const periodo = periodoDaConsulta(dados)
  if (!periodo) return pendencia(id, 'incompleto', 'falta o ano de construção ou da reforma estrutural válido')
  const mapa = calcularEstrelasVoadoras({ facingGraus: graus, periodo: periodo.periodo })
  if (!mapa) return pendencia(id, 'indeterminado', 'não foi possível determinar o mapa com os dados informados')
  const limitacoes = [RESSALVA_XUAN_KONG]
  if (periodo.ambiguo) limitacoes.push(`O ano ${periodo.anoUsado} coincide com a virada de período; antes do Li Chun corresponde ao Período ${periodo.periodoAnterior}. Confirme a data da obra antes de interpretar a carta.`)
  return calcular(id, { mapa, periodo }, limitacoes, true)
}

/**
 * Uma execução determinística dos adaptadores atuais, compartilhada por tela e
 * snapshot do relatório. Não combina escolas nem certifica a validade da tradição.
 * A fonte completa e seu hash pertencem à emissão; não duplicamos dados pessoais aqui.
 */
export function executarMetodos(dados: DadosParaMetodos): ExecucoesMetodos {
  const mingGua = executarMingGua(dados.clientes)
  const escola = dados.bagua_entrada?.escola
  if (escola !== 'bussola') {
    const motivo = escola === 'btb'
      ? 'a Escola BTB não usa orientação — troque para a Escola da Bússola se quiser este método'
      : 'selecione a Escola da Bússola para usar este método'
    return { mingGua, baZhai: pendencia(CONTRATOS_METODOS.baZhai, 'nao_aplicavel', motivo), feiXing: pendencia(CONTRATOS_METODOS.feiXing, 'nao_aplicavel', motivo) }
  }
  const graus = grausConfirmados(dados.bagua_entrada)
  if (graus === null) {
    const motivo = 'falta a leitura da fachada confirmada, com referência de Norte e origem'
    return { mingGua, baZhai: pendencia(CONTRATOS_METODOS.baZhai, 'incompleto', motivo), feiXing: pendencia(CONTRATOS_METODOS.feiXing, 'incompleto', motivo) }
  }
  const orientacao = lerOrientacao(dados.bagua_entrada)
  return {
    mingGua,
    baZhai: calcular(CONTRATOS_METODOS.baZhai, calcularKuaDaCasa(graus), [
      `Classificação por assento e oito octantes; usa a leitura confirmada de Norte ${orientacao.referencia === 'magnetico' ? 'magnético' : 'verdadeiro'}, sem conversão automática de referência.`,
    ]),
    feiXing: executarFeiXing(dados, graus),
  }
}
