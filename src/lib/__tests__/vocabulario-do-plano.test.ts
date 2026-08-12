import { describe, expect, it } from 'vitest'
import { planoEfetivo, enumDoPlano, type PlanoEfetivo } from '../plano-utils'

/**
 * Os valores que o enum `plano_tipo` aceita no banco, conferidos em produção:
 *
 *     select enumlabel from pg_enum
 *     join pg_type on pg_type.oid = enumtypid where typname = 'plano_tipo'
 */
const ENUM_DO_BANCO = ['freemium', 'starter', 'pro', 'agencia'] as const

const PLANOS: PlanoEfetivo[] = ['free', 'simples', 'profissional']

describe('planoEfetivo', () => {
  it('traduz todo valor que o banco pode conter', () => {
    // `starter` caía no `return 'free'` por omissão: o usuário pagava o Simples
    // e o app entregava o gratuito. `agencia` tinha o mesmo destino.
    expect(planoEfetivo('freemium')).toBe('free')
    expect(planoEfetivo('starter')).toBe('simples')
    expect(planoEfetivo('pro')).toBe('profissional')
    expect(planoEfetivo('agencia')).toBe('profissional')
  })

  it('nenhum valor do banco vira «free» por engano', () => {
    // Só `freemium` é gratuito. Qualquer outro valor do enum é plano pago, e
    // devolver 'free' para um deles retira recurso de quem pagou.
    for (const valor of ENUM_DO_BANCO) {
      if (valor === 'freemium') continue
      expect(planoEfetivo(valor), valor).not.toBe('free')
    }
  })

  it('aceita também o vocabulário do app', () => {
    for (const plano of PLANOS) {
      expect(planoEfetivo(plano), plano).toBe(plano)
    }
  })

  it('valor desconhecido ou vazio é free', () => {
    // Aqui 'free' é a resposta certa: na dúvida, não conceder recurso pago.
    for (const v of [null, undefined, '', '   ', 'xyz']) {
      expect(planoEfetivo(v as string), String(v)).toBe('free')
    }
  })

  it('caixa e espaço não separam', () => {
    expect(planoEfetivo('  STARTER ')).toBe('simples')
    expect(planoEfetivo('Pro')).toBe('profissional')
  })
})

describe('enumDoPlano', () => {
  it('devolve sempre um rótulo que o enum aceita', () => {
    // Gravar fora desta lista derruba a transação inteira com
    // `invalid input value for enum plano_tipo`.
    for (const plano of PLANOS) {
      expect(ENUM_DO_BANCO, plano).toContain(enumDoPlano(plano))
    }
  })

  it('a ida e a volta preservam o plano', () => {
    // Se `enumDoPlano` e `planoEfetivo` discordassem, salvar o plano mudaria o
    // plano — o usuário escolhe Simples e o app relê como outra coisa.
    for (const plano of PLANOS) {
      expect(planoEfetivo(enumDoPlano(plano)), plano).toBe(plano)
    }
  })

  it('planos diferentes não colidem no mesmo rótulo', () => {
    const rotulos = PLANOS.map(enumDoPlano)
    expect(new Set(rotulos).size).toBe(PLANOS.length)
  })
})
