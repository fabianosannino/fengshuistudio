import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { carregarPerfilComPlano, obterMeuPlano } from '../src/lib/plano-vigente'

const cliente = (response: unknown) => ({ rpc: vi.fn().mockResolvedValue(response) })
describe('plano vigente não usa o cache como autorização', () => {
  it('concessão vencida substitui Pro no retrato sem escrever no perfil', async () => {
    const c = cliente({ data: 'free', error: null })
    const perfil = { id: 'owner', plano: 'pro', nome_completo: 'Fixture' }
    const result = await carregarPerfilComPlano(c as unknown as SupabaseClient, Promise.resolve({ data: perfil, error: null }))
    expect(result).toEqual({ data: { ...perfil, plano: 'freemium' }, error: null })
    expect(perfil.plano).toBe('pro')
    expect(c.rpc).toHaveBeenCalledExactlyOnceWith('obter_meu_plano')
  })
  it('benefício legítimo vence cache inferior e mantém as colunas selecionadas', async () => {
    const c = cliente({ data: 'profissional', error: null })
    const result = await carregarPerfilComPlano(c as unknown as SupabaseClient, Promise.resolve({ data: { plano: 'freemium' }, error: null }))
    expect(result.data).toEqual({ plano: 'pro' })
  })
  it.each([{ data: null, error: {} }, { data: 'agencia', error: null }, { data: null, error: null }])('falha não vira plano gratuito: %j', async response => {
    const c = cliente(response)
    expect(await obterMeuPlano(c as unknown as SupabaseClient)).toBeNull()
    const result = await carregarPerfilComPlano(c as unknown as SupabaseClient, Promise.resolve({ data: { plano: 'pro' }, error: null }))
    expect(result.data).toBeNull(); expect(result.error).toBeInstanceOf(Error)
  })
  it('perfil indisponível não é fabricado a partir da concessão', async () => {
    const c = cliente({ data: 'profissional', error: null })
    const result = await carregarPerfilComPlano(c as unknown as SupabaseClient, Promise.resolve({ data: null, error: {} }))
    expect(result.data).toBeNull(); expect(result.error).toBeInstanceOf(Error)
  })
  it('rejeição de rede também não concede nem rebaixa', async () => {
    const c = { rpc: vi.fn().mockRejectedValue(new Error('network')) }
    expect(await obterMeuPlano(c as unknown as SupabaseClient)).toBeNull()
  })
})
