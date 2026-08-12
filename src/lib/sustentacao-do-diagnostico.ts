/**
 * «O que este diagnóstico já sustenta».
 *
 * ## O defeito que isto corrige
 *
 * A tela do Ba Guá mostrava os métodos que **davam** para calcular e omitia em
 * silêncio os que não davam. Um imóvel sem ano de construção simplesmente não
 * tinha a seção de Estrelas Voadoras — nem na tela, nem no relatório —, e nada
 * dizia que ela existia e por que estava faltando. O consultor entregava um
 * diagnóstico incompleto sem saber que estava incompleto.
 *
 * Aqui cada método aparece sempre, e o que falta vira **consequência
 * declarada**: «Estrelas Voadoras — falta o ano de construção». É a mesma regra
 * do ADR 0020, aplicada à entrada em vez da saída.
 *
 * ## O que este módulo não faz
 *
 * Não calcula nada. Ele responde «dá para calcular?» a partir dos dados
 * presentes; o cálculo em si mora nos módulos de cada método. Juntar as duas
 * coisas faria a tela recalcular tudo só para saber se pode desenhar um ícone.
 */

export interface DadosDoDiagnostico {
  /** `bagua_entrada.orientacao_graus` — a leitura da fachada. */
  orientacaoGraus?: number | null
  /** Quantos dos nove setores já têm score. */
  setoresComScore?: number
  /** Ano de construção ou de reforma estrutural, o que houver. */
  anoDoImovel?: number | null
  /** Data de nascimento do cliente (ISO). */
  nascimentoDoCliente?: string | null
  /** Gênero do cliente, para o Ming Gua. */
  generoDoCliente?: string | null
  /** Contorno real do imóvel — habilita Tai Ji e setores ausentes. */
  temPoligonoTaiJi?: boolean
  /** Metodologia escolhida ('btb' | 'bussola'). */
  escola?: string | null
}

export interface MetodoSustentado {
  /** Nome do método como o consultor o conhece. */
  nome: string
  disponivel: boolean
  /**
   * O que falta, quando não está disponível. Nunca é o nome do campo: é a
   * consequência de ele faltar, em português de consultor.
   */
  oQueFalta?: string
  /** Para onde ir para resolver. `null` quando não há rota direta. */
  href?: string | null
  /** Texto do link. */
  acao?: string
}

/**
 * A lista completa, na ordem em que os métodos entram no levantamento.
 *
 * Métodos que dependem da Escola da Bússola **não somem** no BTB: aparecem
 * dizendo que a escola escolhida não os usa. Sumir daria a impressão de que
 * eles não existem, e a escolha de escola é reversível.
 */
export function sustentacaoDoDiagnostico(dados: DadosDoDiagnostico): MetodoSustentado[] {
  const {
    orientacaoGraus, setoresComScore = 0, anoDoImovel,
    nascimentoDoCliente, generoDoCliente, temPoligonoTaiJi, escola,
  } = dados

  const temFachada = typeof orientacaoGraus === 'number'
  const bussola = (escola ?? '').toLowerCase() === 'bussola'

  const metodos: MetodoSustentado[] = []

  metodos.push({
    nome: 'Ba Guá dos 9 setores',
    disponivel: setoresComScore > 0,
    oQueFalta: setoresComScore > 0 ? undefined : 'nenhum setor avaliado ainda',
    acao: 'Avaliar',
  })

  metodos.push({
    nome: 'Tai Ji e setores ausentes',
    disponivel: !!temPoligonoTaiJi,
    oQueFalta: temPoligonoTaiJi ? undefined : 'o contorno do imóvel está no retângulo padrão — sem ele, falta e excesso de área não são calculáveis',
    acao: 'Desenhar contorno',
  })

  if (!bussola) {
    // No BTB o Ba Guá é fixo pela porta (ADR 0018): orientação não entra.
    metodos.push({
      nome: 'Kua da Casa · Oito Mansões',
      disponivel: false,
      oQueFalta: 'a Escola BTB não usa orientação — troque para a Escola da Bússola se quiser este método',
      href: null,
    })
    metodos.push({
      nome: 'Estrelas Voadoras',
      disponivel: false,
      oQueFalta: 'a Escola BTB não usa orientação — troque para a Escola da Bússola se quiser este método',
      href: null,
    })
  } else {
    metodos.push({
      nome: 'Kua da Casa · Oito Mansões',
      disponivel: temFachada,
      oQueFalta: temFachada ? undefined : 'falta a leitura da fachada',
      acao: 'Medir',
    })

    metodos.push({
      nome: 'Estrelas Voadoras',
      disponivel: temFachada && typeof anoDoImovel === 'number',
      oQueFalta: !temFachada
        ? 'falta a leitura da fachada'
        : typeof anoDoImovel === 'number' ? undefined : 'falta o ano de construção',
      acao: !temFachada ? 'Medir' : 'Informar',
    })
  }

  const temMingGua = !!nascimentoDoCliente && !!generoDoCliente
  metodos.push({
    nome: 'Ming Gua do morador',
    disponivel: temMingGua,
    oQueFalta: temMingGua
      ? undefined
      : !nascimentoDoCliente
        ? 'sem data de nascimento no cliente'
        : 'sem gênero informado no cliente',
    acao: 'Completar cadastro',
  })

  return metodos
}

/** «3 de 5 métodos sustentados» — o resumo de uma linha. */
export function resumoDaSustentacao(metodos: MetodoSustentado[]): string {
  const disponiveis = metodos.filter(m => m.disponivel).length
  if (disponiveis === 0) return `Nenhum dos ${metodos.length} métodos está sustentado ainda`
  if (disponiveis === metodos.length) return `Os ${metodos.length} métodos estão sustentados`
  return `${disponiveis} de ${metodos.length} métodos sustentados`
}

/**
 * A ressalva metodológica que acompanha qualquer carta de Estrelas Voadoras
 * gerada aqui.
 *
 * Vive neste módulo, e não solta numa tela, porque precisa aparecer igual na
 * bancada e no relatório. Era rodapé de 10px; o handoff pede caixa dourada.
 */
export const RESSALVA_XUAN_KONG =
  'Base San Yuan Xuan Kong. Não inclui estrela de substituição (替卦), fachadas de borda entre montanhas nem casas em período de transição — valide com um consultor formado antes de decisões importantes.'
