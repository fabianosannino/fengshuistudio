import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import NovaConsulta from '../app/consultas/nova/page'

const mocks = vi.hoisted(() => ({
  plano: 'starter', planoVigente: 'simples', tipo: 'consultor', ativos: 1,
  profileError: null as null | { code: string },
  not: vi.fn(), rpc: vi.fn(), fetch: vi.fn(),
}))
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams() }))
vi.mock('../app/components/FlowLayout', () => ({ default: ({ children }: { children: ReactNode }) => <>{children}</> }))
vi.mock('../src/lib/supabase', () => ({ supabase: {
  auth: { getUser: async () => ({ data: { user: { id: 'owner', email: 'synthetic@example.invalid' } } }) },
  rpc: mocks.rpc,
  from: (table: string) => {
    const response = () => table === 'profiles'
      ? { data: { plano: mocks.plano, tipo_usuario: mocks.tipo }, error: mocks.profileError }
      : table === 'clientes'
        ? { data: [{ id: 'client', nome_completo: 'Cliente de teste' }], error: null }
        : { count: mocks.ativos, error: null }
    const query: Record<string, unknown> = {}
    for (const key of ['select', 'eq', 'order', 'single']) query[key] = () => query
    query.not = (...args: unknown[]) => { mocks.not(...args); return query }
    query.then = (resolve: (result: unknown) => void) => Promise.resolve(response()).then(resolve)
    return query
  },
} }))

beforeEach(() => {
  mocks.plano = 'starter'; mocks.planoVigente = 'simples'; mocks.tipo = 'consultor'; mocks.ativos = 1; mocks.profileError = null
  mocks.not.mockClear(); mocks.rpc.mockReset(); mocks.fetch.mockReset()
  mocks.rpc.mockImplementation(async (nome: string) => ({ data: nome === 'obter_meu_plano' ? mocks.planoVigente : 'own-client', error: null }))
  vi.stubGlobal('fetch', mocks.fetch)
})

describe('nova consulta respeita os direitos efetivos', () => {
  it('Pro vencido no cache mostra a cota Free vigente', async () => {
    mocks.plano = 'pro'; mocks.planoVigente = 'free'; mocks.ativos = 3
    render(<NovaConsulta />)
    expect(await screen.findByText(/limite de 3 imóveis ativos/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Criar consulta|Iniciar diagnóstico/ })).not.toBeInTheDocument()
  })
  it('Simples com um imóvel ainda pode criar e selecionar seu cliente', async () => {
    render(<NovaConsulta />)
    expect(await screen.findByRole('button', { name: 'Criar consulta' })).not.toBeDisabled()
    expect(screen.getByText('Cliente de teste')).toBeInTheDocument()
    expect(screen.getByText(/1\/10 imóveis ativos/)).toBeInTheDocument()
    expect(mocks.not).toHaveBeenCalledWith('status', 'in', '(arquivada,deletada)')
  })
  it('Simples no décimo imóvel mostra o limite e mantém o gerenciamento acessível', async () => {
    mocks.ativos = 10
    render(<NovaConsulta />)
    expect(await screen.findByText(/limite de 10 imóveis ativos/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Criar consulta' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Gerenciar imóveis' })).toHaveAttribute('href', '/consultas')
  })
  it('Free prepara o titular por RPC sem enviar identidade ou criar cliente no navegador', async () => {
    mocks.plano = 'freemium'; mocks.planoVigente = 'free'; mocks.tipo = 'pessoal'; mocks.ativos = 2
    mocks.fetch.mockResolvedValue({ ok: false, json: async () => ({ error: 'Falha de teste' }) })
    render(<NovaConsulta />)
    fireEvent.click(await screen.findByRole('button', { name: 'Iniciar diagnóstico' }))
    await waitFor(() => expect(mocks.rpc).toHaveBeenCalledWith('obter_cliente_titular'))
    expect(JSON.parse(mocks.fetch.mock.calls[0][1].body).cliente_id).toBe('own-client')
  })
  it('perfil indisponível não vira Free nem permite iniciar cadastro', async () => {
    mocks.profileError = { code: 'connection_error' }
    render(<NovaConsulta />)
    expect(await screen.findByText(/Não foi possível carregar seu plano/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Criar consulta|Iniciar diagnóstico/ })).not.toBeInTheDocument()
  })
})
