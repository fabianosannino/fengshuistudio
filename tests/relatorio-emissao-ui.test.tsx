import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import Relatorio from '../app/consultas/[id]/relatorio/page'
import { MAX_PDF_RELATORIO, VERSOES_RELATORIO } from '../src/lib/relatorio-emissao'
import type { BaguaEntrada, Consulta } from '../src/lib/types'
import { referenciaDaAnalise } from '../src/lib/analise-bagua'

const mocks = vi.hoisted(() => ({
  router: { push: vi.fn() }, capture: vi.fn(), output: vi.fn(), fetch: vi.fn(), download: vi.fn(), busca:'',
}))
vi.mock('next/navigation', () => ({ useRouter: () => mocks.router, useSearchParams: () => new URLSearchParams(mocks.busca), useParams: () => ({ id: '00000000-0000-4000-8000-000000000001' }) }))
vi.mock('../src/lib/supabase', () => ({ supabase: {} }))
vi.mock('../app/components/useUrlsAssinadas', () => ({ useUrlsAssinadas: () => ({ resolver: () => null, carregando: false }) }))
// jsdom não mede layout nem renderiza canvas. Estes testes verificam o fluxo
// real da página e falhas de persistência; não atestam a aparência do PDF.
vi.mock('html2canvas', () => ({ default: mocks.capture }))
vi.mock('jspdf', () => ({ jsPDF: class {
  addImage() {} addPage() {} setPage() {} setFontSize() {} setTextColor() {} text() {}
  getNumberOfPages() { return 1 }
  output() { return mocks.output() }
} }))

const respostas: { preparo: Record<string, unknown>[]; uploads: FormData[] } = { preparo: [], uploads: [] }
let falharUpload = false
let statusFalha = 503
let falharHistoricoDepois = false
let foto: string | null = null
let leiturasHistorico = 0
let bagua: Partial<BaguaEntrada> = {}
let dadosDaConsulta: Partial<Consulta> = {}
const json = (data: unknown, ok = true) => ({ ok, status: ok ? 200 : 503, json: async () => data })
beforeEach(() => {
  vi.clearAllMocks(); respostas.preparo.length = 0; respostas.uploads.length = 0
  falharUpload = false; statusFalha = 503; falharHistoricoDepois = false; leiturasHistorico = 0; foto = null; bagua = {}
  dadosDaConsulta = {}
  mocks.busca=''
  mocks.capture.mockResolvedValue({ width: 1000, height: 1000, toDataURL: () => 'data:image/png;base64,fixture' })
  mocks.output.mockReturnValue(new Blob(['%PDF-1.4\nfixture\n%%EOF'], { type: 'application/pdf' }))
  vi.stubGlobal('fetch', mocks.fetch)
  Object.defineProperty(document, 'fonts', { configurable: true, value: { ready: Promise.resolve() } })
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(mocks.download)
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => 'blob:fixture') })
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() })
  mocks.fetch.mockImplementation(async (url: string, options?: RequestInit) => {
    if (url.includes('/entrada?')) return json({
      fonte: { consulta: { id: '00000000-0000-4000-8000-000000000001', nome_imovel: 'Imóvel sintético', criado_em: '2026-09-01T00:00:00Z', status: 'em_andamento', bagua_entrada: bagua, foto_geral_url: foto, ...dadosDaConsulta }, perfil: { plano: 'profissional', nome_completo: 'Consultor sintético' }, setores: [], evolucao: [], chi_custom: [] },
      fonte_sha256: 'a'.repeat(64), referencia_temporal: '2026-09-17T12:00:00.000Z',
    })
    if (url.includes('historico=1')) {
      if (++leiturasHistorico > 1 && falharHistoricoDepois) throw new Error('offline')
      return json({ emissoes: [] })
    }
    if (url.endsWith('/preparar')) {
      const body = JSON.parse(options!.body as string)
      respostas.preparo.push(body)
      return json({ emissao: { id: body.id } })
    }
    if (options?.method === 'POST') {
      respostas.uploads.push(options.body as FormData)
      return { ...json({ gerado_em: '2026-09-17T12:30:00.000Z' }, !falharUpload), status: falharUpload ? statusFalha : 200 }
    }
    throw new Error(`URL inesperada: ${url}`)
  })
})
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals() })
async function emitir() {
  render(<Relatorio />)
  fireEvent.click(await screen.findByRole('button', { name: 'Visualizar Relatório' }))
  fireEvent.click(screen.getByRole('button', { name: 'Emitir e salvar PDF' }))
}

describe('emissão pela página', () => {
  it('D2-ORI — relatório exibe leituras, referência e limitações da medição preservada',async()=>{
    bagua={escola:'bussola',orientacao_graus:22.5,orientacao_estado:'confirmada',orientacao_origem:'tres_leituras',orientacao_referencia:'magnetico',orientacao_confirmada_em:'2026-09-18T12:00:00Z',orientacao_medicao:{versao:1,leituras:[22.4,22.5,22.6],referencia:'magnetico',registrada_em:'2026-09-18T12:00:00Z'}}
    bagua.analise_referencia=referenciaDaAnalise(bagua as BaguaEntrada)
    render(<Relatorio/>);fireEvent.click(await screen.findByRole('button',{name:'Visualizar Relatório'}))
    expect(screen.getByLabelText('Registro das medições de fachada')).toHaveTextContent('22.4° · 22.5° · 22.6° em Norte magnético')
    expect(screen.getByText(/abrangem mais de um setor/)).toBeInTheDocument()
  })

  it('D1 — emite a versão selecionada e inclui sua identificação na prévia',async()=>{
    mocks.busca='analise=00000000-0000-4000-8000-000000000040'
    await emitir()
    await waitFor(()=>expect(respostas.preparo).toHaveLength(1))
    expect(respostas.preparo[0].analise_id).toBe('00000000-0000-4000-8000-000000000040')
    expect(mocks.fetch).toHaveBeenCalledWith(expect.stringContaining('&analise=00000000-0000-4000-8000-000000000040'))
    expect(screen.getByText(/Relatório da análise preservada/)).toHaveTextContent('data de referência desta nova emissão')
  })
  it('D0-02/04 — relatório mostra os resultados por método e a limitação experimental', async () => {
    bagua = { escola: 'bussola', orientacao_graus: 0, orientacao_referencia: 'magnetico', orientacao_estado: 'confirmada', orientacao_origem: 'manual', orientacao_confirmada_em: '2026-09-18T12:00:00Z' }
    bagua.analise_referencia = referenciaDaAnalise(bagua as BaguaEntrada)
    dadosDaConsulta = { ano_construcao: 2011, clientes: { nome_completo: 'Cliente sintético', data_nascimento: '1990-06-15', genero: 'masculino' } }
    render(<Relatorio />)
    fireEvent.click(await screen.findByRole('button', { name: 'Visualizar Relatório' }))
    expect(screen.getByText('Kua da Casa 9')).toBeInTheDocument()
    expect(screen.getByText('Ming Gua 1')).toBeInTheDocument()
    expect(screen.getByText('· Experimental')).toBeInTheDocument()
    expect(screen.getByText(/2 de 5 métodos sustentados no escopo atual/)).toBeInTheDocument()
    expect(screen.getByText(/não decide a recomendação final/)).toBeInTheDocument()
    expect(screen.queryByText(/Setores que exigem cautela/)).not.toBeInTheDocument()
  })
  it('não captura prévia nem emite bússola legada com zero presumido', async () => {
    bagua = { escola: 'bussola', orientacao_graus: 0 }
    await emitir()
    expect(screen.getByRole('alert')).toHaveTextContent('Confirme a fachada')
    expect(mocks.capture).not.toHaveBeenCalled()
    expect(respostas.preparo).toHaveLength(0)
    expect(screen.queryByText(/Kua da Casa \d/)).not.toBeInTheDocument()
  })
  it('D0-04 — carta experimental sozinha não aparece como consenso entre escolas', async () => {
    bagua = { escola: 'bussola', orientacao_graus: 0, orientacao_referencia: 'magnetico', orientacao_estado: 'confirmada', orientacao_origem: 'manual', orientacao_confirmada_em: '2026-09-18T12:00:00Z' }
    bagua.analise_referencia = referenciaDaAnalise(bagua as BaguaEntrada)
    dadosDaConsulta = { ano_construcao: 2011 }
    render(<Relatorio />)
    fireEvent.click(await screen.findByRole('button', { name: 'Visualizar Relatório' }))
    expect(screen.getByText(/Não há resultado elegível para uma recomendação final/)).toBeInTheDocument()
    expect(screen.queryByText(/concordam em todos/)).not.toBeInTheDocument()
  })
  it('só baixa e permite concluir a entrega depois de confirmar a persistência', async () => {
    await emitir()
    await waitFor(() => expect(mocks.download).toHaveBeenCalledOnce())
    expect(respostas.preparo[0].versoes).toEqual(VERSOES_RELATORIO)
    expect(respostas.uploads[0].get('emissao_id')).toBe(respostas.preparo[0].id)
    expect(screen.getByRole('button', { name: 'Baixar versão salva' })).toBeEnabled()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
  it('falha de upload não baixa e retoma o mesmo PDF sem criar nova emissão', async () => {
    falharUpload = true
    await emitir()
    fireEvent.click(await screen.findByRole('button', { name: 'Tentar salvar novamente' }))
    await waitFor(() => expect(respostas.uploads).toHaveLength(2))
    expect(mocks.download).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: 'Baixar versão salva' })).not.toBeInTheDocument()
    falharUpload = false
    await waitFor(() => expect(screen.getByRole('button', { name: 'Tentar salvar novamente' })).toBeEnabled())
    fireEvent.click(screen.getByRole('button', { name: 'Tentar salvar novamente' }))
    await waitFor(() => expect(mocks.download).toHaveBeenCalledOnce())
    expect(respostas.preparo).toHaveLength(1)
    expect(mocks.output).toHaveBeenCalledOnce()
    expect(respostas.uploads.every(f => f.get('emissao_id') === respostas.preparo[0].id)).toBe(true)
  })
  it('falha de atualização do histórico não desfaz uma emissão confirmada', async () => {
    falharHistoricoDepois = true
    await emitir()
    expect(await screen.findByRole('alert')).toHaveTextContent('O PDF foi salvo')
    expect(mocks.download).toHaveBeenCalledOnce()
    expect(screen.queryByRole('button', { name: 'Tentar salvar novamente' })).not.toBeInTheDocument()
  })
  it('preparação expirada não prende o usuário num retry impossível', async () => {
    falharUpload = true; statusFalha = 409
    await emitir()
    expect(await screen.findByRole('alert')).toHaveTextContent('Recarregue a página e gere uma nova emissão')
    expect(screen.queryByRole('button', { name: 'Tentar salvar novamente' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Emitir e salvar PDF' })).toBeEnabled()
    expect(mocks.download).not.toHaveBeenCalled()
  })
  it('barra PDF excessivo antes do envio e permite alterar as seções', async () => {
    mocks.output.mockReturnValue(new Blob([new Uint8Array(MAX_PDF_RELATORIO + 1)], { type: 'application/pdf' }))
    await emitir()
    expect(await screen.findByRole('alert')).toHaveTextContent('ultrapassou 4 MB')
    expect(respostas.uploads).toHaveLength(0)
    expect(mocks.download).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: /Alterar seções/ })).toBeEnabled()
  })
  it('não confirma um relatório com foto que falhou ao carregar', async () => {
    foto = 'consulta/foto.jpg'
    await emitir()
    expect(await screen.findByRole('alert')).toHaveTextContent('Uma foto não pôde ser carregada')
    expect(respostas.preparo).toHaveLength(0)
    expect(mocks.capture).not.toHaveBeenCalled()
  })
})
