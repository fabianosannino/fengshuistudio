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
  it('descarta linha com nome que não dá para identificar', () => {
    // Prescrever para um setor irreconhecível é prescrever no escuro. E o banco
    // tem quinze grafias para nove setores — ver `nome-do-setor.ts`.
    const r = setoresParaPrescrever([
      { nome: 'Garagem', score_percentual: 10 },
      { nome: 'Centro/Saúde', score_percentual: 40 },
    ])
    expect(r.map(s => s.nome)).toEqual(['Centro'])
  })

  it('pior primeiro', () => {
    const ordenado = setoresParaPrescrever([
      { nome: 'Prosperidade', score_percentual: 80 },
      { nome: 'Carreira', score_percentual: 28 },
      { nome: 'Fama/Reputação', score_percentual: 52 },
    ])
    // Repare que «Fama/Reputação» volta canônico como «Fama».
    expect(ordenado.map(s => s.nome)).toEqual(['Carreira', 'Fama', 'Prosperidade'])
  })

  it('não avaliado vai para o fim, não para o topo', () => {
    // Sem score não dá para afirmar que o setor precisa de algo. No topo, o
    // consultor prescreveria para um ambiente que ninguém olhou.
    const ordenado = setoresParaPrescrever([
      { nome: 'Prosperidade', score_percentual: null },
      { nome: 'Carreira', score_percentual: 10 },
    ])
    expect(ordenado.map(s => s.nome)).toEqual(['Carreira', 'Prosperidade'])
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
      { nome: 'Carreira', score_percentual: 5 },
      { nome: 'Prosperidade', score_percentual: 90 },
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
