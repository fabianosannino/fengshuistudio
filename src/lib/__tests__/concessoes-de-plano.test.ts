import { describe, expect, it } from 'vitest'
import {
  concessaoViva, planoDasConcessoes, concessoesVivas, type Concessao,
} from '../concessoes-de-plano'

const AGORA = new Date('2026-08-13T12:00:00Z')
const ONTEM = '2026-08-12T12:00:00Z'
const AMANHA = '2026-08-14T12:00:00Z'

function concessao(over: Partial<Concessao> = {}): Concessao {
  return { plano: 'profissional', origem: 'chave', valido_de: ONTEM, ...over }
}

describe('concessaoViva', () => {
  it('vale quando começou e não tem prazo', () => {
    expect(concessaoViva(concessao({ valido_ate: null }), AGORA)).toBe(true)
  })

  it('sem prazo não é o mesmo que vencida', () => {
    // É esta distinção que faz a concessão de uma chave sobreviver ao
    // cancelamento de uma assinatura.
    expect(concessaoViva(concessao({ valido_ate: null }), AGORA)).toBe(true)
    expect(concessaoViva(concessao({ valido_ate: ONTEM }), AGORA)).toBe(false)
  })

  it('ainda não começou não vale — cortesia agendada', () => {
    expect(concessaoViva(concessao({ valido_de: AMANHA }), AGORA)).toBe(false)
  })

  it('encerrada não vale, mesmo dentro do prazo', () => {
    // Cancelamento e estorno encerram antes do prazo. «Venceu» e «foi
    // revogada» são fatos diferentes, e por isso são colunas diferentes.
    expect(concessaoViva(concessao({ valido_ate: AMANHA, encerrada_em: ONTEM }), AGORA)).toBe(false)
  })

  it('o instante do fim já não vale', () => {
    const exato = '2026-08-13T12:00:00Z'
    expect(concessaoViva(concessao({ valido_ate: exato }), AGORA)).toBe(false)
  })

  it('data ilegível não invalida a concessão', () => {
    // Entre tirar acesso de quem paga e manter por causa de um campo corrompido,
    // o primeiro erro é o caro.
    expect(concessaoViva(concessao({ valido_ate: 'não é data' }), AGORA)).toBe(true)
    expect(concessaoViva(concessao({ valido_de: 'nem esta' }), AGORA)).toBe(true)
  })
})

describe('planoDasConcessoes', () => {
  it('sem concessão o plano é free — ausência, não omissão', () => {
    // Gratuito É a ausência de concessão. Por isso o backfill não cria linha
    // para quem já era gratuito.
    expect(planoDasConcessoes([], AGORA)).toBe('free')
  })

  it('a maior concessão viva vence', () => {
    const r = planoDasConcessoes([
      concessao({ plano: 'simples', origem: 'assinatura' }),
      concessao({ plano: 'profissional', origem: 'chave' }),
    ], AGORA)
    expect(r).toBe('profissional')
  })

  it('O DEFEITO DE 13/08: cancelar a assinatura não derruba a chave', () => {
    // Perfil com Profissional por chave compra o Simples e cancela. Antes, o
    // cancelamento escrevia 'free' direto no perfil e apagava a chave junto.
    const r = planoDasConcessoes([
      concessao({ plano: 'simples', origem: 'assinatura', encerrada_em: ONTEM }),
      concessao({ plano: 'profissional', origem: 'chave', valido_ate: null }),
    ], AGORA)
    expect(r).toBe('profissional')
  })

  it('encerrar a última concessão viva devolve ao gratuito', () => {
    const r = planoDasConcessoes([
      concessao({ plano: 'profissional', origem: 'assinatura', encerrada_em: ONTEM }),
    ], AGORA)
    expect(r).toBe('free')
  })

  it('concessão vencida não conta', () => {
    const r = planoDasConcessoes([
      concessao({ plano: 'profissional', origem: 'chave', valido_ate: ONTEM }),
      concessao({ plano: 'simples', origem: 'assinatura', valido_ate: null }),
    ], AGORA)
    expect(r).toBe('simples')
  })

  it('plano desconhecido não vira palpite', () => {
    // Valor fora do vocabulário perde para qualquer coisa conhecida, inclusive
    // free. Conceder por não reconhecer seria dar recurso a quem não comprou.
    expect(planoDasConcessoes([concessao({ plano: 'agencia_premium' })], AGORA)).toBe('free')
  })

  it('cortesia agendada só vale a partir da data', () => {
    const futura = [concessao({ plano: 'profissional', origem: 'cortesia', valido_de: AMANHA })]
    expect(planoDasConcessoes(futura, AGORA)).toBe('free')
    expect(planoDasConcessoes(futura, new Date('2026-08-15T00:00:00Z'))).toBe('profissional')
  })
})

describe('concessoesVivas', () => {
  it('filtra o que está valendo, para responder «por que tenho este plano»', () => {
    const todas = [
      concessao({ plano: 'profissional', origem: 'chave' }),
      concessao({ plano: 'simples', origem: 'assinatura', encerrada_em: ONTEM }),
      concessao({ plano: 'simples', origem: 'cortesia', valido_ate: ONTEM }),
    ]
    const vivas = concessoesVivas(todas, AGORA)
    expect(vivas).toHaveLength(1)
    expect(vivas[0].origem).toBe('chave')
  })
})
