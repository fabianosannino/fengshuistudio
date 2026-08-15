import { describe, expect, it } from 'vitest'
import {
  decidirAcesso, mfaExigido, isentaDeMfa,
  ROTA_DE_VERIFICACAO, MFA_DESLIGADO_POR_CONFIG,
  type NiveisDaSessao,
} from '../mfa-admin'

const COM_FATOR_VERIFICADO: NiveisDaSessao = { currentLevel: 'aal2', nextLevel: 'aal2' }
const COM_FATOR_NAO_CONFIRMADO: NiveisDaSessao = { currentLevel: 'aal1', nextLevel: 'aal2' }
const SEM_FATOR: NiveisDaSessao = { currentLevel: 'aal1', nextLevel: 'aal1' }
const CONSULTA_FALHOU: NiveisDaSessao = { currentLevel: null, nextLevel: null }

describe('decidirAcesso', () => {
  it('libera quem já confirmou o segundo fator nesta sessão', () => {
    expect(decidirAcesso(COM_FATOR_VERIFICADO, true)).toBe('liberado')
  })

  it('pede o código a quem tem fator mas ainda não confirmou', () => {
    expect(decidirAcesso(COM_FATOR_NAO_CONFIRMADO, true)).toBe('precisa_verificar')
  })

  it('pede cadastro a quem não tem fator nenhum', () => {
    expect(decidirAcesso(SEM_FATOR, true)).toBe('precisa_cadastrar')
  })

  /**
   * O teste que existe por causa do Ervatório.
   *
   * Lá, o `catch` em volta da consulta devolve `true` — «MFA indisponível,
   * prosseguindo sem MFA». Qualquer instabilidade de rede vira painel aberto.
   *
   * Aqui o desconhecido é um estado nomeado, e ele **não** é acesso.
   */
  it('NÃO libera quando não foi possível determinar o nível', () => {
    expect(decidirAcesso(CONSULTA_FALHOU, true)).toBe('indeterminado')
  })

  it('não libera nem com nível parcialmente conhecido', () => {
    expect(decidirAcesso({ currentLevel: 'aal2', nextLevel: null }, true)).toBe('indeterminado')
    expect(decidirAcesso({ currentLevel: null, nextLevel: 'aal2' }, true)).toBe('indeterminado')
  })

  it('libera tudo — inclusive o indeterminado — quando o MFA não é exigido', () => {
    for (const niveis of [COM_FATOR_VERIFICADO, COM_FATOR_NAO_CONFIRMADO, SEM_FATOR, CONSULTA_FALHOU]) {
      expect(decidirAcesso(niveis, false)).toBe('liberado')
    }
  })
})

describe('mfaExigido', () => {
  it('exige quando a variável não está definida', () => {
    // O padrão fechado é o ponto: esquecer de configurar não afrouxa nada.
    expect(mfaExigido(undefined)).toBe(true)
  })

  it('exige quando a variável está vazia', () => {
    expect(mfaExigido('')).toBe(true)
  })

  it('desliga apenas com a string exata', () => {
    expect(mfaExigido(MFA_DESLIGADO_POR_CONFIG)).toBe(false)
  })

  it('não desliga com valores parecidos', () => {
    // `'False'`, `'0'` e `'no'` são as formas que alguém escreve achando que
    // desligou. Nenhuma desliga — e o painel continua exigindo, que é o lado
    // seguro de errar.
    for (const quase of ['False', 'FALSE', '0', 'no', 'off', 'nao', ' false']) {
      expect(mfaExigido(quase)).toBe(true)
    }
  })
})

describe('isentaDeMfa', () => {
  it('isenta a própria tela de verificação', () => {
    // Sem isso a tela que resolve a pendência é bloqueada pela pendência, e o
    // redirecionamento se fecha num laço.
    expect(isentaDeMfa(ROTA_DE_VERIFICACAO)).toBe(true)
  })

  it('não isenta o resto do painel', () => {
    for (const rota of ['/admin', '/admin/chaves', '/admin/pagamentos']) {
      expect(isentaDeMfa(rota)).toBe(false)
    }
  })

  it('não isenta por prefixo', () => {
    // Um `startsWith` deixaria estas passarem sem ninguém reparar.
    expect(isentaDeMfa(`${ROTA_DE_VERIFICACAO}-de-email`)).toBe(false)
    expect(isentaDeMfa(`${ROTA_DE_VERIFICACAO}/../chaves`)).toBe(false)
  })
})
