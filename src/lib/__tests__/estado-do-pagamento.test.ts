import { describe, expect, it } from 'vitest'
import {
  estadoDoPagamento, totaisFinanceiros, diasDeAtraso, reguaDaParcela,
} from '../estado-do-pagamento'

const HOJE = '2026-08-12'

describe('estadoDoPagamento', () => {
  it('«atrasado» vem da data, não do status gravado', () => {
    // Nada roda um job diário virando 'pendente' em 'atrasado'. A tela mostrava
    // «Pendente» numa parcela vencida há três semanas.
    expect(estadoDoPagamento({ status: 'pendente', data_vencimento: '2026-07-20' }, HOJE)).toBe('atrasado')
  })

  it('status «atrasado» gravado numa parcela futura não vale', () => {
    // O contrário também acontece: alguém marcou atrasado e depois renegociou
    // a data. Quem sabe é a data.
    expect(estadoDoPagamento({ status: 'atrasado', data_vencimento: '2026-09-30' }, HOJE)).toBe('a_vencer')
  })

  it('pago e cancelado vêm do status — são fatos que alguém registrou', () => {
    expect(estadoDoPagamento({ status: 'pago', data_vencimento: '2026-01-01' }, HOJE)).toBe('pago')
    expect(estadoDoPagamento({ status: 'cancelado', data_vencimento: '2026-01-01' }, HOJE)).toBe('cancelado')
  })

  it('vencer hoje não é estar vencido', () => {
    expect(estadoDoPagamento({ status: 'pendente', data_vencimento: HOJE }, HOJE)).toBe('vence_hoje')
  })

  it('sem data de vencimento não há atraso a afirmar', () => {
    // Afirmar atraso sem data seria cobrar por um prazo inventado.
    expect(estadoDoPagamento({ status: 'pendente', data_vencimento: null }, HOJE)).toBe('a_vencer')
    expect(estadoDoPagamento({ status: 'pendente' }, HOJE)).toBe('a_vencer')
  })
})

describe('totaisFinanceiros', () => {
  it('cada parcela cai em exatamente um balde', () => {
    // Era o defeito: a soma de pendentes incluía todo `status = 'pendente'`, e
    // a de atrasados somava por cima os pendentes com data vencida.
    const t = totaisFinanceiros([
      { status: 'pago', valor: 1000, data_vencimento: '2026-06-01' },
      { status: 'pendente', valor: 950, data_vencimento: '2026-07-20' }, // vencida
      { status: 'pendente', valor: 500, data_vencimento: '2026-09-10' },
    ], HOJE)

    expect(t).toEqual({ recebido: 1000, aReceber: 500, vencido: 950, contratado: 2450 })
    expect(t.recebido + t.aReceber + t.vencido).toBe(t.contratado)
  })

  it('cancelado sai do contratado', () => {
    const t = totaisFinanceiros([
      { status: 'cancelado', valor: 700, data_vencimento: '2026-07-01' },
      { status: 'pendente', valor: 300, data_vencimento: '2026-09-01' },
    ], HOJE)
    expect(t.contratado).toBe(300)
  })

  it('valor ilegível é ignorado, não vira zero silencioso no meio da soma', () => {
    const t = totaisFinanceiros([
      { status: 'pendente', valor: 'não é número', data_vencimento: '2026-09-01' },
      { status: 'pendente', valor: '250.50', data_vencimento: '2026-09-01' },
    ], HOJE)
    expect(t.aReceber).toBe(250.5)
  })

  it('lista vazia dá zeros coerentes', () => {
    expect(totaisFinanceiros([], HOJE)).toEqual({ recebido: 0, aReceber: 0, vencido: 0, contratado: 0 })
  })
})

describe('diasDeAtraso', () => {
  it('conta os dias desde o vencimento', () => {
    expect(diasDeAtraso({ status: 'pendente', data_vencimento: '2026-08-11' }, HOJE)).toBe(1)
    expect(diasDeAtraso({ status: 'pendente', data_vencimento: '2026-07-13' }, HOJE)).toBe(30)
  })

  it('parcela em dia não tem atraso', () => {
    expect(diasDeAtraso({ status: 'pendente', data_vencimento: '2026-09-01' }, HOJE)).toBe(0)
    expect(diasDeAtraso({ status: 'pago', data_vencimento: '2026-01-01' }, HOJE)).toBe(0)
  })
})

describe('reguaDaParcela', () => {
  it('três marcos, não cinco — «enviado» e «aberto» ainda não são conhecidos', () => {
    // Desenhá-los apagados sugeriria que o produto sabe se o cliente abriu a
    // cobrança, e ele não sabe.
    expect(reguaDaParcela({ status: 'pendente', data_vencimento: '2026-09-01' }, HOJE)).toHaveLength(3)
  })

  it('parcela paga tem os três cumpridos', () => {
    const regua = reguaDaParcela({ status: 'pago', data_vencimento: '2026-06-01' }, HOJE)
    expect(regua.every(m => m.cumprido)).toBe(true)
  })

  it('parcela vencida marca «Recebida» como a etapa atual', () => {
    const regua = reguaDaParcela({ status: 'pendente', data_vencimento: '2026-07-01' }, HOJE)
    expect(regua[1].rotulo).toBe('Vencida')
    expect(regua[2].atual).toBe(true)
    expect(regua[2].cumprido).toBe(false)
  })
})
