/**
 * POST /api/admin/produtos/imagem — envia a foto que aparece na vitrine.
 *   `multipart/form-data`: `produto_id`, `imagem`
 *
 * DELETE /api/admin/produtos/imagem?produto_id=… — tira a foto do cartão.
 *
 * ## Não é o mesmo upload que o do arquivo, e a diferença é o bucket
 *
 * `/arquivo` sobe o **entregável** — o que o comprador paga para receber — num
 * bucket privado, entregue por URL assinada de cinco minutos. Aqui é a foto de
 * vitrine, num bucket **público** (ADR 0035): ela existe para ser vista por
 * quem ainda não comprou.
 *
 * Os dois passam pelas mesmas duas regras, que não dependem do bucket:
 *
 * - **MIME por lista branca**, e a **extensão derivada do MIME**, nunca de
 *   `file.name` — que é escolhido por quem envia;
 * - **tamanho conferido antes da subida**, para não gastar a transferência
 *   descobrindo depois o que o bucket já recusaria.
 *
 * `image/svg+xml` fica de fora da lista de propósito, e num bucket público a
 * razão é mais forte do que em qualquer outro lugar do app: SVG é documento com
 * script, e servido do nosso domínio ele executa como se fosse nossa página.
 *
 * ## Substituir não apaga a anterior
 *
 * Mesmo desenho de `/arquivo`: grava o path novo e deixa o objeto antigo. Aqui
 * o custo de apagar é menor — ninguém está «baixando» uma foto de vitrine — mas
 * a limpeza de órfãos continua sendo trabalho de rotina, e misturá-la ao
 * caminho do upload é o que faz uma troca de imagem falhar pela metade.
 */

import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { createRouteHandlerClient } from '../../../../../src/lib/supabase-route'
import { exigirCapacidade, respostaDaGuarda } from '../../../../../src/lib/guarda-admin'
import { createSupabaseAdminClient } from '../../../../../src/lib/supabase-admin'
import { rateLimit, ipDaRequisicao } from '../../../../../src/lib/rate-limit'
import { logger } from '../../../../../src/lib/logger'
import { validateUUID, imageExtensionForMime } from '../../../../../src/lib/validation'
import {
  BUCKET_PRODUTOS_IMAGENS, MAX_BYTES_DA_IMAGEM,
} from '../../../../../src/lib/produtos-da-plataforma'

const ROUTE = '/api/admin/produtos/imagem'

export async function POST(request: Request) {
  const { success } = await rateLimit(ipDaRequisicao(request), { limit: 20, windowMs: 60_000 })
  if (!success) return NextResponse.json({ error: 'Rate limit' }, { status: 429 })

  const sessao = await createRouteHandlerClient()
  const guarda = await exigirCapacidade(sessao, 'catalogo:escrever')
  if (!guarda.ok) return respostaDaGuarda(guarda, ROUTE)

  let form: FormData
  try { form = await request.formData() } catch {
    return NextResponse.json({ error: 'Envio inválido.' }, { status: 400 })
  }

  const produtoId = String(form.get('produto_id') ?? '')
  if (!validateUUID(produtoId)) {
    return NextResponse.json({ error: 'Produto inválido.' }, { status: 400 })
  }

  const imagem = form.get('imagem')
  if (!(imagem instanceof File)) {
    return NextResponse.json({ error: 'Escolha uma imagem.' }, { status: 400 })
  }

  const extensao = imageExtensionForMime(imagem.type)
  if (!extensao) {
    return NextResponse.json(
      { error: 'Formato não aceito. Use JPG, PNG ou WebP.' },
      { status: 400 }
    )
  }

  if (imagem.size > MAX_BYTES_DA_IMAGEM) {
    return NextResponse.json({ error: 'Imagem acima de 2 MB.' }, { status: 400 })
  }

  const supabase = createSupabaseAdminClient()
  const caminho = `${produtoId}/${randomUUID()}.${extensao}`

  const { error: erroDoUpload } = await supabase.storage
    .from(BUCKET_PRODUTOS_IMAGENS)
    .upload(caminho, imagem, { contentType: imagem.type, upsert: false })

  if (erroDoUpload) {
    logger.error('Falha ao subir a imagem do produto', {
      route: ROUTE, produtoId, error: erroDoUpload.message,
    })
    return NextResponse.json({ error: 'Não foi possível enviar a imagem.' }, { status: 503 })
  }

  const { error: erroDaLinha } = await supabase
    .from('produtos')
    .update({ imagem_path: caminho })
    .eq('id', produtoId)

  if (erroDaLinha) {
    /*
     * O objeto subiu e a linha não aponta para ele: o produto continua sem
     * foto e o admin vê o erro. É a falha certa entre as duas — a inversa
     * deixaria a vitrine com um `<img>` apontando para o que não existe.
     */
    logger.error('Imagem subiu mas o produto não foi atualizado', {
      route: ROUTE, produtoId, caminho, error: erroDaLinha.message,
    })
    return NextResponse.json({ error: 'Não foi possível registrar a imagem.' }, { status: 503 })
  }

  logger.info('Imagem do produto atualizada', { route: ROUTE, produtoId })
  return NextResponse.json({ enviado: true })
}

/**
 * Tirar a foto é limpar o path, não apagar o objeto.
 *
 * Pelo mesmo motivo da substituição: o que a vitrine mostra é a coluna, e é ela
 * que precisa ficar consistente no instante do clique. O objeto órfão não faz
 * mal — é uma foto de produto num bucket que existe para servir fotos de
 * produto.
 */
export async function DELETE(request: Request) {
  const { success } = await rateLimit(ipDaRequisicao(request), { limit: 20, windowMs: 60_000 })
  if (!success) return NextResponse.json({ error: 'Rate limit' }, { status: 429 })

  const sessao = await createRouteHandlerClient()
  const guarda = await exigirCapacidade(sessao, 'catalogo:escrever')
  if (!guarda.ok) return respostaDaGuarda(guarda, ROUTE)

  const produtoId = new URL(request.url).searchParams.get('produto_id') ?? ''
  if (!validateUUID(produtoId)) {
    return NextResponse.json({ error: 'Produto inválido.' }, { status: 400 })
  }

  const { error } = await createSupabaseAdminClient()
    .from('produtos')
    .update({ imagem_path: null })
    .eq('id', produtoId)

  if (error) {
    logger.error('Não foi possível remover a imagem do produto', {
      route: ROUTE, produtoId, error: error.message,
    })
    return NextResponse.json({ error: 'Não foi possível remover a imagem.' }, { status: 503 })
  }

  return NextResponse.json({ removido: true })
}
