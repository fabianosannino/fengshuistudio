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
import { precoVigente } from './promocao-do-produto'

const PRODUTOS = 'produtos'

/** Bucket privado onde vive o arquivo entregue. Path, nunca URL (ADR 0022). */
export const BUCKET_PRODUTOS_DIGITAIS = 'produtos-digitais'

/**
 * Bucket **público** da foto de vitrine — o único público do projeto (ADR 0035).
 *
 * O ADR 0022 fechou `clientes-fotos` e `imoveis-fotos` porque são o interior da
 * casa de alguém. A foto de produto é o contrário pela finalidade: existe para
 * ser vista por quem ainda não é cliente, na página mais pública do site.
 *
 * URL assinada aqui defenderia um segredo que não existe e cobraria caro —
 * expira, então nenhum CDN guarda, e cada visitante faria o servidor assinar
 * cada imagem de novo.
 */
export const BUCKET_PRODUTOS_IMAGENS = 'produtos-imagens'

/** Teto da foto, igual ao do bucket. 2 MB é bastante para um cartão de vitrine. */
export const MAX_BYTES_DA_IMAGEM = 2 * 1024 * 1024

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

export type ModoDeVenda = 'marketplace' | 'indicacao'

export interface Produto {
  id: string
  tipo: TipoDeProduto
  modo_de_venda: ModoDeVenda
  nome: string
  descricao: string | null
  preco_centavos: number
  ativo: boolean
  arquivo_path: string | null
  arquivo_nome: string | null
  arquivo_mime: string | null
  arquivo_bytes: number | null
  link_externo: string | null
  parceiro: string | null
  /** Path no bucket público. Nunca URL — o endereço se monta na leitura. */
  imagem_path: string | null
  promocao_preco_centavos: number | null
  promocao_inicio: string | null
  promocao_fim: string | null
  criado_em?: string
  atualizado_em?: string
}

/**
 * O endereço público da foto, montado a partir do path.
 *
 * Montado na leitura e não gravado, pela razão que o ADR 0022 aprendeu caro: a
 * URL gravada amarra a linha ao bucket em que ela nasceu. Quando `imoveis-fotos`
 * precisou fechar, cada linha já escrita virou um 404, e desfazer isso custou um
 * backfill. Aqui o banco guarda o que não muda.
 */
export function urlPublicaDaImagem(path: string | null | undefined): string | null {
  if (!path) return null

  const base = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!base) return null

  const segmentos = path.split('/').map(encodeURIComponent).join('/')
  return `${base.replace(/\/+$/, '')}/storage/v1/object/public/${BUCKET_PRODUTOS_IMAGENS}/${segmentos}`
}

/** O que a vitrine pública pode ver. Campo novo não vaza sozinho. */
export interface ProdutoNaVitrine {
  id: string
  tipo: TipoDeProduto
  modo_de_venda: ModoDeVenda
  nome: string
  descricao: string | null
  /**
   * **O que se paga agora** — já com a promoção aplicada, se houver.
   *
   * O nome não mudou para `preco_vigente_centavos` porque é este o número que a
   * vitrine mostra grande e é este que o comprador paga. O cheio, quando existe
   * promoção, vem separado abaixo.
   */
  preco_centavos: number
  /**
   * O «de» riscado. `null` fora da promoção, e não uma cópia de `preco_centavos`:
   * repetido, a tela teria que comparar os dois para decidir se risca, e um dia
   * riscaria um preço igual ao que está ao lado.
   */
  preco_cheio_centavos: number | null
  /** Quando a campanha fecha, para o cartão poder dizer até quando. */
  promocao_termina_em: string | null
  /** Endereço público da foto, ou `null` quando o produto não tem uma. */
  imagem_url: string | null
  /** Só para a tela dizer «download imediato» em vez de prometer entrega. */
  entrega_digital: boolean
  /**
   * Quem vende, quando não somos nós. Vai para a vitrine **de propósito**:
   * numa indicação a compra acontece no site do parceiro, e o comprador tem
   * que saber disso antes de clicar, não depois.
   *
   * O `link_externo` continua fora daqui — o clique passa por
   * `/api/loja/indicacao`, que mede antes de encaminhar.
   */
  parceiro: string | null
}

export function ehDigital(tipo: string): boolean {
  return tipo === 'bem_proprio_digital'
}

/** `true` quando a compra acontece fora daqui — o dinheiro não passa por nós. */
export function ehIndicacao(produto: { modo_de_venda?: string | null }): boolean {
  return produto.modo_de_venda === 'indicacao'
}

/**
 * `agora` é parâmetro porque o preço depende dele.
 *
 * A alternativa — `new Date()` aqui dentro — tornaria a função impossível de
 * testar nas bordas da janela, que é exatamente onde uma promoção erra.
 */
export function produtoParaVitrine(produto: Produto, agora: Date): ProdutoNaVitrine {
  const vigente = precoVigente(produto, agora)

  return {
    id: produto.id,
    tipo: produto.tipo,
    modo_de_venda: produto.modo_de_venda,
    nome: produto.nome,
    descricao: produto.descricao,
    preco_centavos: vigente.centavos,
    preco_cheio_centavos: vigente.precoCheioCentavos,
    promocao_termina_em: vigente.terminaEm,
    imagem_url: urlPublicaDaImagem(produto.imagem_path),
    entrega_digital: ehDigital(produto.tipo),
    parceiro: produto.parceiro,
  }
}

/**
 * O link de indicação é seguro para encaminhar?
 *
 * O destino vem do nosso cadastro, não do cliente — mas o cadastro é digitado,
 * e um `javascript:` colado ali viraria execução no browser de quem confia na
 * nossa marca. A rota de redirecionamento é pública e o alvo é sempre um
 * terceiro; a checagem custa nada e fecha a classe inteira.
 *
 * **Só `https`.** `http` não é recusado por purismo: o comprador sai da nossa
 * página para uma conexão que pode ser lida e reescrita no caminho, num
 * contexto em que ele acabou de ver nosso aviso de que aquilo é uma
 * recomendação nossa.
 */
export function ehLinkDeIndicacaoSeguro(link: string | null | undefined): boolean {
  if (!link) return false

  let url: URL
  try { url = new URL(link) } catch { return false }

  if (url.protocol !== 'https:') return false
  // `https://usuario:senha@host` é a forma clássica de disfarçar o domínio
  // real na barra de endereços.
  if (url.username || url.password) return false
  return Boolean(url.hostname)
}

const CAMPOS_COMPLETOS = `
  id, tipo, modo_de_venda, nome, descricao, preco_centavos, ativo,
  arquivo_path, arquivo_nome, arquivo_mime, arquivo_bytes,
  link_externo, parceiro, imagem_path,
  promocao_preco_centavos, promocao_inicio, promocao_fim,
  criado_em, atualizado_em
`

/** A vitrine: só o que está ativo, e só o que a vitrine pode ver. */
export async function listarProdutosDaVitrine(
  supabase: SupabaseClient,
  origemDoLog: string,
  agora: Date
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

  /*
   * A promoção **não** entra na consulta como filtro.
   *
   * Seria tentador escrever `or(promocao_fim.gt.now)` no SQL e ter o preço já
   * resolvido pelo banco. Aí existiriam duas implementações da mesma regra — a
   * do SQL e a de `precoVigente`, que o checkout usa — e elas divergiriam na
   * borda, que é o único lugar onde a diferença aparece e o pior lugar para
   * descobri-la.
   *
   * O banco devolve as colunas; quem decide o preço é sempre a mesma função.
   */
  return (data as Produto[]).map(produto => produtoParaVitrine(produto, agora))
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
