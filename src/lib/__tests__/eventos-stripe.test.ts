import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { reivindicarEvento, marcarProcessado, marcarFalha, houveEventoMaisNovo, objetoDoEvento } from '../eventos-stripe'
vi.mock('../logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))
const evento = { id: 'evt_1', type: 'customer.subscription.updated', created: 1_786_556_000, endpoint: '/test', objetoId: 'sub_1' }
function client(data: unknown, error: unknown = null) {
  const rpc = vi.fn().mockResolvedValue({ data, error })
  return { rpc, supabase: { rpc } as unknown as SupabaseClient }
}
describe('reivindicação durável de eventos', () => {
  it.each(['reivindicado', 'retomado'])('devolve o token para %s', async situacao => {
    const c = client({ situacao, token: 'token-1' })
    expect(await reivindicarEvento(c.supabase, evento)).toEqual({ situacao, token: 'token-1' })
    expect(c.rpc).toHaveBeenCalledWith('reivindicar_evento_stripe', expect.objectContaining({ p_event_id: evento.id, p_objeto_id: evento.objetoId }))
  })
  it.each(['ocupado', 'repetido'])('não fornece direito de processar para %s', async situacao => {
    expect(await reivindicarEvento(client({ situacao }).supabase, evento)).toEqual({ situacao })
  })
  it.each([null, {}, { situacao: 'retomado' }, { situacao: 'surpresa', token: 'x' }])('falha fechada para resposta inválida %j', async data => {
    expect(await reivindicarEvento(client(data).supabase, evento)).toEqual({ situacao: 'sem_garantia' })
  })
  it('não processa se o banco está indisponível', async () => {
    expect(await reivindicarEvento(client(null, { code: '08006' }).supabase, evento)).toEqual({ situacao: 'sem_garantia' })
  })
  it('timestamp inválido não é substituído por agora', async () => {
    const c = client({ situacao: 'reivindicado', token: 'x' })
    expect(await reivindicarEvento(c.supabase, { ...evento, created: NaN })).toEqual({ situacao: 'sem_garantia' })
    expect(c.rpc).not.toHaveBeenCalled()
  })
  it.each([false, null])('conclusão rejeitada não confirma sucesso (%s)', async data => {
    await expect(marcarProcessado(client(data).supabase, 'evt_1', '/test', 'token-1')).rejects.toThrow()
  })
  it('erro de banco não confirma conclusão', async () => {
    await expect(marcarProcessado(client(true, { code: '08006' }).supabase, 'evt_1', '/test', 'token-1')).rejects.toThrow()
  })
  it('conclusão e falha carregam o token da tentativa', async () => {
    const c = client(true)
    await marcarProcessado(c.supabase, 'evt_1', '/test', 'token-1')
    await marcarFalha(c.supabase, 'evt_1', '/test', 'token-1')
    expect(c.rpc).toHaveBeenNthCalledWith(1, 'finalizar_evento_stripe', { p_event_id: 'evt_1', p_token: 'token-1', p_sucesso: true })
    expect(c.rpc).toHaveBeenNthCalledWith(2, 'finalizar_evento_stripe', { p_event_id: 'evt_1', p_token: 'token-1', p_sucesso: false })
  })
  it('falha ao liberar não esconde a resposta de erro do handler', async () => {
    await expect(marcarFalha(client(null, {}).supabase, 'evt_1', '/test', 'token-1')).resolves.toBeUndefined()
  })
})
describe('ordem de eventos', () => {
  function ordem(data: unknown, error: unknown = null) {
    const b = { select: () => b, eq: () => b, not: () => b, gt: () => b, limit: async () => ({ data, error }) }
    return { from: () => b } as unknown as SupabaseClient
  }
  it('identifica um evento mais recente', async () => {
    expect(await houveEventoMaisNovo(ordem([{ event_id: 'evt_2' }]), 'sub_1', evento.created, evento.id)).toBe(true)
    expect(await houveEventoMaisNovo(ordem([]), 'sub_1', evento.created, evento.id)).toBe(false)
  })
  it('indisponibilidade não significa ordem válida', async () => {
    await expect(houveEventoMaisNovo(ordem(null, {}), 'sub_1', evento.created, evento.id)).rejects.toThrow()
  })
})
describe('objeto do evento', () => {
  it('ausência e tipo inválido não inventam identidade', () => {
    for (const object of [null, {}, { id: '' }, { id: 42 }]) expect(objetoDoEvento({ data: { object } })).toBeNull()
    expect(objetoDoEvento({ data: { object: { id: 'sub_123' } } })).toBe('sub_123')
  })
})
