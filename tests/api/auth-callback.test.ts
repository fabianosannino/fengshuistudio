// @vitest-environment node
/**
 * Testes da rota /auth/callback (troca do código PKCE por sessão).
 *
 * Invariantes cobertos:
 *  - o código recebido é trocado por sessão (sem isso, nenhum link de e-mail
 *    autentica: era exatamente a causa da recuperação de senha quebrada);
 *  - `next` é validado contra open redirect;
 *  - falha na troca não vaza detalhe do erro na URL de destino.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const exchangeCodeForSession = vi.fn()
vi.mock('../../src/lib/supabase-route', () => ({
  createRouteHandlerClient: async () => ({
    auth: { exchangeCodeForSession: (...a: unknown[]) => exchangeCodeForSession(...a) },
  }),
}))

vi.mock('../../src/lib/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}))

import { GET } from '../../app/auth/callback/route'

const ORIGEM = 'https://app.test.local'

function req(query: string): NextRequest {
  return new NextRequest(`${ORIGEM}/auth/callback${query}`)
}

function destino(res: Response): URL {
  return new URL(res.headers.get('location')!)
}

beforeEach(() => {
  vi.clearAllMocks()
  exchangeCodeForSession.mockResolvedValue({ error: null })
})

describe('GET /auth/callback', () => {
  it('troca o código por sessão e leva ao destino pedido', async () => {
    const res = await GET(req('?code=abc123&next=%2Fredefinir-senha'))

    expect(exchangeCodeForSession).toHaveBeenCalledWith('abc123')
    expect(res.status).toBe(307)
    expect(destino(res).pathname).toBe('/redefinir-senha')
  })

  it('sem código, não tenta trocar nada e volta ao login', async () => {
    const res = await GET(req(''))

    expect(exchangeCodeForSession).not.toHaveBeenCalled()
    expect(destino(res).pathname).toBe('/login')
  })

  it('cai no login quando `next` aponta para fora da aplicação', async () => {
    const res = await GET(req('?code=abc123&next=https%3A%2F%2Fevil.example.com'))

    expect(destino(res).origin).toBe(ORIGEM)
    expect(destino(res).pathname).toBe('/login')
  })

  it('cai no login quando `next` usa barra dupla (open redirect)', async () => {
    const res = await GET(req('?code=abc123&next=%2F%2Fevil.example.com'))

    expect(destino(res).origin).toBe(ORIGEM)
    expect(destino(res).pathname).toBe('/login')
  })

  it('falha na troca leva ao destino sem expor o erro na URL', async () => {
    exchangeCodeForSession.mockResolvedValue({ error: { message: 'code verifier ausente' } })

    const res = await GET(req('?code=expirado&next=%2Fredefinir-senha'))
    const url = destino(res)

    expect(url.pathname).toBe('/redefinir-senha')
    expect(url.search).toBe('')
    expect(res.headers.get('location')).not.toContain('verifier')
  })
})
