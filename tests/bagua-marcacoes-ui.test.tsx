import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import BaguaPlanta from '../app/bagua-planta/page'
import type { BaguaEntrada } from '../src/lib/types'
import { calcularSetores, type Marcacao } from '../src/lib/geometria-bagua'

const mocks = vi.hoisted(() => ({ salvos: [] as { bagua_entrada: BaguaEntrada; bagua_imagem?: string }[], restaurado: null as BaguaEntrada | null, router: { push: vi.fn() } }))
const bordas = { x: 100, y: 100, w: 600, h: 600 }
const existente = { id: 'original', tipo: 'falta' as const, x: 150, y: 150, w: 300, h: 300 }
const fonte = { planta_url: 'sintetica/planta.png', escola: 'btb', etapa: 'resultado', bordas, marcacoes: [existente], metragem_real: 90 }
vi.mock('next/navigation', () => ({ useRouter: () => mocks.router, useSearchParams: () => new URLSearchParams('consultaId=sintetica') }))
vi.mock('../app/components/FlowLayout', () => ({ default: ({ children }: { children: React.ReactNode }) => <>{children}</> }))
vi.mock('../app/components/useUrlsAssinadas', () => ({ urlExibivel: async () => 'https://example.invalid/planta.png' }))
vi.mock('../src/lib/supabase', () => ({ supabase: {
  auth: { getUser: async () => ({ data: { user: { id: 'sintetico' } } }) },
  from: (tabela: string) => {
    const q = {
      select: () => q, eq: () => q, order: () => q, limit: () => q,
      upsert: () => q, delete: () => q, insert: () => q,
      single: async () => ({ data: tabela === 'consultas' ? { nome_imovel: 'Planta sintética', bagua_entrada: mocks.restaurado ?? fonte } : { id: 'setor-sintetico' } }),
      update: (v: { bagua_entrada: BaguaEntrada }) => { mocks.salvos.push(structuredClone(v)); return q },
      then: (resolve: (r: unknown) => unknown) => Promise.resolve({ data: [], count: 0, error: null }).then(resolve),
    }
    return q
  },
} }))

// Exercita a página e os gestos reais; o jsdom não rasteriza a planta nem simula
// captura nativa de ponteiro. O navegador/dispositivo real ainda requer homologação.
const desenho = new Proxy({ drawImage: vi.fn(), strokeRect: vi.fn(), fillRect: vi.fn(), fillText: vi.fn(), measureText: () => ({ width: 40 }) }, {
  get: (obj, prop) => prop in obj ? obj[prop as keyof typeof obj] : vi.fn(),
})
let capturado: number | null = null
class PonteiroDeTeste extends MouseEvent {
  pointerId: number; isPrimary: boolean; pointerType: string
  constructor(tipo: string, init: PointerEventInit = {}) {
    super(tipo, init)
    this.pointerId = init.pointerId ?? 1; this.isPrimary = init.isPrimary ?? true; this.pointerType = init.pointerType ?? 'mouse'
  }
}
beforeEach(() => {
  mocks.salvos.length = 0
  mocks.restaurado = null
  vi.clearAllMocks()
  capturado = null
  vi.stubGlobal('PointerEvent', PonteiroDeTeste)
  Object.defineProperties(HTMLCanvasElement.prototype, {
    setPointerCapture: { configurable: true, value: vi.fn((id: number) => { capturado = id }) },
    hasPointerCapture: { configurable: true, value: (id: number) => capturado === id },
    releasePointerCapture: { configurable: true, value: vi.fn(() => { capturado = null }) },
  })
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(desenho as unknown as CanvasRenderingContext2D)
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(1000)
  vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLCanvasElement) {
    return { x: 0, y: 0, left: 0, top: 0, right: this.width, bottom: this.height, width: this.width, height: this.height, toJSON() {} }
  })
  vi.stubGlobal('innerWidth', 1200); vi.stubGlobal('innerHeight', 1200)
  vi.stubGlobal('Image', class {
    width = 1000; height = 800; onload: (() => void) | null = null
    set src(_v: string) { queueMicrotask(() => this.onload?.()) }
  })
})
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

async function abrir() {
  const { container } = render(<BaguaPlanta />)
  fireEvent.click(await screen.findByRole('button', { name: /Continuar/ }))
  await screen.findByRole('button', { name: '▭ Marcar Falta' })
  const cv = container.querySelector('canvas')!
  await waitFor(() => expect(cv.width).toBeGreaterThan(0))
  return cv
}
function ponto(cv: HTMLCanvasElement, xy: [number, number], pointerType = 'mouse', pointerId = 1) {
  const s = cv.width / 1000
  return { clientX: xy[0] * s, clientY: xy[1] * cv.height / 800, pointerType, pointerId, isPrimary: true, button: 0 }
}
function arrastar(cv: HTMLCanvasElement, de: [number, number], para: [number, number], tipo = 'mouse', intermediario = true) {
  fireEvent.pointerDown(cv, ponto(cv, de, tipo))
  if (intermediario) fireEvent.pointerMove(cv, { ...ponto(cv, para, tipo), buttons: 1 })
  fireEvent.pointerUp(cv, ponto(cv, para, tipo))
}
async function salvo() {
  const antes = mocks.salvos.length
  fireEvent.click(screen.getByRole('button', { name: /Recalcular/ }))
  await waitFor(() => expect(mocks.salvos.length).toBeGreaterThan(antes))
  return mocks.salvos.at(-1)!.bagua_entrada
}

describe('E-MARC-01 — reprodução com mouse e bordas preservadas', () => {
  it('cria uma falta em espaço livre sem alterar as bordas nem a imagem original', async () => {
    const cv = await abrir()
    fireEvent.click(screen.getByRole('button', { name: '▭ Marcar Falta' }))
    arrastar(cv, [500, 200], [560, 270])
    const r = await salvo()
    expect(r.bordas).toEqual(bordas)
    expect(r.planta_url).toBe(fonte.planta_url)
    expect(r.marcacoes).toHaveLength(2)
  })
  it('cria outra falta começando sobre uma marcação existente, sem movê-la', async () => {
    const cv = await abrir()
    fireEvent.click(screen.getByRole('button', { name: '▭ Marcar Falta' }))
    arrastar(cv, [220, 220], [280, 290])
    const r = await salvo()
    expect(r.marcacoes).toHaveLength(2)
    expect(r.marcacoes?.[0]).toEqual(existente)
    expect(r.bordas).toEqual(bordas)
  })
  it.each(['mouse', 'touch', 'pen'])('E-MARC-02 — excesso externo por %s preserva bordas, imagem e marca anterior', async tipo => {
    const cv = await abrir()
    fireEvent.click(screen.getByRole('button', { name: '▭ Marcar Excesso' }))
    arrastar(cv, [650, 200], [800, 300], tipo)
    const r = await salvo()
    expect(r.bordas).toEqual(bordas)
    expect(r.planta_url).toBe(fonte.planta_url)
    expect(r.marcacoes?.[0]).toEqual(existente)
    expect(r.marcacoes?.[1]).toMatchObject({ tipo: 'excesso', x: 650, y: 200, w: 150, h: 100 })
    const setores = calcularSetores(r.bordas!, r.lh!, r.lv!, r.marcacoes as Marcacao[])
    expect(setores.reduce((total, setor) => total + setor.excessoArea, 0)).toBe(10000)
    expect(capturado).toBeNull()
  })
  it('E-MARC-02 — usa o ponto final mesmo sem pointermove', async () => {
    const cv = await abrir()
    fireEvent.click(screen.getByRole('button', { name: '▭ Marcar Falta' }))
    arrastar(cv, [280, 290], [220, 220], 'touch', false)
    expect((await salvo()).marcacoes?.[1]).toMatchObject({ x: 220, y: 220, w: 60, h: 70 })
  })
  it('E-MARC-02 — posição e escala CSS não deslocam o toque na imagem', async () => {
    const cv = await abrir()
    vi.spyOn(cv, 'getBoundingClientRect').mockReturnValue({ x: 70, y: 90, left: 70, top: 90, right: 570, bottom: 490, width: 500, height: 400, toJSON() {} })
    fireEvent.click(screen.getByRole('button', { name: '▭ Marcar Falta' }))
    fireEvent.pointerDown(cv, { clientX: 180, clientY: 200, pointerId: 1, pointerType: 'touch' })
    fireEvent.pointerUp(cv, { clientX: 210, clientY: 235, pointerId: 1, pointerType: 'touch' })
    expect((await salvo()).marcacoes?.[1]).toMatchObject({ x: 220, y: 220, w: 60, h: 70 })
  })
  it.each(['cancel', 'escape', 'lostcapture'])('E-MARC-03 — %s descarta a marcação em curso sem salvá-la', async evento => {
    const cv = await abrir()
    fireEvent.click(screen.getByRole('button', { name: '▭ Marcar Falta' }))
    fireEvent.pointerDown(cv, ponto(cv, [220, 220], 'touch'))
    fireEvent.pointerMove(cv, ponto(cv, [280, 290], 'touch'))
    if (evento === 'cancel') fireEvent.pointerCancel(cv, ponto(cv, [280, 290], 'touch'))
    else if (evento === 'escape') fireEvent.keyDown(window, { key: 'Escape' })
    else fireEvent.lostPointerCapture(cv, ponto(cv, [280, 290], 'touch'))
    fireEvent.pointerUp(cv, ponto(cv, [280, 290], 'touch'))
    expect(screen.getByRole('button', { name: /Recalcular/ })).toBeDisabled()
    expect(mocks.salvos).toHaveLength(0)
  })
  it('E-MARC-03 — sair da área do canvas não termina o desenho antes de soltar', async () => {
    const cv = await abrir()
    fireEvent.click(screen.getByRole('button', { name: '▭ Marcar Falta' }))
    fireEvent.pointerDown(cv, ponto(cv, [220, 220]))
    fireEvent.pointerMove(cv, ponto(cv, [280, 290]))
    fireEvent.pointerLeave(cv, ponto(cv, [1005, 800]))
    expect(screen.getByRole('button', { name: /Recalcular/ })).toBeDisabled()
    fireEvent.pointerUp(cv, ponto(cv, [320, 300]))
    expect((await salvo()).marcacoes?.[1]).toMatchObject({ x: 220, y: 220, w: 100, h: 80 })
  })
  it('E-MARC-03 — outro ponteiro não move ou conclui o gesto ativo', async () => {
    const cv = await abrir()
    fireEvent.click(screen.getByRole('button', { name: '▭ Marcar Falta' }))
    fireEvent.pointerDown(cv, ponto(cv, [220, 220], 'touch'))
    fireEvent.pointerMove(cv, ponto(cv, [600, 600], 'touch', 2))
    fireEvent.pointerUp(cv, ponto(cv, [600, 600], 'touch', 2))
    expect(screen.getByRole('button', { name: /Recalcular/ })).toBeDisabled()
    fireEvent.pointerUp(cv, ponto(cv, [280, 290], 'touch'))
    expect((await salvo()).marcacoes?.[1]).toMatchObject({ w: 60, h: 70 })
  })
  it('E-MARC-04 — editar explicitamente move somente a marca escolhida', async () => {
    const cv = await abrir()
    fireEvent.click(screen.getByRole('button', { name: 'Editar marcações' }))
    arrastar(cv, [220, 220], [280, 290])
    const r = await salvo()
    expect(r.marcacoes).toEqual([{ ...existente, x: 210, y: 220 }])
    expect(r.bordas).toEqual(bordas)
    expect(screen.queryByText(/Bordas alteradas/)).not.toBeInTheDocument()
  })
  it('E-MARC-04 — canto superior direito redimensiona, sem excluir a marca', async () => {
    const cv = await abrir()
    fireEvent.click(screen.getByRole('button', { name: 'Editar marcações' }))
    fireEvent.change(screen.getByRole('combobox', { name: /Marcação para editar/ }), { target: { value: existente.id } })
    arrastar(cv, [450, 150], [500, 120])
    expect((await salvo()).marcacoes).toEqual([{ ...existente, y: 120, w: 350, h: 330 }])
  })
  it('E-MARC-04 — cancelar uma edição restaura o retângulo anterior', async () => {
    const cv = await abrir()
    fireEvent.click(screen.getByRole('button', { name: 'Editar marcações' }))
    fireEvent.pointerDown(cv, ponto(cv, [220, 220]))
    fireEvent.pointerMove(cv, ponto(cv, [280, 290]))
    fireEvent.pointerCancel(cv, ponto(cv, [280, 290]))
    fireEvent.click(screen.getByRole('button', { name: '▭ Marcar Falta' }))
    arrastar(cv, [500, 200], [560, 270])
    expect((await salvo()).marcacoes?.[0]).toEqual(existente)
  })
  it('E-MARC-05 — comparação oculta apenas as sobreposições e conserva a referência', async () => {
    const cv = await abrir()
    desenho.drawImage.mockClear(); desenho.strokeRect.mockClear(); desenho.fillText.mockClear()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Ver planta sem sobreposições' }))
    expect(desenho.drawImage).toHaveBeenCalled()
    const escala = cv.width / 1000
    expect(desenho.strokeRect).toHaveBeenCalledWith(100 * escala, 100 * escala, 600 * escala, 600 * escala)
    expect(desenho.fillText).not.toHaveBeenCalled()
    expect(mocks.salvos).toHaveLength(0)
    fireEvent.click(screen.getByRole('checkbox', { name: 'Ver planta sem sobreposições' }))
    expect(desenho.fillText.mock.calls.some(c => String(c[0]).startsWith('FALTA'))).toBe(true)
  })
  it('E-MARC-06 — excesso inteiramente interno explica o efeito zero sem pedir alteração das bordas', async () => {
    const cv = await abrir()
    fireEvent.click(screen.getByRole('button', { name: '▭ Marcar Excesso' }))
    arrastar(cv, [500, 200], [560, 270])
    expect(screen.getByText(/Este excesso está inteiramente dentro das bordas/)).toBeInTheDocument()
    expect((await salvo()).bordas).toEqual(bordas)
  })
  it('E-MARC-04 — exclusão usa o botão explícito e preserva as bordas', async () => {
    await abrir()
    fireEvent.click(screen.getByRole('button', { name: 'Editar marcações' }))
    expect(screen.getByRole('button', { name: 'Excluir marcação selecionada' })).toBeDisabled()
    fireEvent.change(screen.getByRole('combobox', { name: /Marcação para editar/ }), { target: { value: existente.id } })
    fireEvent.click(screen.getByRole('button', { name: 'Excluir marcação selecionada' }))
    const r = await salvo()
    expect(r.marcacoes ?? []).toEqual([])
    expect(r.bordas).toEqual(bordas)
  })
  it('E-MARC-04 — somente Bordas altera o retângulo-base, sem mover as marcações', async () => {
    const cv = await abrir()
    fireEvent.click(screen.getByRole('button', { name: '⬜ Bordas' }))
    arrastar(cv, [700, 400], [750, 400], 'touch')
    await waitFor(() => expect(mocks.salvos.length).toBeGreaterThan(0))
    expect(mocks.salvos.at(-1)!.bagua_entrada.bordas).toEqual({ ...bordas, w: 650 })
    expect(mocks.salvos.at(-1)!.bagua_entrada.marcacoes).toEqual([existente])
  })
  it('E-MARC-05 — finalizar durante comparação salva a análise com sobreposições', async () => {
    await abrir()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Ver planta sem sobreposições' }))
    desenho.fillText.mockClear()
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockImplementation(() => {
      expect(desenho.fillText.mock.calls.some(c => String(c[0]).startsWith('FALTA'))).toBe(true)
      desenho.fillText.mockClear()
      return 'data:image/png;base64,c2ludGV0aWNh'
    })
    fireEvent.click(screen.getByRole('button', { name: /Salvar e continuar análise/i }))
    await waitFor(() => expect(mocks.salvos.at(-1)?.bagua_entrada.finalizada_em).toBeTruthy())
    expect(mocks.salvos.at(-1)?.bagua_imagem).toBe('data:image/png;base64,c2ludGV0aWNh')
    expect(desenho.fillText).not.toHaveBeenCalled()
    expect(screen.getByRole('checkbox', { name: 'Ver planta sem sobreposições' })).toBeChecked()
  })
  it('E-MARC-02 — tela cheia usa o mesmo gesto de toque e mantém a referência', async () => {
    await abrir()
    fireEvent.click(screen.getByRole('button', { name: /Tela cheia/ }))
    const editor = within(screen.getByRole('region', { name: 'Editor em tela cheia' }))
    fireEvent.click(editor.getByRole('button', { name: '▭ Marcar Falta' }))
    const cv = editor.getByLabelText('Planta em tela cheia para marcar falta e excesso') as HTMLCanvasElement
    const larguraAnterior = cv.width
    vi.stubGlobal('innerWidth', 600)
    fireEvent(window, new Event('resize'))
    expect(cv.width).toBeLessThan(larguraAnterior)
    expect(cv.width / cv.height).toBeCloseTo(1000 / 800, 2)
    arrastar(cv, [220, 220], [280, 290], 'touch')
    fireEvent.click(editor.getByRole('button', { name: /Recalcular/ }))
    await waitFor(() => expect(mocks.salvos.length).toBeGreaterThan(0))
    expect(mocks.salvos.at(-1)!.bagua_entrada.marcacoes).toHaveLength(2)
    expect(mocks.salvos.at(-1)!.bagua_entrada.bordas).toEqual(bordas)
  })
  it.each(['mouse', 'touch'])('E-CONT-01 — extensão pelos pontos brancos com %s não reposiciona a falta; salvar/reabrir preserva a referência', async pointerType => {
    await abrir()
    fireEvent.click(screen.getByRole('button', { name: /Desenhar contorno real/ }))
    const svg = screen.getByTestId('editor-poligono-tai-ji')
    vi.spyOn(svg, 'getBoundingClientRect').mockReturnValue({ x: 0, y: 0, left: 0, top: 0, right: 1000, bottom: 800, width: 1000, height: 800, toJSON() {} })
    fireEvent.pointerDown(screen.getByTestId('handle-meio-0'), { pointerId: 1, pointerType })
    fireEvent.pointerDown(screen.getByTestId('vertice-1'), { pointerId: 1, pointerType })
    fireEvent.pointerMove(svg, { clientX: 400, clientY: 500, pointerId: 1, pointerType })
    fireEvent.pointerUp(svg, { clientX: 400, clientY: 500, pointerId: 1, pointerType })
    const geometria = () => {
      const falta = screen.getByTestId('celula-ausente-0-1')
      return ['x', 'y', 'width', 'height'].map(a => falta.getAttribute(a))
    }
    expect(geometria()).toEqual(['300', '100', '200', '200'])
    const todasAsCelulas = () => Array.from(svg.querySelectorAll('g > rect')).map(c => ['x', 'y', 'width', 'height'].map(a => c.getAttribute(a)))
    const gradeAnterior = todasAsCelulas()
    fireEvent.pointerDown(screen.getByTestId('handle-meio-2'), { pointerId: 1, pointerType })
    fireEvent.pointerDown(screen.getByTestId('vertice-3'), { pointerId: 1, pointerType })
    fireEvent.pointerMove(svg, { clientX: 900, clientY: 400, pointerId: 1, pointerType })
    fireEvent.pointerUp(svg, { clientX: 900, clientY: 400, pointerId: 1, pointerType })
    expect(geometria()).toEqual(['300', '100', '200', '200'])
    expect(todasAsCelulas()).toHaveLength(9)
    expect(todasAsCelulas()).toEqual(gradeAnterior)
    expect(screen.getAllByTestId(/extensao-externa-/).length).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole('button', { name: /Concluir edição/ }))
    await waitFor(() => expect(mocks.salvos.length).toBeGreaterThan(0))
    expect(mocks.salvos.at(-1)!.bagua_entrada.bordas).toEqual(bordas)
    expect(mocks.salvos.at(-1)!.bagua_entrada.tai_ji_poligono).toContainEqual({ x: 900, y: 400 })
    expect(mocks.salvos.at(-1)!.bagua_entrada.lh).toEqual([1 / 3, 2 / 3])
    expect(mocks.salvos.at(-1)!.bagua_entrada.lv).toEqual([1 / 3, 2 / 3])
    mocks.restaurado = mocks.salvos.at(-1)!.bagua_entrada
    cleanup()
    await abrir()
    fireEvent.click(screen.getByRole('button', { name: /Editar contorno/ }))
    expect(geometria()).toEqual(['300', '100', '200', '200'])
    expect(screen.getByTestId('vertice-3')).toHaveAttribute('cx', '900')
  })
  it('E-CONT-03 — restaurar o contorno usa as bordas escolhidas, não as margens da imagem', async () => {
    await abrir()
    fireEvent.click(screen.getByRole('button', { name: /Desenhar contorno real/ }))
    fireEvent.pointerDown(screen.getByTestId('handle-meio-0'), { pointerId: 1 })
    fireEvent.click(screen.getByRole('button', { name: /Restaurar contorno às bordas definidas/ }))
    fireEvent.click(screen.getByRole('button', { name: /Concluir edição/ }))
    await waitFor(() => expect(mocks.salvos.length).toBeGreaterThan(0))
    expect(mocks.salvos.at(-1)!.bagua_entrada.tai_ji_poligono).toEqual([
      { x: 100, y: 100 }, { x: 700, y: 100 }, { x: 700, y: 700 }, { x: 100, y: 700 },
    ])
    expect(mocks.salvos.at(-1)!.bagua_entrada.bordas).toEqual(bordas)
  })
  it('E-CONT-04 — trocar do contorno para marcações encerra a sobreposição e mantém os dois desenhos', async () => {
    const cv = await abrir()
    fireEvent.click(screen.getByRole('button', { name: /Desenhar contorno real/ }))
    fireEvent.pointerDown(screen.getByTestId('handle-meio-0'), { pointerId: 1 })
    fireEvent.click(screen.getByRole('button', { name: '▭ Marcar Excesso' }))
    expect(screen.queryByTestId('editor-poligono-tai-ji')).not.toBeInTheDocument()
    arrastar(cv, [650, 200], [800, 300])
    const r = await salvo()
    expect(r.bordas).toEqual(bordas)
    expect(r.tai_ji_poligono).toHaveLength(5)
    expect(r.marcacoes).toHaveLength(2)
    fireEvent.click(screen.getByRole('button', { name: /Editar contorno/ }))
    expect(screen.getByRole('button', { name: '▭ Marcar Excesso' })).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(screen.getByRole('checkbox', { name: 'Ver planta sem sobreposições' }))
    expect(screen.queryByTestId('editor-poligono-tai-ji')).not.toBeInTheDocument()
  })
})
