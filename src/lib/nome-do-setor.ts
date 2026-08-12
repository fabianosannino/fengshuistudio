/**
 * Um setor, muitos nomes — o resolvedor canônico.
 *
 * ## O problema
 *
 * `setores_bagua.nome` é texto livre gravado pela tela que criou a linha, e as
 * telas nunca concordaram. Em produção, hoje, nove setores aparecem sob quinze
 * grafias:
 *
 * - `Centro` e `Centro/Saúde`
 * - `Fama` e `Fama/Reputação`
 * - `Família` e `Familia` (sem acento)
 * - `Pessoas Úteis` e `Pessoas Uteis`
 * - `Espiritualidade` e `Conhecimento` (dois nomes para o mesmo Guá, NE)
 * - `Criatividade` e `Filhos`
 *
 * Quem compara `nome` com igualdade exata perde a maior parte das linhas **em
 * silêncio** — o setor simplesmente não aparece, como se não tivesse sido
 * avaliado. `app/curas/page.tsx` já carregava uma tabela de apelidos própria
 * para contornar isso; esta é a mesma ideia, num lugar só.
 *
 * ## Por que não normalizar o banco
 *
 * Um `update` corrigindo as grafias resolveria hoje e voltaria amanhã: a coluna
 * continua sendo texto livre escrito por três telas diferentes. O resolvedor
 * cobre o que já existe **e** o que ainda vai ser gravado. Normalizar a coluna
 * é uma decisão separada, que exige constraint para valer.
 */

import { LOSHU_ORDER } from './constants'

/** O nome canônico de cada setor é o de `LOSHU_ORDER`. */
export type SetorCanonico = string

/**
 * Apelidos conhecidos → nome canônico.
 *
 * A comparação é feita **sem acento e sem caixa**, então `Familia` e `FAMÍLIA`
 * caem no mesmo lugar sem entrada própria. Aqui ficam só as variações que
 * mudam a palavra: composições («Centro/Saúde»), sinônimos de domínio
 * («Conhecimento» é o Guá NE, o mesmo da «Espiritualidade») e os rótulos que a
 * biblioteca de curas usa.
 */
const APELIDOS: Record<string, SetorCanonico> = {
  'centro': 'Centro',
  'centro/saude': 'Centro',
  'saude/centro': 'Centro',
  'saude': 'Centro',
  'fama': 'Fama',
  'fama/reputacao': 'Fama',
  'reputacao': 'Fama',
  'familia': 'Família',
  'familia/saude': 'Família',
  'relacionamentos': 'Relacionamentos',
  'amor': 'Relacionamentos',
  'criatividade': 'Criatividade',
  'filhos': 'Criatividade',
  'criatividade/filhos': 'Criatividade',
  'pessoas uteis': 'Pessoas Úteis',
  'mentores': 'Pessoas Úteis',
  'espiritualidade': 'Conhecimento',
  'conhecimento': 'Conhecimento',
  'sabedoria': 'Conhecimento',
  'prosperidade': 'Prosperidade',
  'riqueza': 'Prosperidade',
  'carreira': 'Carreira',
}

/** Sem acento, sem caixa, sem espaço em volta e sem espaço em torno da barra. */
function chave(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s*\/\s*/g, '/')
    .replace(/\s+/g, ' ')
}

/**
 * O nome canônico de um setor, ou `null` quando não dá para reconhecer.
 *
 * `null` e não um palpite: atribuir a linha ao setor errado é pior que
 * ignorá-la, porque o score de um ambiente apareceria sob o nome de outro.
 */
export function setorCanonico(nome: string | null | undefined): SetorCanonico | null {
  if (typeof nome !== 'string' || nome.trim() === '') return null

  const k = chave(nome)
  if (APELIDOS[k]) return APELIDOS[k]

  // Ainda pode ser um nome canônico que não está na tabela de apelidos.
  const direto = LOSHU_ORDER.find(canonico => chave(canonico) === k)
  return direto ?? null
}

/**
 * Score por setor canônico, a partir das linhas de `setores_bagua`.
 *
 * Os nove setores estão sempre presentes no resultado: os que não têm linha —
 * ou cujo nome não foi reconhecido — ficam `null`, que é «não avaliado», nunca
 * zero.
 *
 * Quando duas linhas caem no mesmo setor canônico (a consulta foi refeita por
 * uma tela que grafa diferente), vale a que **tem** score. Descartar a que tem
 * em favor da que não tem apagaria uma avaliação real.
 */
export function scorePorSetor(
  linhas: { nome?: string | null; score_percentual?: number | null }[]
): Record<SetorCanonico, number | null> {
  const saida: Record<SetorCanonico, number | null> = {}
  for (const canonico of LOSHU_ORDER) saida[canonico] = null

  for (const linha of linhas) {
    const canonico = setorCanonico(linha.nome)
    if (!canonico || !(canonico in saida)) continue

    const score = typeof linha.score_percentual === 'number' ? linha.score_percentual : null
    if (score !== null || saida[canonico] === null) saida[canonico] = score
  }

  return saida
}
