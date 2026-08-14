/**
 * Os e-mails da loja.
 *
 * ## Por que a confirmação existe
 *
 * O comprador **não tem conta**. O link do pedido é a única forma de ele
 * acompanhar, e até agora esse link só era entregue na tela pós-pagamento —
 * quem fechasse a aba perdia o acesso, sem nenhuma outra porta. Era a única
 * peça da loja que dependia de o usuário não fechar uma janela.
 *
 * ## O que vai dentro
 *
 * O número do pedido, o que foi comprado, o total, **o prazo de
 * arrependimento** e o link. O prazo é o dado que mais evita atrito no
 * suporte: sem ele, a pergunta «até quando posso desistir?» chega por
 * WhatsApp.
 *
 * Nenhum valor de negócio do vendedor entra aqui — comissão e líquido são
 * assunto dele, e o e-mail do comprador não é lugar para isso. A regra é a
 * mesma da projeção pública (`pedido-publico.ts`).
 */

import { escaparHtml } from './email'

function reais(centavos: number): string {
  return (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function dataCurta(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('pt-BR')
}

const MOLDURA = (miolo: string) => `
<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;background:#F9FAFB;padding:24px">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;padding:28px">
    ${miolo}
    <p style="color:#9CA3AF;font-size:12px;margin:24px 0 0;border-top:1px solid #F3F4F6;padding-top:16px">
      Você recebeu este e-mail porque fez uma compra no FengShui Studio.
    </p>
  </div>
</div>`.trim()

export interface DadosDaConfirmacao {
  numero: string
  itens: { nome: string; quantidade: number }[]
  totalCentavos: number
  arrependimentoAte: string | null
  linkDoPedido: string
}

export function emailDeConfirmacao(dados: DadosDaConfirmacao): {
  assunto: string; html: string; texto: string
} {
  const itens = dados.itens
    .map(i => `<li style="margin-bottom:4px">${escaparHtml(i.nome)}${i.quantidade > 1 ? ` × ${i.quantidade}` : ''}</li>`)
    .join('')

  const prazo = dataCurta(dados.arrependimentoAte)

  const html = MOLDURA(`
    <h1 style="color:#0E1B2C;font-size:20px;margin:0 0 4px">Pagamento confirmado</h1>
    <p style="color:#6B7280;font-size:14px;margin:0 0 20px">Pedido ${escaparHtml(dados.numero)}</p>

    <ul style="color:#374151;font-size:14px;padding-left:20px;margin:0 0 12px">${itens}</ul>
    <p style="color:#0E1B2C;font-size:16px;font-weight:bold;margin:0 0 20px">
      Total: ${reais(dados.totalCentavos)}
    </p>

    <a href="${dados.linkDoPedido}" style="display:inline-block;padding:12px 24px;background:#2E7D6B;color:#ffffff;border-radius:8px;font-size:15px;font-weight:bold;text-decoration:none">
      Acompanhar meu pedido
    </a>

    <p style="color:#6B7280;font-size:13px;line-height:1.6;margin:20px 0 0">
      <strong>Guarde este link</strong> — é por ele que você acompanha o pedido e pode
      solicitar devolução.
      ${prazo ? ` Você pode desistir da compra até <strong>${prazo}</strong>, com devolução integral (CDC, art.&nbsp;49).` : ''}
    </p>
  `)

  const texto = [
    `Pagamento confirmado — pedido ${dados.numero}`,
    '',
    ...dados.itens.map(i => `- ${i.nome}${i.quantidade > 1 ? ` x${i.quantidade}` : ''}`),
    `Total: ${reais(dados.totalCentavos)}`,
    '',
    `Acompanhe seu pedido: ${dados.linkDoPedido}`,
    prazo ? `Você pode desistir até ${prazo}, com devolução integral (CDC art. 49).` : '',
    '',
    'Guarde este link: é por ele que você acompanha o pedido e pede devolução.',
  ].filter(Boolean).join('\n')

  return { assunto: `Pedido ${dados.numero} confirmado`, html, texto }
}

/**
 * Aviso ao vendedor de que o comprador pediu devolução.
 *
 * Existe porque o pedido de devolução nasce numa página que o vendedor não
 * visita: a do comprador. Sem este aviso, ele só descobriria abrindo
 * `/vendas` por conta própria — e o prazo do «de imediato» do art. 49 corre a
 * partir do pedido, não de quando ele resolveu olhar.
 */
export function emailDeDevolucaoSolicitada(dados: {
  numero: string
  totalCentavos: number
  linkDasVendas: string
}): { assunto: string; html: string; texto: string } {
  const html = MOLDURA(`
    <h1 style="color:#0E1B2C;font-size:20px;margin:0 0 4px">Devolução solicitada</h1>
    <p style="color:#6B7280;font-size:14px;margin:0 0 20px">
      O comprador do pedido ${escaparHtml(dados.numero)} pediu a devolução de
      ${reais(dados.totalCentavos)}.
    </p>

    <p style="color:#374151;font-size:14px;line-height:1.6;margin:0 0 20px">
      Dentro dos 7 dias, a devolução é integral e o valor deve ser estornado
      <strong>de imediato</strong>. A plataforma devolve a comissão junto.
    </p>

    <a href="${dados.linkDasVendas}" style="display:inline-block;padding:12px 24px;background:#0E1B2C;color:#ffffff;border-radius:8px;font-size:15px;font-weight:bold;text-decoration:none">
      Abrir minhas vendas
    </a>
  `)

  const texto = [
    `Devolução solicitada — pedido ${dados.numero}`,
    `Valor: ${reais(dados.totalCentavos)}`,
    '',
    'Dentro dos 7 dias a devolução é integral e deve ser estornada de imediato.',
    'A plataforma devolve a comissão junto.',
    '',
    `Estorne em: ${dados.linkDasVendas}`,
  ].join('\n')

  return { assunto: `Devolução solicitada — pedido ${dados.numero}`, html, texto }
}
