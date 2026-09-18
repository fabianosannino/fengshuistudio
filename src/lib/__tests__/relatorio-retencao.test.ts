// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { excluirEmissoesDoTitular, listarEmissoesDoTitular, listarHistoricoRelatorio } from '../relatorio-retencao'

vi.mock('server-only', () => ({}))
type Linha = { id: string; consultor_id: string; consulta_id: string; pdf_path: string; criado_em: string; estado: string; entrada: unknown }
const linhas: Linha[] = []
const remove = vi.fn()
const rpc = vi.fn()
const selecoes: string[] = []
let erroLeitura = false
const client = {
  from: () => {
    const filtros: ((r: Linha) => boolean)[] = []
    let inicio = 0; let fim = 0; let colunas = '*'
    const q = {
      select(c: string) { selecoes.push(c); colunas = c; return q },
      eq(c: keyof Linha, v: unknown) { filtros.push(r => r[c] === v); return q },
      order() { return q },
      range(a: number, b: number) { inicio = a; fim = b; return q },
      then(resolve: (r: unknown) => unknown) {
        const data = linhas.filter(r => filtros.every(f => f(r))).slice(inicio, fim + 1)
          .map(r => colunas === '*' ? r : Object.fromEntries(colunas.split(',').map(c => [c, r[c as keyof Linha]])))
        return Promise.resolve(erroLeitura ? { data: null, error: {} } : { data, error: null }).then(resolve)
      },
    }
    return q
  },
  storage: { from: () => ({ remove }) }, rpc,
} as unknown as SupabaseClient
function linha(n: number, extra: Partial<Linha> = {}): Linha {
  return { id: `${n}`, consultor_id: 'dono', consulta_id: 'consulta', pdf_path: `consulta/emissoes/${n}.pdf`, criado_em: '2026-01-01T00:00:00Z', estado: 'concluida', entrada: { privado: true }, ...extra }
}
beforeEach(() => {
  vi.clearAllMocks(); linhas.length = 0; selecoes.length = 0; erroLeitura = false
  remove.mockResolvedValue({ error: null }); rpc.mockResolvedValue({ error: null })
})

describe('retenção das emissões', () => {
  it('não confia num caminho de PDF incompatível com a consulta', async () => {
    linhas.push(linha(1, { pdf_path: 'consulta-alheia/emissoes/1.pdf' }))
    await expect(excluirEmissoesDoTitular(client, 'dono')).rejects.toThrow('Posse')
    expect(remove).not.toHaveBeenCalled(); expect(rpc).not.toHaveBeenCalled()
  })
  it('alcança mais de mil arquivos e apaga todas as revisões numa transação depois do storage', async () => {
    linhas.push(...Array.from({ length: 1001 }, (_, n) => linha(n)))
    rpc.mockImplementation(async () => {
      expect(remove).toHaveBeenCalledTimes(3)
      return { error: null }
    })
    expect(await excluirEmissoesDoTitular(client, 'dono', 'consulta')).toBe(1001)
    expect(remove.mock.calls.flatMap(c => c[0])).toHaveLength(1001)
    expect(rpc).toHaveBeenCalledExactlyOnceWith('excluir_emissoes_relatorio', { p_consultor: 'dono', p_ids: linhas.map(r => r.id) })
    expect(selecoes.every(c => !c.includes('entrada') && c !== '*')).toBe(true)
  })
  it('não alcança arquivos de outro titular nem outra consulta', async () => {
    linhas.push(linha(1), linha(2, { consultor_id: 'outro' }), linha(3, { consulta_id: 'outra' }))
    await excluirEmissoesDoTitular(client, 'dono', 'consulta')
    expect(remove).toHaveBeenCalledExactlyOnceWith(['consulta/emissoes/1.pdf'])
  })
  it('falha de inventário não dispara exclusão', async () => {
    erroLeitura = true
    await expect(excluirEmissoesDoTitular(client, 'dono')).rejects.toThrow('inventariar')
    expect(remove).not.toHaveBeenCalled(); expect(rpc).not.toHaveBeenCalled()
  })
  it('falha de storage preserva metadados para uma nova tentativa', async () => {
    linhas.push(linha(1)); remove.mockResolvedValue({ error: {} })
    await expect(excluirEmissoesDoTitular(client, 'dono')).rejects.toThrow('histórico preservado')
    expect(rpc).not.toHaveBeenCalled()
  })
  it('falha da exclusão no banco interrompe a operação', async () => {
    linhas.push(linha(1)); rpc.mockResolvedValue({ error: {} })
    await expect(excluirEmissoesDoTitular(client, 'dono')).rejects.toThrow('histórico')
  })
  it('aguarda uma emissão potencialmente em trânsito antes de tocar nos arquivos', async () => {
    linhas.push(linha(1, { estado: 'preparada', criado_em: new Date().toISOString() }))
    await expect(excluirEmissoesDoTitular(client, 'dono')).rejects.toThrow('30 minutos')
    expect(remove).not.toHaveBeenCalled(); expect(rpc).not.toHaveBeenCalled()
  })
  it('remove preparações antigas por pedido explícito de exclusão', async () => {
    linhas.push(linha(1, { estado: 'preparada' }))
    expect(await excluirEmissoesDoTitular(client, 'dono')).toBe(1)
  })
  it('inclui entradas na exportação e somente metadados no histórico, sem corte de mil registros', async () => {
    linhas.push(...Array.from({ length: 1001 }, (_, n) => linha(n)))
    const exportadas = await listarEmissoesDoTitular(client, 'dono')
    expect(exportadas).toHaveLength(1001)
    expect(exportadas[0].entrada).toEqual({ privado: true })
    const historico = await listarHistoricoRelatorio(client, 'dono', 'consulta')
    expect(historico).toHaveLength(1001)
    expect(historico[0]).not.toHaveProperty('entrada')
    expect(historico[0]).not.toHaveProperty('pdf_path')
  })
})
