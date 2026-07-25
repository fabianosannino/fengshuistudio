/**
 * Ano solar chinês (Hsia) — todo cálculo de ano em Feng Shui (Ming Gua, Período
 * de construção, e futuramente BaZi/estrela anual) usa o ano SOLAR, que começa
 * no Li Chun (立春, ~3–5 de fevereiro), nunca o ano civil nem o Ano Novo lunar.
 *
 * LIMITAÇÃO CONHECIDA (documentada em
 * docs/domain/fengshui-metodos-referencia.md §1.6): aproximamos o Li Chun por
 * uma data fixa (4 de fevereiro), quando a data real varia entre 3 e 5 de
 * fevereiro ano a ano. Isso cobre a esmagadora maioria dos casos, mas erra em
 * um punhado de dias por década perto da fronteira. A correção exigiria uma
 * tabela de efemérides (precisão de minuto) ou uma biblioteca astronômica —
 * decisão registrada como pendente, não deve ser resolvida "no chute" aqui.
 *
 * Fonte única desta aproximação: antes desta extração, `ming-gua.ts` e
 * `estrelas-voadoras.ts` reimplementavam o mesmo parsing e a mesma regra
 * separadamente.
 */

const DIA_LI_CHUN_APROXIMADO = 4
const MES_LI_CHUN = 2

export interface DataSolar {
  /** Ano civil (calendário gregoriano), sem ajuste de Li Chun. */
  anoCivil: number
  /** Ano solar chinês: igual ao civil, exceto entre 1º de janeiro e o Li Chun (conta o ano anterior). */
  anoSolar: number
}

/**
 * Extrai {anoCivil, anoSolar} de uma data (ISO 'yyyy-mm-dd' ou `Date`).
 * Para strings, lê os campos direto do texto — evita bugs de fuso horário
 * que `new Date(string)` introduziria. Devolve null para entrada ausente ou
 * inválida — fail-closed, nunca chuta uma data.
 */
export function dataSolar(data: string | Date | null | undefined): DataSolar | null {
  if (!data) return null

  let ano: number, mes: number, dia: number
  if (typeof data === 'string') {
    const m = data.match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (!m) return null
    ano = Number(m[1]); mes = Number(m[2]); dia = Number(m[3])
  } else {
    if (isNaN(data.getTime())) return null
    ano = data.getFullYear(); mes = data.getMonth() + 1; dia = data.getDate()
  }

  const antesDoLiChun = mes < MES_LI_CHUN || (mes === MES_LI_CHUN && dia < DIA_LI_CHUN_APROXIMADO)
  return { anoCivil: ano, anoSolar: antesDoLiChun ? ano - 1 : ano }
}
