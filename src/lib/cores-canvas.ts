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

/** Propriedades cujo valor pode conter uma função de cor moderna. */
const PROPRIEDADES_DE_COR = [
  'color',
  'background-color',
  'border-top-color',
  'border-right-color',
  'border-bottom-color',
  'border-left-color',
  'outline-color',
  'text-decoration-color',
  'fill',
  'stroke',
] as const

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
  limite = 5
): string[] {
  if (!('querySelectorAll' in raiz)) return []

  const achados: string[] = []

  for (const el of Array.from(raiz.querySelectorAll('*'))) {
    if (achados.length >= limite) break

    let computado: CSSStyleDeclaration
    try {
      computado = lerEstilo(el)
    } catch {
      continue
    }
    if (!computado) continue

    for (const prop of [...PROPRIEDADES_DE_COR, 'box-shadow'] as const) {
      const valor = computado.getPropertyValue(prop)
      if (!corNaoSuportada(valor)) continue

      const nome = el.tagName.toLowerCase()
      const classe = typeof el.className === 'string' && el.className
        ? `.${el.className.trim().split(/\s+/).slice(0, 2).join('.')}`
        : ''
      achados.push(`${nome}${classe} { ${prop}: ${valor} }`)
      break
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

    // Sombra carrega cor embutida e não vale a conversão: num PDF de relatório
    // ela não acrescenta nada, e mantê-la quebraria a captura do mesmo jeito.
    const sombra = computado.getPropertyValue('box-shadow')
    if (corNaoSuportada(sombra)) {
      alvo.style.setProperty('box-shadow', 'none', 'important')
      trocas++
    }
  }

  return trocas
}
