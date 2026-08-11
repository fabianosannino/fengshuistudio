/**
 * Resolução de imagens do Supabase Storage.
 *
 * ## O problema (C8 da auditoria de 2026-07-18)
 *
 * Os buckets `imoveis-fotos` e `clientes-fotos` nasceram públicos, e o banco
 * guarda a **URL pública completa** — não o path do objeto. Quem tivesse a URL
 * via o interior da casa de um cliente sem autenticação nenhuma. Dado pessoal,
 * exposição direta, risco LGPD.
 *
 * ## O que este módulo resolve
 *
 * Fechar o bucket quebraria toda linha já gravada, porque uma URL pública de um
 * bucket privado devolve 404. A saída é parar de depender do formato do que está
 * gravado: qualquer valor — URL pública legada, URL assinada ou path — vira um
 * **path de objeto**, e o path é o que se manda assinar.
 *
 * Assim o backfill deixa de ser pré-requisito do fechamento do bucket e vira
 * limpeza: linhas antigas e novas funcionam pelo mesmo caminho.
 */

export const BUCKET_IMOVEIS = 'imoveis-fotos'
export const BUCKET_CLIENTES = 'clientes-fotos'

/** Validade da URL assinada. Curta o bastante para não virar link permanente. */
export const TTL_URL_ASSINADA_SEGUNDOS = 3600

/**
 * `true` para valores que já são a imagem em si (`data:`) ou uma referência
 * local do browser (`blob:`) — preview antes do upload, snapshot embutido. Não
 * há o que assinar: renderiza direto.
 */
export function ehImagemDireta(valor: string | null | undefined): boolean {
  if (!valor) return false
  return valor.startsWith('data:') || valor.startsWith('blob:')
}

/**
 * Path do objeto dentro do bucket, a partir de qualquer forma já usada no banco.
 *
 * Devolve `null` quando o valor não aponta para um objeto deste bucket — inclui
 * `data:`/`blob:` e URLs de outro domínio. `null` significa "não sei assinar
 * isto", nunca "está tudo bem, mostre assim mesmo": quem chama decide.
 */
export function caminhoDoObjeto(
  valor: string | null | undefined,
  bucket: string
): string | null {
  if (!valor) return null

  const limpo = valor.trim()
  if (!limpo || ehImagemDireta(limpo)) return null

  // Formas conhecidas:
  //   .../storage/v1/object/public/<bucket>/<path>
  //   .../storage/v1/object/sign/<bucket>/<path>?token=...
  //   .../storage/v1/object/<bucket>/<path>
  const marcador = `/${bucket}/`
  const posicao = limpo.indexOf(marcador)

  if (posicao !== -1) {
    const depois = limpo.slice(posicao + marcador.length)
    return normalizarPath(depois)
  }

  // Sem o marcador: só pode ser um path já normalizado. Se tiver esquema de
  // URL, é de outro bucket ou de outro serviço — não é nosso.
  if (limpo.includes('://')) return null

  return normalizarPath(limpo)
}

function normalizarPath(bruto: string): string | null {
  // Fora o query string (token de assinatura) e o fragmento.
  const semQuery = bruto.split('?')[0].split('#')[0]
  const semBarraInicial = semQuery.replace(/^\/+/, '')
  if (!semBarraInicial) return null

  let decodificado: string
  try {
    decodificado = decodeURIComponent(semBarraInicial)
  } catch {
    // Sequência percent-encoded inválida: fica o valor cru, que ainda pode ser
    // um path legítimo com `%` no nome.
    decodificado = semBarraInicial
  }

  // Um `..` no path atravessaria pastas — e no bucket de imóveis a primeira
  // pasta é justamente o que prova a posse (id da consulta).
  if (decodificado.split('/').some(parte => parte === '..')) return null

  return decodificado
}

/**
 * Primeira pasta do path — o segmento que carrega a posse: id da consulta em
 * `imoveis-fotos`, id do usuário em `clientes-fotos`.
 */
export function pastaRaiz(path: string): string | null {
  const primeiro = path.split('/')[0]
  return primeiro || null
}
