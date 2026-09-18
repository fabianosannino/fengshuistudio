import 'server-only'
import sharp from 'sharp'
import { imageExtensionForMime } from './validation'
import { ErroDeFormulario, lerFormularioLimitado } from './multipart-limitado'
import { MAX_BYTES_FORMULARIO_IMAGEM, MAX_BYTES_IMAGEM, MAX_LADO_IMAGEM, MAX_PIXELS_IMAGEM } from './upload-imagem-limites'

export class ErroDeImagem extends Error {
  constructor(message: string, readonly status: 400 | 413 = 400) { super(message) }
}

/** Limita os bytes lidos, inclusive quando Content-Length falta ou mente. */
export async function lerFormularioDeImagem(request: Request): Promise<FormData> {
  try {
    return await lerFormularioLimitado(request, MAX_BYTES_FORMULARIO_IMAGEM)
  } catch (erro) {
    if (erro instanceof ErroDeFormulario) {
      throw new ErroDeImagem(erro.status === 413 ? 'Envio muito grande. Use até 4 MB no total.' : erro.message, erro.status)
    }
    throw new ErroDeImagem('Não foi possível ler o envio.')
  }
}

// FormData pode vir de outro realm; conferir capacidades, não o construtor File.
function ehArquivo(valor: unknown): valor is File {
  return typeof valor === 'object' && valor !== null && 'arrayBuffer' in valor &&
    typeof valor.arrayBuffer === 'function' && 'size' in valor && typeof valor.size === 'number' &&
    'type' in valor && typeof valor.type === 'string'
}

function formatoDosBytes(bytes: Buffer): 'jpeg' | 'png' | 'webp' | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpeg'
  if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'png'
  if (bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') return 'webp'
  return null
}

function pngAnimado(bytes: Buffer): boolean {
  for (let offset = 8; offset + 12 <= bytes.length;) {
    const tamanho = bytes.readUInt32BE(offset)
    if (bytes.toString('ascii', offset + 4, offset + 8) === 'acTL') return true
    offset += tamanho + 12
  }
  return false
}

/** Decodifica pixels, orienta e reencoda sem EXIF/GPS/XMP nem nome original. */
export async function normalizarImagem(valor: unknown, maxBytes = MAX_BYTES_IMAGEM) {
  if (!ehArquivo(valor) || !imageExtensionForMime(valor.type)) {
    throw new ErroDeImagem('Escolha uma imagem JPG, PNG ou WebP.')
  }
  if (!Number.isSafeInteger(valor.size) || valor.size <= 0) throw new ErroDeImagem('Imagem vazia ou inválida.')
  if (valor.size > maxBytes) throw new ErroDeImagem('Imagem acima do limite de envio.', 413)
  try {
    const bytes = Buffer.from(await valor.arrayBuffer())
    const formato = formatoDosBytes(bytes)
    if (bytes.length !== valor.size || !formato || valor.type !== `image/${formato}`) {
      throw new ErroDeImagem('O conteúdo não corresponde ao formato da imagem.')
    }
    if (formato === 'png' && pngAnimado(bytes)) throw new ErroDeImagem('Use uma imagem sem animação.')
    const imagem = sharp(bytes, { failOn: 'warning', limitInputPixels: MAX_PIXELS_IMAGEM, limitInputChannels: 4 })
    const meta = await imagem.metadata()
    if (meta.format !== formato || (meta.pages ?? 1) !== 1) throw new ErroDeImagem('Use uma imagem sem animação.')
    if (!meta.width || !meta.height || meta.width > MAX_LADO_IMAGEM || meta.height > MAX_LADO_IMAGEM ||
        meta.width * meta.height > MAX_PIXELS_IMAGEM) {
      throw new ErroDeImagem('Imagem muito grande. Use até 24 megapixels e 8192 pixels por lado.')
    }
    const orientada = imagem.autoOrient().timeout({ seconds: 10 })
    const saida = await (formato === 'jpeg' ? orientada.jpeg({ quality: 95, chromaSubsampling: '4:4:4' }) :
      formato === 'png' ? orientada.png() : orientada.webp({ lossless: true })).toBuffer()
    if (saida.length > maxBytes) throw new ErroDeImagem('Reduza a resolução da imagem e tente novamente.', 413)
    return { bytes: saida, mime: `image/${formato}`, extensao: formato === 'jpeg' ? 'jpg' : formato }
  } catch (erro) {
    if (erro instanceof ErroDeImagem) throw erro
    // O decoder pode incluir conteúdo/metadados na mensagem. Não propagar nem registrar.
    throw new ErroDeImagem('Imagem inválida ou acima dos limites. Exporte outra imagem e tente novamente.')
  }
}
