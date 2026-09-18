import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
vi.mock('../app/components/useUrlsAssinadas', () => ({ useUrlsAssinadas: () => ({ resolver: (path: string) => path }) }))
import TabFotos from '../app/consultas/[id]/TabFotos'
const onUpdate = vi.fn()
const fetchMock = vi.fn()
const props = { consultaId: 'visit', fotoGeral: 'visit/geral/old.png', fotosComodos: [], onUpdate, saving: false,
  fotosAntes: [], fotosDepois: [], onUpdateAntes: vi.fn(), onUpdateDepois: vi.fn() }
beforeEach(() => { vi.clearAllMocks(); vi.stubGlobal('fetch', fetchMock) })
afterEach(() => { cleanup(); vi.unstubAllGlobals() })
describe('substituição de foto não destrói a versão anterior', () => {
  it('falha no upload mantém a imagem e informa erro sem DELETE', async () => {
    fetchMock.mockResolvedValue(Response.json({ error: 'Falha de armazenamento' }, { status: 503 }))
    render(<TabFotos {...props} />)
    fireEvent.change(screen.getByLabelText('Trocar foto'), { target: { files: [new File(['fixture'], 'nova.png', { type: 'image/png' })] } })
    await screen.findByText('Falha de armazenamento')
    expect(onUpdate).not.toHaveBeenCalled()
    expect(screen.getByAltText('Foto geral do imóvel')).toHaveAttribute('src', props.fotoGeral)
    expect(fetchMock.mock.calls.map(c => c[1].method)).toEqual(['POST'])
  })
  it('só troca a referência depois de confirmar o upload', async () => {
    fetchMock.mockResolvedValue(Response.json({ paths: ['visit/geral/new.png'] }))
    render(<TabFotos {...props} />)
    fireEvent.change(screen.getByLabelText('Trocar foto'), { target: { files: [new File(['fixture'], 'nova.png', { type: 'image/png' })] } })
    await waitFor(() => expect(onUpdate).toHaveBeenCalledWith('visit/geral/new.png', []))
    expect(fetchMock.mock.calls.map(c => c[1].method)).toEqual(['POST'])
  })
  it('falha de remoção não confirma retirada na interface', async () => {
    fetchMock.mockResolvedValue(Response.json({}, { status: 503 }))
    render(<TabFotos {...props} />)
    fireEvent.click(screen.getByRole('button', { name: /^Remover$/ }))
    await screen.findByText('Não foi possível remover a foto. Tente novamente.')
    expect(onUpdate).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: /^Remover$/ })).toBeEnabled()
  })
})
