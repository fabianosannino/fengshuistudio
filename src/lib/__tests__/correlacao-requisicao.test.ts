// @vitest-environment node
import { expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
import { comCorrelacao } from '../correlacao-requisicao'

it('correlaciona a resposta sem aceitar identificador fornecido pelo cliente', async () => {
  const registrados: string[] = []
  const handler = comCorrelacao(async (_request, id) => {
    registrados.push(id)
    return Response.json({ error: 'Indisponível' }, { status: 503, headers: { 'Retry-After': '30' } })
  })
  const request = new Request('https://example.invalid', { headers: { 'X-Request-ID': 'nome@example.invalid' } })
  const responses = await Promise.all([handler(request), handler(request)])
  expect(registrados[0]).toMatch(/^[0-9a-f-]{36}$/)
  expect(registrados[1]).not.toBe(registrados[0])
  expect(responses[0].headers.get('X-Request-ID')).toBe(registrados[0])
  expect(responses[0].headers.get('Retry-After')).toBe('30')
  expect(responses[0].status).toBe(503)
  expect(await responses[0].json()).toEqual({ error: 'Indisponível' })
})
