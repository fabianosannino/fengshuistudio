import { desvioCircular, mediaCircular, normalizarGraus } from './graus'
import {
  converterLeitura,
  declinacaoPlausivel,
  type ReferenciaNorte,
} from './declinacao-magnetica'
import { montanhaDoGrau } from './montanhas'

/** Limiar operacional para recomendar repetição; não é precisão do instrumento. */
export const DISPERSAO_ALERTA_GRAUS = 3
const RESULTANTE_MINIMA = 1e-12

export interface MedicaoFachada {
  versao: 1
  leituras: [number, number, number]
  referencia: ReferenciaNorte
  registrada_em: string
  /** Conversão desde a referência original, nunca sobre uma média já convertida. */
  conversao?: { referencia: ReferenciaNorte; declinacao: number }
}

const referenciaValida = (r: unknown): r is ReferenciaNorte =>
  r === 'magnetico' || r === 'verdadeiro'

export function avaliarTresLeituras(valores: readonly number[]) {
  if (
    valores.length !== 3 ||
    valores.some((n) => !Number.isFinite(n) || n < 0 || n >= 360)
  )
    return null
  const seno = valores.reduce((s, g) => s + Math.sin((g * Math.PI) / 180), 0)
  const cosseno = valores.reduce((s, g) => s + Math.cos((g * Math.PI) / 180), 0)
  // 0/120/240 não possui direção média definida. Ruído de ponto flutuante
  // não pode escolher arbitrariamente uma fachada para esse conjunto.
  if (Math.hypot(seno, cosseno) / valores.length <= RESULTANTE_MINIMA)
    return null
  const media = mediaCircular([...valores])!
  const dispersao = desvioCircular([...valores])!
  const aplicada = normalizarGraus(Math.round(media * 10) / 10)
  const montanhas = valores.map(montanhaDoGrau)
  return {
    media,
    dispersao,
    aplicada,
    repetir: dispersao > DISPERSAO_ALERTA_GRAUS,
    mudaSetor: new Set(montanhas.map((m) => m.setor)).size > 1,
    mudaMontanha: new Set(montanhas.map((m) => m.numero)).size > 1,
    arredondamentoMudaFaixa:
      montanhaDoGrau(media).numero !== montanhaDoGrau(aplicada).numero,
  }
}

/** Dados legados sem originais continuam sem originais: nunca inventar amostras. */
export function lerMedicaoFachada(valor: unknown): MedicaoFachada | null {
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) return null
  const v = valor as Record<string, unknown>
  if (
    v.versao !== 1 ||
    !Array.isArray(v.leituras) ||
    v.leituras.some((n) => typeof n !== 'number') ||
    !avaliarTresLeituras(v.leituras) ||
    !referenciaValida(v.referencia) ||
    typeof v.registrada_em !== 'string' ||
    !Number.isFinite(Date.parse(v.registrada_em))
  )
    return null
  const medicao: MedicaoFachada = {
    versao: 1,
    leituras: [...v.leituras] as [number, number, number],
    referencia: v.referencia,
    registrada_em: v.registrada_em,
  }
  if (v.conversao !== undefined) {
    if (!v.conversao || typeof v.conversao !== 'object') return null
    const c = v.conversao as Record<string, unknown>
    if (
      !referenciaValida(c.referencia) ||
      c.referencia === v.referencia ||
      typeof c.declinacao !== 'number' ||
      !declinacaoPlausivel(c.declinacao)
    )
      return null
    medicao.conversao = { referencia: c.referencia, declinacao: c.declinacao }
  }
  return medicao
}

export function converterMedicaoFachada(
  medicao: MedicaoFachada,
  destino: ReferenciaNorte,
  declinacao: number,
): MedicaoFachada {
  const original = lerMedicaoFachada(medicao)
  if (
    !original ||
    !referenciaValida(destino) ||
    !declinacaoPlausivel(declinacao)
  )
    throw new Error('Medição inválida')
  delete original.conversao
  if (destino !== original.referencia)
    original.conversao = { referencia: destino, declinacao }
  return original
}

export function resumirMedicaoFachada(medicao: MedicaoFachada) {
  const original = avaliarTresLeituras(medicao.leituras)!
  const c = medicao.conversao
  const valores = c
    ? medicao.leituras.map(
        (graus) =>
          converterLeitura(
            { graus, referencia: medicao.referencia, declinacao: c.declinacao },
            c.referencia,
          )!.graus,
      )
    : medicao.leituras
  return {
    original,
    atual: avaliarTresLeituras(valores)!,
    referencia: c?.referencia ?? medicao.referencia,
  }
}
