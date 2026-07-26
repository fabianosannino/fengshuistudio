import { describe, expect, it } from 'vitest'
import { gerarRemedios } from '../remedios'
import { gerarRecomendacoes } from '../recomendacoes'
import type { Remedio } from '../sintese-metodos'

const ORDEM_CUSTO: Record<Remedio['custo'], number> = { zero: 0, baixo: 1, medio: 2, alto: 3, estrutural: 4 }

describe('gerarRemedios — proveniência obrigatória', () => {
  it('todo remédio declara método, força da evidência, custo e reversibilidade', () => {
    const r = gerarRemedios({ nomeSetor: 'Prosperidade', scorePct: 30, comodos: ['banheiro'], faltaPct: 20, excessoPct: 20 })
    expect(r.length).toBeGreaterThan(0)
    for (const rem of r) {
      expect(rem.metodo).toBeTruthy()
      expect(rem.forcaEvidencia).toBeTruthy()
      expect(rem.custo).toBeTruthy()
      expect(rem.reversibilidade).toBeTruthy()
      expect(rem.id).toBeTruthy()
      expect(rem.problema).toBeTruthy()
      expect(rem.acao).toBeTruthy()
    }
  })

  it('ids são únicos (o relatório usa como key de render)', () => {
    const r = gerarRemedios({ nomeSetor: 'Prosperidade', scorePct: 20, comodos: ['banheiro', 'lavabo'], faltaPct: 20, excessoPct: 20 })
    expect(new Set(r.map(x => x.id)).size).toBe(r.length)
  })

  it('vem ordenado por custo zero primeiro (regra da Parte IV)', () => {
    const r = gerarRemedios({ nomeSetor: 'Prosperidade', scorePct: 20, comodos: ['banheiro'], excessoPct: 30 })
    const custos = r.map(x => ORDEM_CUSTO[x.custo])
    expect(custos).toEqual([...custos].sort((a, b) => a - b))
  })
})

describe('gerarRemedios — conflitos cômodo×setor', () => {
  it('banheiro na Prosperidade gera remédio de consenso clássico, custo baixo e reversível', () => {
    const r = gerarRemedios({ nomeSetor: 'Prosperidade', scorePct: 90, comodos: ['banheiro'] })
    const conflito = r.find(x => x.id.startsWith('conflito-'))
    expect(conflito).toBeDefined()
    expect(conflito!.forcaEvidencia).toBe('consenso-classico')
    expect(conflito!.custo).toBe('baixo')
    expect(conflito!.reversibilidade).toBe('facil')
    expect(conflito!.problema).toContain('Prosperidade')
  })

  it('sem cômodos informados não inventa conflito', () => {
    const r = gerarRemedios({ nomeSetor: 'Prosperidade', scorePct: 90 })
    expect(r.some(x => x.id.startsWith('conflito-'))).toBe(false)
  })

  it('cômodo sem conflito clássico no setor não gera remédio de conflito', () => {
    const r = gerarRemedios({ nomeSetor: 'Prosperidade', scorePct: 90, comodos: ['quarto'] })
    expect(r.some(x => x.id.startsWith('conflito-'))).toBe(false)
  })
})

describe('gerarRemedios — geometria (regra do terço)', () => {
  it('respeita o limiar: 3% não gera, 20% gera', () => {
    expect(gerarRemedios({ nomeSetor: 'Carreira', scorePct: 90, faltaPct: 3 }).some(x => x.id.includes('falta'))).toBe(false)
    expect(gerarRemedios({ nomeSetor: 'Carreira', scorePct: 90, faltaPct: 20 }).some(x => x.id.includes('falta'))).toBe(true)
  })

  it('a cura geométrica é variante-de-escola, não consenso clássico', () => {
    // O diagnóstico (regra do terço) é clássico, mas a CURA não tem forma
    // canônica única — e é a cura que está sendo recomendada.
    const falta = gerarRemedios({ nomeSetor: 'Carreira', scorePct: 90, faltaPct: 20 }).find(x => x.id.includes('falta'))
    const excesso = gerarRemedios({ nomeSetor: 'Carreira', scorePct: 90, excessoPct: 20 }).find(x => x.id.includes('excesso'))
    expect(falta!.forcaEvidencia).toBe('variante-de-escola')
    expect(excesso!.forcaEvidencia).toBe('variante-de-escola')
  })

  it('excesso usa bloqueio-de-forma e custo maior que falta (divisória vs. objeto)', () => {
    const excesso = gerarRemedios({ nomeSetor: 'Carreira', scorePct: 90, excessoPct: 20 }).find(x => x.id.includes('excesso'))
    expect(excesso!.mecanismo).toBe('bloqueio-de-forma')
    expect(ORDEM_CUSTO[excesso!.custo]).toBeGreaterThan(ORDEM_CUSTO['baixo'])
  })
})

describe('gerarRemedios — Cinco Elementos', () => {
  it('score crítico fortalece o próprio elemento E o que o nutre (ciclo Sheng)', () => {
    const r = gerarRemedios({ nomeSetor: 'Carreira', scorePct: 20 })
    const fortalecer = r.filter(x => x.id.includes('fortalecer'))
    // Carreira = Água; crítico fortalece Água + Metal (Metal gera Água).
    expect(fortalecer).toHaveLength(2)
    expect(fortalecer.every(x => x.acaoWuXing === 'gerar')).toBe(true)
    expect(fortalecer.every(x => x.forcaEvidencia === 'consenso-classico')).toBe(true)
  })

  it('score bom não gera remédio elemental (nada a corrigir)', () => {
    const r = gerarRemedios({ nomeSetor: 'Carreira', scorePct: 95 })
    expect(r.filter(x => x.id.includes('elemento-'))).toHaveLength(0)
  })

  it('o remédio de evitar o controlador tem custo zero e é instantâneo (é restrição, não compra)', () => {
    const evitar = gerarRemedios({ nomeSetor: 'Carreira', scorePct: 20 }).find(x => x.id.includes('evitar'))
    expect(evitar).toBeDefined()
    expect(evitar!.acaoWuXing).toBe('controlar')
    expect(evitar!.custo).toBe('zero')
    expect(evitar!.reversibilidade).toBe('instantanea')
  })

  it('respeita o elemento vindo do banco em vez do clássico do setor', () => {
    // Carreira é Água por padrão; forçando Fogo, o nutridor passa a ser Madeira.
    const r = gerarRemedios({ nomeSetor: 'Carreira', scorePct: 20, elemento: 'Fogo' })
    expect(r.some(x => x.id.includes('fortalecer-Carreira-fogo'))).toBe(true)
    expect(r.some(x => x.id.includes('fortalecer-Carreira-madeira'))).toBe(true)
  })

  it('elemento inválido cai no clássico do setor, sem estourar', () => {
    const r = gerarRemedios({ nomeSetor: 'Carreira', scorePct: 20, elemento: 'Plutônio' })
    expect(r.some(x => x.id.includes('fortalecer-Carreira-agua'))).toBe(true)
  })
})

describe('coexistência com o motor de texto (não-regressão)', () => {
  it('gerarRecomendacoes segue funcionando igual — este módulo é aditivo', () => {
    const input = { nomeSetor: 'Prosperidade', scorePct: 30, criterios: [0, 1, 2, 3, 4, 2, 2, 2], comodos: ['banheiro'] }
    const rec = gerarRecomendacoes(input)
    expect(rec.urgente.length).toBeGreaterThan(0)
    expect(Array.isArray(rec.melhoria)).toBe(true)
    expect(Array.isArray(rec.manutencao)).toBe(true)
    // E os dois motores partem do mesmo conflito clássico, sem se contradizer.
    const rem = gerarRemedios(input)
    expect(rem.some(x => x.id.startsWith('conflito-'))).toBe(true)
  })

  it('não cobre as dicas de texto livre — fronteira declarada, não acidente', () => {
    // SETOR_DICAS/CRITERIO_DICAS não são classificadas (ver cabeçalho do módulo
    // e ADR 0015): nenhum remédio estruturado deve vir delas.
    const r = gerarRemedios({ nomeSetor: 'Carreira', scorePct: 20 })
    const prefixosEsperados = ['conflito-', 'geometria-', 'elemento-']
    expect(r.every(x => prefixosEsperados.some(p => x.id.startsWith(p)))).toBe(true)
  })
})
