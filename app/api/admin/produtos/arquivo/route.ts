/**
 * POST /api/admin/produtos/arquivo — envia o arquivo que o comprador vai baixar.
 *   `multipart/form-data`: `produto_id`, `arquivo`
 *
 * ## O que é conferido, e por quê
 *
 * - **MIME por lista branca**, e a **extensão derivada do MIME** — nunca de
 *   `file.name`, que é escolhido por quem envia. É a mesma regra das fotos
 *   (`imageExtensionForMime`), aqui para outra família de tipos.
 * - **Tamanho antes da subida**: o bucket também recusa, mas recusar aqui
 *   evita gastar a transferência para descobrir depois.
 * - O path é `<produto_id>/<uuid>.<ext>`. O nome original vai para a coluna
 *   `arquivo_nome` e é o que aparece no disco do comprador — o path não
 *   carrega texto vindo de fora.
 *
 * ## Substituir o arquivo não apaga o anterior
 *
 * O `path` novo é gravado e o objeto antigo fica no bucket, órfão. É
 * deliberado por ora: apagar o anterior enquanto alguém baixa é o único jeito
 * de transformar uma correção de arquivo numa entrega interrompida. Limpeza de
 * órfãos é trabalho de rotina, não do caminho do upload.
 */

import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { createRouteHandlerClient } from '../../../../../src/lib/supabase-route'
import { exigirCapacidade, respostaDaGuarda } from '../../../../../src/lib/guarda-admin'
import { createSupabaseAdminClient } from '../../../../../src/lib/supabase-admin'
import { rateLimit, ipDaRequisicao } from '../../../../../src/lib/rate-limit'
import { logger } from '../../../../../src/lib/logger'
import { sanitizeString, validateUUID } from '../../../../../src/lib/validation'
import { ErroDeFormulario, lerFormularioLimitado, MARGEM_MULTIPART } from '../../../../../src/lib/multipart-limitado'
import {
  BUCKET_PRODUTOS_DIGITAIS, MAX_BYTES_DO_ARQUIVO, extensaoParaMimeDeProduto,
} from '../../../../../src/lib/produtos-da-plataforma'

const ROUTE = '/api/admin/produtos/arquivo'

const MAX_NOME_DO_ARQUIVO = 120

export async function POST(request: Request) {
  const { success, indisponivel: limiteIndisponivel } = await rateLimit(ipDaRequisicao(request), { limit: 10, windowMs: 60_000, escopo: 'POST:/api/admin/produtos/arquivo', exigirCompartilhado: true })
  if (limiteIndisponivel) return Response.json({ error: 'Proteção temporariamente indisponível. Tente novamente em instantes.' }, { status: 503, headers: { 'Retry-After': '30' } })
  if (!success) return NextResponse.json({ error: 'Rate limit' }, { status: 429 })

  const sessao = await createRouteHandlerClient()
  const guarda = await exigirCapacidade(sessao, 'catalogo:escrever')
  if (!guarda.ok) return respostaDaGuarda(guarda, '/api/admin/produtos/arquivo')
  let form: FormData
  try { form = await lerFormularioLimitado(request, MAX_BYTES_DO_ARQUIVO + MARGEM_MULTIPART) } catch (erro) {
    return NextResponse.json({ error: 'Envie um arquivo de até 4 MB.' }, { status: erro instanceof ErroDeFormulario ? erro.status : 400 })
  }

  const produtoId = String(form.get('produto_id') ?? '')
  if (!validateUUID(produtoId)) {
    return NextResponse.json({ error: 'Produto inválido.' }, { status: 400 })
  }

  const arquivo = form.get('arquivo')
  if (!(arquivo instanceof File)) {
    return NextResponse.json({ error: 'Escolha um arquivo.' }, { status: 400 })
  }

  const extensao = extensaoParaMimeDeProduto(arquivo.type)
  if (!extensao) {
    return NextResponse.json(
      { error: 'Formato não aceito. Use PDF, EPUB, ZIP, MP3 ou MP4.' },
      { status: 400 }
    )
  }

  if (arquivo.size === 0 || arquivo.size > MAX_BYTES_DO_ARQUIVO) {
    return NextResponse.json({ error: 'Escolha um arquivo não vazio de até 4 MB.' }, { status: arquivo.size === 0 ? 400 : 413 })
  }

  try {
    const supabase = createSupabaseAdminClient()
    const anterior = await supabase.from('produtos').select('id,arquivo_path').eq('id', produtoId).maybeSingle()
    if (anterior.error) return NextResponse.json({ error: 'Não foi possível consultar o produto.' }, { status: 503 })
    if (!anterior.data) return NextResponse.json({ error: 'Produto não encontrado.' }, { status: 404 })
    const caminho = `${produtoId}/${randomUUID()}.${extensao}`

    const { error: erroDoUpload } = await supabase.storage
      .from(BUCKET_PRODUTOS_DIGITAIS)
      .upload(caminho, arquivo, { contentType: arquivo.type, upsert: false })

    if (erroDoUpload) {
      logger.error('Falha ao subir o arquivo do produto', {
        route: ROUTE, produtoId, error: erroDoUpload.message,
      })
      return NextResponse.json({ error: 'Não foi possível enviar o arquivo.' }, { status: 503 })
    }

    // O nome do arquivo é o que o comprador vê no disco. Passa pelo saneamento
    // porque vem de fora, mesmo vindo de um admin.
    const nomeVisivel = sanitizeString(arquivo.name || `produto.${extensao}`, MAX_NOME_DO_ARQUIVO)

    let atualizacao = supabase
      .from('produtos')
      .update({
        arquivo_path: caminho,
        arquivo_nome: nomeVisivel,
        arquivo_mime: arquivo.type,
        arquivo_bytes: arquivo.size,
      })
      .eq('id', produtoId)
    // Uma substituição concorrente não pode ser perdida silenciosamente.
    atualizacao = anterior.data.arquivo_path === null
      ? atualizacao.is('arquivo_path', null)
      : atualizacao.eq('arquivo_path', anterior.data.arquivo_path)
    const { data: atualizado, error: erroDaLinha } = await atualizacao.select('id').maybeSingle()

    if (erroDaLinha) {
      /*
       * Não apagar objeto diante de falha ambígua: a escrita pode ter sido
       * confirmada antes do timeout. O arquivo anterior também é preservado.
       */
      logger.error('Arquivo subiu mas o produto não foi atualizado', {
        route: ROUTE, produtoId, caminho, error: erroDaLinha.message,
      })
      return NextResponse.json({ error: 'Não foi possível registrar o arquivo.' }, { status: 503 })
    }
    if (!atualizado) {
      return NextResponse.json({ error: 'O produto mudou durante o envio. Recarregue a página antes de tentar novamente.' }, { status: 409 })
    }

    logger.info('Arquivo do produto atualizado', { route: ROUTE, produtoId })
    return NextResponse.json({ enviado: true, nome: nomeVisivel, bytes: arquivo.size })
  } catch {
    logger.error('Falha no envio do arquivo do produto', { route: ROUTE })
    return NextResponse.json({ error: 'Não foi possível enviar o arquivo.' }, { status: 503 })
  }
}
