import { describe, expect, it } from 'vitest'
import { avaliarSetorFeiXing, avaliarSetorBaZhai, sintetizarSetor } from '../avaliacao-setor'
import { calcularEstrelasVoadoras } from '../estrelas-voadoras'
import { calcularGradeAnual } from '../estrela-anual'
import type { Palacio3Estrelas } from '../estrelas-voadoras'
import type { Setor } from '../trigramas'

function palacio(over: Partial<Palacio3Estrelas> = {}): Palacio3Estrelas {
  return { palacio: 'N', montanha: 1, periodo: 2, fachada: 3, temEstrela5: false, ...over }
}

describe('avaliarSetorFeiXing', () => {
  it('sem Estrela 5 devolve NEUTRO, nunca favorável (o app não classifica combinações auspiciosas)', () => {
    const a = avaliarSetorFeiXing(palacio())
    expect(a.veredicto).toBe('neutro')
    expect(a.motivo).toContain('ainda não são classificadas')
  })

  it('Estrela 5 natal → perigoso', () => {
    expect(avaliarSetorFeiXing(palacio({ temEstrela5: true })).veredicto).toBe('perigoso')
  })

  it('Estrela 5 anual → perigoso, sinalizando que é temporário', () => {
    const a = avaliarSetorFeiXing(palacio(), 5)
    expect(a.veredicto).toBe('perigoso')
    expect(a.motivo).toContain('temporária')
  })

  it('Estrela 5 natal E anual → perigoso, com motivo de agravamento', () => {
    const a = avaliarSetorFeiXing(palacio({ temEstrela5: true }), 5)
    expect(a.veredicto).toBe('perigoso')
    expect(a.motivo).toContain('agravada')
  })

  it('estrela anual diferente de 5 não gera veredicto negativo', () => {
    expect(avaliarSetorFeiXing(palacio(), 8).veredicto).toBe('neutro')
  })

  it('tolera entrada nula sem estourar (fail-closed)', () => {
    expect(avaliarSetorFeiXing(null).veredicto).toBe('neutro')
    expect(avaliarSetorFeiXing(undefined, null).veredicto).toBe('neutro')
  })
})

describe('avaliarSetorBaZhai', () => {
  const favoraveis = new Set<Setor>(['N', 'E', 'SE', 'S'])

  it('setor favorável → favoravel', () => {
    expect(avaliarSetorBaZhai(favoraveis, 'N').veredicto).toBe('favoravel')
  })

  it('setor fora das 4 favoráveis → desfavoravel', () => {
    expect(avaliarSetorBaZhai(favoraveis, 'W').veredicto).toBe('desfavoravel')
  })
})

describe('sintetizarSetor — integração com os cálculos reais', () => {
  it('métodos sem dado não entram na síntese (não viram "neutro forçado")', () => {
    const r = sintetizarSetor({ setor: 'N' })
    expect(r.veredictoFinal).toBe('neutro')
    expect(r.metodoVencedor).toBeNull()
    expect(r.divergencias).toEqual([])
  })

  it('só Ba Zhai informado: ele decide, sem conflito', () => {
    const r = sintetizarSetor({ setor: 'N', baZhaiFavoraveis: new Set<Setor>(['N']) })
    expect(r.metodoVencedor).toBe('ba-zhai')
    expect(r.veredictoFinal).toBe('favoravel')
    expect(r.houveConflito).toBe(false)
  })

  it('CONFLITO CANÔNICO com dados reais: Ba Zhai favorável vs Estrela 5 → Fei Xing vence, divergência preservada', () => {
    const r = sintetizarSetor({
      setor: 'N',
      estrelasNatais: palacio({ temEstrela5: true }),
      baZhaiFavoraveis: new Set<Setor>(['N']),
    })
    expect(r.veredictoFinal).toBe('perigoso')
    expect(r.metodoVencedor).toBe('fei-xing')
    expect(r.houveConflito).toBe(true)
    expect(r.divergencias).toHaveLength(1)
    expect(r.divergencias[0].metodo).toBe('ba-zhai')
    expect(r.divergencias[0].veredicto).toBe('favoravel')
  })

  it('Fei Xing neutro não sobrepõe o Ba Zhai (neutro nunca vence nem conflita)', () => {
    const r = sintetizarSetor({
      setor: 'W',
      estrelasNatais: palacio(),
      baZhaiFavoraveis: new Set<Setor>(['N']),
    })
    expect(r.metodoVencedor).toBe('ba-zhai')
    expect(r.veredictoFinal).toBe('desfavoravel')
    expect(r.houveConflito).toBe(false)
  })

  it('consome a saída real de calcularEstrelasVoadoras + calcularGradeAnual sem adaptação', () => {
    // Período 8, fachada ao Sul (180°) — carta real do módulo já testado.
    const mapa = calcularEstrelasVoadoras({ facingGraus: 180, periodo: 8 })
    expect(mapa).not.toBeNull()
    const gradeAnual = calcularGradeAnual(2026)

    // Percorre todos os palácios e confirma que a síntese nunca estoura e sempre
    // devolve um veredicto coerente com a presença (ou não) da Estrela 5.
    for (const p of mapa!.palacios) {
      if (p.palacio === 'C') continue // Centro não é um dos 8 setores do Ba Zhai
      const setor = p.palacio as Setor
      const r = sintetizarSetor({
        setor,
        estrelasNatais: p,
        estrelaAnual: gradeAnual[p.palacio],
        baZhaiFavoraveis: new Set<Setor>(['N', 'E', 'SE', 'S']),
      })
      const deveSerPerigoso = p.temEstrela5 || gradeAnual[p.palacio] === 5
      if (deveSerPerigoso) {
        expect(r.veredictoFinal).toBe('perigoso')
        expect(r.metodoVencedor).toBe('fei-xing')
      } else {
        // Sem Estrela 5, quem decide é o Ba Zhai (Fei Xing devolve neutro).
        expect(r.metodoVencedor).toBe('ba-zhai')
      }
    }
  })

  it('há ao menos um setor com Estrela 5 na carta do Período 8 (o teste acima não é vacuamente verdadeiro)', () => {
    const mapa = calcularEstrelasVoadoras({ facingGraus: 180, periodo: 8 })
    expect(mapa!.palacios.some(p => p.temEstrela5)).toBe(true)
  })
})
