/**
 * O catálogo próprio da plataforma — a fase 2 da loja.
 *
 * ## O que muda em relação à venda do consultor
 *
 * Na venda do consultor a plataforma é intermediária: a cobrança é direta na
 * conta conectada, o consultor é o vendedor perante o comprador e nós retemos
 * 10%. Aqui a plataforma **é** a vendedora — cobrança na nossa conta, sem conta
 * conectada, sem comissão a reter e com a obrigação de entrega do nosso lado.
 *
 * Por isso o preço não vem do Stripe. Na venda do consultor o `price_id` mora
 * lá e ler de lá prova, ao mesmo tempo, que o preço é real e que pertence
 * àquela conta. No nosso catálogo o dono do dado é este banco, e é daqui que
 * o valor sai — do cliente, nunca.
 *
 * ## A lista branca
 *
 * `produtos` tem RLS ligado e **nenhuma policy**: ninguém lê a tabela sem
 * `service_role`. A vitrine pública sai de `produtoParaVitrine`, que copia
 * campo a campo. O motivo é `arquivo_path`: publicar o endereço do arquivo que
 * se está cobrando para entregar não vaza o produto (o bucket é privado), mas
 * começa a defesa um passo atrás sem ganhar nada. Mesma regra do ADR 0028.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { logger } from './logger'

const PRODUTOS = 'produtos'

/** Bucket privado onde vive o arquivo entregue. Path, nunca URL (ADR 0022). */
export const BUCKET_PRODUTOS_DIGITAIS = 'produtos-digitais'

/**
 * Validade do link de download.
 *
 * Curta de propósito: o link é gerado no clique, com o pedido conferido no
 * instante. Uma hora de validade transformaria o mesmo link num endereço
 * repassável — e o que ele entrega é o produto inteiro, não a miniatura de uma
 * foto. Cinco minutos bastam para o download começar.
 */
export const TTL_DOWNLOAD_SEGUNDOS = 300

export type TipoDeProduto = 'bem_proprio_digital' | 'bem_proprio_fisico' | 'bem_de_terceiro'

/**
 * MIME aceito no arquivo do produto → extensão canônica.
 *
 * A extensão sai **daqui**, nunca de `file.name`: o nome do arquivo é escolhido
 * por quem envia, e derivar a extensão dele é o caminho conhecido de injeção de
 * extensão. É a mesma regra de `imageExtensionForMime` em `validation.ts`,
 * repetida para outra família de tipos em vez de alargar aquela.
 */
const MIME_ACEITO: Record<string, string> = {
  'application/pdf': 'pdf',
  'application/epub+zip': 'epub',
  'application/zip': 'zip',
  'audio/mpeg': 'mp3',
  'video/mp4': 'mp4',
}

export const MIMES_DE_PRODUTO_DIGITAL = Object.keys(MIME_ACEITO)

/** Teto do arquivo, igual ao do bucket. Recusar antes do upload poupa a subida. */
export const MAX_BYTES_DO_ARQUIVO = 100 * 1024 * 1024

export function extensaoParaMimeDeProduto(mime: string): string | null {
  return MIME_ACEITO[mime] ?? null
}

export interface Produto {
  id: string
  tipo: TipoDeProduto
  nome: string
  descricao: string | null
  preco_centavos: number
  ativo: boolean
  arquivo_path: string | null
  arquivo_nome: string | null
  arquivo_mime: string | null
  arquivo_bytes: number | null
  criado_em?: string
  atualizado_em?: string
}

/** O que a vitrine pública pode ver. Campo novo não vaza sozinho. */
export interface ProdutoNaVitrine {
  id: string
  tipo: TipoDeProduto
  nome: string
  descricao: string | null
  preco_centavos: number
  /** Só para a tela dizer «download imediato» em vez de prometer entrega. */
  entrega_digital: boolean
}

export function ehDigital(tipo: string): boolean {
  return tipo === 'bem_proprio_digital'
}

export function produtoParaVitrine(produto: Produto): ProdutoNaVitrine {
  return {
    id: produto.id,
    tipo: produto.tipo,
    nome: produto.nome,
    descricao: produto.descricao,
    preco_centavos: produto.preco_centavos,
    entrega_digital: ehDigital(produto.tipo),
  }
}

const CAMPOS_COMPLETOS = `
  id, tipo, nome, descricao, preco_centavos, ativo,
  arquivo_path, arquivo_nome, arquivo_mime, arquivo_bytes, criado_em, atualizado_em
`

/** A vitrine: só o que está ativo, e só o que a vitrine pode ver. */
export async function listarProdutosDaVitrine(
  supabase: SupabaseClient,
  origemDoLog: string
): Promise<ProdutoNaVitrine[] | null> {
  const { data, error } = await supabase
    .from(PRODUTOS)
    .select(CAMPOS_COMPLETOS)
    .eq('ativo', true)
    .order('criado_em', { ascending: false })

  if (error) {
    logger.error('Não foi possível listar o catálogo da plataforma', {
      origem: origemDoLog, error: error.message,
    })
    return null
  }

  return (data as Produto[]).map(produtoParaVitrine)
}

/** Tudo, para a tela de admin. Inclui inativo e o arquivo. */
export async function listarProdutosParaAdmin(
  supabase: SupabaseClient,
  origemDoLog: string
): Promise<Produto[] | null> {
  const { data, error } = await supabase
    .from(PRODUTOS)
    .select(CAMPOS_COMPLETOS)
    .order('criado_em', { ascending: false })

  if (error) {
    logger.error('Não foi possível listar os produtos para o admin', {
      origem: origemDoLog, error: error.message,
    })
    return null
  }

  return data as Produto[]
}

/**
 * O produto que pode ser cobrado agora.
 *
 * Devolve `null` para inativo e para o que não existe — **a mesma resposta**,
 * porque distinguir os dois conta a quem está sondando quais ids existem. É a
 * mesma escolha do 404 igual para token errado e token vencido.
 */
export async function produtoParaVenda(
  supabase: SupabaseClient,
  produtoId: string,
  origemDoLog: string
): Promise<Produto | null> {
  const { data, error } = await supabase
    .from(PRODUTOS)
    .select(CAMPOS_COMPLETOS)
    .eq('id', produtoId)
    .eq('ativo', true)
    .maybeSingle()

  if (error) {
    logger.error('Não foi possível ler o produto para venda', {
      origem: origemDoLog, produtoId, error: error.message,
    })
    return null
  }

  return (data as Produto | null) ?? null
}
