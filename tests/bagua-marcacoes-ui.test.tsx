import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import BaguaPlanta from '../app/bagua-planta/page'
import type { BaguaEntrada } from '../src/lib/types'
import { calcularSetores, type Marcacao } from '../src/lib/geometria-bagua'

const mocks = vi.hoisted(() => ({ salvos: [] as { bagua_entrada: BaguaEntrada; bagua_imagem?: string }[], restaurado: null as BaguaEntrada | null, falhar: false, router: { push: vi.fn() } }))
const bordas = { x: 100, y: 100, w: 600, h: 600 }
const existente = { id: 'original', tipo: 'falta' as const, x: 100, y: 100, w: 100, h: 100 }
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
      then: (resolve: (r: unknown) => unknown) => Promise.resolve({ data: [], count: 0, error: mocks.falhar ? {message:'falha sintética'} : null }).then(resolve),
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
  mocks.restaurado = null; mocks.falhar = false
  vi.clearAllMocks()
  capturado = null
  vi.stubGlobal('PointerEvent', PonteiroDeTeste)
  Object.defineProperties(HTMLCanvasElement.prototype, {
    setPointerCapture: { configurable: true, value: vi.fn((id: number) => { capturado = id }) },
    hasPointerCapture: { configurable: true, value: (id: number) => capturado === id },
    releasePointerCapture: { configurable: true, value: vi.fn(() => { capturado = null }) },
  })
  Object.defineProperties(SVGElement.prototype, {
    setPointerCapture: {configurable:true,value:(id:number)=>{capturado=id}},
    hasPointerCapture: {configurable:true,value:(id:number)=>capturado===id},
    releasePointerCapture: {configurable:true,value:()=>{capturado=null}},
    getBoundingClientRect: {configurable:true,value:()=>({x:0,y:0,left:0,top:0,right:1000,bottom:800,width:1000,height:800,toJSON(){}})},
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
  await screen.findByRole('button', { name: 'Editar planta e marcações' })
  const cv = container.querySelector('canvas')!
  await waitFor(() => expect(cv.width).toBeGreaterThan(0))
  return cv
}

async function editar(confirmar = true) {
  fireEvent.click(screen.getByRole('button', { name: 'Editar planta e marcações' }))
  if (confirmar) {
    fireEvent.click(screen.getByRole('button', { name: '1. Marcar bordas' }))
    fireEvent.click(screen.getByRole('button', { name: 'OK — confirmar bordas' }))
    await screen.findByText(/Bordas revisadas e confirmadas/)
  }
  return screen.getByLabelText('Editor de polígonos da planta')
}
function desenhar(svg: HTMLElement, pts: [number, number][], tipo = 'mouse') {
  for (const [x,y] of pts) {
    fireEvent.pointerDown(svg,{clientX:x,clientY:y,pointerId:1,pointerType:tipo,isPrimary:true,button:0})
    fireEvent.pointerUp(svg,{clientX:x,clientY:y,pointerId:1,pointerType:tipo,isPrimary:true,button:0})
  }
}
async function confirmar(tipo: string) {
  fireEvent.click(screen.getByRole('button', { name: 'OK — confirmar '+tipo }))
  await screen.findByText(/Marcação confirmada e salva/)
}
async function salvo() {
  fireEvent.click(screen.getByRole('button', { name: 'Concluir edição' }))
  const antes = mocks.salvos.length
  fireEvent.click(screen.getByRole('button', { name: /Recalcular/ }))
  await waitFor(() => expect(mocks.salvos.length).toBeGreaterThan(antes))
  return mocks.salvos.at(-1)!.bagua_entrada
}

describe('E-POL-03 — fluxo completo da página, confirmações e regressões', () => {
  it('orienta sem afirmar detecção automática e deixa revisão de bordas explícita', async () => {
    await abrir(); await editar(false)
    expect(screen.getByRole('button', {name:'2. Marcar Falta'})).toBeDisabled()
    expect(screen.getByText(/sem confirmação neste fluxo/)).toBeInTheDocument()
    expect(screen.getByText(/não detecta automaticamente as paredes/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', {name:'1. Marcar bordas'}))
    expect(screen.getByText(/tracejado = antes/)).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Borda x'),{target:{value:'80'}})
    expect(mocks.salvos).toHaveLength(0)
    fireEvent.click(screen.getByRole('button',{name:'OK — confirmar bordas'}))
    await screen.findByText(/Bordas revisadas e confirmadas/)
    expect(mocks.salvos.at(-1)?.bagua_entrada.bordas?.x).toBe(80)
  })
  it.each(['mouse','touch','pen'])('cria polígonos de falta e excesso por %s preservando referências e marcas antigas',async tipo=>{
    await abrir();const svg=await editar()
    fireEvent.click(screen.getByRole('button',{name:'2. Marcar Falta'}))
    desenhar(svg,[[300,100],[400,100],[350,180]],tipo)
    await confirmar('falta')
    fireEvent.click(screen.getByRole('button',{name:'3. Marcar Excesso'}))
    desenhar(svg,[[300,100],[350,30],[400,100]],tipo)
    await confirmar('excesso')
    const be=await salvo()
    expect(be.bordas).toEqual(bordas);expect(be.marcacoes?.[0]).toEqual(existente)
    expect(be.marcacoes).toHaveLength(3);expect(be.marcacoes?.[1].pontos).toHaveLength(3)
    expect(be.geometria_regra).toBe('saldo-v2');expect(be.planta_url).toBe(fonte.planta_url)
    const sc=calcularSetores(be.bordas!,be.lh!,be.lv!,be.marcacoes as Marcacao[],'saldo-v2')[1]
    expect(sc.faltaArea).toBe(4000);expect(sc.excessoArea).toBe(3500);expect(sc.geo).toBe(98.75)
    expect(capturado).toBeNull()
  })
  it('sobrepor uma marca nova não move a antiga nem desliga a edição',async()=>{
    await abrir();const svg=await editar()
    fireEvent.click(screen.getByRole('button',{name:'2. Marcar Falta'}))
    desenhar(svg,[[100,100],[190,100],[100,190]])
    fireEvent.click(screen.getByRole('button',{name:'3. Marcar Excesso'}))
    expect(screen.getByRole('alert')).toHaveTextContent(/Confirme com OK/)
    expect(screen.getByTestId('ponto-0')).toBeInTheDocument()
    await confirmar('falta');const be=await salvo()
    expect(be.marcacoes?.[0]).toEqual(existente);expect(be.marcacoes).toHaveLength(2)
  })
  it('bloqueia área desconectada, permite corrigir pelos campos e só salva no OK',async()=>{
    await abrir();const svg=await editar();const antes=mocks.salvos.length
    fireEvent.click(screen.getByRole('button',{name:'2. Marcar Falta'}))
    desenhar(svg,[[400,200],[500,200],[450,250]])
    fireEvent.click(screen.getByRole('button',{name:'OK — confirmar falta'}))
    expect(await screen.findByRole('alert')).toHaveTextContent(/Conecte/)
    expect(mocks.salvos).toHaveLength(antes)
    fireEvent.change(screen.getByLabelText('Ponto para ajustar'),{target:{value:'0'}})
    fireEvent.change(screen.getByLabelText('Ponto y'),{target:{value:'100'}})
    fireEvent.change(screen.getByLabelText('Ponto para ajustar'),{target:{value:'1'}})
    fireEvent.change(screen.getByLabelText('Ponto y'),{target:{value:'100'}})
    await confirmar('falta')
  })
  it('reabre marcas antigas com alças; ajusta vértice sem mover a grade',async()=>{
    await abrir();const svg=await editar()
    fireEvent.click(screen.getByRole('button',{name:'Editar marcações'}))
    fireEvent.change(screen.getByLabelText('Marcação para editar'),{target:{value:'original'}})
    expect(screen.getAllByTestId(/^ponto-/)).toHaveLength(4)
    fireEvent.pointerDown(screen.getByTestId('ponto-2'),{clientX:200,clientY:200,pointerId:1,button:0})
    fireEvent.pointerUp(svg,{clientX:230,clientY:210,pointerId:1,button:0})
    await confirmar('revisão')
    const be=await salvo();expect(be.bordas).toEqual(bordas)
    expect(be.marcacoes?.[0].pontos?.[2]).toEqual({x:230,y:210})
    cleanup();mocks.restaurado=be;await abrir();await editar(false)
    fireEvent.click(screen.getByRole('button',{name:'Editar marcações'}))
    fireEvent.change(screen.getByLabelText('Marcação para editar'),{target:{value:'original'}})
    expect(screen.getAllByTestId(/^ponto-/)).toHaveLength(4)
  })
  it.each(['cancel','lostcapture','escape'])('cancelamento %s do gesto mantém o polígono anterior',async evento=>{
    await abrir();const svg=await editar()
    fireEvent.click(screen.getByRole('button',{name:'Editar marcações'}))
    fireEvent.change(screen.getByLabelText('Marcação para editar'),{target:{value:'original'}})
    fireEvent.pointerDown(screen.getByTestId('ponto-2'),{clientX:200,clientY:200,pointerId:1,button:0})
    fireEvent.pointerMove(svg,{clientX:300,clientY:250,pointerId:1,buttons:1})
    if(evento==='cancel')fireEvent.pointerCancel(svg,{pointerId:1})
    else if(evento==='lostcapture')fireEvent.lostPointerCapture(svg,{pointerId:1})
    else fireEvent.keyDown(svg,{key:'Escape'})
    expect(screen.getByTestId('ponto-2')).toHaveAttribute('cx','200')
    expect(screen.getByTestId('ponto-2')).toHaveAttribute('cy','200')
  })
  it('falha de gravação não confirma a etapa nem descarta a edição',async()=>{
    await abrir();await editar(false)
    fireEvent.click(screen.getByRole('button',{name:'1. Marcar bordas'}))
    mocks.falhar=true
    fireEvent.click(screen.getByRole('button',{name:'OK — confirmar bordas'}))
    expect(await screen.findByRole('alert')).toHaveTextContent(/Não foi possível salvar/)
    expect(screen.getByLabelText('Borda x')).toBeInTheDocument()
    expect(screen.getByRole('button',{name:'2. Marcar Falta'})).toBeDisabled()
  })
  it('exporta o desenho de polígonos mesmo quando a comparação esconde sobreposições',async()=>{
    const cv=await abrir();const svg=await editar()
    fireEvent.click(screen.getByRole('button',{name:'2. Marcar Falta'}))
    desenhar(svg,[[300,100],[400,100],[350,180]]);await confirmar('falta');await salvo()
    fireEvent.click(screen.getByRole('checkbox',{name:'Ver planta sem sobreposições'}))
    const png=vi.spyOn(cv,'toDataURL').mockReturnValue('data:image/png;base64,synthetic')
    await waitFor(()=>expect(screen.getByRole('button',{name:/Recalcular/})).toBeDisabled())
    const finalizar=screen.getByRole('button',{name:/Salvar e continuar análise/})
    fireEvent.click(finalizar)
    await waitFor(()=>expect(png).toHaveBeenCalled())
    expect(mocks.salvos.at(-1)?.bagua_entrada.marcacoes?.[1].pontos).toHaveLength(3)
  })
  it('tela cheia usa o mesmo editor, com confirmações e bordas fixas',async()=>{
    await abrir();fireEvent.click(screen.getByRole('button',{name:/Tela cheia/}))
    const fs=within(screen.getByRole('region',{name:'Editor em tela cheia'}))
    fireEvent.click(fs.getByRole('button',{name:'Editar planta e marcações'}))
    fireEvent.click(fs.getByRole('button',{name:'1. Marcar bordas'}))
    fireEvent.click(fs.getByRole('button',{name:'OK — confirmar bordas'}))
    await fs.findByText(/Bordas revisadas e confirmadas/)
    expect(fs.getByTestId('referencia-editor')).toHaveAttribute('width','600')
    fireEvent.click(fs.getByRole('button',{name:'Concluir edição'}))
    fireEvent.click(fs.getByRole('button',{name:'✓ OK — Voltar'}))
  })
})
