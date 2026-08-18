import { describe, expect, it } from 'vitest'
import { coresNaoSuportadasRestantes, corNaoSuportada, normalizarCores } from '../cores-canvas'

describe('corNaoSuportada', () => {
  it('reconhece as funções que quebram o html2canvas', () => {
    // `lab()` é o que o Chrome devolve em getComputedStyle para um token
    // declarado em oklch() — foi exatamente o erro visto em produção.
    for (const valor of [
      'lab(52.2% 40.1 59.9)',
      'oklch(0.545 0.085 175)',
      'oklab(0.5 0.1 0.1)',
      'lch(52% 60 30)',
      'color(display-p3 0.2 0.4 0.6)',
      'color-mix(in oklab, red, blue)',
      'rgb(0, 0, 0) 0px 1px 2px, lab(50% 0 0) 0px 0px 4px',
    ]) {
      expect(corNaoSuportada(valor), valor).toBe(true)
    }
  })

  it('não sinaliza o que o parser já entende', () => {
    for (const valor of [
      'rgb(46, 125, 107)',
      'rgba(46, 125, 107, 0.5)',
      '#2E7D6B',
      'hsl(170, 46%, 34%)',
      'transparent',
      'currentColor',
      'none',
      '',
    ]) {
      expect(corNaoSuportada(valor), JSON.stringify(valor)).toBe(false)
    }
  })

  it('não confunde palavra que só contém o nome da função', () => {
    // «collaborate» contém «lab», mas sem parêntese não é função de cor.
    expect(corNaoSuportada('collaborate')).toBe(false)
    expect(corNaoSuportada('labial')).toBe(false)
  })

  it('trata nulo e indefinido', () => {
    expect(corNaoSuportada(null)).toBe(false)
    expect(corNaoSuportada(undefined)).toBe(false)
  })
})

/** Estilo computado falso: o jsdom não resolve oklch, e o teste não precisa. */
function estiloFalso(mapa: Record<string, string>): CSSStyleDeclaration {
  return { getPropertyValue: (p: string) => mapa[p] ?? '' } as CSSStyleDeclaration
}

describe('normalizarCores', () => {
  it('troca a cor não suportada por rgb, como estilo inline', () => {
    document.body.innerHTML = '<div id="a"><span id="b">x</span></div>'

    const trocas = normalizarCores(
      document.body,
      () => 'rgb(46, 125, 107)',
      () => estiloFalso({ color: 'lab(52% 40 60)' })
    )

    expect(trocas).toBe(2) // div + span
    expect(document.getElementById('a')!.style.color).toBe('rgb(46, 125, 107)')
    expect(document.getElementById('b')!.style.color).toBe('rgb(46, 125, 107)')
  })

  it('não mexe no que já é suportado', () => {
    document.body.innerHTML = '<div id="a">x</div>'

    const trocas = normalizarCores(
      document.body,
      () => 'rgb(0, 0, 0)',
      () => estiloFalso({ color: '#2E7D6B', 'background-color': 'rgb(255, 255, 255)' })
    )

    expect(trocas).toBe(0)
    expect(document.getElementById('a')!.style.color).toBe('')
  })

  it('remove a sombra quando ela carrega cor não suportada', () => {
    // Converter a sombra exigiria reescrever offsets e blur junto; num PDF de
    // relatório ela não acrescenta nada, e mantê-la quebraria a captura.
    document.body.innerHTML = '<div id="a">x</div>'

    normalizarCores(
      document.body,
      () => 'rgb(0, 0, 0)',
      () => estiloFalso({ 'box-shadow': '0 1px 2px oklch(0.5 0.1 200)' })
    )

    expect(document.getElementById('a')!.style.boxShadow).toBe('none')
  })

  it('segue em frente quando o resolvedor não sabe converter', () => {
    // Melhor deixar a cor original e falhar só naquele elemento do que abortar
    // a normalização inteira.
    document.body.innerHTML = '<div id="a"><span id="b">x</span></div>'

    const trocas = normalizarCores(
      document.body,
      () => null,
      () => estiloFalso({ color: 'lab(52% 40 60)' })
    )

    expect(trocas).toBe(0)
    expect(document.getElementById('a')!.style.color).toBe('')
  })

  it('não estoura se a leitura de estilo falhar', () => {
    document.body.innerHTML = '<div id="a">x</div>'

    expect(() => normalizarCores(
      document.body,
      () => 'rgb(0, 0, 0)',
      () => { throw new Error('sem layout') }
    )).not.toThrow()
  })
})

describe('normalizarCores em outro realm', () => {
  /*
    O clone do html2canvas vive dentro de um `<iframe>`: outro realm, com outro
    `HTMLElement`. A versão anterior filtrava por `el instanceof HTMLElement`,
    que é sempre `false` do lado de fora — então pulava todos os elementos,
    devolvia zero e deixava as cores `lab()` chegarem ao parser.

    A suíte não pegava porque o jsdom monta tudo num realm só: a guarda passava
    por rodar no ambiente errado. Este teste monta o ambiente certo.
  */
  function elementoDeOutroRealm(): Element & { style: CSSStyleDeclaration } {
    const propriedades = new Map<string, string>()
    return {
      tagName: 'DIV',
      className: 'do-clone',
      style: {
        setProperty: (p: string, v: string) => propriedades.set(p, v),
        getPropertyValue: (p: string) => propriedades.get(p) ?? '',
      } as unknown as CSSStyleDeclaration,
      // Deliberadamente **não** é `instanceof HTMLElement` desta janela.
    } as unknown as Element & { style: CSSStyleDeclaration }
  }

  function raizComElementos(elementos: Element[]) {
    return { querySelectorAll: () => elementos } as unknown as HTMLElement
  }

  it('converte a cor de um elemento que não é instanceof HTMLElement daqui', () => {
    const el = elementoDeOutroRealm()

    const trocas = normalizarCores(
      raizComElementos([el]),
      () => 'rgb(46, 125, 107)',
      () => estiloFalso({ color: 'lab(52% 40 60)' })
    )

    expect(trocas).toBe(1)
    expect(el.style.getPropertyValue('color')).toBe('rgb(46, 125, 107)')
  })

  it('ignora o que não tem style, sem estourar', () => {
    const semStyle = { tagName: 'SVG' } as unknown as Element

    const trocas = normalizarCores(
      raizComElementos([semStyle]),
      () => 'rgb(0, 0, 0)',
      () => estiloFalso({ color: 'lab(52% 40 60)' })
    )

    expect(trocas).toBe(0)
  })
})

describe('coresNaoSuportadasRestantes', () => {
  it('nomeia elemento, propriedade e valor do que sobrou', () => {
    document.body.innerHTML = '<div class="cabecalho destaque"><span>x</span></div>'

    const achados = coresNaoSuportadasRestantes(
      document.body,
      el => estiloFalso(el.tagName === 'DIV' ? { color: 'lab(52% 40 60)' } : {})
    )

    expect(achados).toEqual(['div.cabecalho.destaque { color: lab(52% 40 60) }'])
  })

  it('devolve vazio quando tudo já é suportado', () => {
    document.body.innerHTML = '<div><span>x</span></div>'

    expect(
      coresNaoSuportadasRestantes(document.body, () => estiloFalso({ color: 'rgb(1, 2, 3)' }))
    ).toEqual([])
  })

  it('respeita o limite, para o erro não virar um despejo', () => {
    document.body.innerHTML = '<i></i><i></i><i></i><i></i>'

    const achados = coresNaoSuportadasRestantes(
      document.body,
      () => estiloFalso({ color: 'oklch(0.5 0.1 175)' }),
      2
    )

    expect(achados).toHaveLength(2)
  })
})
