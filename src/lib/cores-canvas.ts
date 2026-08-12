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
      // Se o browser não entender o valor, `fillStyle` fica com o anterior —
      // por isso o marcador improvável antes, para detectar a recusa.
      ctx.fillStyle = '#010203'
      ctx.fillStyle = valor
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
    if (!(el instanceof HTMLElement) && !(el instanceof SVGElement)) continue

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

      el.style.setProperty(prop, convertida, 'important')
      trocas++
    }

    // Sombra carrega cor embutida e não vale a conversão: num PDF de relatório
    // ela não acrescenta nada, e mantê-la quebraria a captura do mesmo jeito.
    const sombra = computado.getPropertyValue('box-shadow')
    if (corNaoSuportada(sombra)) {
      el.style.setProperty('box-shadow', 'none', 'important')
      trocas++
    }
  }

  return trocas
}
