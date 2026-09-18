import { describe, expect, it } from 'vitest'
import { sintetizarImovel, SETORES_ORDEM } from '../sintese-imovel'
import { calcularEstrelasVoadoras } from '../estrelas-voadoras'
import { calcularGradeAnual } from '../estrela-anual'
import type { Setor } from '../trigramas'

describe('SETORES_ORDEM', () => {
  it('cobre os 8 setores cardeais, sem o Centro (que não é setor do Ba Zhai)', () => {
    expect(SETORES_ORDEM).toHaveLength(8)
    expect(SETORES_ORDEM).not.toContain('C')
    expect([...SETORES_ORDEM].sort()).toEqual(['E', 'N', 'NE', 'NW', 'S', 'SE', 'SW', 'W'])
  })
})

describe('sintetizarImovel', () => {
  it('sem nenhum dado: 8 setores neutros, nenhuma divergência (não inventa veredicto)', () => {
    const s = sintetizarImovel({})
    expect(s.setores).toHaveLength(8)
    expect(s.temDivergencia).toBe(false)
    expect(s.divergentes).toEqual([])
    expect(s.perigosos).toEqual([])
    expect(s.setores.every(x => x.resolucao.veredictoFinal === 'neutro')).toBe(true)
  })

  it('só Ba Zhai: 4 favoráveis e 4 desfavoráveis, sem conflito nenhum', () => {
    const favoraveis = new Set<Setor>(['N', 'E', 'SE', 'S'])
    const s = sintetizarImovel({ baZhaiFavoraveis: favoraveis })
    expect(s.temDivergencia).toBe(false)
    const bons = s.setores.filter(x => x.resolucao.veredictoFinal === 'favoravel').map(x => x.setor)
    const ruins = s.setores.filter(x => x.resolucao.veredictoFinal === 'desfavoravel').map(x => x.setor)
    expect(bons.sort()).toEqual(['E', 'N', 'S', 'SE'])
    expect(ruins.sort()).toEqual(['NE', 'NW', 'SW', 'W'])
  })

  it('com carta real do Período 8 + Ba Zhai: gera divergência exatamente onde há Estrela 5 em setor favorável', () => {
    const mapa = calcularEstrelasVoadoras({ facingGraus: 180, periodo: 8 })
    const favoraveis = new Set<Setor>(['N', 'E', 'SE', 'S'])
    const s = sintetizarImovel({ mapaEstrelas: mapa, baZhaiFavoraveis: favoraveis })

    // Divergência = Estrela 5 (Fei Xing perigoso) num setor que o Ba Zhai considera bom.
    const esperados = mapa!.palacios
      .filter(p => p.palacio !== 'C' && p.temEstrela5 && favoraveis.has(p.palacio as Setor))
      .map(p => p.palacio)
      .sort()

    expect(s.divergentes.map(d => d.setor).sort()).toEqual(esperados)
    expect(s.temDivergencia).toBe(esperados.length > 0)
    // A implementação experimental não herda a precedência da escola completa.
    for (const d of s.divergentes) {
      expect(d.resolucao.metodoVencedor).toBe('ba-zhai')
      expect(d.resolucao.veredictoFinal).toBe('favoravel')
      expect(d.resolucao.divergencias.map(x => x.metodo)).toEqual(['fei-xing'])
    }
  })

  it('D0-04 — a carta simplificada não classifica setores como perigosos na decisão final', () => {
    const mapa = calcularEstrelasVoadoras({ facingGraus: 180, periodo: 8 })
    const s = sintetizarImovel({ mapaEstrelas: mapa, baZhaiFavoraveis: new Set<Setor>(['N']) })
    const comEstrela5 = mapa!.palacios.filter(p => p.palacio !== 'C' && p.temEstrela5).map(p => p.palacio).sort()
    expect(s.perigosos).toEqual([])
    expect(comEstrela5.length).toBeGreaterThan(0) // anti-vacuidade
  })

  it('combinar a anual com o mapa experimental continua sem produzir recomendação final', () => {
    const mapa = calcularEstrelasVoadoras({ facingGraus: 180, periodo: 8 })
    const gradeAnual = calcularGradeAnual(2026)
    const semAnual = sintetizarImovel({ mapaEstrelas: mapa })
    const comAnual = sintetizarImovel({ mapaEstrelas: mapa, gradeAnual })

    // A presença real da estrela anual 5 não muda a maturidade da interpretação.
    const setorAnual5 = SETORES_ORDEM.find(st => gradeAnual[st as never] === 5)
    expect(setorAnual5).toBeDefined()
    expect(comAnual.perigosos).toEqual([])
    expect(semAnual.perigosos).toEqual([])
    expect(comAnual.setores.every(s => s.resolucao.metodoVencedor === null)).toBe(true)
  })

  it('avisos são deduplicados (não repete o mesmo aviso 8 vezes, uma por setor)', () => {
    // Nenhum aviso é gerado neste cenário, mas a propriedade de dedup precisa valer:
    const s = sintetizarImovel({ baZhaiFavoraveis: new Set<Setor>(['N']) })
    expect(s.avisos).toEqual([...new Set(s.avisos)])
  })

  it('setores preservam a ordem cardeal convencional (relatório depende disso)', () => {
    const s = sintetizarImovel({ baZhaiFavoraveis: new Set<Setor>(['N']) })
    expect(s.setores.map(x => x.setor)).toEqual([...SETORES_ORDEM])
  })
})
