/**
 * Envio de e-mail transacional (Resend), pela API HTTP.
 *
 * ## Sem SDK, de propósito
 *
 * A API é um `POST` com JSON. Uma dependência a mais traria atualizações,
 * vulnerabilidades e peso de bundle para economizar dez linhas — e este
 * projeto já paga esse imposto em `stripe` e `@supabase`, onde ele se
 * justifica.
 *
 * ## Best-effort **declarado**
 *
 * Falha de e-mail **nunca** desfaz o que já aconteceu. Quando isto é chamado,
 * a venda está paga e registrada; devolver erro faria o webhook responder 500,
 * o Stripe reentregar, e a reentrega refazer trabalho que já estava certo —
 * trocando um aviso perdido por um evento reprocessado.
 *
 * O que não pode é a falha sumir. Por isso devolve boolean e registra, no
 * mesmo espírito de `escreverBestEffort` (`supabase-escrita.ts`): best-effort é
 * decisão declarada, não descuido.
 *
 * ## Sem chave, não envia — e diz
 *
 * Em desenvolvimento e em preview não há `RESEND_API_KEY`. A ausência vira log
 * de informação, não erro: é o estado esperado ali. O que seria ruim é o
 * silêncio, porque tornaria indistinguível «não configurado» de «não enviou».
 */

import { logger } from './logger'

const ENDPOINT = 'https://api.resend.com/emails'

/**
 * Remetente padrão.
 *
 * ## Por que `collabz.com.br` e não `fengshuistudio.com.br`
 *
 * Parece errado à primeira vista — o app é o FengShui Studio. O domínio aqui
 * não é o da marca: é **o domínio verificado no Resend**, e são coisas
 * diferentes.
 *
 * O plano gratuito do Resend dá **um** domínio verificado, e a CollabZ tem
 * vários produtos que vão precisar mandar e-mail. Como um domínio verificado
 * cobre infinitos endereços nele, um único `collabz.com.br` atende todos —
 * `fengshui@`, `ervatorio@`, e o que vier — em vez de gastar um plano pago
 * para ter um domínio por marca.
 *
 * Quem carrega a marca é o **nome de exibição**, que é o que a caixa de
 * entrada mostra em destaque; o endereço só aparece para quem abre os
 * detalhes.
 *
 * ## O que muda se o padrão estiver errado
 *
 * Remetente em domínio não verificado é **recusado** pelo Resend. Como este
 * módulo é best-effort, a recusa vira log e o comprador fica sem o link do
 * pedido — que é o único acesso que ele tem. Por isso o padrão aponta para o
 * domínio que de fato será verificado, e não para o que seria mais bonito:
 * esquecer o `EMAIL_REMETENTE` no deploy passa a ser inofensivo em vez de
 * silenciosamente quebrar a entrega.
 */
const REMETENTE_PADRAO = 'FengShui Studio <nao-responda@collabz.com.br>'

/**
 * Para onde vai a resposta do comprador.
 *
 * ## Por que existe, separado do remetente
 *
 * Endereço de envio e caixa postal são coisas diferentes: o Resend manda de
 * qualquer endereço no domínio verificado, exista caixa ou não. Já **receber**
 * exige caixa de verdade — e é isso que se paga por usuário no provedor de
 * e-mail.
 *
 * Daí a separação. O remetente carrega a marca e não precisa existir; o
 * `Reply-To` aponta para a única caixa que existe hoje.
 *
 * Sem isto, quem respondesse à confirmação da compra escreveria para
 * `nao-responda@`, que não é lido por ninguém — e a resposta de um comprador
 * confuso é exatamente a que não pode se perder.
 */
const RESPONDER_PARA_PADRAO = 'fsannino@collabz.com.br'

export interface EmailParaEnviar {
  para: string
  assunto: string
  html: string
  /** Texto puro. Cliente que não renderiza HTML não deve receber tela em branco. */
  texto?: string
}

export async function enviarEmail(
  email: EmailParaEnviar,
  origemDoLog: string
): Promise<boolean> {
  const chave = process.env.RESEND_API_KEY
  const remetente = process.env.EMAIL_REMETENTE || REMETENTE_PADRAO
  const responderPara = process.env.EMAIL_RESPONDER_PARA || RESPONDER_PARA_PADRAO

  if (!chave) {
    logger.info('Envio de e-mail ignorado — RESEND_API_KEY ausente', {
      origem: origemDoLog, assunto: email.assunto,
    })
    return false
  }

  if (!email.para.includes('@')) {
    logger.warn('Envio de e-mail ignorado — destinatário inválido', { origem: origemDoLog })
    return false
  }

  try {
    const resposta = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${chave}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: remetente,
        // `reply_to` aceita lista; uma entrada só, e ela precisa ser uma caixa
        // que alguém lê — ver `RESPONDER_PARA_PADRAO`.
        ...(responderPara ? { reply_to: [responderPara] } : {}),
        to: [email.para],
        subject: email.assunto,
        html: email.html,
        text: email.texto,
      }),
    })

    if (!resposta.ok) {
      // O corpo do erro do Resend diz o motivo — domínio não verificado,
      // remetente recusado — e é o que faz a diferença entre consertar em um
      // minuto e adivinhar. Não contém dado do comprador.
      const detalhe = await resposta.text().catch(() => '')
      logger.error('Resend recusou o envio', {
        origem: origemDoLog, status: resposta.status, detalhe: detalhe.slice(0, 300),
      })
      return false
    }

    logger.info('E-mail enviado', { origem: origemDoLog, assunto: email.assunto })
    return true
  } catch (err) {
    logger.error('Falha ao falar com o Resend', { origem: origemDoLog, error: String(err) })
    return false
  }
}

/**
 * Escapa o que vai para dentro do HTML.
 *
 * Nome de comprador e nome de produto vêm do Stripe e do cadastro do
 * consultor — nenhum dos dois é confiável para interpolar cru. Um `<script>`
 * num nome de produto não roda no e-mail da maioria dos clientes, mas um
 * `</div>` mal colocado quebra o layout, e um `<a>` transforma o nosso aviso
 * em phishing assinado por nós.
 */
export function escaparHtml(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
