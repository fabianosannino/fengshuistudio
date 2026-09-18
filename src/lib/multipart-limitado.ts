import 'server-only'

/** Espaço para os campos e cabeçalhos, além do limite do arquivo. */
export const MARGEM_MULTIPART = 64 * 1024

export class ErroDeFormulario extends Error {
  constructor(message: string, readonly status: 400 | 413 = 400) { super(message) }
}

/** Limita o corpo inteiro antes do parser, inclusive sem Content-Length confiável. */
export async function lerFormularioLimitado(request: Request, maxBytes: number): Promise<FormData> {
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) throw new Error('Limite de formulário inválido.')
  const tipo = request.headers.get('content-type') ?? ''
  if (!tipo.toLowerCase().startsWith('multipart/form-data;') || !request.body) {
    throw new ErroDeFormulario('Envio inválido.')
  }
  if (Number(request.headers.get('content-length')) > maxBytes) {
    await request.body.cancel().catch(() => {})
    throw new ErroDeFormulario('Envio acima do limite permitido.', 413)
  }
  const reader = request.body.getReader()
  // Um único buffer também limita a memória quando o stream entrega milhões
  // de fragmentos pequenos. Não manter um objeto por fragmento recebido.
  const buffer = Buffer.allocUnsafe(maxBytes)
  let bytes = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      if (value.byteLength > maxBytes - bytes) {
        await reader.cancel().catch(() => {})
        throw new ErroDeFormulario('Envio acima do limite permitido.', 413)
      }
      buffer.set(value, bytes)
      bytes += value.byteLength
    }
    return await new Request('https://upload.invalid', {
      method: 'POST', headers: { 'content-type': tipo }, body: buffer.subarray(0, bytes),
    }).formData()
  } catch (erro) {
    if (erro instanceof ErroDeFormulario) throw erro
    throw new ErroDeFormulario('Não foi possível ler o envio.')
  } finally { reader.releaseLock() }
}
