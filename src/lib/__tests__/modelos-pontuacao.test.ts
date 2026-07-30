import { describe, expect, it } from 'vitest'
import {
  MODELOS, MODELO_PADRAO, NOTA_NEUTRA, NOTA_MAXIMA,
  calcularPontuacao, faixaDe, modeloValido, pontuacaoFisica, pontuacaoGeometrica,
  type NotaCriterio,
} from '../modelos-pontuacao'
import { CRITERIOS } from '../constants'

const oito = (n: NotaCriterio | null) => Array(8).fill(n) as (NotaCriterio | null)[]

describe('o defeito que originou o módulo', () => {
  it('imóvel inteiramente neutro NÃO é 100%', () => {
    // A fórmula antiga era geo + Σ(−2..+2): tudo neutro dava 100 + 0 = 100%.
    for (const id of Object.keys(MODELOS) as (keyof typeof MODELOS)[]) {
      if (id === 'geometrico-puro') continue
      const p = calcularPontuacao(id, { criterios: oito(NOTA_NEUTRA), geo: 100 })
      expect(p.valor, id).not.toBe(100)
    }
  })

  it('tudo neutro no estado físico é exatamente 50% — ponto médio da escala', () => {
    expect(pontuacaoFisica(oito(NOTA_NEUTRA))).toBe(50)
  })

  it('nenhum modelo passa de 100, nem com geometria e físico máximos', () => {
    for (const id of Object.keys(MODELOS) as (keyof typeof MODELOS)[]) {
      const p = calcularPontuacao(id, { criterios: oito(NOTA_MAXIMA), geo: 100 })
      expect(p.valor, id).toBeLessThanOrEqual(100)
    }
  })

  it('imóvel péssimo alcança a faixa «urgente» — antes era inalcançável', () => {
    // Com a fórmula antiga o valor ficava preso em ~84–116: nem os oito
    // critérios em «Crítico» chegavam ao corte de 40.
    const p = calcularPontuacao(MODELO_PADRAO, { criterios: oito(0), geo: 100 })
    expect(p.valor).toBe(0)
    expect(p.faixa).toBe('urgente')
  })
})

describe('pontuacaoFisica — só o que foi avaliado', () => {
  it('ignora os não avaliados em vez de contá-los como neutros', () => {
    const criterios = [4, 4, null, null, null, null, null, null] as (NotaCriterio | null)[]
    expect(pontuacaoFisica(criterios)).toBe(100)  // 2 de 2 avaliados, ambos máximos
  })

  it('nada avaliado devolve null — não sei, nunca zero', () => {
    expect(pontuacaoFisica(oito(null))).toBeNull()
    expect(pontuacaoFisica([])).toBeNull()
  })

  it('extremos da escala', () => {
    expect(pontuacaoFisica(oito(0))).toBe(0)
    expect(pontuacaoFisica(oito(NOTA_MAXIMA))).toBe(100)
  })
})

describe('pontuacaoGeometrica', () => {
  it('geo já é 0–100 e passa direto', () => {
    expect(pontuacaoGeometrica(100)).toBe(100)
    expect(pontuacaoGeometrica(87)).toBe(87)
  })

  it('limita negativo em 0 — falta + excesso pode passar de 100%', () => {
    expect(pontuacaoGeometrica(-35)).toBe(0)
  })

  it('valor não finito devolve null — lixo não vira nota', () => {
    expect(pontuacaoGeometrica(NaN)).toBeNull()
    expect(pontuacaoGeometrica(Infinity)).toBeNull()
  })
})

describe('modelos', () => {
  const entrada = { criterios: oito(NOTA_NEUTRA), geo: 80 }  // físico 50, geo 80

  it('fisico-puro ignora a geometria', () => {
    expect(MODELOS['fisico-puro'].calcular(entrada)).toBe(50)
    expect(MODELOS['fisico-puro'].calcular({ ...entrada, geo: 10 })).toBe(50)
  })

  it('geometrico-puro ignora os critérios', () => {
    expect(MODELOS['geometrico-puro'].calcular(entrada)).toBe(80)
    expect(MODELOS['geometrico-puro'].calcular({ criterios: oito(null), geo: 80 })).toBe(80)
  })

  it('composto-ponderado respeita o peso', () => {
    const m = MODELOS['composto-ponderado']
    expect(m.calcular({ ...entrada, pesoGeo: 0.5 })).toBe(65)   // (80+50)/2
    expect(m.calcular({ ...entrada, pesoGeo: 1 })).toBe(80)     // só geo
    expect(m.calcular({ ...entrada, pesoGeo: 0 })).toBe(50)     // só físico
  })

  it('peso fora de 0–1 é limitado, sem estourar', () => {
    const m = MODELOS['composto-ponderado']
    expect(m.calcular({ ...entrada, pesoGeo: 9 })).toBe(80)
    expect(m.calcular({ ...entrada, pesoGeo: -9 })).toBe(50)
  })

  it('composto-conservador não deixa geometria boa mascarar físico ruim', () => {
    const conservador = MODELOS['composto-conservador']
    const ponderado = MODELOS['composto-ponderado']
    const caso = { criterios: oito(0), geo: 100 }   // geo perfeito, físico zero
    expect(conservador.calcular(caso)).toBe(0)
    // o ponderado ainda daria 50 — é justamente a diferença entre os dois
    expect(ponderado.calcular(caso)).toBe(50)
  })

  it('modelos compostos devolvem null sem estado físico — não caem no geo', () => {
    const semFisico = { criterios: oito(null), geo: 90 }
    expect(MODELOS['composto-ponderado'].calcular(semFisico)).toBeNull()
    expect(MODELOS['composto-conservador'].calcular(semFisico)).toBeNull()
  })
})

describe('faixaDe', () => {
  it('classifica pelos cortes herdados (40 / 70)', () => {
    expect(faixaDe(0)).toBe('urgente')
    expect(faixaDe(39)).toBe('urgente')
    expect(faixaDe(40)).toBe('atencao')
    expect(faixaDe(69)).toBe('atencao')
    expect(faixaDe(70)).toBe('manter')
    expect(faixaDe(100)).toBe('manter')
  })

  it('sem valor não há faixa — «não sei» não vira «manter»', () => {
    // O código antigo fazia `(score ?? 100) >= 80` → setor não avaliado
    // aparecia como MANTER. Aqui não há faixa nenhuma.
    expect(faixaDe(null)).toBeNull()
  })
})

describe('modeloValido — fail-closed', () => {
  it('aceita os conhecidos', () => {
    for (const id of Object.keys(MODELOS)) expect(modeloValido(id)).toBe(id)
  })

  it('cai no padrão para desconhecido, nulo ou vazio', () => {
    for (const v of ['inventado', '', null, undefined]) {
      expect(modeloValido(v)).toBe(MODELO_PADRAO)
    }
  })
})

describe('procedência — vai impressa no relatório do cliente', () => {
  it('nomeia o modelo, as dimensões e a cobertura', () => {
    const p = calcularPontuacao('composto-conservador', {
      criterios: [4, 4, 2, 2, null, null, null, null] as (NotaCriterio | null)[],
      geo: 90,
    })
    expect(p.procedencia).toContain('Composto conservador')
    expect(p.procedencia).toContain('geometria 90%')
    expect(p.procedencia).toContain('estado físico 75%')
    expect(p.procedencia).toContain('4 de 8 critérios avaliados')
  })

  it('declara quando o estado físico não foi avaliado', () => {
    const p = calcularPontuacao('composto-conservador', { criterios: oito(null), geo: 90 })
    expect(p.valor).toBeNull()
    expect(p.procedencia).toContain('não avaliado')
  })

  it('o ponderado informa o peso usado', () => {
    const p = calcularPontuacao('composto-ponderado', {
      criterios: oito(NOTA_NEUTRA), geo: 80, pesoGeo: 0.7,
    })
    expect(p.procedencia).toContain('peso da geometria 70%')
  })

  it('não cita arquivo de código nem jargão interno', () => {
    for (const id of Object.keys(MODELOS) as (keyof typeof MODELOS)[]) {
      const p = calcularPontuacao(id, { criterios: oito(3), geo: 88 })
      expect(p.procedencia, id).not.toMatch(/`|\.tsx?\b|src\/lib|POMP|null|undefined/)
    }
  })

  it('o geométrico não fala de critérios que não usou', () => {
    const p = calcularPontuacao('geometrico-puro', { criterios: oito(null), geo: 88 })
    expect(p.valor).toBe(88)
    expect(p.procedencia).not.toContain('critérios avaliados')
  })
})

describe('coerência com a lista de critérios do produto', () => {
  it('são oito, e a entrada acompanha esse tamanho', () => {
    expect(CRITERIOS.length).toBe(8)
    const p = calcularPontuacao(MODELO_PADRAO, { criterios: oito(NOTA_NEUTRA), geo: 100 })
    expect(p.criteriosTotal).toBe(CRITERIOS.length)
  })
})
