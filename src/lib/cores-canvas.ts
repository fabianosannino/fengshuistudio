/**
 * Normalização de cores para a captura do relatório em PDF.
 *
 * ## O problema
 *
 * O `html2canvas` 1.4.1 — último release da biblioteca, de 2022 — reimplementa
 * o parser de CSS por conta própria e só entende as funções de cor que existiam
 * na época: `rgb()`, `hsl()`, hex e nomes. A paleta do app é declarada em
 * `oklch()` (`app/globals.css`, tokens do design de 28/07), e o Chrome serializa
 * `oklch()` como `lab()` em `getComputedStyle`. O resultado era a captura
 * inteira falhando com:
 *
 *     Error: Attempting to parse an unsupported color function "lab"
 *
 * Ou seja: o relatório — o entregável que o cliente recebe — parou de ser
 * gerado quando a paleta nova entrou, e a mensagem genérica de erro escondeu a
 * causa por duas semanas.
 *
 * ## A saída
 *
 * Antes da captura, reescrever as cores que o parser não entende para `rgb()`.
 * A conversão não é feita à mão: o próprio browser resolve, pintando a cor num
 * canvas 1×1 e lendo o pixel de volta. Isso vale para qualquer função de cor
 * que o Chrome saiba pintar — inclusive as que ainda nem existem — sem
 * implementar matemática de espaço de cor aqui.
 *
 * Só o **clone** usado pela captura é alterado; a tela do usuário continua com
 * a paleta original.
 */

/**
 * As propriedades que o html2canvas 1.4.1 lê como cor.
 *
 * A lista foi **conferida na fonte da biblioteca**, não suposta: são os cinco
 * descritores com `format: 'color'` (`background-color`, `border-<lado>-color`,
 * `color`, `text-decoration-color`, `-webkit-text-stroke-color`) mais as
 * chamadas diretas a `color.parse` em `box-shadow`, `text-shadow` e nos pontos
 * de parada dos gradientes de `background-image`.
 *
 * A versão anterior desta lista tinha `outline-color`, `fill` e `stroke` — que
 * o html2canvas **não** lê — e faltavam-lhe `-webkit-text-stroke-color`,
 * `text-shadow` e `background-image`. Cobria o que parecia razoável em vez do
 * que a biblioteca faz.
 */
const PROPRIEDADES_DE_COR = [
  'color',
  'background-color',
  'border-top-color',
  'border-right-color',
  'border-bottom-color',
  'border-left-color',
  'text-decoration-color',
  '-webkit-text-stroke-color',
] as const

/**
 * Propriedades que carregam cor **embutida** noutro valor. Converter exigiria
 * reescrever a sintaxe toda; zerar custa pouco num relatório impresso.
 *
 * Só são zeradas **quando** carregam cor não suportada — `background-image`
 * também guarda as fotos do relatório, e apagá-las sempre seria trocar um
 * defeito por outro.
 */
const PROPRIEDADES_ZERADAS = ['box-shadow', 'text-shadow', 'background-image'] as const

/** Pseudo-elementos que o html2canvas desenha, e cujo estilo é preciso ler à parte. */
const PSEUDO = ['::before', '::after'] as const

/**
 * Funções de cor que o html2canvas 1.4.1 não sabe interpretar. `color()` entra
 * porque cobre `display-p3` e afins, que o Chrome também emite.
 */
const FUNCOES_NAO_SUPORTADAS = /\b(lab|oklab|lch|oklch|color|color-mix)\s*\(/i

/** `true` se o valor usa uma função de cor que quebraria a captura. */
export function corNaoSuportada(valor: string | null | undefined): boolean {
  if (!valor) return false
  return FUNCOES_NAO_SUPORTADAS.test(valor)
}

/** Converte uma cor CSS em `rgb()`/`rgba()`. Devolve `null` se não souber. */
export type ResolvedorDeCor = (valor: string) => string | null

/**
 * Cor improvável usada para detectar quando o canvas **recusa** um valor.
 * Ver `criarResolvedorCanvas`.
 */
const MARCADOR = '#010203'

/**
 * Resolvedor apoiado no próprio browser: pinta a cor num canvas 1×1 e lê o
 * pixel. Devolve `null` fora do browser ou se o canvas 2D não existir.
 */
export function criarResolvedorCanvas(): ResolvedorDeCor {
  if (typeof document === 'undefined') return () => null

  const canvas = document.createElement('canvas')
  canvas.width = 1
  canvas.height = 1
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return () => null

  const cache = new Map<string, string | null>()

  return (valor: string) => {
    const emCache = cache.get(valor)
    if (emCache !== undefined) return emCache

    let resultado: string | null = null
    try {
      ctx.clearRect(0, 0, 1, 1)
      /*
        Se o browser não entender o valor, `fillStyle` **não** lança: ele
        simplesmente ignora a atribuição e mantém o que estava. Por isso o
        marcador improvável antes — e a comparação depois.

        Ela faltava. O marcador estava aqui desde o começo, com o comentário
        dizendo que servia «para detectar a recusa», e nada o comparava: um
        valor recusado virava `rgb(1, 2, 3)`, quase preto, em silêncio. O
        comentário descrevia uma guarda que nunca foi escrita.

        O preço do falso positivo é uma cor que por acaso resolva exatamente
        para o marcador ser pulada — e o de pular é a cor original ficar, que
        é o comportamento correto para «não sei converter isto».
      */
      ctx.fillStyle = MARCADOR
      ctx.fillStyle = valor
      if (ctx.fillStyle === MARCADOR) {
        cache.set(valor, null)
        return null
      }

      ctx.fillRect(0, 0, 1, 1)
      const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data
      resultado = a === 255
        ? `rgb(${r}, ${g}, ${b})`
        : `rgba(${r}, ${g}, ${b}, ${(a / 255).toFixed(3)})`
    } catch {
      resultado = null
    }

    cache.set(valor, resultado)
    return resultado
  }
}

/**
 * Os nomes das custom properties que valem para o documento.
 *
 * Duas fontes, unidas:
 *
 * 1. **O estilo computado da raiz.** Navegadores atuais enumeram as custom
 *    properties ao percorrer a declaração por índice. É a fonte confiável — e
 *    é a que dá para exercitar em teste, porque a leitura é injetada.
 * 2. **As folhas de estilo**, percorrendo `@layer` e `@media` por dentro — o
 *    Tailwind põe o `:root` dentro de `@layer base`. Serve de rede para o
 *    navegador que não enumera a computada; o jsdom não preserva custom
 *    properties nas regras, então esta parte não tem teste e é por isso que
 *    ela é a **segunda** fonte, não a única.
 *
 * Folha de outra origem lança ao ler `cssRules`; é pulada. A paleta é nossa.
 */
export function nomesDeVariaveis(
  doc: Document,
  computadoDaRaiz?: CSSStyleDeclaration
): string[] {
  const nomes = new Set<string>()

  if (computadoDaRaiz) {
    for (let i = 0; i < computadoDaRaiz.length; i += 1) {
      const nome = computadoDaRaiz.item(i)
      if (nome && nome.startsWith('--')) nomes.add(nome)
    }
  }

  const visitar = (regras: CSSRuleList) => {
    for (const regra of Array.from(regras)) {
      const grupo = (regra as CSSGroupingRule).cssRules
      if (grupo) {
        visitar(grupo)
        continue
      }
      const estilo = (regra as CSSStyleRule).style
      if (!estilo) continue
      for (let i = 0; i < estilo.length; i += 1) {
        const nome = estilo.item(i)
        if (nome && nome.startsWith('--')) nomes.add(nome)
      }
    }
  }

  for (const folha of Array.from(doc.styleSheets ?? [])) {
    try {
      visitar(folha.cssRules)
    } catch {
      // Folha de outra origem. A paleta não mora nelas.
    }
  }

  return Array.from(nomes)
}

/**
 * Converte a paleta **na origem**: as próprias variáveis CSS.
 *
 * ## Por que aqui, e não só nos usos
 *
 * A paleta são 32 `oklch()` declarados como custom properties no `:root`
 * (`app/globals.css`). Toda cor da tela deriva delas — inclusive as que a
 * varredura por propriedade não alcança: `::before`/`::after`, pontos de
 * parada de gradiente, `text-shadow`, `-webkit-text-stroke-color`.
 *
 * Trocar a variável faz o browser substituir o valor **antes** de o
 * html2canvas ler qualquer coisa. É um lugar em vez de uma lista, e a lista é
 * justamente o que já falhou duas vezes aqui: primeiro por não rodar (o
 * `instanceof` entre realms), depois por ser mais curta do que a da própria
 * biblioteca.
 *
 * A varredura por propriedade continua, como segunda linha — cor escrita
 * literalmente numa regra, sem passar por variável, só ela pega.
 */
export function normalizarVariaveisDeCor(
  doc: Document,
  resolver: ResolvedorDeCor,
  lerEstilo: (el: Element) => CSSStyleDeclaration = el => getComputedStyle(el)
): number {
  const raiz = doc.documentElement
  if (!raiz) return 0

  let computado: CSSStyleDeclaration
  try {
    computado = lerEstilo(raiz)
  } catch {
    return 0
  }
  if (!computado) return 0

  const estilo = (raiz as unknown as { style?: CSSStyleDeclaration }).style
  if (!estilo || typeof estilo.setProperty !== 'function') return 0

  let trocas = 0

  for (const nome of nomesDeVariaveis(doc, computado)) {
    const valor = computado.getPropertyValue(nome)
    if (!corNaoSuportada(valor)) continue

    const convertida = resolver(valor)
    if (!convertida) continue

    /*
      Inline no `<html>` com `!important`: ganha do `:root` e também do
      `.dark`, que declara as mesmas variáveis no mesmo elemento. Sem o
      `!important` a regra de classe venceria e o tema escuro continuaria
      em oklch.
    */
    estilo.setProperty(nome, convertida, 'important')
    trocas += 1
  }

  return trocas
}

/**
 * O que sobrou depois da normalização.
 *
 * A varredura devolvia só um número, e ninguém o conferia — então zero trocas
 * era indistinguível de «não havia o que trocar». Foi assim que a captura
 * passou a falhar no iPhone com a mensagem opaca do html2canvas
 * (`unsupported color function "lab"`), sem nada no log apontando onde.
 *
 * Esta função responde a pergunta que a mensagem do html2canvas não responde:
 * **qual elemento, qual propriedade, qual valor.**
 */
export function coresNaoSuportadasRestantes(
  raiz: Document | HTMLElement,
  lerEstilo: (el: Element) => CSSStyleDeclaration = el => getComputedStyle(el),
  limite = 5,
  lerPseudo?: (el: Element, pseudo: string) => CSSStyleDeclaration | null
): string[] {
  if (!('querySelectorAll' in raiz)) return []

  const achados: string[] = []

  const identificar = (el: Element) => {
    const nome = el.tagName.toLowerCase()
    const classe = typeof el.className === 'string' && el.className
      ? `.${el.className.trim().split(/\s+/).slice(0, 2).join('.')}`
      : ''
    return `${nome}${classe}`
  }

  const conferir = (el: Element, sufixo: string, computado: CSSStyleDeclaration) => {
    for (const prop of [...PROPRIEDADES_DE_COR, ...PROPRIEDADES_ZERADAS] as const) {
      const valor = computado.getPropertyValue(prop)
      if (!corNaoSuportada(valor)) continue
      achados.push(`${identificar(el)}${sufixo} { ${prop}: ${valor} }`)
      return true
    }
    return false
  }

  for (const el of Array.from(raiz.querySelectorAll('*'))) {
    if (achados.length >= limite) break

    let computado: CSSStyleDeclaration
    try {
      computado = lerEstilo(el)
    } catch {
      continue
    }
    if (computado) conferir(el, '', computado)

    /*
      Os pseudo-elementos entram na conferência porque o html2canvas os
      **desenha** — e ficam de fora da normalização porque não há estilo
      inline em `::before`. Se um deles for o culpado, o erro passa a dizer
      isso em vez de deixar a busca recomeçar do zero.
    */
    for (const pseudo of PSEUDO) {
      if (achados.length >= limite) break
      try {
        const doPseudo = lerPseudo?.(el, pseudo)
        if (doPseudo) conferir(el, pseudo, doPseudo)
      } catch {
        // Ambiente que não resolve pseudo-elemento; segue.
      }
    }
  }

  return achados
}

/**
 * Reescreve, como estilo inline, toda cor não suportada encontrada em `raiz`.
 *
 * Devolve quantas declarações foram trocadas — útil para log e para o teste
 * afirmar que a varredura realmente alcançou os elementos.
 */
export function normalizarCores(
  raiz: Document | HTMLElement,
  resolver: ResolvedorDeCor,
  lerEstilo: (el: Element) => CSSStyleDeclaration = el => getComputedStyle(el)
): number {
  const escopo = 'querySelectorAll' in raiz ? raiz : null
  if (!escopo) return 0

  let trocas = 0

  for (const el of Array.from(escopo.querySelectorAll('*'))) {
    /*
      **Nada de `instanceof` aqui.**

      O clone do html2canvas vive dentro de um `<iframe>` — outro realm, com
      outro `HTMLElement`. `el instanceof HTMLElement` compara contra o
      construtor **desta** janela e devolve `false` para todo elemento do
      clone. A versão anterior fazia exatamente isso: pulava todos, devolvia
      zero trocas, e a captura seguia com as cores `lab()` intactas até o
      html2canvas estourar com «unsupported color function».

      O teste não pegava porque o jsdom monta tudo num realm só — é a guarda
      que passa por rodar no ambiente errado.

      O que precisamos é escrever em `style`. Perguntar isso direto vale em
      qualquer realm, e é a capacidade que de fato usamos.
    */
    const alvo = el as unknown as { style?: CSSStyleDeclaration }
    if (!alvo.style || typeof alvo.style.setProperty !== 'function') continue

    let computado: CSSStyleDeclaration
    try {
      computado = lerEstilo(el)
    } catch {
      continue
    }
    if (!computado) continue

    for (const prop of PROPRIEDADES_DE_COR) {
      const valor = computado.getPropertyValue(prop)
      if (!corNaoSuportada(valor)) continue

      const convertida = resolver(valor)
      if (!convertida) continue

      alvo.style.setProperty(prop, convertida, 'important')
      trocas++
    }

    /*
      As três que carregam cor embutida noutro valor. Zeradas só **quando**
      carregam cor não suportada: `background-image` também guarda as fotos do
      relatório, e apagá-las sempre trocaria um defeito por outro.
    */
    for (const prop of PROPRIEDADES_ZERADAS) {
      if (!corNaoSuportada(computado.getPropertyValue(prop))) continue
      alvo.style.setProperty(prop, 'none', 'important')
      trocas++
    }
  }

  return trocas
}
