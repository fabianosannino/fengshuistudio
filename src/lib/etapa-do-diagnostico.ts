/**
 * Em que ponto do diagnóstico cada consulta está.
 *
 * ## Por que existe
 *
 * O produto tinha `status` (`rascunho`, `em_andamento`, `finalizada`,
 * `arquivada`) e nada mais. «Em andamento» é o estado de quase toda consulta
 * viva e não diz nada: uma consulta que só tem nome e uma que já tem Ba Guá,
 * curas e falta só o PDF são ambas «em andamento». O consultor não conseguia
 * responder «o que falta aqui?» sem abrir a consulta.
 *
 * A etapa é **derivada**, nunca gravada. Um campo de etapa gravado é mais uma
 * coisa para desincronizar do dado real — a leitura de fachada estar lá e a
 * etapa dizer que não é o tipo de divergência que ninguém percebe até o
 * relatório sair errado.
 */

/** As cinco etapas, na ordem em que acontecem. */
export const ETAPAS = ['cadastro', 'orientacao', 'bagua', 'curas', 'relatorio'] as const
export type Etapa = typeof ETAPAS[number]

export const ROTULO_DA_ETAPA: Record<Etapa, string> = {
  cadastro: 'Cadastro',
  orientacao: 'Orientação',
  bagua: 'Ba Guá',
  curas: 'Curas',
  relatorio: 'Relatório',
}

/** O que precisa estar no lugar para cada etapa contar como cumprida. */
export interface DadosDaConsulta {
  /** `bagua_entrada.orientacao_graus` — a leitura da fachada. */
  orientacaoGraus?: number | null
  /** `bagua_entrada.finalizada_em` — a análise do Ba Guá foi fechada. */
  baguaFinalizadaEm?: string | null
  /** Quantos setores já têm score. Ba Guá também conta por aqui. */
  setoresComScore?: number
  /** Quantas curas foram prescritas para esta consulta. */
  prescricoes?: number
  /** `relatorio_gerado_em`. */
  relatorioGeradoEm?: string | null
}

export interface ProgressoDoDiagnostico {
  /** A etapa em que a consulta está — a primeira ainda não cumprida. */
  atual: Etapa
  /** Índice de `atual` em `ETAPAS`. */
  indice: number
  /** Uma por etapa, na ordem de `ETAPAS`. */
  cumpridas: boolean[]
  /** `true` quando as cinco estão cumpridas. */
  completo: boolean
  /** «Etapa Ba Guá» ou «Concluída». */
  rotulo: string
}

/**
 * As cinco etapas de uma consulta.
 *
 * Cadastro conta como cumprida sempre: se há uma consulta, alguém a cadastrou.
 * É o que faz a barra nunca aparecer inteiramente vazia — e uma barra vazia
 * seria lida como «nada foi feito», o que nunca é verdade aqui.
 */
export function progressoDoDiagnostico(dados: DadosDaConsulta): ProgressoDoDiagnostico {
  const cumpridas = [
    true,
    typeof dados.orientacaoGraus === 'number',
    !!dados.baguaFinalizadaEm || (dados.setoresComScore ?? 0) > 0,
    (dados.prescricoes ?? 0) > 0,
    !!dados.relatorioGeradoEm,
  ]

  // A primeira não cumprida, e não «a última cumprida + 1»: quem informa a
  // fachada e pula direto para as curas não está na etapa Relatório — está
  // devendo o Ba Guá, e é isso que a tela precisa dizer.
  const primeiraPendente = cumpridas.indexOf(false)
  const completo = primeiraPendente === -1
  const indice = completo ? ETAPAS.length - 1 : primeiraPendente

  return {
    atual: ETAPAS[indice],
    indice,
    cumpridas,
    completo,
    rotulo: completo ? 'Concluída' : `Etapa ${ROTULO_DA_ETAPA[ETAPAS[indice]]}`,
  }
}

/**
 * Cor de cada segmento da barra: cumprido, atual, futuro.
 *
 * Fora da paleta não entra nada — jade para o feito, dourado para o de agora,
 * branco translúcido para o que ainda não começou (a barra vive sobre o cartão
 * tinta).
 */
export function coresDaBarra(progresso: ProgressoDoDiagnostico): string[] {
  return progresso.cumpridas.map((cumprida, i) => {
    if (cumprida) return '#2E7D6B'
    if (i === progresso.indice) return '#C9A227'
    return 'rgba(255,255,255,0.16)'
  })
}
