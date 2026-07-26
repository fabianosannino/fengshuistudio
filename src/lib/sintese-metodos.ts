/**
 * Motor de síntese e conflitos entre métodos (Parte IV de
 * docs/domain/fengshui-metodos-referencia.md).
 *
 * O problema que este módulo resolve: os métodos discordam entre si o tempo
 * todo, e sem uma política explícita o software vira um gerador de conselhos
 * contraditórios. Aqui mora a **hierarquia de precedência** (decisão de
 * domínio registrada na ADR 0013) e a resolução de conflito derivada dela.
 *
 * Módulo puro — nenhum cálculo de método acontece aqui. Recebe os veredictos
 * já calculados por `oito-mansoes.ts`, `estrelas-voadoras.ts`, `liu-fa.ts`
 * etc. e decide o que fazer quando eles se contradizem.
 *
 * Invariante de honestidade (§Parte IV): divergência nunca é silenciada. A
 * resolução SEMPRE devolve, junto do vencedor, a lista completa de veredictos
 * perdedores — para o relatório poder dizer "onde as escolas divergem neste
 * imóvel". Um produto que esconde divergência mente por omissão.
 */

export type MetodoFengShui =
  | 'formas'        // Luan Tou 峦头
  | 'fei-xing'      // Xuan Kong Fei Xing 玄空飛星
  | 'ba-zhai'       // Oito Mansões 八宅
  | 'liu-fa'        // Xuan Kong Liu Fa 玄空六法
  | 'ba-zi'         // 八字
  | 'da-gua-san-he' // Xuan Kong Da Gua / San He
  | 'btb'           // Black Sect Tantric Buddhism

interface PerfilMetodo {
  /** 1 = maior precedência. Ver ADR 0013. */
  precedencia: number
  nome: string
  /**
   * false = o método nunca origina uma recomendação por conta própria; só
   * escolhe entre remédios que outro método já validou (caso do BaZi).
   */
  podeCriarRecomendacao: boolean
  /**
   * true = o método não pode ser combinado com nenhum outro na mesma análise
   * (caso do BTB: usa um mapeamento de setores incompatível com os métodos de
   * bússola — misturar produz um resultado que não é válido em escola alguma).
   */
  isolado: boolean
  /** Escopo de aplicação: a casa toda, ou apenas pontos específicos. */
  escopo: 'imovel' | 'pontual'
}

export const PERFIS_METODOS: Record<MetodoFengShui, PerfilMetodo> = {
  'formas':        { precedencia: 1, nome: 'Escola das Formas', podeCriarRecomendacao: true,  isolado: false, escopo: 'imovel' },
  'fei-xing':      { precedencia: 2, nome: 'Estrelas Voadoras', podeCriarRecomendacao: true,  isolado: false, escopo: 'imovel' },
  'ba-zhai':       { precedencia: 3, nome: 'Oito Mansões',      podeCriarRecomendacao: true,  isolado: false, escopo: 'imovel' },
  'liu-fa':        { precedencia: 4, nome: 'Liu Fa',            podeCriarRecomendacao: true,  isolado: false, escopo: 'imovel' },
  'ba-zi':         { precedencia: 5, nome: 'BaZi',              podeCriarRecomendacao: false, isolado: false, escopo: 'imovel' },
  'da-gua-san-he': { precedencia: 6, nome: 'Da Gua / San He',   podeCriarRecomendacao: true,  isolado: false, escopo: 'pontual' },
  'btb':           { precedencia: 7, nome: 'Chapéu Preto (BTB)', podeCriarRecomendacao: true, isolado: true,  escopo: 'imovel' },
}

/**
 * Veredicto de um método sobre um setor. 'neutro' significa "este método não
 * tem nada a dizer aqui" — e por isso nunca vence nem conta como divergência.
 */
export type Veredicto = 'perigoso' | 'desfavoravel' | 'neutro' | 'favoravel'

const SEVERIDADE: Record<Veredicto, number> = {
  perigoso: 3, desfavoravel: 2, favoravel: 1, neutro: 0,
}

export interface AvaliacaoMetodo {
  metodo: MetodoFengShui
  veredicto: Veredicto
  /** Texto curto do porquê, para o relatório. */
  motivo: string
}

export interface Divergencia {
  metodo: MetodoFengShui
  veredicto: Veredicto
  motivo: string
  /** Por que este veredicto perdeu — sempre explicitado, nunca só descartado. */
  razaoDaPerda: string
}

export interface ResolucaoConflito {
  veredictoFinal: Veredicto
  metodoVencedor: MetodoFengShui | null
  motivoFinal: string
  /** Veredictos não-neutros que discordam do vencedor. Vazio = consenso. */
  divergencias: Divergencia[]
  /** true quando havia ao menos uma divergência real — dispara a seção "onde as escolas divergem". */
  houveConflito: boolean
  /** Avisos estruturais (ex.: BTB misturado com método de bússola). */
  avisos: string[]
}

function conflita(a: Veredicto, b: Veredicto): boolean {
  if (a === 'neutro' || b === 'neutro') return false
  const aRuim = a === 'perigoso' || a === 'desfavoravel'
  const bRuim = b === 'perigoso' || b === 'desfavoravel'
  // Discordância de DIREÇÃO (bom vs. ruim) é conflito; 'desfavoravel' vs
  // 'perigoso' é o mesmo lado, apenas graus diferentes de gravidade.
  return aRuim !== bRuim
}

/**
 * Aplica a hierarquia de precedência a um conjunto de avaliações do MESMO
 * setor e devolve o veredicto final mais a divergência completa.
 *
 * Regras implementadas (ADR 0013 / Parte IV do documento de referência):
 * - O método de maior precedência com veredicto não-neutro decide.
 * - Métodos que não podem criar recomendação (BaZi) nunca decidem sozinhos.
 * - BTB é isolado: se aparecer junto de métodos de bússola, emite aviso e é
 *   descartado da decisão (não existe leitura válida que misture os dois).
 * - Nada é silenciado: todo veredicto não-neutro que discorda do vencedor sai
 *   em `divergencias`, com a razão da perda.
 */
export function resolverConflito(avaliacoes: AvaliacaoMetodo[]): ResolucaoConflito {
  const avisos: string[] = []
  const naoNeutras = avaliacoes.filter(a => a.veredicto !== 'neutro')

  if (naoNeutras.length === 0) {
    return {
      veredictoFinal: 'neutro', metodoVencedor: null,
      motivoFinal: 'Nenhum método apontou algo relevante neste setor.',
      divergencias: [], houveConflito: false, avisos,
    }
  }

  const temBussola = naoNeutras.some(a => !PERFIS_METODOS[a.metodo].isolado)
  const temIsolado = naoNeutras.some(a => PERFIS_METODOS[a.metodo].isolado)
  if (temBussola && temIsolado) {
    avisos.push(
      'BTB não pode ser combinado com métodos de bússola (usam mapeamentos de setor incompatíveis). ' +
      'O veredicto do BTB foi desconsiderado nesta síntese — rode uma análise BTB separada se quiser essa leitura.',
    )
  }

  // Elegíveis a DECIDIR (mas todos os não-neutros seguem reportáveis como divergência).
  const elegiveis = naoNeutras.filter(a => {
    const perfil = PERFIS_METODOS[a.metodo]
    if (!perfil.podeCriarRecomendacao) return false
    if (perfil.isolado && temBussola) return false
    return true
  })

  if (elegiveis.length === 0) {
    return {
      veredictoFinal: 'neutro', metodoVencedor: null,
      motivoFinal: 'Nenhum método elegível a originar recomendação se manifestou neste setor.',
      divergencias: naoNeutras.map(a => ({
        metodo: a.metodo, veredicto: a.veredicto, motivo: a.motivo,
        razaoDaPerda: PERFIS_METODOS[a.metodo].podeCriarRecomendacao
          ? 'Método isolado (BTB), desconsiderado por haver métodos de bússola na análise.'
          : `${PERFIS_METODOS[a.metodo].nome} não origina recomendação por conta própria — só escolhe entre remédios já validados.`,
      })),
      houveConflito: false, avisos,
    }
  }

  const vencedor = [...elegiveis].sort((a, b) => {
    const precA = PERFIS_METODOS[a.metodo].precedencia
    const precB = PERFIS_METODOS[b.metodo].precedencia
    if (precA !== precB) return precA - precB
    // Mesma precedência: o mais grave prevalece (fail-safe — nunca subestima risco).
    return SEVERIDADE[b.veredicto] - SEVERIDADE[a.veredicto]
  })[0]

  const divergencias: Divergencia[] = naoNeutras
    .filter(a => a !== vencedor && conflita(a.veredicto, vencedor.veredicto))
    .map(a => {
      const perfil = PERFIS_METODOS[a.metodo]
      let razaoDaPerda: string
      if (perfil.isolado && temBussola) {
        razaoDaPerda = 'Método isolado (BTB), desconsiderado por haver métodos de bússola na análise.'
      } else if (!perfil.podeCriarRecomendacao) {
        razaoDaPerda = `${perfil.nome} não origina recomendação por conta própria.`
      } else {
        razaoDaPerda =
          `${PERFIS_METODOS[vencedor.metodo].nome} tem precedência sobre ${perfil.nome} ` +
          `(${PERFIS_METODOS[vencedor.metodo].precedencia}ª vs ${perfil.precedencia}ª na hierarquia).`
      }
      return { metodo: a.metodo, veredicto: a.veredicto, motivo: a.motivo, razaoDaPerda }
    })

  return {
    veredictoFinal: vencedor.veredicto,
    metodoVencedor: vencedor.metodo,
    motivoFinal: vencedor.motivo,
    divergencias,
    houveConflito: divergencias.length > 0,
    avisos,
  }
}

// ─── Taxonomia de remédios ────────────────────────────────────────────────
// Parte IV do documento pede `evidenceStrength` OBRIGATÓRIO desde o primeiro
// remédio codificado ("é mais barato nascer com o campo do que migrar dados
// depois") — por isso nenhum campo de proveniência aqui é opcional.

export type MecanismoRemedio = 'layout' | 'elemento' | 'bloqueio-de-forma' | 'ativacao' | 'comportamental' | 'temporal'
export type AcaoWuXing = 'gerar' | 'exaurir' | 'controlar' | 'nenhuma'
export type CustoRemedio = 'zero' | 'baixo' | 'medio' | 'alto' | 'estrutural'
export type Reversibilidade = 'instantanea' | 'facil' | 'dificil' | 'permanente'
export type ForcaEvidencia = 'consenso-classico' | 'variante-de-escola' | 'tradicao-popular'

export interface Remedio {
  id: string
  metodo: MetodoFengShui
  setor: string
  problema: string
  acao: string
  mecanismo: MecanismoRemedio
  acaoWuXing: AcaoWuXing
  custo: CustoRemedio
  reversibilidade: Reversibilidade
  forcaEvidencia: ForcaEvidencia
  contraindicacoes: string[]
  exigeSelecaoDeData: boolean
}

const ORDEM_CUSTO: Record<CustoRemedio, number> = { zero: 0, baixo: 1, medio: 2, alto: 3, estrutural: 4 }
const ORDEM_REVERSIBILIDADE: Record<Reversibilidade, number> = { instantanea: 0, facil: 1, dificil: 2, permanente: 3 }
const ORDEM_EVIDENCIA: Record<ForcaEvidencia, number> = { 'consenso-classico': 0, 'variante-de-escola': 1, 'tradicao-popular': 2 }

/**
 * Ordenação padrão das recomendações: **custo zero e reversível primeiro**
 * ("reposicionar uma cama antes de vender um cristal" — Parte IV). Protege a
 * credibilidade do consultor e do produto.
 *
 * Critério de desempate por força de evidência é escolha própria declarada,
 * não citação do documento: entre dois remédios de mesmo custo e
 * reversibilidade, o de consenso clássico vem antes do popular sem consenso.
 * Não reordena por gravidade do problema — isso é responsabilidade de quem
 * agrupa por setor, já que a gravidade vem da resolução de conflito.
 */
export function ordenarRemedios(remedios: Remedio[]): Remedio[] {
  return [...remedios].sort((a, b) => {
    const custo = ORDEM_CUSTO[a.custo] - ORDEM_CUSTO[b.custo]
    if (custo !== 0) return custo
    const rev = ORDEM_REVERSIBILIDADE[a.reversibilidade] - ORDEM_REVERSIBILIDADE[b.reversibilidade]
    if (rev !== 0) return rev
    return ORDEM_EVIDENCIA[a.forcaEvidencia] - ORDEM_EVIDENCIA[b.forcaEvidencia]
  })
}
