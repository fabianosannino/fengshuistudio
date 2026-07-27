import { describe, expect, it, vi, afterEach } from 'vitest'
import {
  classificarErroAuth, falhaAuth, MENSAGEM_POR_CAUSA,
} from '../auth-erros'

/** Reproduz o formato de `AuthApiError` do supabase-js. */
function apiError(message: string, status: number, code = '') {
  return { name: 'AuthApiError', message, status, code }
}

afterEach(() => vi.restoreAllMocks())

describe('classificarErroAuth — o caso que motivou o módulo', () => {
  it('falha de rede NÃO vira "senha incorreta"', () => {
    const r = classificarErroAuth({
      name: 'AuthRetryableFetchError', message: 'Failed to fetch', status: 0,
    })
    expect(r.causa).toBe('rede-indisponivel')
    expect(r.mensagem).not.toMatch(/senha/i)
  })

  it('chave de API inválida NÃO vira "senha incorreta"', () => {
    // Foi exatamente isto que a tela mostrou como credencial errada.
    const r = classificarErroAuth(apiError('Invalid API key', 401))
    expect(r.causa).toBe('servico-indisponivel')
    expect(r.mensagem).not.toMatch(/senha/i)
  })

  it('erro de túnel/proxy do navegador cai em rede, não em credencial', () => {
    const r = classificarErroAuth(new TypeError('Failed to fetch'))
    expect(r.causa).toBe('rede-indisponivel')
  })
})

describe('classificarErroAuth — demais causas', () => {
  it('credencial errada de verdade continua sendo credencial errada', () => {
    const r = classificarErroAuth(apiError('Invalid login credentials', 400, 'invalid_credentials'))
    expect(r.causa).toBe('credenciais-invalidas')
    expect(r.mensagem).toBe(MENSAGEM_POR_CAUSA['credenciais-invalidas'])
  })

  it('e-mail não confirmado', () => {
    const r = classificarErroAuth(apiError('Email not confirmed', 400, 'email_not_confirmed'))
    expect(r.causa).toBe('email-nao-confirmado')
  })

  it('limite de tentativas (429)', () => {
    const r = classificarErroAuth(apiError('over_email_send_rate_limit', 429))
    expect(r.causa).toBe('limite-de-tentativas')
  })

  it('conta já existente', () => {
    const r = classificarErroAuth(apiError('User already registered', 422, 'user_already_exists'))
    expect(r.causa).toBe('conta-ja-existe')
  })

  it('senha fraca', () => {
    const r = classificarErroAuth(apiError('Password should be at least 6 characters', 400, 'weak_password'))
    expect(r.causa).toBe('senha-fraca')
  })

  it('5xx é serviço indisponível', () => {
    const r = classificarErroAuth(apiError('internal error', 503))
    expect(r.causa).toBe('servico-indisponivel')
  })

  it('erro irreconhecível não estoura e cai em desconhecida', () => {
    for (const entrada of [null, undefined, {}, 'texto solto', 42]) {
      expect(classificarErroAuth(entrada).causa, String(entrada)).toBe('desconhecida')
    }
  })
})

describe('a mensagem da tela nunca é a da biblioteca', () => {
  const vazamentos = [
    apiError('Invalid API key', 401),
    apiError('Invalid login credentials', 400, 'invalid_credentials'),
    apiError('duplicate key value violates unique constraint "users_pkey"', 422),
    { name: 'AuthRetryableFetchError', message: 'Failed to fetch', status: 0 },
  ]

  it('não repassa texto da lib nem detalhe técnico ao usuário', () => {
    const permitidas = new Set(Object.values(MENSAGEM_POR_CAUSA))
    for (const e of vazamentos) {
      const r = classificarErroAuth(e)
      expect(permitidas.has(r.mensagem), r.mensagem).toBe(true)
      expect(r.mensagem).not.toContain(e.message)
      // nada de nome de tabela, status HTTP ou identificador de código
      expect(r.mensagem).not.toMatch(/`|status=|\bAuth[A-Z]|constraint|\.tsx?\b/)
    }
  })

  it('o detalhe técnico existe — só que fora da tela', () => {
    const r = classificarErroAuth(apiError('Invalid API key', 401))
    expect(r.detalhe).toContain('Invalid API key')
    expect(r.detalhe).toContain('status=401')
  })
})

describe('falhaAuth registra sempre', () => {
  it('loga o detalhe e devolve a mesma classificação', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const r = falhaAuth(apiError('Invalid API key', 401), 'signInWithPassword')
    expect(r.causa).toBe('servico-indisponivel')
    expect(spy).toHaveBeenCalledOnce()
    const registrado = String(spy.mock.calls[0][0])
    expect(registrado).toContain('Invalid API key')
    expect(registrado).toContain('signInWithPassword')
  })

  it('o log tem só os campos previstos — nada de PII entra por acidente', () => {
    // A garantia real não é «a string não casa com /@/» (o nome da ação já
    // contém "Password"): é que o objeto registrado não carrega nenhum campo
    // além destes. E-mail e senha nunca são passados a `falhaAuth`.
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    falhaAuth(apiError('Invalid login credentials', 400), 'signInWithPassword')
    const entrada = JSON.parse(String(spy.mock.calls[0][0]))
    expect(Object.keys(entrada).sort()).toEqual(
      ['action', 'causa', 'detalhe', 'level', 'message', 'timestamp'])
  })
})
