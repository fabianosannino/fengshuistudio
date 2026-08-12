import { describe, expect, it } from 'vitest'
import {
  curasDoSetor, elementoDoSetor, setoresParaPrescrever, urgenciaDoScore,
  montarPrescricao, chaveDaPrescricao,
} from '../prescricao'
import { LOSHU_ORDER } from '../constants'

describe('elementoDoSetor', () => {
  it('mapeia os nove setores do diagnóstico para a biblioteca', () => {
    // O nome no diagnóstico e o `gua` da biblioteca divergem («Família» vs
    // «Família / Saúde»). Um setor sem par sairia da tela sem nenhuma cura.
    for (const setor of LOSHU_ORDER) {
      expect(elementoDoSetor(setor), setor).not.toBeNull()
    }
  })

  it('setor desconhecido não quebra', () => {
    expect(elementoDoSetor('Inexistente')).toBeNull()
    expect(curasDoSetor('Inexistente')).toEqual([])
  })
})

describe('curasDoSetor', () => {
  it('traz cristais, plantas, objetos e as três práticas', () => {
    const curas = curasDoSetor('Carreira')
    const tipos = new Set(curas.map(c => c.tipo))
    expect(tipos).toEqual(new Set(['cristal', 'planta', 'objeto', 'pratica']))
  })

  it('custo zero primeiro — é a ordenação do documento-mestre', () => {
    const curas = curasDoSetor('Carreira')
    const primeiroComCusto = curas.findIndex(c => !c.semCusto)
    const ultimoSemCusto = curas.map(c => c.semCusto).lastIndexOf(true)
    expect(ultimoSemCusto).toBeLessThan(primeiroComCusto)
  })

  it('as chaves são únicas dentro do setor', () => {
    // A chave é o que liga a prescrição gravada ao item da biblioteca. Duas
    // iguais fariam «Prescrever» sumir do item errado.
    const curas = curasDoSetor('Prosperidade')
    expect(new Set(curas.map(c => c.chave)).size).toBe(curas.length)
  })
})

describe('setoresParaPrescrever', () => {
  it('pior primeiro', () => {
    const ordenado = setoresParaPrescrever([
      { nome: 'A', score_percentual: 80 },
      { nome: 'B', score_percentual: 28 },
      { nome: 'C', score_percentual: 52 },
    ])
    expect(ordenado.map(s => s.nome)).toEqual(['B', 'C', 'A'])
  })

  it('não avaliado vai para o fim, não para o topo', () => {
    // Sem score não dá para afirmar que o setor precisa de algo. No topo, o
    // consultor prescreveria para um ambiente que ninguém olhou.
    const ordenado = setoresParaPrescrever([
      { nome: 'sem score', score_percentual: null },
      { nome: 'ruim', score_percentual: 10 },
    ])
    expect(ordenado.map(s => s.nome)).toEqual(['ruim', 'sem score'])
    expect(ordenado[1].urgencia).toBe('nao_avaliado')
    expect(ordenado[1].prioridade).toBe(99)
  })

  it('classifica pelos limiares do produto', () => {
    expect(urgenciaDoScore(28)).toBe('prioridade')
    expect(urgenciaDoScore(52)).toBe('atencao')
    expect(urgenciaDoScore(80)).toBe('equilibrado')
    expect(urgenciaDoScore(null)).toBe('nao_avaliado')
  })

  it('prioridade menor para score pior', () => {
    const [pior, melhor] = setoresParaPrescrever([
      { nome: 'pior', score_percentual: 5 },
      { nome: 'melhor', score_percentual: 90 },
    ])
    expect(pior.prioridade).toBeLessThan(melhor.prioridade)
    expect(pior.prioridade).toBeGreaterThanOrEqual(1)
  })
})

describe('montarPrescricao e chaveDaPrescricao', () => {
  it('a ida e a volta preservam setor e chave', () => {
    const [setor] = setoresParaPrescrever([{ nome: 'Carreira', score_percentual: 28 }])
    const cura = curasDoSetor('Carreira')[0]
    const linha = montarPrescricao('consulta-1', 'setor-1', setor, cura)

    expect(chaveDaPrescricao(linha.objeto)).toEqual({ setor: 'Carreira', chave: cura.chave })
  })

  it('guarda a chave, não o nome — o nome muda quando o texto é revisado', () => {
    const [setor] = setoresParaPrescrever([{ nome: 'Carreira', score_percentual: 28 }])
    const cura = curasDoSetor('Carreira')[0]
    const linha = montarPrescricao('c', null, setor, cura)
    expect(linha.objeto).not.toContain(cura.titulo)
    expect(linha.objeto).toContain(cura.chave)
  })

  it('`objeto` ilegível devolve null em vez de um par inventado', () => {
    for (const lixo of [null, undefined, '', 'sem-separador']) {
      expect(chaveDaPrescricao(lixo as string), String(lixo)).toBeNull()
    }
  })
})
