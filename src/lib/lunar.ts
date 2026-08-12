/**
 * Fase da lua — cálculo único.
 *
 * A mesma função vivia copiada em `app/calendario/page.tsx` e em
 * `app/consultas/[id]/relatorio/page.tsx`, com a mesma constante mágica de
 * lunação e a mesma âncora. Duas cópias de um cálculo é uma cópia esperando
 * para divergir da outra — e a divergência apareceria numa tela dizendo «lua
 * cheia» enquanto o relatório imprime «gibosa crescente» para o mesmo dia.
 *
 * ## Precisão
 *
 * É a aproximação de lunação média: conta os dias desde uma lua nova conhecida
 * e divide pelo mês sinódico. Erra em algumas horas contra uma efeméride real,
 * porque a órbita não é circular. Para escolher o dia de um ritual, essa
 * precisão basta; para qualquer coisa que dependa do instante exato da fase,
 * não bastaria — e nada aqui depende.
 */

/** Mês sinódico médio, em dias. */
const LUNACAO = 29.53058867

/** Lua nova de 6 de janeiro de 2000, 18:14 UTC — a âncora do cálculo. */
const LUA_NOVA_CONHECIDA = Date.UTC(2000, 0, 6, 18, 14)

/** As quatro fases que o produto usa em `rituais.fase_lunar`. */
export type FaseSimples = 'nova' | 'crescente' | 'cheia' | 'minguante'

export interface FaseLunar {
  /** Nome exibível, com as oito subdivisões. */
  nome: string
  emoji: string
  /** Posição no ciclo, 0–100. */
  percentual: number
  /** A redução às quatro fases usadas pelos rituais. */
  simples: FaseSimples
}

/**
 * Limites em dias desde a lua nova. A ordem importa: o primeiro que couber
 * ganha, e o resto do ciclo volta a ser «Nova».
 */
const FAIXAS: { ate: number; nome: string; emoji: string; simples: FaseSimples }[] = [
  { ate: 1.85, nome: 'Nova', emoji: '🌑', simples: 'nova' },
  { ate: 7.38, nome: 'Crescente', emoji: '🌒', simples: 'crescente' },
  { ate: 9.23, nome: 'Quarto Crescente', emoji: '🌓', simples: 'crescente' },
  { ate: 13.69, nome: 'Gibosa Crescente', emoji: '🌔', simples: 'crescente' },
  { ate: 16.61, nome: 'Cheia', emoji: '🌕', simples: 'cheia' },
  { ate: 20.30, nome: 'Gibosa Minguante', emoji: '🌖', simples: 'minguante' },
  { ate: 22.15, nome: 'Quarto Minguante', emoji: '🌗', simples: 'minguante' },
  { ate: 27.68, nome: 'Minguante', emoji: '🌘', simples: 'minguante' },
]

const NOVA: FaseLunar = { nome: 'Nova', emoji: '🌑', percentual: 0, simples: 'nova' }

export function faseLunar(data: Date = new Date()): FaseLunar {
  const t = data.getTime()
  if (Number.isNaN(t)) return NOVA

  const dias = (t - LUA_NOVA_CONHECIDA) / 86_400_000
  // O `+ LUNACAO` antes do segundo `%` cobre datas anteriores à âncora, em que
  // o resto de `%` é negativo em JavaScript.
  const noCiclo = ((dias % LUNACAO) + LUNACAO) % LUNACAO
  const percentual = Math.round((noCiclo / LUNACAO) * 100)

  const faixa = FAIXAS.find(f => noCiclo < f.ate)
  if (!faixa) return { ...NOVA, percentual }
  return { nome: faixa.nome, emoji: faixa.emoji, percentual, simples: faixa.simples }
}

/** Cor de cada fase simples, dentro da paleta. */
export const COR_DA_FASE: Record<FaseSimples, string> = {
  nova: '#0E1B2C',
  crescente: '#2E7D6B',
  cheia: '#C9A227',
  minguante: '#6B7280',
}

/**
 * Reduz um nome de fase às quatro usadas pelos rituais.
 *
 * Existe porque partes da tela já têm o nome em mãos (vindo de um `select` ou
 * do banco) e não a data. A ordem dos testes importa: «Quarto Crescente» e
 * «Gibosa Crescente» contêm «Crescente», e é isso que se quer.
 */
export function simplesDoNome(nome: string): FaseSimples {
  if (nome.includes('Crescente')) return 'crescente'
  if (nome.includes('Cheia')) return 'cheia'
  if (nome.includes('Minguante')) return 'minguante'
  return 'nova'
}
