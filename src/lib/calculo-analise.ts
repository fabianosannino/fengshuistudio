import type { FonteRelatorio } from './relatorio-emissao'
import { estadoDaAnalise, impedimentoDaAnalise } from './analise-bagua'
import { executarMetodos } from './execucao-metodos'
import { calcularSetores, type Marcacao } from './geometria-bagua'
import { nomesDosQuadrantes } from './mobiliario'
import { lerOrientacao } from './orientacao'
import type { ResultadoAnalise } from './historico-analises'

export function impedimentoParaHistorico(fonte: FonteRelatorio): string | null {
  const b = fonte.consulta.bagua_entrada
  if (
    !b?.bordas ||
    !b.finalizada_em ||
    !['btb', 'bussola'].includes(b.escola ?? '') ||
    fonte.setores.length !== 9
  ) {
    return 'Finalize e salve os nove setores da planta antes de registrar a análise.'
  }
  if (estadoDaAnalise(b) !== 'atual')
    return 'Revise e finalize a planta com as entradas atuais antes de registrar a análise.'
  return impedimentoDaAnalise(b, { bagua: true })
}

/** Fontes antigas nunca são recalculadas ao abrir; esta função só cria versões. */
export function calcularResultadoAnalise(
  fonte: FonteRelatorio,
): ResultadoAnalise {
  const impedimento = impedimentoParaHistorico(fonte)
  if (impedimento) throw new Error(impedimento)
  const b = fonte.consulta.bagua_entrada!
  const nomes = nomesDosQuadrantes(b)
  const setores = calcularSetores(
    b.bordas!,
    b.lh ?? [1 / 3, 2 / 3],
    b.lv ?? [1 / 3, 2 / 3],
    (b.marcacoes ?? []) as Marcacao[],
    b.geometria_regra ?? 'descontos-v1',
  )
  return {
    orientacao: lerOrientacao(b),
    metodos: executarMetodos(fonte.consulta),
    setores: setores.map((s, i) => ({
      numero: i + 1,
      nome: nomes[i],
      falta: s.faltaPct,
      excesso: s.excessoPct,
      saldo: s.excessoPct - s.faltaPct,
      geometria: s.geo,
      nota:
        fonte.setores.find((v) => v.numero === i + 1)?.score_percentual ?? null,
    })),
  }
}
