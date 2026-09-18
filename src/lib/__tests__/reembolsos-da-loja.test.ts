// @vitest-environment node
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
const provider = vi.hoisted(() => ({ paymentIntents: { retrieve: vi.fn() }, refunds: { list: vi.fn() },
  applicationFees: { retrieve: vi.fn(), listRefunds: vi.fn() } }))
vi.mock('../stripe', () => ({ default: provider }))
import { sincronizarReembolsosDaLoja } from '../reembolsos-da-loja'

const pedido = { id: 'pedido-1', stripe_payment_intent: 'pi_1', stripe_account_id: 'acct_1', vendedor_tipo: 'consultor',
  vendedor_perfil_id: 'seller-1', total_centavos: 2000, taxa_plataforma_centavos: 200, moeda: 'brl' }
const charge = { id: 'ch_1', livemode: false, payment_intent: 'pi_1', paid: true, status: 'succeeded', currency: 'brl', amount_captured: 2000, application_fee: 'fee_1' }
const refund = { id: 're_1', charge: 'ch_1', payment_intent: 'pi_1', amount: 500, currency: 'brl', status: 'succeeded', created: 1_786_555_000 }
const fee = { id: 'fee_1', livemode: false, account: 'acct_1', charge: 'ch_1', currency: 'brl', amount: 200, amount_refunded: 50 }
const feeRefund = { id: 'fr_1', fee: 'fee_1', amount: 50, currency: 'brl', created: 1_786_555_000 }
let leitura: { data: typeof pedido | null; error: { message: string } | null }
const rpc = vi.fn<(name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>>()
function db() {
  const query = { select: () => query, eq: () => query, maybeSingle: async () => leitura }
  return { from: () => query, rpc } as unknown as SupabaseClient
}
const applied = () => rpc.mock.calls.find(([name]) => name === 'aplicar_reembolsos_pedido')?.[1]
beforeEach(() => {
  vi.resetAllMocks()
  vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_fixture')
  leitura = { data: { ...pedido }, error: null }
  rpc.mockImplementation(async name => ({ data: name === 'reservar_sincronizacao_financeira' ? 'token-current'
    : name === 'aplicar_reembolsos_pedido' ? { versao: 1, confirmado_centavos: 500, pendente_centavos: 0 } : true, error: null }))
  provider.paymentIntents.retrieve.mockResolvedValue({ id: 'pi_1', livemode: false, status: 'succeeded', currency: 'brl', amount_received: 2000, latest_charge: charge })
  provider.refunds.list.mockResolvedValue({ data: [refund], has_more: false })
  provider.applicationFees.retrieve.mockResolvedValue(fee)
  provider.applicationFees.listRefunds.mockResolvedValue({ data: [feeRefund], has_more: false })
})
afterEach(() => vi.unstubAllEnvs())
describe('conciliação de reembolsos da loja', () => {
  it('reserva antes de ler; usa conta conectada para cobrança e plataforma para comissão', async () => {
    const current = await provider.paymentIntents.retrieve()
    provider.paymentIntents.retrieve.mockImplementation(async () => {
      expect(rpc.mock.calls[0]).toEqual(['reservar_sincronizacao_financeira', { p_recurso: 'pedido:pedido-1' }])
      return current
    })
    await sincronizarReembolsosDaLoja(db(), 'pedido-1', 'acct_1')
    expect(provider.paymentIntents.retrieve).toHaveBeenLastCalledWith('pi_1', { expand: ['latest_charge'] }, expect.objectContaining({ stripeAccount: 'acct_1', maxNetworkRetries: 0 }))
    expect(provider.applicationFees.retrieve.mock.calls[0][2]).not.toHaveProperty('stripeAccount')
    expect(provider.applicationFees.listRefunds.mock.calls[0][2]).not.toHaveProperty('stripeAccount')
    expect(applied()).toMatchObject({ p_token: 'token-current', p_dados: { account: 'acct_1', vendedor_perfil_id: 'seller-1',
      reembolsos: [{ id: 're_1', centavos: 500 }], estornos_comissao: [{ id: 'fr_1', centavos: 50 }] } })
  })
  it('pedido de outra conta é recusado antes de consultar Stripe', async () => {
    await expect(sincronizarReembolsosDaLoja(db(), 'pedido-1', 'acct_other')).rejects.toThrow()
    expect(provider.paymentIntents.retrieve).not.toHaveBeenCalled()
    expect(applied()).toBeUndefined()
  })
  it('falha de leitura do pedido permanece retryable', async () => {
    leitura = { data: null, error: { message: 'unavailable' } }
    await expect(sincronizarReembolsosDaLoja(db(), 'pedido-1', 'acct_1')).rejects.toThrow()
    expect(provider.paymentIntents.retrieve).not.toHaveBeenCalled()
  })
  it('reserva ocupada não lê provedor', async () => {
    rpc.mockResolvedValue({ data: null, error: null })
    await expect(sincronizarReembolsosDaLoja(db(), 'pedido-1', 'acct_1')).rejects.toThrow()
    expect(provider.paymentIntents.retrieve).not.toHaveBeenCalled()
  })
  it.each(['reembolsos', 'comissao'])('paginação incompleta de %s não escreve parcial', async tipo => {
    if (tipo === 'reembolsos') provider.refunds.list.mockResolvedValue({ data: [refund], has_more: true })
    else provider.applicationFees.listRefunds.mockResolvedValue({ data: [feeRefund], has_more: true })
    await expect(sincronizarReembolsosDaLoja(db(), 'pedido-1', 'acct_1')).rejects.toThrow()
    expect(applied()).toBeUndefined()
  })
  it.each([{ account: 'acct_other' }, { charge: 'ch_other' }, { amount: 300 }, { livemode: true }])('comissão incompatível %j não é atribuída ao vendedor', async delta => {
    provider.applicationFees.retrieve.mockResolvedValue({ ...fee, ...delta })
    await expect(sincronizarReembolsosDaLoja(db(), 'pedido-1', 'acct_1')).rejects.toThrow()
    expect(applied()).toBeUndefined()
  })
  it.each([{ amount: 0.1 }, { charge: 'ch_other' }, { currency: 'usd' }, { status: 'unknown' }])('reembolso incompatível %j não entra no razão', async delta => {
    provider.refunds.list.mockResolvedValue({ data: [{ ...refund, ...delta }], has_more: false })
    await expect(sincronizarReembolsosDaLoja(db(), 'pedido-1', 'acct_1')).rejects.toThrow()
    expect(applied()).toBeUndefined()
  })
  it('erro do banco não confirma e libera apenas o token atual', async () => {
    const normal = rpc.getMockImplementation()!
    rpc.mockImplementation(async (name, args) => name === 'aplicar_reembolsos_pedido'
      ? { data: null, error: { message: 'expired' } } : normal(name, args))
    await expect(sincronizarReembolsosDaLoja(db(), 'pedido-1', 'acct_1')).rejects.toThrow()
    expect(rpc).toHaveBeenLastCalledWith('liberar_sincronizacao_financeira', { p_recurso: 'pedido:pedido-1', p_token: 'token-current' })
  })
  it('estorno pendente preserva seu estado sem presumir sucesso', async () => {
    provider.refunds.list.mockResolvedValue({ data: [{ ...refund, status: 'pending' }], has_more: false })
    await sincronizarReembolsosDaLoja(db(), 'pedido-1', 'acct_1')
    expect(applied()?.p_dados).toMatchObject({ reembolsos: [{ status: 'pending' }] })
  })
})
