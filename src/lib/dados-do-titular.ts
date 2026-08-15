/**
 * Direitos do titular (LGPD art. 18) — acesso, portabilidade e exclusão.
 *
 * ## O que torna este portal diferente dos outros
 *
 * No Solarisis e no Ervatório o titular guarda dados **sobre si**. Aqui o
 * consultor guarda dados **sobre outras pessoas**: `clientes` tem nome, CPF,
 * data de nascimento, endereço e foto de gente que nunca abriu uma conta aqui.
 *
 * Isso muda o que "excluir minha conta" significa. Não dá para anonimizar o
 * consultor e deixar a base de clientes dele parada no banco: aquelas pessoas
 * não têm relação com a plataforma, e o único fundamento para guardá-las era o
 * contrato com quem acabou de sair. Sem o controlador, o dado não tem por que
 * existir — então ele é **apagado**, não anonimizado.
 *
 * ## O que sobrevive, e por quê
 *
 * Pedido é registro fiscal, e a plataforma reteve comissão sobre ele: valores,
 * situação e a referência do Stripe precisam continuar de pé para que o razão
 * feche. O que sai do pedido é quem a pessoa era.
 *
 * A mesma regra do `modelo-da-loja.md`: o fato financeiro fica, a identidade
 * sai.
 *
 * ## A regra que não tem exceção
 *
 * Tudo opera sobre `user.id` da sessão, **nunca** sobre um id vindo do corpo.
 * As funções aqui recebem o id porque isso as torna testáveis; quem o fornece é
 * a rota, a partir de `supabase.auth.getUser()`.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { BUCKET_CLIENTES, BUCKET_IMOVEIS, caminhoDoObjeto } from './storage-imagens'

/**
 * O bucket privado dos relatórios em PDF.
 *
 * Mora aqui e não em `storage-imagens.ts` porque não é imagem — e foi
 * justamente por procurar só em «storage-imagens» que ele ficou de fora da
 * primeira versão desta exclusão.
 */
export const BUCKET_RELATORIOS = 'relatorios'

/**
 * O texto que fica no lugar do que identificava a pessoa.
 *
 * Legível de propósito: quem abrir o pedido no admin daqui a um ano precisa
 * entender que foi exclusão a pedido, não dado corrompido.
 */
export const MARCA_DE_ANONIMIZACAO = 'Titular removido a pedido (LGPD art. 18)'

/**
 * O e-mail que substitui o real.
 *
 * `.invalid` é reservado pela RFC 2606: nem um erro de configuração faz sair
 * mensagem para lá. O id garante unicidade — dois titulares excluídos não
 * podem colidir numa coluna com índice único.
 */
export function emailAnonimo(userId: string): string {
  return `removido+${userId}@invalid`
}

/** A palavra que a pessoa digita para confirmar. */
export const PALAVRA_DE_CONFIRMACAO = 'EXCLUIR'

/**
 * O inventário: o que existe hoje, contado na hora.
 *
 * Sai de contagem, não de campo guardado — ninguém precisa mantê-lo em dia e
 * ele não pode divergir do que está lá. Sem isto, «excluir minha conta» é um
 * botão que faz algo que a pessoa não consegue prever, e a lei pede
 * consentimento informado.
 */
export interface InventarioDoTitular {
  clientes: number
  consultas: number
  pedidosComoComprador: number
  pedidosComoVendedor: number
}

export async function inventariar(
  supabase: SupabaseClient,
  userId: string,
  email: string | null
): Promise<InventarioDoTitular> {
  const contar = async (tabela: string, coluna: string, valor: string | null) => {
    if (!valor) return 0
    const { count } = await supabase
      .from(tabela)
      .select('id', { count: 'exact', head: true })
      .eq(coluna, valor)
    return count ?? 0
  }

  const [clientes, consultas, comoComprador, comoVendedor] = await Promise.all([
    contar('clientes', 'consultor_id', userId),
    contar('consultas', 'consultor_id', userId),
    contar('pedidos', 'comprador_email', email),
    contar('pedidos', 'vendedor_perfil_id', userId),
  ])

  return {
    clientes,
    consultas,
    pedidosComoComprador: comoComprador,
    pedidosComoVendedor: comoVendedor,
  }
}

/**
 * De onde saem os arquivos do titular — enumerados por bucket.
 *
 * ## Por que uma lista por bucket, e não «as colunas de foto»
 *
 * A primeira versão disto tinha uma lista só, chamada «colunas de foto da
 * consulta», e ela estava errada de três formas ao mesmo tempo:
 *
 * 1. faltava `planta_url` — que hoje mora **dentro** do jsonb `bagua_entrada`,
 *    não numa coluna própria;
 * 2. faltava `relatorio_pdf_path`, que aponta para **outro bucket**
 *    (`relatorios`) e por isso nem caberia numa lista de «fotos»;
 * 3. faltava `fotos_consulta` inteira — uma **tabela**, não uma coluna.
 *
 * O erro comum aos três é o nome: «colunas de foto da consulta» descreve onde
 * eu tinha olhado, não onde os arquivos estão. A varredura que corrigiu isso
 * partiu do schema, procurando `foto|imagem|url|path|anexo|arquivo` em toda
 * tabela — e é essa varredura que precisa ser repetida quando alguém somar um
 * upload novo.
 */

/** Colunas de `consultas` cujo conteúdo vive em `imoveis-fotos`. */
export const COLUNAS_DE_IMAGEM_DA_CONSULTA = [
  'bagua_imagem',
  'foto_geral_url',
  'fotos_comodos',
  'fotos_antes',
  'fotos_depois',
  // `bagua_entrada` é jsonb e guarda `planta_url` — a forma que o app escreve
  // hoje (`app/bagua-planta/page.tsx`). A coluna solta abaixo é a forma antiga;
  // as duas entram porque há linha das duas eras no banco.
  'bagua_entrada',
  'planta_url',
  'relatorio_url',
] as const

/**
 * Colunas de `consultas` cujo conteúdo vive em `relatorios`.
 *
 * Bucket privado e separado. Um PDF de relatório traz o diagnóstico do imóvel
 * do cliente com endereço — tão pessoal quanto as fotos, e estava ficando.
 */
export const COLUNAS_DE_RELATORIO_DA_CONSULTA = ['relatorio_pdf_path'] as const

/**
 * A tabela de fotos da consulta.
 *
 * Separada de `consultas` e ligada por `consulta_id`. As linhas somem por
 * cascata quando a consulta é apagada — **os objetos não**. Sem colher a `url`
 * daqui antes, cada foto enviada por esse caminho fica no bucket para sempre.
 */
export const TABELA_DE_FOTOS_DA_CONSULTA = 'fotos_consulta'

export const CHAVES_DE_IMAGEM_ANINHADAS = ['fotos', 'url', 'path', 'planta_url'] as const

/**
 * Junta, de uma linha de `consultas`, tudo que parece caminho de imagem.
 *
 * As colunas têm formas diferentes: duas são texto, `fotos_antes`/`fotos_depois`
 * são arrays de texto, e `fotos_comodos` é array de `{ comodo, fotos[] }`.
 * Achatar tudo aqui deixa a rota sem um `if` por coluna — e sem a chance de
 * esquecer uma quando o formato mudar.
 */
export function fotosDaConsulta(
  linha: Record<string, unknown>,
  colunas: readonly string[] = COLUNAS_DE_IMAGEM_DA_CONSULTA
): string[] {
  const encontradas: string[] = []

  const colher = (valor: unknown): void => {
    if (typeof valor === 'string') { encontradas.push(valor); return }
    if (Array.isArray(valor)) { valor.forEach(colher); return }
    if (valor && typeof valor === 'object') {
      // Só as chaves que guardam imagem.
      //
      // A tentação é descer em todos os valores do objeto, «para não depender
      // do formato». Não funciona: `FotoComodo` é `{ comodo, fotos[] }`, e
      // descer em tudo colhe o **nome do cômodo** junto — «sala» viraria um
      // caminho a remover. `caminhoDoObjeto` descartaria depois, mas uma função
      // que devolve lixo obriga quem chama a saber disso.
      for (const chave of CHAVES_DE_IMAGEM_ANINHADAS) {
        colher((valor as Record<string, unknown>)[chave])
      }
    }
  }

  for (const coluna of colunas) colher(linha[coluna])
  return encontradas
}

/**
 * Os caminhos que precisam sair do storage, agrupados por bucket.
 *
 * Apagar a linha não apaga o objeto: uma exclusão que limpa `clientes` e deixa
 * `clientes-fotos` cheio devolve o rosto das pessoas a quem tiver o link — e o
 * link continua válido, porque nada o invalidou. É a forma mais silenciosa de
 * a funcionalidade ser mentira.
 *
 * Recebe um mapa de bucket para valores crus. O mapa, e não dois parâmetros
 * posicionais como antes: com posição, somar o terceiro bucket exigia mexer em
 * toda chamada, e foi assim que `relatorios` ficou de fora.
 *
 * Pura de propósito — recebe o que o banco devolveu e diz o que apagar, sem
 * tocar em rede.
 */
export function arquivosParaApagar(
  porBucket: Record<string, readonly (string | null | undefined)[]>
): { bucket: string; paths: string[] }[] {
  return Object.entries(porBucket)
    .map(([bucket, valores]) => {
      const paths = valores
        .map((valor) => (valor ? caminhoDoObjeto(valor, bucket) : null))
        .filter((p): p is string => Boolean(p))
      // `Set` porque a mesma foto pode aparecer em mais de uma linha, e pedir
      // duas vezes a remoção do mesmo objeto faz a segunda parecer falha.
      return { bucket, paths: [...new Set(paths)] }
    })
    .filter((g) => g.paths.length > 0)
}

export interface ResumoDaExclusao {
  clientesApagados: number
  consultasApagadas: number
  arquivosApagados: number
  pedidosAnonimizados: number
}

/** Os três buckets que guardam arquivo do titular. */
export const BUCKETS_DO_TITULAR = {
  clientes: BUCKET_CLIENTES,
  imoveis: BUCKET_IMOVEIS,
  relatorios: BUCKET_RELATORIOS,
} as const
