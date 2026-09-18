import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import MobiliarioPage from '../app/consultas/[id]/mobiliario/page'
import { cadastroVazio, novoMobiliario, type CadastroMobiliario } from '../src/lib/mobiliario'
import type { BaguaEntrada } from '../src/lib/types'
vi.mock('next/navigation', () => ({ useParams: () => ({ id: 'consulta-teste' }) }))
vi.mock('../app/components/FlowLayout', () => ({ default: ({ children }: { children: React.ReactNode }) => <>{children}</> }))
vi.mock('../app/components/useUrlsAssinadas', () => ({ urlExibivel: async () => 'https://example.invalid/planta.png' }))
let cadastro: CadastroMobiliario, falhar: number, enviados: { itens: unknown[] }[]
let planta: BaguaEntrada
beforeEach(() => {
  cadastro = cadastroVazio(); falhar = 0; enviados = []
  planta = { planta_url: 'sintetica/planta.png', escola: 'btb', bordas: { x: 0, y: 0, w: 600, h: 600 }, orientacao_graus: 180, orientacao_estado: 'confirmada', orientacao_referencia: 'magnetico', orientacao_origem: 'manual', orientacao_confirmada_em: '2026-09-18T12:00:00Z' }
  vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
    if (init?.method === 'PUT') {
      const body = JSON.parse(init.body as string); enviados.push(body)
      if (falhar) return Response.json({ error: falhar === 409 ? 'Outro salvamento alterou os dados. Recarregue para revisar as diferenças.' : 'Falha de conexão. A edição permanece na tela.' }, { status: falhar })
      cadastro = { versao: 1, revisao: cadastro.revisao + 1, referencia_planta: 'hash-atual', itens: body.itens }
      return Response.json({ cadastro })
    }
    return Response.json({ cadastro, nome: 'Teste sintético', planta, planta_sha256: 'hash-atual' })
  }))
  const ctx = new Proxy({}, { get: () => vi.fn() })
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as CanvasRenderingContext2D)
  vi.stubGlobal('Image', class { width = 600; height = 600; onload: (() => void) | null = null; set src(_s: string) { queueMicrotask(() => this.onload?.()) } })
})
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals() })
async function abrir() { render(<MobiliarioPage />); await screen.findByRole('button', { name: 'Adicionar mobiliário' }) }
async function novo(identificacao: string, tipo = 'mesa') {
  fireEvent.click(screen.getByRole('button', { name: 'Adicionar mobiliário' }))
  fireEvent.change(screen.getByLabelText('Ambiente'), { target: { value: 'Cozinha' } })
  fireEvent.change(screen.getByLabelText('Mobiliário', { selector: 'select' }), { target: { value: tipo } })
  fireEvent.change(screen.getByLabelText('Identificação / convenção da direção'), { target: { value: identificacao } })
}
async function gravar() {
  fireEvent.click(screen.getByRole('button', { name: 'Salvar móvel' }))
  await screen.findByText(/Cadastro salvo/)
}
describe('D-MOB-04 — jornada de cadastro em tela própria', () => {
  it('salva mesa e fogão no mesmo ambiente e setor, edita só um e reabre ambos', async () => {
    await abrir(); await novo('Mesa da janela'); await gravar()
    await novo('Fogão da ilha', 'fogao'); await gravar()
    expect(cadastro.itens).toHaveLength(2)
    expect(cadastro.itens[0].setor).toBe(cadastro.itens[1].setor)
    fireEvent.click(screen.getByRole('button', { name: 'Editar Mesa da janela' }))
    fireEvent.change(screen.getByLabelText('Direção em graus'), { target: { value: '0' } })
    fireEvent.change(screen.getByLabelText('Referência de Norte'), { target: { value: 'magnetico' } })
    await gravar();expect(cadastro.itens[0].direcao).toBe(0);expect(cadastro.itens[1].direcao).toBeNull()
    cleanup();await abrir()
    expect(screen.getByRole('button', { name: 'Editar Mesa da janela' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Editar Fogão da ilha' })).toBeInTheDocument()
  })
  it.each([503, 409])('erro %i conserva os campos e não finge salvamento', async status => {
    await abrir();await novo('Mesa preservada');falhar = status
    fireEvent.click(screen.getByRole('button', { name: 'Salvar móvel' }))
    await screen.findByRole('alert')
    expect(screen.getByLabelText('Ambiente')).toHaveValue('Cozinha')
    expect(cadastro.itens).toHaveLength(0)
    expect(screen.queryByText(/Cadastro salvo/)).not.toBeInTheDocument()
    falhar = 0; await gravar();expect(cadastro.itens).toHaveLength(1)
  })
  it('excluir remove somente o item escolhido; falha não remove a linha', async () => {
    await abrir();await novo('Mesa A');await gravar();await novo('Mesa B');await gravar()
    falhar = 503;fireEvent.click(screen.getByRole('button', { name: 'Excluir Mesa A' }));await screen.findByRole('alert')
    expect(screen.getByRole('button', { name: 'Editar Mesa A' })).toBeInTheDocument()
    falhar = 0;fireEvent.click(screen.getByRole('button', { name: 'Excluir Mesa A' }))
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Editar Mesa A' })).not.toBeInTheDocument())
    expect(cadastro.itens[0].descricao).toBe('Mesa B')
  })
  it('planta alterada suspende interpretação e solicita revisão explícita dos dados', async () => {
    cadastro = { versao: 1, revisao: 1, referencia_planta: 'antiga', itens: [{ ...novoMobiliario(), ambiente: 'Cozinha', direcao: 180, origem: 'planta' }] }
    await abrir()
    expect(screen.getByText('Aguardando revisão da planta.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Salvar revisão da referência' })).toBeDisabled()
    fireEvent.click(screen.getByRole('checkbox', { name: /Revisei os setores/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Salvar revisão da referência' }))
    await screen.findByText(/Cadastro salvo/);expect(cadastro.itens[0].direcao).toBeNull()
  })
  it('marca posição e direção com dois pontos usando escala CSS da planta', async () => {
    await abrir();await novo('Mesa no mapa')
    fireEvent.click(screen.getByRole('button', { name: 'Posicionar ou medir na planta' }))
    const svg = await screen.findByRole('img', { name: 'Mapa de posições dos móveis' })
    vi.spyOn(svg, 'getBoundingClientRect').mockReturnValue({ x: 50, y: 50, top: 50, left: 50, width: 300, height: 300, right: 350, bottom: 350, toJSON() {} })
    fireEvent.click(svg, { clientX: 100, clientY: 100 })
    fireEvent.click(screen.getByRole('button', { name: 'Marcar direção com dois pontos' }))
    fireEvent.click(svg, { clientX: 100, clientY: 100 });fireEvent.click(svg, { clientX: 150, clientY: 100 })
    expect(screen.getByLabelText('Direção em graus')).toHaveValue(90)
    await gravar();expect(cadastro.itens[0]).toMatchObject({ setor: 1, posicao: { x: 100, y: 100 }, direcao: 90, origem: 'planta' })
  })
  it('bloqueia direção gráfica sem fachada confirmada, permite cadastro numérico e explica termos', async () => {
    planta.orientacao_estado = 'nao_confirmada'
    await abrir();await novo('Mesa')
    fireEvent.click(screen.getByRole('button', { name: 'Posicionar ou medir na planta' }))
    expect(screen.getByRole('button', { name: 'Marcar direção com dois pontos' })).toBeDisabled()
    expect(screen.getByText(/Ming Gua — Kua pessoal/)).toBeInTheDocument()
    expect(screen.getByText(/Ba Zhai — Oito Mansões/)).toBeInTheDocument()
    expect(enviados).toHaveLength(0)
  })
})
