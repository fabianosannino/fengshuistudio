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
import {
  BUCKET_PRODUTOS_DIGITAIS, MAX_BYTES_DO_ARQUIVO, extensaoParaMimeDeProduto,
} from '../../../../../src/lib/produtos-da-plataforma'

const ROUTE = '/api/admin/produtos/arquivo'

const MAX_NOME_DO_ARQUIVO = 120

export async function POST(request: Request) {
  const { success } = await rateLimit(ipDaRequisicao(request), { limit: 10, windowMs: 60_000 })
  if (!success) return NextResponse.json({ error: 'Rate limit' }, { status: 429 })

  const sessao = await createRouteHandlerClient()
  const guarda = await exigirCapacidade(sessao, 'catalogo:escrever')
  if (!guarda.ok) return respostaDaGuarda(guarda, '/api/admin/produtos/arquivo')
  const user = guarda.user

  let form: FormData
  try { form = await request.formData() } catch {
    return NextResponse.json({ error: 'Envio inválido.' }, { status: 400 })
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

  if (arquivo.size > MAX_BYTES_DO_ARQUIVO) {
    return NextResponse.json({ error: 'Arquivo acima de 100 MB.' }, { status: 400 })
  }

  const supabase = createSupabaseAdminClient()
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

  const { error: erroDaLinha } = await supabase
    .from('produtos')
    .update({
      arquivo_path: caminho,
      arquivo_nome: nomeVisivel,
      arquivo_mime: arquivo.type,
      arquivo_bytes: arquivo.size,
    })
    .eq('id', produtoId)

  if (erroDaLinha) {
    /*
     * O objeto subiu e a linha não aponta para ele: o produto continua sem
     * arquivo e o admin vê o erro. É a falha certa entre as duas possíveis —
     * a inversa (linha apontando para objeto que não subiu) daria um produto
     * publicável cujo download quebra na mão do comprador.
     */
    logger.error('Arquivo subiu mas o produto não foi atualizado', {
      route: ROUTE, produtoId, caminho, error: erroDaLinha.message,
    })
    return NextResponse.json({ error: 'Não foi possível registrar o arquivo.' }, { status: 503 })
  }

  logger.info('Arquivo do produto atualizado', { route: ROUTE, produtoId })
  return NextResponse.json({ enviado: true, nome: nomeVisivel, bytes: arquivo.size })
}
