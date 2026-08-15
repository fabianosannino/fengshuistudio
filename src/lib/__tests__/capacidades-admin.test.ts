import { describe, expect, it } from 'vitest'
import {
  CAPACIDADES, CAPACIDADES_PADRAO, CAPACIDADE_DA_TELA,
  DESCRICAO_DA_CAPACIDADE, temCapacidade, ehCapacidadeConhecida,
  primeiraTelaVisivel, type Capacidade,
} from '../capacidades-admin'

const SO_RELATORIO: Capacidade[] = ['relatorios:ler']
const TUDO = [...CAPACIDADES]

describe('temCapacidade', () => {
  it('reconhece o que a pessoa tem', () => {
    expect(temCapacidade(SO_RELATORIO, 'relatorios:ler')).toBe(true)
  })

  /**
   * O ponto da mudança inteira: até aqui, quem lia o relatório semanal também
   * promovia gente a admin — era a mesma permissão.
   */
  it('recusa o que ela não tem, ainda que seja admin', () => {
    expect(temCapacidade(SO_RELATORIO, 'usuarios:promover')).toBe(false)
    expect(temCapacidade(SO_RELATORIO, 'chaves:gerar')).toBe(false)
  })

  it('trata ausência como nenhuma capacidade', () => {
    for (const vazio of [null, undefined, []]) {
      expect(temCapacidade(vazio, 'auditoria:ler')).toBe(false)
    }
  })
})

describe('CAPACIDADES_PADRAO', () => {
  it('é vazio — admin novo não herda poder que ninguém decidiu dar', () => {
    // Um padrão generoso reencenaria o defeito: admin novo nasceria podendo
    // promover outros, e a decisão não teria sido de ninguém.
    expect(CAPACIDADES_PADRAO).toEqual([])
  })
})

describe('ehCapacidadeConhecida', () => {
  it('aceita as da lista', () => {
    for (const c of CAPACIDADES) expect(ehCapacidadeConhecida(c)).toBe(true)
  })

  it('recusa erro de digitação', () => {
    // Sem esta recusa, `chaves:gerarr` viraria capacidade fantasma: gravada,
    // nunca conferida, e a tela correspondente fechada sem explicação.
    for (const errada of ['chaves:gerarr', 'usuarios:promoverr', 'admin', '*', '']) {
      expect(ehCapacidadeConhecida(errada)).toBe(false)
    }
  })
})

describe('CAPACIDADE_DA_TELA', () => {
  it('só aponta para capacidades que existem', () => {
    // Guarda contra a divergência silenciosa: uma tela exigindo capacidade
    // inexistente é uma tela que ninguém abre, e o sintoma aparece longe daqui.
    for (const exigida of Object.values(CAPACIDADE_DA_TELA)) {
      if (exigida !== null) expect(ehCapacidadeConhecida(exigida)).toBe(true)
    }
  })

  it('cobre as seis telas do menu de administração', () => {
    expect(Object.keys(CAPACIDADE_DA_TELA)).toHaveLength(6)
  })
})

describe('DESCRICAO_DA_CAPACIDADE', () => {
  it('descreve todas — quem concede precisa saber o que entrega', () => {
    for (const c of CAPACIDADES) {
      expect(DESCRICAO_DA_CAPACIDADE[c]).toBeTruthy()
    }
  })
})

describe('primeiraTelaVisivel', () => {
  it('leva quem tem tudo à primeira do menu', () => {
    expect(primeiraTelaVisivel(TUDO)).toBe('/admin/chaves')
  })

  /**
   * `/admin/pagamentos` era o destino fixo depois do login. Com capacidades,
   * ele é inalcançável para quem só cuida do catálogo — e a pessoa entraria
   * para levar um redirect sem explicação.
   */
  it('leva cada um à primeira tela que ele consegue abrir', () => {
    expect(primeiraTelaVisivel(['catalogo:escrever'])).toBe('/admin/produtos')
    expect(primeiraTelaVisivel(['auditoria:ler'])).toBe('/admin/auditoria')
    expect(primeiraTelaVisivel(['assinaturas:escrever'])).toBe('/admin/pagamentos')
  })

  it('devolve null para admin sem nenhuma capacidade', () => {
    // Estado legítimo: alguém marcado como admin e ainda sem nada concedido.
    // Devolver uma tela qualquer aqui produziria um laço de redirect.
    expect(primeiraTelaVisivel([])).toBeNull()
    expect(primeiraTelaVisivel(null)).toBeNull()
  })
})
