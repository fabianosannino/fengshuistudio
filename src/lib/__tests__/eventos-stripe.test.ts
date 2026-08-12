import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  reivindicarEvento, houveEventoMaisNovo, objetoDoEvento,
} from '../eventos-stripe'

vi.mock('../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

const EVENTO = {
  id: 'evt_1',
  type: 'customer.subscription.updated',
  created: 1_786_556_000,
  endpoint: '/api/stripe/webhooks/subscriptions',
  objetoId: 'sub_1',
}

/** Duplo do client: só o que estas funções usam. */
function supabaseFalso(opcoes: {
  erroDoInsert?: { code: string; message: string } | null
  linhaExistente?: { processado_em: string | null } | null
  erroDaLeitura?: { message: string } | null
  maisNovos?: { event_id: string }[]
  erroDaOrdem?: { message: string } | null
}) {
  return {
    from() {
      return {
        insert: async () => ({ error: opcoes.erroDoInsert ?? null }),
        select() {
          const encadeavel = {
            eq: () => encadeavel,
            not: () => encadeavel,
            gt: () => encadeavel,
            limit: async () => ({ data: opcoes.maisNovos ?? [], error: opcoes.erroDaOrdem ?? null }),
            single: async () => ({
              data: opcoes.linhaExistente ?? null,
              error: opcoes.erroDaLeitura ?? null,
            }),
          }
          return encadeavel
        },
      }
    },
  } as unknown as SupabaseClient
}

describe('reivindicarEvento', () => {
  it('evento inédito é reivindicado', async () => {
    const r = await reivindicarEvento(supabaseFalso({}), EVENTO)
    expect(r.situacao).toBe('reivindicado')
  })

  it('evento já concluído é repetido — descartar', async () => {
    // O Stripe reentrega quando o endpoint demora ou responde erro. Sem isto,
    // um `charge.refunded` reentregue estornaria a comissão duas vezes.
    const r = await reivindicarEvento(supabaseFalso({
      erroDoInsert: { code: '23505', message: 'duplicate key' },
      linhaExistente: { processado_em: '2026-08-12T20:00:00Z' },
    }), EVENTO)
    expect(r.situacao).toBe('repetido')
  })

  it('reivindicação sem conclusão é retomada, não descartada', async () => {
    // Uma tentativa anterior morreu no meio. Descartar aqui perderia o evento
    // para sempre — é por isso que `processado_em` é data, não booleano.
    const r = await reivindicarEvento(supabaseFalso({
      erroDoInsert: { code: '23505', message: 'duplicate key' },
      linhaExistente: { processado_em: null },
    }), EVENTO)
    expect(r.situacao).toBe('retomado')
  })

  it('falha de banco não bloqueia o evento — segue sem garantia', async () => {
    // Recusar por causa da tabela de controle trocaria um risco pequeno
    // (processar duas vezes) por um grande (perder o evento).
    const r = await reivindicarEvento(supabaseFalso({
      erroDoInsert: { code: '08006', message: 'connection failure' },
    }), EVENTO)
    expect(r.situacao).toBe('sem_garantia')
  })

  it('conflito que não dá para reler também segue', async () => {
    const r = await reivindicarEvento(supabaseFalso({
      erroDoInsert: { code: '23505', message: 'duplicate key' },
      erroDaLeitura: { message: 'timeout' },
    }), EVENTO)
    expect(r.situacao).toBe('sem_garantia')
  })
})

describe('houveEventoMaisNovo', () => {
  it('acusa quando já houve evento posterior sobre o mesmo objeto', async () => {
    // Sem isto, um `updated` de dez minutos atrás reentregue agora
    // sobrescreveria o cancelamento que veio depois.
    const r = await houveEventoMaisNovo(
      supabaseFalso({ maisNovos: [{ event_id: 'evt_2' }] }), 'sub_1', EVENTO.created, 'evt_1')
    expect(r).toBe(true)
  })

  it('nada posterior significa em ordem', async () => {
    const r = await houveEventoMaisNovo(
      supabaseFalso({ maisNovos: [] }), 'sub_1', EVENTO.created, 'evt_1')
    expect(r).toBe(false)
  })

  it('falha de consulta não descarta o evento', async () => {
    // Entre não aplicar um evento legítimo e aplicar um antigo, o primeiro
    // erro é o mais caro.
    const r = await houveEventoMaisNovo(
      supabaseFalso({ erroDaOrdem: { message: 'timeout' } }), 'sub_1', EVENTO.created, 'evt_1')
    expect(r).toBe(false)
  })
})

describe('objetoDoEvento', () => {
  it('extrai o id do objeto', () => {
    expect(objetoDoEvento({ data: { object: { id: 'sub_123' } } })).toBe('sub_123')
  })

  it('objeto sem id devolve null — ausência não é ordem', () => {
    for (const evento of [
      {}, { data: {} }, { data: { object: null } },
      { data: { object: {} } }, { data: { object: { id: '' } } },
      { data: { object: { id: 42 } } },
    ]) {
      expect(objetoDoEvento(evento as { data?: { object?: unknown } })).toBeNull()
    }
  })
})
