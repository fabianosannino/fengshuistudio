import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { origemDaAplicacao } from '../auth-rotas'

function pedido(headers: Record<string, string> = {}): Request {
  return new Request('https://exemplo.test/api/stripe/subscribe', { method: 'POST', headers })
}

beforeEach(() => {
  vi.stubEnv('APP_ALLOWED_ORIGINS', '')
  vi.stubEnv('VERCEL_ENV', '')
})
afterEach(() => {
  vi.unstubAllEnvs()
})

describe('origemDaAplicacao', () => {
  it('ignora um Origin arbitrário mesmo quando é uma URL válida', () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://configurado.example')
    expect(origemDaAplicacao(pedido({ origin: 'https://app.example' }))).toBe('https://configurado.example')
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

  it('um alias explicitamente autorizado continua válido com a variável principal ruim', () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://fengshuistudio.vercel.')
    vi.stubEnv('APP_ALLOWED_ORIGINS', 'https://app.example')
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

describe('lista explícita de origens', () => {
  it('aceita somente um alias exato', () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://configurado.example')
    vi.stubEnv('APP_ALLOWED_ORIGINS', 'https://app.example')
    expect(origemDaAplicacao(pedido({origin:'https://app.example'}))).toBe('https://app.example')
    expect(origemDaAplicacao(pedido({origin:'https://app.example.evil.test'}))).toBe('https://configurado.example')
  })
  it.each(['https://user:password@app.example','https://app.example/path','https://app.example?secret=1','https://app.example#x','http://app.example'])('recusa configuração ambígua %s', origem => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('NEXT_PUBLIC_APP_URL', origem)
    expect(() => origemDaAplicacao(pedido())).toThrow()
  })
  it('usa apenas o host da preview informado pela plataforma', () => {
    vi.stubEnv('NODE_ENV','production')
    vi.stubEnv('NEXT_PUBLIC_APP_URL','')
    vi.stubEnv('VERCEL_ENV','preview')
    vi.stubEnv('VERCEL_URL','preview-project.vercel.app')
    expect(origemDaAplicacao(pedido({origin:'https://evil.example'}))).toBe('https://preview-project.vercel.app')
  })
  it('retorna para a preview em chamadas de servidor mesmo com a URL principal configurada', () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL','https://production.example')
    vi.stubEnv('VERCEL_ENV','preview')
    vi.stubEnv('VERCEL_URL','preview-project.vercel.app')
    expect(origemDaAplicacao(pedido())).toBe('https://preview-project.vercel.app')
  })
})
