import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * O que este arquivo protege é a **declaração da lacuna**, não o número.
 *
 * A tarifa vem da `balance_transaction` porque estimá-la daria um razão que
 * quase fecha — e um razão que quase fecha é pior que um que não fecha,
 * porque ninguém percebe a diferença. Quando ela não vem, a regra é não
 * inventar a linha e **dizer** que o razão está incompleto (ADR 0020).
 *
 * A segunda metade dessa regra estava valendo para um caso em quatro: só o
 * `catch` registrava. Custou o pedido `P260815-C799D5`, cujo razão saiu sem
 * `tarifa_gateway` e sem uma única linha de log — a `balance_transaction`
 * existia no Stripe, com `fee: 43`, e mesmo assim não deu para dizer qual
 * condição tinha disparado.
 */

const retrieve = vi.fn()
const registrarLancamento = vi.fn().mockResolvedValue(true)
const warn = vi.fn()

vi.mock('../stripe', () => ({
  default: { paymentIntents: { retrieve: (...args: unknown[]) => retrieve(...args) } },
}))

vi.mock('../logger', () => ({
  logger: {
    warn: (...args: unknown[]) => warn(...args),
    info: vi.fn(), error: vi.fn(), debug: vi.fn(),
  },
}))

vi.mock('../lancamentos-do-pedido', () => ({
  registrarLancamento: (...args: unknown[]) => registrarLancamento(...args),
}))

const { registrarLancamentosDaVenda, completarTarifaDaVenda } = await import('../lancamentos-da-venda')

const SUPABASE = {} as never

const VENDA = {
  pedidoId: 'ped-1',
  totalCentavos: 100,
  freteCentavos: 0,
  taxaPlataformaCentavos: 0,
  paymentIntent: 'pi_123',
  contaConectada: null,
  vendedor: 'plataforma' as const,
  referencia: 'evt_1',
  ocorridoEm: '2026-08-15T19:56:47.000Z',
}

/** Os lançamentos escritos nesta rodada, por tipo. */
function tiposEscritos(): string[] {
  return registrarLancamento.mock.calls.map(c => (c[1] as { tipo: string }).tipo)
}

/** O motivo declarado no aviso de lacuna, se houve um. */
function motivoDaLacuna(): string | undefined {
  const chamada = warn.mock.calls.find(c => String(c[0]).includes('sem tarifa do gateway'))
  return chamada ? (chamada[1] as { porque: string }).porque : undefined
}

beforeEach(() => {
  retrieve.mockReset()
  registrarLancamento.mockClear()
  warn.mockReset()
})

describe('tarifa presente', () => {
  it('vira lançamento com o valor efetivamente descontado', async () => {
    retrieve.mockResolvedValue({
      latest_charge: { balance_transaction: { fee: 43, fee_details: [{ type: 'stripe_fee', amount: 43 }] } },
    })

    await registrarLancamentosDaVenda(SUPABASE, VENDA, 'teste')

    expect(tiposEscritos()).toContain('tarifa_gateway')
    const linha = registrarLancamento.mock.calls
      .map(c => c[1] as { tipo: string; valorCentavos: number })
      .find(l => l.tipo === 'tarifa_gateway')
    expect(linha?.valorCentavos).toBe(43)
    expect(motivoDaLacuna()).toBeUndefined()
  })

  it('desconta a comissão que já está dentro da tarifa', async () => {
    // Numa venda de consultor os nossos 10% chegam como `application_fee` e
    // aparecem dentro do `fee`. Sem subtrair, seriam contados duas vezes.
    retrieve.mockResolvedValue({
      latest_charge: {
        balance_transaction: {
          fee: 53,
          fee_details: [{ type: 'stripe_fee', amount: 43 }, { type: 'application_fee', amount: 10 }],
        },
      },
    })

    await registrarLancamentosDaVenda(SUPABASE, { ...VENDA, vendedor: 'consultor', taxaPlataformaCentavos: 10 }, 'teste')

    const linha = registrarLancamento.mock.calls
      .map(c => c[1] as { tipo: string; valorCentavos: number })
      .find(l => l.tipo === 'tarifa_gateway')
    expect(linha?.valorCentavos).toBe(43)
  })
})

describe('tarifa ausente — a lacuna precisa se anunciar', () => {
  /*
   * Cada caso aqui é uma das saídas que ficavam mudas. O que se afirma é
   * duplo, e as duas metades importam: **não** escreve a linha (não inventa
   * número) e **diz** por que não escreveu (dá para diagnosticar depois).
   */

  it('sem payment_intent', async () => {
    await registrarLancamentosDaVenda(SUPABASE, { ...VENDA, paymentIntent: null }, 'teste')

    expect(tiposEscritos()).not.toContain('tarifa_gateway')
    expect(motivoDaLacuna()).toBe('pedido sem payment_intent')
    expect(retrieve).not.toHaveBeenCalled()
  })

  it('payment_intent sem cobrança', async () => {
    retrieve.mockResolvedValue({ latest_charge: null })

    await registrarLancamentosDaVenda(SUPABASE, VENDA, 'teste')

    expect(tiposEscritos()).not.toContain('tarifa_gateway')
    expect(motivoDaLacuna()).toBe('payment_intent sem latest_charge')
  })

  it('cobrança que não expandiu', async () => {
    // O `expand` pedido mas não atendido: vem o id, não o objeto.
    retrieve.mockResolvedValue({ latest_charge: 'ch_123' })

    await registrarLancamentosDaVenda(SUPABASE, VENDA, 'teste')

    expect(motivoDaLacuna()).toBe('latest_charge não expandiu')
  })

  it('cobrança sem balance_transaction', async () => {
    retrieve.mockResolvedValue({ latest_charge: { balance_transaction: null } })

    await registrarLancamentosDaVenda(SUPABASE, VENDA, 'teste')

    expect(motivoDaLacuna()).toBe('cobrança sem balance_transaction')
  })

  it('balance_transaction que não expandiu', async () => {
    retrieve.mockResolvedValue({ latest_charge: { balance_transaction: 'txn_123' } })

    await registrarLancamentosDaVenda(SUPABASE, VENDA, 'teste')

    expect(motivoDaLacuna()).toBe('balance_transaction não expandiu')
  })

  it('erro na consulta ao Stripe', async () => {
    retrieve.mockRejectedValue(new Error('rede caiu'))

    await registrarLancamentosDaVenda(SUPABASE, VENDA, 'teste')

    expect(tiposEscritos()).not.toContain('tarifa_gateway')
    expect(motivoDaLacuna()).toContain('rede caiu')
  })

  it('a venda continua registrada mesmo sem a tarifa', async () => {
    // A tarifa é uma linha do razão, não a venda. Perdê-la não pode levar
    // junto o registro de que o comprador pagou.
    retrieve.mockRejectedValue(new Error('rede caiu'))

    await registrarLancamentosDaVenda(SUPABASE, VENDA, 'teste')

    expect(tiposEscritos()).toContain('produto')
  })
})

describe('completarTarifaDaVenda — a segunda chance', () => {
  /*
   * A reconciliação chama isto para pedidos pagos cujo razão ficou sem a
   * tarifa. Roda depois, sem pressa, e é onde a corrida contra a consistência
   * eventual do Stripe deixa de importar.
   */
  const PEDIDO = {
    pedidoId: 'ped-1',
    paymentIntent: 'pi_123',
    contaConectada: null,
    vendedor: 'plataforma' as const,
  }

  it('escreve a linha que faltou, do vendedor para o gateway', async () => {
    retrieve.mockResolvedValue({
      latest_charge: { balance_transaction: { fee: 43, fee_details: [{ type: 'stripe_fee', amount: 43 }] } },
    })

    expect(await completarTarifaDaVenda(SUPABASE, PEDIDO, 'teste')).toBe(true)

    const linha = registrarLancamento.mock.calls[0][1] as Record<string, unknown>
    expect(linha.tipo).toBe('tarifa_gateway')
    expect(linha.valorCentavos).toBe(43)
    expect(linha.pagador).toBe('plataforma')
    expect(linha.recebedor).toBe('gateway')
  })

  it('a referência amarra o conserto à cobrança', async () => {
    // É o que torna a execução de amanhã inofensiva: o índice de unicidade
    // recusa o segundo insert com a mesma referência dentro do tipo.
    retrieve.mockResolvedValue({
      latest_charge: { balance_transaction: { fee: 43, fee_details: [] } },
    })

    await completarTarifaDaVenda(SUPABASE, PEDIDO, 'teste')

    const linha = registrarLancamento.mock.calls[0][1] as { referencia: string }
    expect(linha.referencia).toBe('reconciliacao:tarifa:pi_123')
  })

  it('devolve false e não escreve quando a tarifa continua indisponível', async () => {
    // O caso que motivou tudo: a `balance_transaction` ainda não alcançável.
    // Sem linha inventada, e a lacuna segue declarada no log.
    retrieve.mockResolvedValue({ latest_charge: { balance_transaction: null } })

    expect(await completarTarifaDaVenda(SUPABASE, PEDIDO, 'teste')).toBe(false)
    expect(registrarLancamento).not.toHaveBeenCalled()
    expect(motivoDaLacuna()).toBe('cobrança sem balance_transaction')
  })

  it('na venda do consultor, a tarifa sai do consultor', async () => {
    retrieve.mockResolvedValue({
      latest_charge: { balance_transaction: { fee: 43, fee_details: [] } },
    })

    await completarTarifaDaVenda(SUPABASE, { ...PEDIDO, vendedor: 'consultor', contaConectada: 'acct_1' }, 'teste')

    const linha = registrarLancamento.mock.calls[0][1] as { pagador: string }
    expect(linha.pagador).toBe('consultor')
    // E a consulta vai para a conta conectada, que é onde o dinheiro caiu.
    expect(retrieve.mock.calls[0][2]).toEqual({ stripeAccount: 'acct_1' })
  })
})
