// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
import { lerFormularioLimitado } from '../src/lib/multipart-limitado'

function streamRequest(chunks: Uint8Array[], length?: string, cancel = vi.fn()) {
  let index = 0
  const headers = new Headers({ 'content-type': 'multipart/form-data; boundary=fixture' })
  if (length !== undefined) headers.set('content-length', length)
  const body = new ReadableStream({
    pull(controller) {
      if (index === chunks.length) controller.close()
      else controller.enqueue(chunks[index++])
    }, cancel,
  }, { highWaterMark: 0 })
  return new Request('https://example.invalid', { method: 'POST', headers, body, duplex: 'half' } as RequestInit)
}

describe('limite do corpo antes do parser multipart', () => {
  it('aceita exatamente o limite com muitos fragmentos e preserva os bytes', async () => {
    const bytes = Buffer.from('--fixture\r\nContent-Disposition: form-data; name="campo"\r\n\r\nvalor\r\n--fixture--\r\n')
    const request = streamRequest([...bytes].map(byte => Uint8Array.of(byte)))
    expect((await lerFormularioLimitado(request, bytes.length)).get('campo')).toBe('valor')
  })
  it.each([undefined, '1', '-1', 'invalido'])('não confia em Content-Length=%s', async length => {
    const cancel = vi.fn()
    const request = streamRequest([new Uint8Array(10), new Uint8Array(11), new Uint8Array(100)], length, cancel)
    await expect(lerFormularioLimitado(request, 20)).rejects.toMatchObject({ status: 413 })
    expect(cancel).toHaveBeenCalledOnce()
    expect(request.body?.locked).toBe(false)
  })
  it('recusa tamanho declarado excessivo sem ler o stream', async () => {
    const pull = vi.fn(), cancel = vi.fn()
    const body = new ReadableStream({ pull, cancel }, { highWaterMark: 0 })
    const request = new Request('https://example.invalid', { method: 'POST', headers: {
      'content-type': 'multipart/form-data; boundary=fixture', 'content-length': '21',
    }, body, duplex: 'half' } as RequestInit)
    await expect(lerFormularioLimitado(request, 20)).rejects.toMatchObject({ status: 413 })
    expect(pull).not.toHaveBeenCalled(); expect(cancel).toHaveBeenCalledOnce()
  })
  it('mantém 413 se o cancelamento do transporte falha', async () => {
    const cancel = vi.fn().mockRejectedValue(new Error('private transport detail'))
    await expect(lerFormularioLimitado(streamRequest([new Uint8Array(21)], undefined, cancel), 20))
      .rejects.toMatchObject({ status: 413, message: 'Envio acima do limite permitido.' })
  })
  it('não propaga dados do transporte nem aceita multipart truncado', async () => {
    const body = new ReadableStream({ start(controller) { controller.error(new Error('private detail')) } })
    const request = new Request('https://example.invalid', { method: 'POST', headers: {
      'content-type': 'multipart/form-data; boundary=fixture',
    }, body, duplex: 'half' } as RequestInit)
    await expect(lerFormularioLimitado(request, 100)).rejects.toMatchObject({ status: 400, message: 'Não foi possível ler o envio.' })
    await expect(lerFormularioLimitado(streamRequest([Buffer.from('--fixture\r\n')]), 100)).rejects.toMatchObject({ status: 400 })
  })
})
