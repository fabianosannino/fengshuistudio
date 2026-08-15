import { afterEach, describe, expect, it, vi } from 'vitest'
import { origemDaAplicacao } from '../auth-rotas'

function pedido(headers: Record<string, string> = {}): Request {
  return new Request('https://exemplo.test/api/stripe/subscribe', { method: 'POST', headers })
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('origemDaAplicacao', () => {
  it('usa o origin da requisição — é onde o usuário realmente está', () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://configurado.example')
    expect(origemDaAplicacao(pedido({ origin: 'https://app.example' }))).toBe('https://app.example')
  })

  it('cai para a variável quando não há origin', () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://configurado.example')
    expect(origemDaAplicacao(pedido())).toBe('https://configurado.example')
  })

  it('tira a barra final, para a URL montada não ter barra dupla', () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://configurado.example/')
    expect(origemDaAplicacao(pedido())).toBe('https://configurado.example')
  })

  it('em produção sem nada, lança em vez de mandar para localhost', () => {
    // Este é o defeito que originou a função: o `|| 'http://localhost:3000'`
    // silencioso mandou um cliente que acabara de pagar com cartão para
    // ERR_CONNECTION_REFUSED. Falhar é melhor que fingir um destino.
    vi.stubEnv('NEXT_PUBLIC_APP_URL', '')
    vi.stubEnv('NODE_ENV', 'production')
    expect(() => origemDaAplicacao(pedido())).toThrow(/NEXT_PUBLIC_APP_URL/)
  })

  it('em desenvolvimento sem nada, localhost segue valendo', () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', '')
    vi.stubEnv('NODE_ENV', 'development')
    expect(origemDaAplicacao(pedido())).toBe('http://localhost:3000')
  })

  it('origin que não é URL não é aceito', () => {
    // `null` é o que um navegador manda em requisição opaca; usá-lo como
    // origem produziria `null/stripe/success`.
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://configurado.example')
    for (const invalido of ['null', 'file://x', 'javascript:alert(1)']) {
      expect(origemDaAplicacao(pedido({ origin: invalido })), invalido).toBe('https://configurado.example')
    }
  })
})

describe('variável mal digitada não vira link quebrado', () => {
  /*
   * Aconteceu em produção, 15/08: `NEXT_PUBLIC_APP_URL` estava como
   * `https://fengshuistudio.vercel.` — faltando o `app`.
   *
   * O checkout não sofreu, porque ali a requisição vem do browser e traz
   * `origin`. O **webhook** não traz, caiu na variável, e o e-mail de
   * confirmação foi entregue ao comprador com o único link que ele tem
   * apontando para um domínio que não existe.
   *
   * Nada quebrou, nada falhou, e só o destinatário descobriria.
   */
  it('host terminado em ponto é recusado — é a forma exata do engano', () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://fengshuistudio.vercel.')
    vi.stubEnv('NODE_ENV', 'production')
    expect(() => origemDaAplicacao(pedido())).toThrow(/NEXT_PUBLIC_APP_URL/)
  })

  it('mas o origin da requisição continua valendo, mesmo com a variável ruim', () => {
    // A variável só é consultada quando não há `origin`. Recusá-la não pode
    // derrubar o caminho que estava funcionando.
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://fengshuistudio.vercel.')
    expect(origemDaAplicacao(pedido({ origin: 'https://app.example' }))).toBe('https://app.example')
  })

  it('recusa o que não é URL absoluta', () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'fengshuistudio.com.br')
    vi.stubEnv('NODE_ENV', 'production')
    expect(() => origemDaAplicacao(pedido())).toThrow()
  })

  it('recusa esquema que não serve de link', () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'javascript:alert(1)')
    vi.stubEnv('NODE_ENV', 'production')
    expect(() => origemDaAplicacao(pedido())).toThrow()
  })

  it('host sem ponto não passa em produção', () => {
    // `https://fengshuistudio` é o outro jeito de errar a mesma coisa.
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://fengshuistudio')
    vi.stubEnv('NODE_ENV', 'production')
    expect(() => origemDaAplicacao(pedido())).toThrow()
  })

  it('o valor bom continua passando', () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://fengshuistudio.vercel.app')
    expect(origemDaAplicacao(pedido())).toBe('https://fengshuistudio.vercel.app')
  })
})
