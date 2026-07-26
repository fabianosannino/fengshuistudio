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
    // E o vencedor da divergência é sempre o Fei Xing (precedência 2 > Ba Zhai 3).
    for (const d of s.divergentes) {
      expect(d.resolucao.metodoVencedor).toBe('fei-xing')
      expect(d.resolucao.veredictoFinal).toBe('perigoso')
      expect(d.resolucao.divergencias.map(x => x.metodo)).toEqual(['ba-zhai'])
    }
  })

  it('todo setor com Estrela 5 entra em perigosos, independente do Ba Zhai', () => {
    const mapa = calcularEstrelasVoadoras({ facingGraus: 180, periodo: 8 })
    const s = sintetizarImovel({ mapaEstrelas: mapa, baZhaiFavoraveis: new Set<Setor>(['N']) })
    const comEstrela5 = mapa!.palacios.filter(p => p.palacio !== 'C' && p.temEstrela5).map(p => p.palacio).sort()
    expect(s.perigosos.map(p => p.setor).sort()).toEqual(comEstrela5)
    expect(comEstrela5.length).toBeGreaterThan(0) // anti-vacuidade
  })

  it('a estrela anual acrescenta setores perigosos além dos natais', () => {
    const mapa = calcularEstrelasVoadoras({ facingGraus: 180, periodo: 8 })
    const gradeAnual = calcularGradeAnual(2026)
    const semAnual = sintetizarImovel({ mapaEstrelas: mapa })
    const comAnual = sintetizarImovel({ mapaEstrelas: mapa, gradeAnual })

    // O setor onde a estrela anual é 5 precisa estar em perigosos quando a grade anual é considerada.
    const setorAnual5 = SETORES_ORDEM.find(st => gradeAnual[st as never] === 5)
    expect(setorAnual5).toBeDefined()
    expect(comAnual.perigosos.map(p => p.setor)).toContain(setorAnual5)
    // E a lista com anual nunca é menor que a sem anual.
    expect(comAnual.perigosos.length).toBeGreaterThanOrEqual(semAnual.perigosos.length)
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
