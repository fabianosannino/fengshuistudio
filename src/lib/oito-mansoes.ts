/**
 * Oito Mansões (Ba Zhai) da CASA — só faz sentido na Escola da Bússola, que
 * já captura a orientação magnética real da fachada (`orientacao_graus`).
 *
 * Diferente do Ming Gua pessoal (que depende de nascimento/gênero), o Kua da
 * casa depende só da direção que a fachada encara — determinado pelo mesmo
 * quadrado mágico Lo Shu (洛書) usado em toda a numerologia clássica chinesa
 * (Oito Mansões, Estrelas Voadoras, etc.), aqui aplicado à direção do imóvel:
 *
 *   N=1  NE=8  E=3  SE=4  S=9  SW=2  W=7  NW=6
 *
 * Verificação: cada linha/coluna/diagonal do quadrado 3x3 formado por essas
 * posições soma 15 — é o próprio quadrado Lo Shu, testado abaixo.
 *
 * Uma vez com o Kua da casa, reaproveita-se a MESMA tabela de direções
 * favoráveis do Ming Gua pessoal (src/lib/ming-gua.ts) — a tabela não muda,
 * só a fonte do número Kua (pessoa vs. fachada do imóvel).
 */

import { DIRECOES_POR_KUA, GRUPO_LESTE, type GrupoKua, type MingGua } from './ming-gua'

/** Lo Shu por octante (0=N,1=NE,2=E,3=SE,4=S,5=SW,6=W,7=NW) — mesma convenção de octantes de bagua-grid.ts. */
const LO_SHU_POR_OCTANTE = [1, 8, 3, 4, 9, 2, 7, 6] as const

/**
 * Kua da casa a partir da orientação magnética da fachada (0–359°, 0=Norte).
 * Arredonda para o octante mais próximo — mesma granularidade da Bússola.
 */
export function calcularKuaDaCasa(facingGraus: number): MingGua {
  const normalizado = ((facingGraus % 360) + 360) % 360
  const octante = Math.round(normalizado / 45) % 8
  const kua = LO_SHU_POR_OCTANTE[octante]
  return {
    kua,
    grupo: GRUPO_LESTE.has(kua) ? 'leste' : 'oeste',
    direcoes: DIRECOES_POR_KUA[kua],
  }
}

export interface Compatibilidade {
  compativel: boolean
  grupoMorador: GrupoKua
  grupoCasa: GrupoKua
  mensagem: string
}

/**
 * Compara o grupo do morador (Kua pessoal) com o grupo da casa (Kua da
 * fachada). Grupos iguais = energia da casa reforça as direções favoráveis
 * do morador; grupos diferentes = conflito clássico, não impede morar bem,
 * mas indica atenção redobrada na escolha de quarto/porta/mesa de trabalho.
 */
export function compatibilidadeMoradorCasa(kuaMorador: number, kuaCasa: number): Compatibilidade {
  const grupoMorador: GrupoKua = GRUPO_LESTE.has(kuaMorador) ? 'leste' : 'oeste'
  const grupoCasa: GrupoKua = GRUPO_LESTE.has(kuaCasa) ? 'leste' : 'oeste'
  const compativel = grupoMorador === grupoCasa
  return {
    compativel,
    grupoMorador,
    grupoCasa,
    mensagem: compativel
      ? `O grupo do morador (${grupoMorador === 'leste' ? 'Leste' : 'Oeste'}) combina com o grupo da casa — as direções favoráveis do morador são reforçadas pela orientação do imóvel.`
      : `O grupo do morador (${grupoMorador === 'leste' ? 'Leste' : 'Oeste'}) diverge do grupo da casa (${grupoCasa === 'leste' ? 'Leste' : 'Oeste'}) — vale atenção redobrada ao posicionar cama, mesa de trabalho e porta do quarto nas direções pessoais favoráveis, já que a orientação geral do imóvel não as reforça.`,
  }
}
