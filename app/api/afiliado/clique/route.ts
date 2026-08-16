/**
 * GET /api/afiliado/clique?codigo=… — o visitante que chega por um afiliado.
 *
 * Registra de quem veio e manda para a loja. É a metade da fase 5 que não pode
 * esperar: percentual se decide depois e se aplica a pedidos já gravados, mas
 * visita não registrada é atribuição perdida para sempre.
 *
 * ## Por que redireciona em vez de responder
 *
 * O link do afiliado é divulgado — vai em post, story, assinatura de e-mail.
 * Quem clica espera chegar na loja, não numa página de confirmação. A rota é
 * um pedágio invisível: mede e segue.
 *
 * ## Código inválido não é erro para o visitante
 *
 * Quem clicou não tem nada com isso: o link errado é do afiliado, ou é link
 * antigo de alguém que deixou o programa. Mostrar erro puniria a pessoa errada
 * e ainda revelaria quais códigos existem, para quem ficasse tentando. Segue
 * para a loja sem cookie, e o log guarda o que aconteceu.
 *
 * ## Não é a rota de indicação de saída
 *
 * `/api/loja/indicacao` manda o visitante **para fora**, à loja de um parceiro,
 * e mede volume sem identificar ninguém. Esta traz alguém **para dentro** e
 * precisa lembrar quem trouxe, porque vai haver dinheiro nosso no meio. Mesmo
 * nome de família, obrigações opostas.
 */

import { NextResponse } from 'next/server'
import { logger } from '../../../../src/lib/logger'
import { rateLimit, ipDaRequisicao } from '../../../../src/lib/rate-limit'
import { createSupabaseAdminClient } from '../../../../src/lib/supabase-admin'
import { escreverBestEffort } from '../../../../src/lib/supabase-escrita'
import {
  COOKIE_DO_VISITANTE, COOKIE_DO_VISITANTE_DIAS,
  ehCodigoDeAfiliadoValido, novaIdentidadeDeVisitante, hashDoVisitante, expiraEm,
} from '../../../../src/lib/atribuicao-de-afiliado'

const ROUTE = '/api/afiliado/clique'

/** Para onde o visitante vai, dê certo ou não o registro. */
const DESTINO = '/produtos'

export async function GET(request: Request) {
  const resposta = NextResponse.redirect(new URL(DESTINO, request.url), 302)

  const { success } = await rateLimit(ipDaRequisicao(request), { limit: 30, windowMs: 60_000 })
  if (!success) {
    // Mesmo estourando o limite o visitante chega à loja. Recusar a navegação
    // por causa da nossa contabilidade seria cobrar dele o nosso problema.
    logger.warn('Clique de afiliado acima do limite — seguiu sem registro', { route: ROUTE })
    return resposta
  }

  const codigo = new URL(request.url).searchParams.get('codigo')
  if (!ehCodigoDeAfiliadoValido(codigo)) {
    logger.info('Clique de afiliado com código de forma inválida', { route: ROUTE })
    return resposta
  }

  const supabase = createSupabaseAdminClient()

  // `ilike` sem curinga: o índice de unicidade é sobre `lower(codigo)`, então
  // maiúscula digitada errada não deve custar a comissão de ninguém.
  const { data: afiliado, error } = await supabase
    .from('profiles')
    .select('id')
    .ilike('codigo_de_afiliado', codigo!)
    .maybeSingle()

  if (error) {
    logger.error('Falha ao resolver o código de afiliado', { route: ROUTE, error: error.message })
    return resposta
  }

  if (!afiliado) {
    logger.info('Clique de afiliado com código inexistente', { route: ROUTE })
    return resposta
  }

  /*
   * A identidade do visitante é reaproveitada quando já existe.
   *
   * Trocar a cada clique quebraria a própria regra que este módulo implementa:
   * «último clique» precisa que os cliques do mesmo visitante sejam
   * reconhecíveis entre si. Com identidade nova a cada vez, todo clique seria
   * o primeiro e o último de um visitante diferente.
   */
  const existente = request.headers.get('cookie')
    ?.split(';')
    .map(p => p.trim())
    .find(p => p.startsWith(`${COOKIE_DO_VISITANTE}=`))
    ?.split('=')[1]

  const identidade = existente || novaIdentidadeDeVisitante()
  const agora = new Date()

  const gravou = await escreverBestEffort(
    supabase.from('indicacoes').insert({
      afiliado_perfil_id: afiliado.id,
      codigo,
      visitante_hash: hashDoVisitante(identidade),
      expira_em: expiraEm(agora).toISOString(),
    }),
    { rota: ROUTE, operacao: 'registrar a indicação de afiliado' }
  )

  /*
   * Best-effort **declarado**: o visitante chega à loja mesmo se o registro
   * falhar. O custo é uma atribuição perdida; a alternativa seria negar a
   * navegação a quem clicou num link legítimo, o que é pior para as três
   * partes.
   *
   * O cookie só é escrito se a linha entrou. Um cookie sem indicação no banco
   * não atribui nada e ainda faria a próxima visita parecer conhecida.
   */
  if (!gravou) return resposta

  resposta.cookies.set(COOKIE_DO_VISITANTE, identidade, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    // `lax` e não `strict`: o link chega de fora — de uma rede social, de um
    // e-mail — e `strict` não manda cookie em navegação vinda de outro site,
    // que é exatamente a única forma como este link é usado.
    sameSite: 'lax',
    path: '/',
    maxAge: COOKIE_DO_VISITANTE_DIAS * 24 * 60 * 60,
  })

  logger.info('Clique de afiliado registrado', { route: ROUTE, afiliadoId: afiliado.id })
  return resposta
}
