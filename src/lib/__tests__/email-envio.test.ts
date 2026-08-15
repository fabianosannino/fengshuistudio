import { describe, it, expect, vi, afterEach } from 'vitest'
import { enviarEmail } from '../email'

/**
 * O que este arquivo protege é o **envelope** — de quem sai e para onde volta.
 * O conteúdo dos e-mails é assunto de `emails-do-pedido.test.ts`.
 *
 * A distinção não é cosmética: um corpo errado é visível para quem lê o
 * e-mail, enquanto um envelope errado falha em silêncio. Remetente em domínio
 * não verificado é recusado com 403 pelo Resend e, como o envio é best-effort
 * declarado, o comprador simplesmente não recebe o único link que tem para o
 * pedido. Foi exatamente isso que aconteceu em produção até 15/08.
 */

const EMAIL = { para: 'comprador@exemplo.test', assunto: 'Pedido confirmado', html: '<p>oi</p>' }

/** Devolve o corpo JSON que `enviarEmail` mandou ao Resend. */
async function corpoEnviado(): Promise<Record<string, unknown>> {
  const fetchFalso = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }))
  vi.stubGlobal('fetch', fetchFalso)

  await enviarEmail(EMAIL, 'teste')

  expect(fetchFalso).toHaveBeenCalledOnce()
  const [, init] = fetchFalso.mock.calls[0] as [string, RequestInit]
  return JSON.parse(String(init.body))
}

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('enviarEmail — remetente', () => {
  it('sai do domínio verificado no Resend, mesmo sem EMAIL_REMETENTE', async () => {
    // O padrão do código é a rede de segurança de esquecer a variável no
    // deploy. Se ele apontar para um domínio não verificado, esquecer deixa de
    // ser inofensivo e passa a derrubar a entrega inteira, sem erro visível.
    vi.stubEnv('RESEND_API_KEY', 'chave-de-teste')
    vi.stubEnv('EMAIL_REMETENTE', '')

    const corpo = await corpoEnviado()
    expect(String(corpo.from)).toContain('@collabz.com.br')
  })

  it('usa a caixa que existe de verdade', async () => {
    // `fsannino@` é a única caixa real hoje: envia porque o domínio está
    // verificado, e recebe porque a caixa existe.
    vi.stubEnv('RESEND_API_KEY', 'chave-de-teste')
    vi.stubEnv('EMAIL_REMETENTE', '')

    const corpo = await corpoEnviado()
    expect(corpo.from).toBe('FengShui Studio <fsannino@collabz.com.br>')
  })

  it('EMAIL_REMETENTE vence o padrão', async () => {
    vi.stubEnv('RESEND_API_KEY', 'chave-de-teste')
    vi.stubEnv('EMAIL_REMETENTE', 'Outro <fengshui@collabz.com.br>')

    const corpo = await corpoEnviado()
    expect(corpo.from).toBe('Outro <fengshui@collabz.com.br>')
  })
})

describe('enviarEmail — Reply-To', () => {
  it('é omitido quando aponta para o próprio remetente', async () => {
    // Cabeçalho que não muda o destino da resposta é ruído, e alguns clientes
    // exibem o aviso de «responder para outro endereço» sem que haja outro.
    vi.stubEnv('RESEND_API_KEY', 'chave-de-teste')
    vi.stubEnv('EMAIL_REMETENTE', '')
    vi.stubEnv('EMAIL_RESPONDER_PARA', '')

    const corpo = await corpoEnviado()
    expect(corpo).not.toHaveProperty('reply_to')
  })

  it('compara pelo endereço, não pela string — nome de exibição não conta', async () => {
    // O remetente traz nome de exibição e o `Reply-To` não. Comparar as
    // strings cruas diria que são endereços diferentes, e o cabeçalho voltaria
    // a ser enviado apontando para o mesmo lugar.
    vi.stubEnv('RESEND_API_KEY', 'chave-de-teste')
    vi.stubEnv('EMAIL_REMETENTE', 'FengShui Studio <FSannino@Collabz.com.br>')
    vi.stubEnv('EMAIL_RESPONDER_PARA', 'fsannino@collabz.com.br')

    const corpo = await corpoEnviado()
    expect(corpo).not.toHaveProperty('reply_to')
  })

  it('vai junto quando a resposta cai em outra caixa', async () => {
    // O caso que justifica a constante continuar existindo: no dia em que o
    // envio sair de `fengshui@`, a resposta ainda precisa chegar em alguém.
    vi.stubEnv('RESEND_API_KEY', 'chave-de-teste')
    vi.stubEnv('EMAIL_REMETENTE', 'FengShui Studio <fengshui@collabz.com.br>')
    vi.stubEnv('EMAIL_RESPONDER_PARA', 'fsannino@collabz.com.br')

    const corpo = await corpoEnviado()
    expect(corpo.reply_to).toEqual(['fsannino@collabz.com.br'])
  })
})

describe('enviarEmail — recusas', () => {
  it('sem chave, não chama o Resend e devolve false', async () => {
    // Estado esperado em desenvolvimento e em preview. O que não pode é o
    // silêncio, que tornaria «não configurado» indistinguível de «não enviou».
    vi.stubEnv('RESEND_API_KEY', '')
    const fetchFalso = vi.fn()
    vi.stubGlobal('fetch', fetchFalso)

    expect(await enviarEmail(EMAIL, 'teste')).toBe(false)
    expect(fetchFalso).not.toHaveBeenCalled()
  })

  it('403 do Resend devolve false em vez de lançar', async () => {
    // Best-effort declarado: a venda já está paga e registrada quando isto
    // roda. Lançar faria o webhook responder 500 e o Stripe reentregar um
    // evento que já foi processado certo.
    vi.stubEnv('RESEND_API_KEY', 'chave-de-teste')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response('{"message":"The domain is not verified"}', { status: 403 }),
    ))

    expect(await enviarEmail(EMAIL, 'teste')).toBe(false)
  })
})
