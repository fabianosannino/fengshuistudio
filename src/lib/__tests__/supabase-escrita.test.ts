import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { escreverOuFalhar, escreverBestEffort, ErroDeEscrita } from '../supabase-escrita'

const CONTEXTO = { rota: '/api/teste', operacao: 'update-plano' }

/**
 * Reproduz o comportamento real do client: a promise **resolve** com
 * `{ data, error }` mesmo quando o banco recusa. Nenhum destes casos rejeita —
 * é exatamente essa a armadilha que os helpers existem para fechar.
 */
function respostaDoSupabase<T>(resposta: { data: T; error: { message: string } | null }) {
  return Promise.resolve(resposta)
}

describe('escreverOuFalhar', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('devolve o dado quando a escrita passa', async () => {
    const dado = await escreverOuFalhar(
      respostaDoSupabase({ data: [{ id: 'abc' }], error: null }),
      CONTEXTO
    )
    expect(dado).toEqual([{ id: 'abc' }])
  })

  it('lança quando o banco recusa — a promise resolvida não engole mais a falha', async () => {
    await expect(
      escreverOuFalhar(
        respostaDoSupabase({ data: null, error: { message: 'new row violates row-level security policy' } }),
        CONTEXTO
      )
    ).rejects.toBeInstanceOf(ErroDeEscrita)
  })

  it('não vaza o detalhe do banco na mensagem — ele fica em `detalhe` e no log', async () => {
    // ADR 0019: resposta genérica ao cliente, detalhe só no servidor. A mensagem
    // pode subir até um catch de rota que a devolva no body.
    const detalheDoBanco = 'duplicate key value violates unique constraint "subscriptions_pkey"'
    let erro!: ErroDeEscrita
    try {
      await escreverOuFalhar(
        respostaDoSupabase({ data: null, error: { message: detalheDoBanco } }),
        CONTEXTO
      )
    } catch (e) {
      erro = e as ErroDeEscrita
    }

    expect(erro.message).not.toContain(detalheDoBanco)
    expect(erro.message).toContain('update-plano')
    expect(erro.detalhe).toBe(detalheDoBanco)
    expect(erro.contexto.rota).toBe('/api/teste')
  })

  it('registra a falha no logger antes de lançar', async () => {
    const spy = vi.spyOn(console, 'error')
    await escreverOuFalhar(
      respostaDoSupabase({ data: null, error: { message: 'permission denied' } }),
      { ...CONTEXTO, userId: 'user-1' }
    ).catch(() => {})

    expect(spy).toHaveBeenCalledOnce()
    const registro = JSON.parse(spy.mock.calls[0][0] as string)
    expect(registro.level).toBe('error')
    expect(registro.route).toBe('/api/teste')
    expect(registro.action).toBe('update-plano')
    expect(registro.userId).toBe('user-1')
    expect(registro.error).toBe('permission denied')
  })

  it('um try/catch em volta da query crua não capturaria nada — por isso o helper existe', async () => {
    let capturou = false
    try {
      await respostaDoSupabase({ data: null, error: { message: 'permission denied' } })
    } catch {
      capturou = true
    }
    expect(capturou).toBe(false)
  })
})

describe('escreverBestEffort', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('devolve true no sucesso', async () => {
    expect(await escreverBestEffort(respostaDoSupabase({ data: null, error: null }), CONTEXTO)).toBe(true)
  })

  it('devolve false e registra em vez de lançar', async () => {
    const spy = vi.spyOn(console, 'warn')
    const ok = await escreverBestEffort(
      respostaDoSupabase({ data: null, error: { message: 'relation "admin_audit_log" does not exist' } }),
      CONTEXTO
    )

    expect(ok).toBe(false)
    expect(spy).toHaveBeenCalledOnce()
    expect(JSON.parse(spy.mock.calls[0][0] as string).level).toBe('warn')
  })
})
