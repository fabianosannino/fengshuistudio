import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
vi.mock('../app/components/AppShell', () => ({ default: ({ children }: { children: ReactNode }) => children }))
vi.mock('../src/lib/supabase', () => ({ supabase: { auth: { signOut: vi.fn() } } }))
import MeusDados from '../app/privacidade/meus-dados/page'
const fetchMock = vi.fn()
beforeEach(() => { vi.clearAllMocks(); vi.stubGlobal('fetch', fetchMock) })
describe('inventário visível antes da exclusão', () => {
  it('erro não mostra zero nem habilita uma exclusão sem inventário', async () => {
    fetchMock.mockResolvedValue({ ok: false })
    render(<MeusDados />)
    await screen.findByRole('alert')
    fireEvent.change(screen.getByLabelText(/Digite/), { target: { value: 'EXCLUIR' } })
    expect(screen.getByRole('button', { name: 'Excluir minha conta' })).toBeDisabled()
    expect(screen.queryByText(/0 clientes/)).not.toBeInTheDocument()
  })
  it('nova leitura válida libera a confirmação e preserva as contagens', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false }).mockResolvedValueOnce({ ok: true, json: async () => ({ clientes: 7, consultas: 9, pedidosComoComprador: 2 }) })
    render(<MeusDados />)
    fireEvent.click(await screen.findByRole('button', { name: 'Tentar novamente' }))
    fireEvent.change(screen.getByLabelText(/Digite/), { target: { value: 'EXCLUIR' } })
    await waitFor(() => expect(screen.getByRole('button', { name: 'Excluir minha conta' })).toBeEnabled())
    expect(screen.getByText(/7 clientes e as 9 consultas/)).toBeInTheDocument()
  })
})
