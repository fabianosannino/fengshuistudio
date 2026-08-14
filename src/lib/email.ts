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
 * Remetente. Precisa de domínio verificado no Resend — sem isso, o Resend só
 * entrega para o endereço dono da conta, e a venda de um cliente real não
 * chegaria a ninguém.
 */
const REMETENTE_PADRAO = 'FengShui Studio <nao-responda@fengshuistudio.com.br>'

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
