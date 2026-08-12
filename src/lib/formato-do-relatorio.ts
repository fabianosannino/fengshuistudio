/**
 * Os dois formatos do relatório.
 *
 * ## Por que dois
 *
 * O relatório tinha um formato só — todas as seções, todas as vezes — e um
 * seletor com onze caixas para o consultor montar o dele na mão. Na prática ele
 * monta sempre as mesmas duas coisas:
 *
 * - o **resumo do cliente**, que é o que a pessoa lê: o que está bem, o que
 *   pede atenção e o que fazer, sem grade de estrelas nem tabela de critérios;
 * - o **dossiê técnico**, que é o que ele arquiva e usa para se defender: tudo,
 *   incluindo a metodologia e os números.
 *
 * Escolher um formato passa a ser um clique; as caixas continuam lá para quem
 * quiser ajustar depois, porque a escolha é um ponto de partida, não uma
 * camisa de força.
 *
 * ## O que fica de fora do resumo
 *
 * Estrelas Voadoras, divergências entre métodos e a evolução do diagnóstico
 * saem — não porque não importem, mas porque exigem vocabulário que o cliente
 * não tem e, sem esse vocabulário, viram autoridade decorativa. O consultor
 * pode religá-las caso a caso.
 */

/** As seções que o relatório sabe montar. */
export const SECOES = [
  'completo', 'capa', 'introducao', 'bagua', 'curas', 'checklist', 'roda_vida',
  'plano_acao', 'evolucao', 'fotos', 'proximos_passos', 'calendario',
  'divergencias', 'conclusao',
] as const

export type Secao = typeof SECOES[number]

export type FormatoDoRelatorio = 'resumo' | 'dossie'

export interface DescricaoDeFormato {
  id: FormatoDoRelatorio
  titulo: string
  subtitulo: string
  /** Quais seções o formato liga. */
  secoes: Record<Secao, boolean>
}

function todas(valor: boolean): Record<Secao, boolean> {
  return Object.fromEntries(SECOES.map(s => [s, valor])) as Record<Secao, boolean>
}

/**
 * `completo` é o interruptor mestre das telas: quando ligado, várias seções são
 * renderizadas por ele em vez de individualmente. O resumo o desliga de
 * propósito — é o que permite escolher seção a seção.
 */
export const FORMATOS: Record<FormatoDoRelatorio, DescricaoDeFormato> = {
  resumo: {
    id: 'resumo',
    titulo: 'Resumo do cliente',
    subtitulo: 'O que está bem, o que pede atenção e o que fazer — sem tabela de critérios nem grade de estrelas.',
    secoes: {
      ...todas(false),
      capa: true,
      introducao: true,
      bagua: true,
      curas: true,
      plano_acao: true,
      fotos: true,
      proximos_passos: true,
      conclusao: true,
    },
  },
  dossie: {
    id: 'dossie',
    titulo: 'Dossiê técnico',
    subtitulo: 'Tudo: métodos, números, evolução e divergências entre escolas.',
    secoes: todas(true),
  },
}

/** As seções de um formato, prontas para virar estado da tela. */
export function secoesDoFormato(formato: FormatoDoRelatorio): Record<Secao, boolean> {
  return { ...FORMATOS[formato].secoes }
}

/**
 * Qual formato as seções ligadas correspondem — ou `null` quando o consultor
 * ajustou à mão.
 *
 * Existe para o seletor não mentir: com «Resumo» destacado e uma seção extra
 * ligada, o consultor entregaria um dossiê achando que mandou o resumo.
 */
export function formatoCorrespondente(
  secoes: Partial<Record<Secao, boolean>>
): FormatoDoRelatorio | null {
  for (const formato of Object.values(FORMATOS)) {
    const igual = SECOES.every(s => !!secoes[s] === formato.secoes[s])
    if (igual) return formato.id
  }
  return null
}

/**
 * Estimativa de páginas A4 do que está ligado.
 *
 * São pesos, não medição: a contagem real depende de quantos setores foram
 * avaliados, quantas fotos existem e do texto que o consultor escreveu. O
 * número aparece na tela como «cerca de», e é isso que ele é.
 */
const PAGINAS_POR_SECAO: Record<Secao, number> = {
  // `completo` não soma: é o interruptor mestre, e as seções que ele liga já
  // estão contadas uma a uma. Somar os dois contaria o relatório em dobro.
  completo: 0,
  capa: 1,
  introducao: 0.5,
  bagua: 2,
  curas: 2,
  checklist: 1,
  roda_vida: 1,
  plano_acao: 1,
  evolucao: 1,
  fotos: 1,
  proximos_passos: 0.5,
  calendario: 0.5,
  divergencias: 1,
  conclusao: 0.5,
}

export function paginasEstimadas(secoes: Partial<Record<Secao, boolean>>): number {
  // Sem base fixa: a capa é uma seção como as outras e já tem peso próprio.
  // Somar uma base por cima a contaria duas vezes.
  const soma = SECOES.reduce((total, s) => total + (secoes[s] ? PAGINAS_POR_SECAO[s] : 0), 0)
  return Math.max(1, Math.round(soma))
}
