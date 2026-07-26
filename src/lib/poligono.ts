/**
 * Geometria de polígono — centro (Tai Ji) real de um imóvel, conforme
 * docs/domain/fengshui-metodos-referencia.md §1.7:
 *
 *   "Centro = centróide geométrico do polígono (não o centro do bounding
 *   box). Para plantas em L, U ou T o centróide pode cair fora da área
 *   construída — isso é diagnóstico em si."
 *
 * Hoje o app usa o centro do retângulo delimitador (bounding box) — correto
 * só para plantas retangulares. Este módulo implementa a matemática real
 * (fórmula padrão do centroide de polígono por decomposição em triângulos
 * com o teorema do sapateiro/shoelace — geometria de livro-texto, sem
 * ambiguidade de interpretação) para plantas de qualquer forma.
 *
 * ESCOPO: só a geometria. A "regra do terço" (setor ausente vs. extensão)
 * e a ferramenta de desenho de polígono na UI ficam fora deste corte — ver
 * ADR 0009.
 */

export interface Ponto {
  x: number
  y: number
}

/**
 * Área do polígono pela fórmula do sapateiro (shoelace). Sempre positiva,
 * independente da polígono estar em sentido horário ou anti-horário.
 * Devolve 0 para menos de 3 pontos.
 */
export function areaPoligono(pontos: Ponto[]): number {
  return Math.abs(areaComSinal(pontos))
}

function areaComSinal(pontos: Ponto[]): number {
  if (pontos.length < 3) return 0
  let soma = 0
  for (let i = 0; i < pontos.length; i++) {
    const atual = pontos[i]
    const proximo = pontos[(i + 1) % pontos.length]
    soma += atual.x * proximo.y - proximo.x * atual.y
  }
  return soma / 2
}

/**
 * Centróide geométrico (ponderado pela área) do polígono — NÃO é a média
 * aritmética dos vértices, que erra para polígonos não uniformes (ex.: um
 * "L" tem mais vértices do lado estreito, puxando a média para lá sem
 * justificativa geométrica). Devolve null para polígono degenerado (menos
 * de 3 pontos ou área zero).
 */
export function centroidePoligono(pontos: Ponto[]): Ponto | null {
  const a = areaComSinal(pontos)
  if (pontos.length < 3 || a === 0) return null

  let cx = 0
  let cy = 0
  for (let i = 0; i < pontos.length; i++) {
    const atual = pontos[i]
    const proximo = pontos[(i + 1) % pontos.length]
    const fator = atual.x * proximo.y - proximo.x * atual.y
    cx += (atual.x + proximo.x) * fator
    cy += (atual.y + proximo.y) * fator
  }
  return { x: cx / (6 * a), y: cy / (6 * a) }
}

/**
 * Teste ponto-em-polígono por ray casting (par/ímpar de cruzamentos).
 * Funciona para polígonos simples (sem auto-interseção), convexos ou
 * côncavos — exatamente o caso de plantas em L/U/T que este módulo precisa
 * cobrir.
 */
export function pontoDentroDoPoligono(ponto: Ponto, pontos: Ponto[]): boolean {
  let dentro = false
  for (let i = 0, j = pontos.length - 1; i < pontos.length; j = i++) {
    const pi = pontos[i]
    const pj = pontos[j]
    const cruza =
      pi.y > ponto.y !== pj.y > ponto.y &&
      ponto.x < ((pj.x - pi.x) * (ponto.y - pi.y)) / (pj.y - pi.y) + pi.x
    if (cruza) dentro = !dentro
  }
  return dentro
}

export interface DiagnosticoTaiJi {
  centro: Ponto
  /** true quando o centróide geométrico cai FORA da área construída — diagnóstico em si (plantas em L/U/T). */
  centroForaDaArea: boolean
}

/**
 * Calcula o Tai Ji (centro) de um polígono e sinaliza quando ele cai fora
 * da área construída. Devolve null para polígono degenerado.
 */
export function calcularTaiJi(pontos: Ponto[]): DiagnosticoTaiJi | null {
  const centro = centroidePoligono(pontos)
  if (!centro) return null
  return { centro, centroForaDaArea: !pontoDentroDoPoligono(centro, pontos) }
}

// ─── Cobertura por célula (base da "regra do terço") ──────────────────────

export interface Retangulo {
  x: number
  y: number
  w: number
  h: number
}

/** Retângulo delimitador (bounding box) do polígono. Devolve null para lista vazia. */
export function retanguloDelimitador(pontos: Ponto[]): Retangulo | null {
  if (pontos.length === 0) return null
  const xs = pontos.map(p => p.x)
  const ys = pontos.map(p => p.y)
  const x = Math.min(...xs)
  const y = Math.min(...ys)
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y }
}

/**
 * Recorta um polígono por um retângulo alinhado aos eixos, pelo algoritmo
 * de Sutherland-Hodgman (4 recortes sucessivos, um por lado do retângulo).
 * Geometria de livro-texto, funciona para polígonos convexos ou côncavos
 * (mas não auto-interseccionados) — o resultado pode ter mais vértices que
 * a entrada. Devolve [] quando não há interseção.
 */
export function recortarPoligono(pontos: Ponto[], retangulo: Retangulo): Ponto[] {
  const { x, y, w, h } = retangulo
  const bordas: [Ponto, Ponto][] = [
    [{ x, y }, { x: x + w, y }],
    [{ x: x + w, y }, { x: x + w, y: y + h }],
    [{ x: x + w, y: y + h }, { x, y: y + h }],
    [{ x, y: y + h }, { x, y }],
  ]

  let saida = pontos
  for (const [a, b] of bordas) {
    if (saida.length === 0) break
    const entrada = saida
    saida = []
    // "Dentro" = lado direito do vetor a→b (bordas do retângulo em sentido horário, y crescendo para baixo).
    const dentro = (p: Ponto) => (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x) >= 0
    const intersecao = (p1: Ponto, p2: Ponto): Ponto => {
      const d1 = (b.x - a.x) * (p1.y - a.y) - (b.y - a.y) * (p1.x - a.x)
      const d2 = (b.x - a.x) * (p2.y - a.y) - (b.y - a.y) * (p2.x - a.x)
      const t = d1 / (d1 - d2)
      return { x: p1.x + t * (p2.x - p1.x), y: p1.y + t * (p2.y - p1.y) }
    }
    for (let i = 0; i < entrada.length; i++) {
      const atual = entrada[i]
      const anterior = entrada[(i - 1 + entrada.length) % entrada.length]
      const atualDentro = dentro(atual)
      const anteriorDentro = dentro(anterior)
      if (atualDentro) {
        if (!anteriorDentro) saida.push(intersecao(anterior, atual))
        saida.push(atual)
      } else if (anteriorDentro) {
        saida.push(intersecao(anterior, atual))
      }
    }
  }
  return saida
}

export interface CoberturaCelula {
  linha: number
  coluna: number
  /** Fração (0-1) da área da célula coberta pelo polígono. */
  cobertura: number
}

/**
 * Divide o retângulo delimitador do polígono numa grade `divisoes × divisoes`
 * (3×3 por padrão) e calcula, para cada célula, a fração de área coberta
 * pelo polígono. Célula (0,0) é o canto superior-esquerdo do bounding box,
 * na mesma orientação x/y da entrada — mapear célula → setor cardeal
 * (N/NE/E/…) é responsabilidade de quem chama, pois depende do facing/
 * rotação do imóvel (mesma separação de responsabilidade de
 * `calcularGridOrder` em bagua-grid.ts).
 */
export function coberturaPorCelula(pontos: Ponto[], divisoes = 3): CoberturaCelula[] {
  if (pontos.length < 3) return []
  const bbox = retanguloDelimitador(pontos)
  if (!bbox || bbox.w === 0 || bbox.h === 0) return []
  const larguraCelula = bbox.w / divisoes
  const alturaCelula = bbox.h / divisoes
  const celulas: CoberturaCelula[] = []
  for (let linha = 0; linha < divisoes; linha++) {
    for (let coluna = 0; coluna < divisoes; coluna++) {
      const celula: Retangulo = {
        x: bbox.x + coluna * larguraCelula,
        y: bbox.y + linha * alturaCelula,
        w: larguraCelula,
        h: alturaCelula,
      }
      const areaCelula = larguraCelula * alturaCelula
      const areaCoberta = areaPoligono(recortarPoligono(pontos, celula))
      celulas.push({ linha, coluna, cobertura: areaCoberta / areaCelula })
    }
  }
  return celulas
}

/**
 * Regra do terço — lado do "setor ausente" (缺角): células da grade 3×3
 * (excluindo o Centro) cuja cobertura fica abaixo do limiar dado.
 *
 * Escolha de implementação (documentada, não uma citação literal): o
 * documento de referência descreve a regra em termos de "falta na extensão
 * do LADO" (uma medida linear), não de área. Aqui a aproximamos por
 * cobertura de ÁREA da célula — célula com menos de (1 − limiarFalta) da
 * área coberta conta como "ausente". Para o limiar padrão de 1/3 isso
 * significa: célula com menos de 2/3 de cobertura → setor ausente.
 */
export function setoresAusentes(pontos: Ponto[], limiarFalta = 1 / 3): CoberturaCelula[] {
  const CENTRO = 1 // linha 1, coluna 1 na grade 3×3
  return coberturaPorCelula(pontos, 3).filter(
    c => !(c.linha === CENTRO && c.coluna === CENTRO) && c.cobertura < 1 - limiarFalta
  )
}

interface RetanguloDaGrade {
  linhaInicio: number
  linhaFim: number
  colunaInicio: number
  colunaFim: number
}

function celulaDentroDoRetangulo(linha: number, coluna: number, r: RetanguloDaGrade): boolean {
  return linha >= r.linhaInicio && linha < r.linhaFim && coluna >= r.colunaInicio && coluna < r.colunaFim
}

/**
 * Regra do terço — lado da "extensão" (凸出): protrusão sólida além do corpo
 * principal do imóvel.
 *
 * Diferente do "setor ausente" (que só precisa do bounding box do próprio
 * polígono), extensão exige uma referência de "corpo principal" — nada se
 * projeta além do seu próprio retângulo delimitador, por definição. ADR 0009
 * deixava isso em aberto; a definição abaixo é um algoritmo PRÓPRIO,
 * declarado, não uma citação de fonte clássica:
 *
 *   1. Marca cada célula da grade 3×3 como "cheia" (cobertura ≥ 1−limiarFalta,
 *      o mesmo limiar e o complemento exato de "ausente" — uma célula nunca é
 *      as duas coisas ao mesmo tempo).
 *   2. Entre todos os sub-retângulos da grade (alinhados aos eixos) que
 *      contêm o Centro e cujas células são TODAS "cheias", encontra a maior
 *      área possível — o tamanho do "corpo principal".
 *   3. Faz a UNIÃO de TODOS os retângulos que atingem essa área máxima (não
 *      só um, escolhido arbitrariamente) — essencial quando há empate: um
 *      formato em L simples tem DOIS retângulos de mesma área máxima (as
 *      "duas pernas" do L), e escolher só um trataria a outra perna como
 *      "extensão" por engano. Unindo os dois, o L inteiro vira corpo
 *      principal e não sobra nenhuma extensão — comportamento verificado em
 *      teste.
 *   4. Toda célula "cheia" que fica FORA dessa união é uma extensão.
 *
 * Verificado com dois casos hand-verified: (a) um L simples não gera nenhuma
 * extensão (a "perna" que sobra é corpo principal, não saliência); (b) corpo
 * principal ocupando as 2/3 superiores da grade mais uma saliência sólida na
 * célula inferior-central — o algoritmo aponta exatamente essa célula como
 * extensão, e as duas células vazias ao lado dela como "ausente" (nunca as
 * duas categorias ao mesmo tempo).
 */
export function setoresExtensao(pontos: Ponto[], limiarFalta = 1 / 3): CoberturaCelula[] {
  const DIVISOES = 3
  const CENTRO = 1
  const celulas = coberturaPorCelula(pontos, DIVISOES)
  if (celulas.length === 0) return []

  const limiarCheia = 1 - limiarFalta
  const cheia = (linha: number, coluna: number) =>
    celulas.find(c => c.linha === linha && c.coluna === coluna)!.cobertura >= limiarCheia

  const candidatos: (RetanguloDaGrade & { area: number })[] = []
  for (let linhaInicio = 0; linhaInicio < DIVISOES; linhaInicio++) {
    for (let linhaFim = linhaInicio + 1; linhaFim <= DIVISOES; linhaFim++) {
      for (let colunaInicio = 0; colunaInicio < DIVISOES; colunaInicio++) {
        for (let colunaFim = colunaInicio + 1; colunaFim <= DIVISOES; colunaFim++) {
          const r: RetanguloDaGrade = { linhaInicio, linhaFim, colunaInicio, colunaFim }
          if (!celulaDentroDoRetangulo(CENTRO, CENTRO, r)) continue

          let todasCheias = true
          for (let linha = linhaInicio; linha < linhaFim && todasCheias; linha++) {
            for (let coluna = colunaInicio; coluna < colunaFim; coluna++) {
              if (!cheia(linha, coluna)) { todasCheias = false; break }
            }
          }
          if (!todasCheias) continue

          candidatos.push({ ...r, area: (colunaFim - colunaInicio) * (linhaFim - linhaInicio) })
        }
      }
    }
  }

  if (candidatos.length === 0) return []
  const areaMaxima = Math.max(...candidatos.map(c => c.area))
  const corposPrincipais = candidatos.filter(c => c.area === areaMaxima)

  return celulas.filter(
    c => cheia(c.linha, c.coluna) && !corposPrincipais.some(r => celulaDentroDoRetangulo(c.linha, c.coluna, r))
  )
}
