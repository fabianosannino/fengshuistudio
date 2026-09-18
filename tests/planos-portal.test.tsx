import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import Planos from '../app/planos/page'
vi.mock('../app/components/AppShell', () => ({ default: ({ children }: { children: ReactNode }) => <>{children}</> }))
vi.mock('../src/lib/plano-vigente', () => ({ carregarPerfilComPlano: async () => ({ data: { plano: 'freemium', tipo_usuario: 'pessoal' } }) }))
vi.mock('../src/lib/supabase', () => ({ supabase: {
  auth: { getUser: async () => ({ data: { user: { id: 'owner' } } }) },
  from: () => {
    const query = { select: () => query, eq: () => query, in: () => query, limit: () => query,
      single: async () => ({ data: null }), maybeSingle: async () => ({ data: null }) }
    return query
  },
} }))
afterEach(() => vi.unstubAllGlobals())
describe('recuperação de assinatura existente', () => {
  it('409 oferece portal acionável mesmo sem assinatura na projeção local', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ error: 'Assinatura em andamento', portal: true }), { status: 409 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: 'Portal temporariamente indisponível' }), { status: 503 }))
    vi.stubGlobal('fetch', fetchMock)
    render(<Planos />)
    fireEvent.click((await screen.findAllByRole('button', { name: 'Assinar Mensal' }))[0])
    fireEvent.click(await screen.findByRole('button', { name: 'Abrir portal de cobrança' }))
    await waitFor(() => expect(fetchMock).toHaveBeenLastCalledWith('/api/stripe/portal', { method: 'POST' }))
    expect(await screen.findByText(/Portal temporariamente indisponível/)).toBeInTheDocument()
    expect(fetchMock.mock.calls.filter(c => c[0] === '/api/stripe/subscribe')).toHaveLength(1)
  })
})
