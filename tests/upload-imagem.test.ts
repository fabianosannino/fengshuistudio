// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import sharp from 'sharp'
vi.mock('server-only', () => ({}))
import { lerFormularioDeImagem, normalizarImagem } from '../src/lib/upload-imagem'
import { MAX_BYTES_FORMULARIO_IMAGEM, MAX_BYTES_IMAGEM } from '../src/lib/upload-imagem-limites'

const arquivo = (bytes: Buffer, type: string) => new File([Uint8Array.from(bytes)], 'nome-nao-confiavel.svg', { type })
const imagem = () => sharp({ create: { width: 4, height: 2, channels: 4, background: { r: 20, g: 80, b: 110, alpha: 0.5 } } })

describe('decoder real e privacidade das imagens', () => {
  it.each(['jpeg', 'png', 'webp'] as const)('normaliza %s sem confiar na extensão', async formato => {
    const resultado = await normalizarImagem(arquivo(await imagem().toFormat(formato).toBuffer(), `image/${formato}`))
    expect(resultado.mime).toBe(`image/${formato}`)
    expect((await sharp(resultado.bytes).metadata()).format).toBe(formato)
  })
  it('orienta os pixels e remove EXIF, GPS, XMP e ICC', async () => {
    const bytes = await imagem().jpeg().withMetadata({ orientation: 6 })
      .withExifMerge({ IFD3: { GPSLatitudeRef: 'N', GPSLatitude: '1/1 2/1 3/1' } })
      .withXmp('<x:xmpmeta xmlns:x="adobe:ns:meta/">fixture-private</x:xmpmeta>').toBuffer()
    expect((await sharp(bytes).metadata()).exif).toBeDefined()
    const resultado = await normalizarImagem(arquivo(bytes, 'image/jpeg'))
    const meta = await sharp(resultado.bytes).metadata()
    expect([meta.width, meta.height]).toEqual([2, 4])
    expect(meta.exif).toBeUndefined(); expect(meta.xmp).toBeUndefined(); expect(meta.icc).toBeUndefined()
    expect(resultado.bytes.includes(Buffer.from('fixture-private'))).toBe(false)
  })
  it('preserva transparência e pixels PNG sem redimensionar a planta', async () => {
    const bytes = await imagem().png().toBuffer()
    const resultado = await normalizarImagem(arquivo(bytes, 'image/png'))
    expect(await sharp(resultado.bytes).raw().toBuffer()).toEqual(await sharp(bytes).raw().toBuffer())
  })
  it.each([null, 'arquivo', 3, new File([], 'vazio.png', { type: 'image/png' })])('rejeita entrada vazia ou sem capacidades de arquivo (%s)', async entrada => {
    await expect(normalizarImagem(entrada)).rejects.toMatchObject({ status: 400 })
  })
  it.each(['<svg><script>alert(1)</script></svg>', '<html>fixture</html>', '%PDF-1.7'])('não entrega outro formato ao decoder: %s', async conteudo => {
    await expect(normalizarImagem(arquivo(Buffer.from(conteudo), 'image/png'))).rejects.toMatchObject({ status: 400 })
  })
  it('rejeita MIME falso e dados truncados apesar de assinatura válida', async () => {
    const png = await imagem().png().toBuffer()
    await expect(normalizarImagem(arquivo(png, 'image/jpeg'))).rejects.toMatchObject({ status: 400 })
    await expect(normalizarImagem(arquivo(png.subarray(0, 40), 'image/png'))).rejects.toMatchObject({ status: 400 })
  })
  it('recusa dimensões excessivas e animação WebP no decoder real', async () => {
    const grande = await sharp({ create: { width: 9000, height: 1, channels: 3, background: 'white' } }).png().toBuffer()
    await expect(normalizarImagem(arquivo(grande, 'image/png'))).rejects.toMatchObject({ status: 400 })
    const vermelho = await sharp({ create: { width: 2, height: 2, channels: 3, background: 'red' } }).png().toBuffer()
    const azul = await sharp({ create: { width: 2, height: 2, channels: 3, background: 'blue' } }).png().toBuffer()
    const animada = await sharp([vermelho, azul], { join: { animated: true } }).webp({ loop: 0 }).toBuffer()
    expect((await sharp(animada).metadata()).pages).toBe(2)
    await expect(normalizarImagem(arquivo(animada, 'image/webp'))).rejects.toMatchObject({ status: 400 })
  })
  it('rejeita APNG pelo chunk acTL antes da decodificação', async () => {
    const png = await imagem().png().toBuffer()
    const chunk = Buffer.alloc(20); chunk.writeUInt32BE(8); chunk.write('acTL', 4)
    await expect(normalizarImagem(arquivo(Buffer.concat([png.subarray(0, 33), chunk, png.subarray(33)]), 'image/png'))).rejects.toMatchObject({ status: 400 })
  })
  it('limita os bytes antes de ler o arquivo', async () => {
    const arrayBuffer = vi.fn()
    await expect(normalizarImagem({ type: 'image/png', size: MAX_BYTES_IMAGEM + 1, arrayBuffer })).rejects.toMatchObject({ status: 413 })
    expect(arrayBuffer).not.toHaveBeenCalled()
  })
})

describe('multipart limitado', () => {
  it('lê formulário real sem Content-Length', async () => {
    const form = new FormData(); form.set('foto', arquivo(await imagem().png().toBuffer(), 'image/png'))
    const resultado = await lerFormularioDeImagem(new Request('https://example.invalid', { method: 'POST', body: form }))
    expect((resultado.get('foto') as File).type).toBe('image/png')
  })
  it.each([undefined, '1'])('limita stream mesmo com Content-Length %s', async length => {
    const cancel = vi.fn()
    const headers: Record<string, string> = { 'content-type': 'multipart/form-data; boundary=x' }
    if (length) headers['content-length'] = length
    const body = new ReadableStream({ start(c) { c.enqueue(new Uint8Array(MAX_BYTES_FORMULARIO_IMAGEM + 1)) }, cancel })
    const request = new Request('https://example.invalid', { method: 'POST', headers, body, duplex: 'half' } as RequestInit)
    await expect(lerFormularioDeImagem(request)).rejects.toMatchObject({ status: 413 })
    expect(cancel).toHaveBeenCalledOnce()
  })
  it('rejeita multipart quebrado e tipos diferentes', async () => {
    for (const type of ['application/json', 'multipart/form-data; boundary=x']) {
      await expect(lerFormularioDeImagem(new Request('https://example.invalid', { method: 'POST', headers: { 'content-type': type }, body: '{}' }))).rejects.toMatchObject({ status: 400 })
    }
  })
})
