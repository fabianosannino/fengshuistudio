/**
 * Xuan Kong Liu Fa (玄空六法) — implementa apenas a camada de maior valor
 * prático segundo docs/domain/fengshui-prompts-modulos.md (P6): Zheng Shen
 * (正神, "Direção Correta") e Ling Shen (零神, "Direção do Espírito") do
 * período. As demais camadas do método (Cheng Men, Ci Xiong, Jin Long, Ai
 * Xing) ficam fora deste corte — ver ADR 0008.
 *
 * Zheng Shen é o setor cujo número Lo Shu FIXO (o arranjo estático do
 * Bagua, não a grade voadora) é igual ao número do período — a "casa
 * natural" da estrela do período. Ling Shen é o setor geometricamente
 * oposto. Exemplo conferido no Período 9: número 9 é Li (Sul) no arranjo
 * fixo → Zheng Shen = Sul; oposto = Norte → Ling Shen = Norte — bate
 * exatamente com o valor citado em fengshui-metodos-referencia.md, Método 6.
 *
 * Período 5 não tem setor próprio (é o Centro do Lo Shu, não uma das 8
 * direções) — devolve null. Textos clássicos divergem sobre a convenção de
 * substituição para o Período 5; não resolvo essa ambiguidade às cegas.
 */

import { TRIGRAMAS, type Setor } from './trigramas'

const SETOR_OPOSTO: Record<Setor, Setor> = {
  N: 'S', S: 'N', E: 'W', W: 'E', NE: 'SW', SW: 'NE', SE: 'NW', NW: 'SE',
}

const SETOR_POR_NUMERO_LO_SHU: Partial<Record<number, Setor>> = Object.fromEntries(
  Object.values(TRIGRAMAS).map(info => [info.numeroLoShu, info.direcao])
)

export interface ZhengShenLingShen {
  zhengShen: Setor
  lingShen: Setor
}

/** Zheng Shen/Ling Shen do período (1-9). Período 5 → null (ver nota acima). */
export function zhengShenLingShen(periodo: number): ZhengShenLingShen | null {
  const zhengShen = SETOR_POR_NUMERO_LO_SHU[periodo]
  if (!zhengShen) return null
  return { zhengShen, lingShen: SETOR_OPOSTO[zhengShen] }
}
