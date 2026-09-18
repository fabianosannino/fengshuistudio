import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { rateLimit, ipDaRequisicao } from '../rate-limit'
import { SCRIPT_RATE_LIMIT } from '../rate-limit-script'

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

    vi.advanceTimersByTime(10_000)
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
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('conta no Redis quando configurado', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({ result: [3, 50_000] }),
      { status: 200 }
    )))

    expect(await rateLimit('redis-1', { limit: 5 })).toEqual({
      success: true, remaining: 2, compartilhado: true,
    })
  })

  it('bloqueia quando o contador do Redis passa do limite', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({ result: [11, 50_000] }),
      { status: 200 }
    )))

    expect(await rateLimit('redis-2', { limit: 10 })).toMatchObject({ success: false, compartilhado: true })
  })

  it('envia um comando atômico com chave pseudônima e prazo', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ result: [1, 60_000] }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await rateLimit('redis-3', { limit: 5, windowMs: 60_000 })

    const corpo = JSON.parse(fetchMock.mock.calls[0][1]!.body as string)
    expect(corpo).toEqual(['EVAL', SCRIPT_RATE_LIMIT, 1, expect.stringMatching(/^fss:ratelimit:v2:[a-f0-9]{64}$/), 60_000])
    expect(corpo[3]).not.toContain('redis-3')
  })

  it('degrada para a memória quando o Redis falha — não deixa a rota sem limite', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('ECONNREFUSED') }))

    const resultado = await rateLimit('redis-4', { limit: 2 })
    expect(resultado).toMatchObject({ success: true, compartilhado: false })
  })

  it.each([{ result: [1, -1] }, { result: [1.5, 100] }, { result: [1] }, { result: [1, 100], error: 'synthetic' }, { result: [0, 100] }])('recusa resposta inválida em operação crítica: %j', async body => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(body))))
    expect(await rateLimit('critico', { exigirCompartilhado: true })).toMatchObject({ success: false, indisponivel: true, compartilhado: false })
  })

  it('não degrada escrita crítica em produção quando Redis está indisponível', async () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('upstream private metadata')))
    expect(await rateLimit('critico-falha', { exigirCompartilhado: true })).toMatchObject({ success: false, indisponivel: true })
    expect(JSON.stringify(warning.mock.calls)).not.toMatch(/private metadata|critico-falha|token-de-teste/)
  })

  it('não mistura GET/POST nem operações diferentes do mesmo IP', async () => {
    vi.stubEnv('UPSTASH_REDIS_REST_URL', '')
    const a = { limit: 1, escopo: 'POST:/api/planos' }
    expect((await rateLimit('same-ip', a)).success).toBe(true)
    expect((await rateLimit('same-ip', a)).success).toBe(false)
    expect((await rateLimit('same-ip', { ...a, escopo: 'GET:/api/planos' })).success).toBe(true)
    expect((await rateLimit('same-ip', { ...a, escopo: 'POST:/api/clientes' })).success).toBe(true)
  })

  it('ausência de configuração em produção é indisponibilidade em operação crítica', async () => {
    vi.stubEnv('NODE_ENV', 'production'); vi.stubEnv('UPSTASH_REDIS_REST_URL', '')
    expect(await rateLimit('sem-config', { exigirCompartilhado: true })).toMatchObject({ success: false, indisponivel: true })
  })

  it('desenvolvimento permite o fallback declarado sem exigir credenciais reais', async () => {
    vi.stubEnv('NODE_ENV', 'development'); vi.stubEnv('UPSTASH_REDIS_REST_URL', '')
    expect(await rateLimit('local-fixture', { exigirCompartilhado: true })).toMatchObject({ success: true, compartilhado: false })
  })

  it.each([{ limit: 0 }, { limit: -1 }, { limit: 1.5 }, { windowMs: 0 }, { windowMs: Infinity }])('rejeita configuração inválida %j', async opcoes => {
    await expect(rateLimit('config', opcoes)).rejects.toThrow('Configuração')
  })
})

describe('rateLimit — pressão sobre memória', () => {
  it('recusa novas identidades sem devolver cota a contadores vivos e recupera após expiração', async () => {
    vi.resetModules()
    vi.useFakeTimers()
    vi.stubEnv('UPSTASH_REDIS_REST_URL', '')
    try {
      const { rateLimit: isolado } = await import('../rate-limit')
      const opcoes = { limit: 1, windowMs: 1_000 }
      for (let i = 0; i < 10_000; i++) expect((await isolado(`fixture-${i}`, opcoes)).success).toBe(true)
      expect(await isolado('excedente', opcoes)).toMatchObject({ success: false, indisponivel: true })
      expect(await isolado('fixture-0', opcoes)).toMatchObject({ success: false, remaining: 0 })
      vi.advanceTimersByTime(1_000)
      expect((await isolado('excedente', opcoes)).success).toBe(true)
    } finally {
      vi.useRealTimers()
      vi.unstubAllEnvs()
    }
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
