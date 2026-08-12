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
