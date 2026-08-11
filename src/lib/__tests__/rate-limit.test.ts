import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { rateLimit, ipDaRequisicao } from '../rate-limit'

/**
 * Consolida os dois arquivos que existiam para este módulo (`tests/` e
 * `src/lib/__tests__/`) e que já haviam divergido — duas fontes de verdade para
 * o mesmo comportamento, apontadas na auditoria de 2026-07-18 (R4).
 *
 * O store em memória é de módulo, então cada teste usa uma chave própria em vez
 * de tentar zerá-lo entre casos.
 */

function requisicaoCom(headers: Record<string, string>): Request {
  return new Request('https://exemplo.test/api/qualquer', { headers })
}

describe('rateLimit — contagem', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllEnvs()
  })

  it('libera abaixo do limite e decrementa o restante', async () => {
    const r1 = await rateLimit('conta-1', { limit: 3, windowMs: 60_000 })
    expect(r1).toMatchObject({ success: true, remaining: 2 })

    const r2 = await rateLimit('conta-1', { limit: 3, windowMs: 60_000 })
    expect(r2).toMatchObject({ success: true, remaining: 1 })
  })

  it('bloqueia acima do limite', async () => {
    const opcoes = { limit: 2, windowMs: 60_000 }
    await rateLimit('conta-2', opcoes)
    await rateLimit('conta-2', opcoes)
    expect(await rateLimit('conta-2', opcoes)).toMatchObject({ success: false, remaining: 0 })
  })

  it('isola chaves diferentes', async () => {
    const opcoes = { limit: 1, windowMs: 60_000 }
    await rateLimit('conta-3a', opcoes)
    expect((await rateLimit('conta-3b', opcoes)).success).toBe(true)
    expect((await rateLimit('conta-3a', opcoes)).success).toBe(false)
  })

  it('reabre a cota quando a janela expira', async () => {
    const opcoes = { limit: 1, windowMs: 10_000 }
    await rateLimit('conta-4', opcoes)
    expect((await rateLimit('conta-4', opcoes)).success).toBe(false)

    vi.advanceTimersByTime(11_000)
    expect((await rateLimit('conta-4', opcoes)).success).toBe(true)
  })

  it('usa limite 30 e janela de 60s por padrão', async () => {
    expect(await rateLimit('conta-5')).toMatchObject({ success: true, remaining: 29 })
  })

  it('declara que a contagem é local quando não há store compartilhado', async () => {
    // Em serverless isto significa "limite × número de instâncias". O campo
    // existe para que a limitação seja visível, não presumida.
    expect((await rateLimit('conta-6')).compartilhado).toBe(false)
  })
})

describe('rateLimit — store compartilhado', () => {
  beforeEach(() => {
    vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://redis.exemplo.test')
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'token-de-teste')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('conta no Redis quando configurado', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify([{ result: 3 }, { result: 1 }]),
      { status: 200 }
    )))

    expect(await rateLimit('redis-1', { limit: 5 })).toEqual({
      success: true, remaining: 2, compartilhado: true,
    })
  })

  it('bloqueia quando o contador do Redis passa do limite', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify([{ result: 11 }, { result: 0 }]),
      { status: 200 }
    )))

    expect(await rateLimit('redis-2', { limit: 10 })).toMatchObject({ success: false, compartilhado: true })
  })

  it('fixa a expiração só na criação da chave (EXPIRE ... NX)', async () => {
    // Sem o NX, cada requisição empurraria a janela para frente e uma rajada
    // contínua nunca resetaria o contador — janela fixa virando janela infinita.
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) =>
      new Response(JSON.stringify([{ result: 1 }, { result: 1 }]), { status: 200 })
    )
    vi.stubGlobal('fetch', fetchMock)

    await rateLimit('redis-3', { limit: 5, windowMs: 60_000 })

    const corpo = JSON.parse(fetchMock.mock.calls[0][1].body as string)
    expect(corpo[0]).toEqual(['INCR', 'ratelimit:redis-3:60000'])
    expect(corpo[1]).toEqual(['EXPIRE', 'ratelimit:redis-3:60000', '60', 'NX'])
  })

  it('degrada para a memória quando o Redis falha — não deixa a rota sem limite', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('ECONNREFUSED') }))

    const resultado = await rateLimit('redis-4', { limit: 2 })
    expect(resultado).toMatchObject({ success: true, compartilhado: false })
  })
})

describe('ipDaRequisicao', () => {
  it('prefere x-real-ip, que a plataforma sobrescreve', () => {
    expect(ipDaRequisicao(requisicaoCom({
      'x-real-ip': '203.0.113.7',
      'x-forwarded-for': '1.1.1.1',
    }))).toBe('203.0.113.7')
  })

  it('ignora o IP forjado à esquerda do x-forwarded-for', () => {
    // Era exatamente o furo do A4: `split(',')[0]` lia a ponta que o cliente
    // escreve, então bastava variar o header para ganhar cota nova.
    expect(ipDaRequisicao(requisicaoCom({
      'x-forwarded-for': '9.9.9.9, 203.0.113.7',
    }))).toBe('203.0.113.7')
  })

  it('usa o único valor quando o proxy sobrescreve o header inteiro', () => {
    expect(ipDaRequisicao(requisicaoCom({ 'x-forwarded-for': '203.0.113.7' }))).toBe('203.0.113.7')
  })

  it('não estoura quando não há header nenhum', () => {
    expect(ipDaRequisicao(requisicaoCom({}))).toBe('desconhecido')
  })
})
