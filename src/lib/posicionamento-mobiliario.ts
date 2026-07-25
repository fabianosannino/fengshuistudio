/**
 * Regra estrutural do Ba Zhai "sentar no mal, olhar para o bem" (坐凶向吉),
 * conforme docs/domain/fengshui-metodos-referencia.md, Método 2:
 *
 *   - localização de coisas ruins (fogão, banheiro, depósito) pode ficar
 *     num setor desfavorável — é onde essas coisas normalmente já estão;
 *   - a DIREÇÃO para a qual a pessoa/objeto se volta deve ser favorável.
 *
 * Aplica-se do mesmo jeito a fogão (corpo × boca), cama (posição × direção
 * medida pela perpendicular à cabeceira) e mesa (posição × direção para a
 * qual a pessoa olha) — só muda como o consultor mede "direção" para cada
 * objeto, não a regra de avaliação em si.
 *
 * Sempre avaliado contra as direções favoráveis de UMA pessoa (o Ming Gua
 * de quem usa o objeto — quem dorme na cama, quem cozinha, quem trabalha na
 * mesa — não necessariamente o Kua da casa). Quem chama esta função decide
 * de quem são as direções.
 */

import type { DirecoesFavoraveis } from './ming-gua'
import type { Setor } from './trigramas'

const SETOR_POR_NOME_DIRECAO: Record<string, Setor> = {
  Norte: 'N', Nordeste: 'NE', Leste: 'E', Sudeste: 'SE',
  Sul: 'S', Sudoeste: 'SW', Oeste: 'W', Noroeste: 'NW',
}

/** Converte os 4 nomes de direção favorável (como vêm de ming-gua.ts) para o setor correspondente. */
export function setoresFavoraveis(direcoes: DirecoesFavoraveis): Set<Setor> {
  return new Set(
    [direcoes.shengChi, direcoes.tienYi, direcoes.yenNien, direcoes.fuWei].map(nome => SETOR_POR_NOME_DIRECAO[nome])
  )
}

export interface AvaliacaoPosicionamento {
  localizacao: Setor
  /** Informativo — a regra não exige que a localização seja desfavorável, só permite. */
  localizacaoFavoravel: boolean
  direcao: Setor
  /** O critério que importa: a direção (para onde o objeto aponta/a pessoa olha) deve ser favorável. */
  direcaoFavoravel: boolean
}

/**
 * Avalia um objeto (fogão, cama, mesa) contra a regra 坐凶向吉.
 * `localizacao` é o setor onde o corpo do objeto está; `direcao` é o setor
 * para o qual ele aponta (boca do fogão, perpendicular à cabeceira da cama,
 * direção do olhar na mesa).
 */
export function avaliarPosicionamento(
  direcoesFavoraveis: DirecoesFavoraveis,
  localizacao: Setor,
  direcao: Setor
): AvaliacaoPosicionamento {
  const favoraveis = setoresFavoraveis(direcoesFavoraveis)
  return {
    localizacao,
    localizacaoFavoravel: favoraveis.has(localizacao),
    direcao,
    direcaoFavoravel: favoraveis.has(direcao),
  }
}
