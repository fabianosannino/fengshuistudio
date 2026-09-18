import { calcularResultadoAnalise } from '../src/lib/calculo-analise'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import AnalisesPage from '../app/consultas/[id]/analises/page'
import {
  fonteAnaliseTeste,
  idAnaliseTeste as id,
} from './fixtures/fonte-analise'
import {
  VERSAO_MOTOR_ANALISE,
  type AnaliseSalva,
} from '../src/lib/historico-analises'
vi.mock('next/navigation', () => ({
  useParams: () => ({ id: 'consulta-teste' }),
}))
vi.mock('../app/components/FlowLayout', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))
let registros: AnaliseSalva[],
  fonte: ReturnType<typeof fonteAnaliseTeste>,
  falha: number,
  pedidos: { id: string; fonte_sha256: string }[],
  pendencia: string | null
const hash = () =>
  fonte.consulta.bagua_entrada!.escola === 'btb' ? 'hash-btb' : 'hash-bussola'
function salva(n: number, escola = 'btb'): AnaliseSalva {
  const f = fonteAnaliseTeste(escola)
  return {
    id: id(n),
    consulta_id: 'consulta-teste',
    criado_em: '2026-09-18T12:00:00.000Z',
    metodo: escola as 'btb' | 'bussola',
    variante: escola === 'btb' ? 'btb-porta' : 'bussola-octantes',
    versao_motor: VERSAO_MOTOR_ANALISE,
    fonte_sha256: `hash-${escola}`,
    fonte: f,
    resultado: calcularResultadoAnalise(f),
  }
}
beforeEach(() => {
  registros = []
  fonte = fonteAnaliseTeste()
  falha = 0
  pedidos = []
  pendencia = null
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === 'POST') {
        const p = JSON.parse(init.body as string)
        pedidos.push(p)
        if (falha)
          return Response.json(
            {
              error:
                falha === 409
                  ? 'Os dados mudaram. Atualize a lista.'
                  : 'Conexão interrompida; tente novamente.',
            },
            { status: falha },
          )
        const r = {
          ...salva(31, fonte.consulta.bagua_entrada!.escola),
          id: p.id,
        }
        registros.unshift(r)
        return Response.json({ analise: r }, { status: 201 })
      }
      const q = new URL(url, 'https://example.invalid').searchParams
      if (q.has('analise')) {
        const r = registros.find((r) => r.id === q.get('analise'))
        return Response.json(
          r ? { analise: r } : { error: 'Versão não encontrada' },
          { status: r ? 200 : 404 },
        )
      }
      const p = Number(q.get('pagina') ?? 0)
      return Response.json({
        analises: registros
          .slice(p * 20, (p + 1) * 20)
          .map((v) => ({
            id: v.id,
            consulta_id: v.consulta_id,
            criado_em: v.criado_em,
            metodo: v.metodo,
            variante: v.variante,
            versao_motor: v.versao_motor,
            fonte_sha256: v.fonte_sha256,
          })),
        mais: registros.length > (p + 1) * 20,
        atual: {
          nome: 'Planta sintética',
          metodo: fonte.consulta.bagua_entrada!.escola,
          fonte_sha256: hash(),
          impedimento: pendencia,
        },
      })
    }),
  )
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})
const abrir = async () => {
  render(<AnalisesPage />)
  await screen.findByRole('button', { name: 'Atualizar lista' })
}
describe('D1 — histórico real React com I/O simulado', () => {
  it('D2-ORI — abre as medições da versão histórica sem usar dados atuais',async()=>{
    const antiga=salva(35)
    antiga.fonte.consulta.bagua_entrada!.orientacao_medicao={versao:1,leituras:[358,0,2],referencia:'magnetico',registrada_em:'2026-09-18T12:00:00Z'}
    registros=[antiga];await abrir()
    fireEvent.change(screen.getByLabelText('Versão A'),{target:{value:id(35)}})
    expect(await screen.findByLabelText('Registro das medições de fachada')).toHaveTextContent('358° · 0° · 2° em Norte magnético')
  })
  it('salva BTB, muda para Bússola, reabre e compara fontes preservadas', async () => {
    await abrir()
    fireEvent.click(
      screen.getByRole('button', { name: 'Registrar análise atual' }),
    )
    await screen.findByText(/Versão registrada/)
    const original = structuredClone(registros[0])
    fonte = fonteAnaliseTeste('bussola')
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar lista' }))
    await screen.findByRole('button', { name: 'Registrar análise atual' })
    fireEvent.click(
      screen.getByRole('button', { name: 'Registrar análise atual' }),
    )
    await waitFor(() => expect(registros).toHaveLength(2))
    expect(registros[1]).toEqual(original)
    cleanup()
    await abrir()
    fireEvent.change(screen.getByLabelText('Versão A'), {
      target: { value: registros[1].id },
    })
    fireEvent.change(screen.getByLabelText('Versão B'), {
      target: { value: registros[0].id },
    })
    await screen.findByText(/Métodos diferentes/)
    const antigo = within(
      screen.getByRole('article', { name: `Versão ${original.id}` }),
    )
    expect(
      antigo.getByRole('link', { name: 'Preparar relatório desta versão' }),
    ).toHaveAttribute(
      'href',
      `/consultas/consulta-teste/relatorio?analise=${original.id}`,
    )
    expect(antigo.getByText('Não avaliado')).toBeInTheDocument()
  })
  it('falha de conexão mantém o identificador para retry sem anunciar sucesso', async () => {
    await abrir()
    falha = 503
    fireEvent.click(
      screen.getByRole('button', { name: 'Registrar análise atual' }),
    )
    await screen.findByRole('alert')
    expect(screen.queryByText(/Versão registrada/)).not.toBeInTheDocument()
    expect(registros).toHaveLength(0)
    falha = 0
    fireEvent.click(
      screen.getByRole('button', { name: 'Tentar salvar novamente' }),
    )
    await screen.findByText(/Versão registrada/)
    expect(pedidos[0].id).toBe(pedidos[1].id)
  })
  it('impedimento desabilita registro e aponta para a planta; histórico antigo continua legível', async () => {
    registros = [{ ...salva(32), versao_motor: 'motor-antigo' }]
    pendencia = 'Finalize os nove setores da planta.'
    await abrir()
    expect(
      screen.getByRole('button', { name: 'Registrar análise atual' }),
    ).toBeDisabled()
    expect(
      screen.getByRole('link', { name: 'Revisar planta' }),
    ).toHaveAttribute('href', '/bagua-planta?consultaId=consulta-teste')
    fireEvent.change(screen.getByLabelText('Versão A'), {
      target: { value: id(32) },
    })
    await screen.findByText(/Esta versão usa um motor anterior/)
    expect(
      screen.queryByRole('link', { name: 'Preparar relatório desta versão' }),
    ).not.toBeInTheDocument()
  })
  it('carrega páginas adicionais sem perder versões já listadas', async () => {
    registros = Array.from({ length: 23 }, (_, i) => salva(i + 31))
    await abrir()
    fireEvent.click(
      screen.getByRole('button', { name: 'Carregar mais versões' }),
    )
    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: 'Carregar mais versões' }),
      ).not.toBeInTheDocument(),
    )
    expect(
      within(screen.getByLabelText('Versão A')).getAllByRole('option'),
    ).toHaveLength(24)
  })
})
