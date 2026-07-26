import { describe, expect, it } from 'vitest'
import {
  determinarFacing, CRITERIOS_FACING, ORDEM_CRITERIOS, LIMIAR_AMBIGUIDADE,
  type FaceCandidata,
} from '../facing'

function face(id: string, graus: number, ...criterios: FaceCandidata['criterios']): FaceCandidata {
  return { id, graus, criterios }
}

describe('hierarquia de critérios (§2.5)', () => {
  it('respeita a ordem do documento: Yang > fachada > água/vazio > porta', () => {
    expect(CRITERIOS_FACING['yang'].peso).toBeGreaterThan(CRITERIOS_FACING['fachada-arquitetonica'].peso)
    expect(CRITERIOS_FACING['fachada-arquitetonica'].peso).toBeGreaterThan(CRITERIOS_FACING['agua-ou-vazio'].peso)
    expect(CRITERIOS_FACING['agua-ou-vazio'].peso).toBeGreaterThan(CRITERIOS_FACING['porta-principal'].peso)
  })

  it('a porta principal é o critério mais fraco de todos (o alerta central do §2.5)', () => {
    const pesos = Object.entries(CRITERIOS_FACING)
    const porta = CRITERIOS_FACING['porta-principal'].peso
    for (const [chave, info] of pesos) {
      if (chave !== 'porta-principal') expect(info.peso).toBeGreaterThan(porta)
    }
  })

  it('nenhum critério isolado vence os dois mais fortes somados', () => {
    const ordenados = Object.values(CRITERIOS_FACING).map(c => c.peso).sort((a, b) => b - a)
    const maior = ordenados[0]
    const somaDosDoisMaiores = ordenados[0] + ordenados[1]
    expect(maior).toBeLessThan(somaDosDoisMaiores)
  })

  it('ORDEM_CRITERIOS lista todos os critérios, do mais forte ao mais fraco', () => {
    expect([...ORDEM_CRITERIOS].sort()).toEqual(Object.keys(CRITERIOS_FACING).sort())
    const pesos = ORDEM_CRITERIOS.map(c => CRITERIOS_FACING[c].peso)
    expect(pesos).toEqual([...pesos].sort((a, b) => b - a))
  })
})

describe('determinarFacing — casos claros', () => {
  it('a face com os critérios mais fortes ganha', () => {
    const r = determinarFacing([
      face('Rua', 90, 'yang', 'fachada-arquitetonica'),
      face('Fundos', 270, 'porta-principal'),
    ])
    expect(r.principal!.face.id).toBe('Rua')
    expect(r.facingGraus).toBe(90)
    expect(r.ambiguo).toBe(false)
    expect(r.concorrente).toBeNull()
  })

  it('sitting é sempre o oposto exato do facing (180°)', () => {
    const r = determinarFacing([face('Rua', 90, 'yang')])
    expect(r.sittingGraus).toBe(270)
    const r2 = determinarFacing([face('Rua', 350, 'yang')])
    expect(r2.facingGraus).toBe(350)
    expect(r2.sittingGraus).toBe(170) // normaliza cruzando o 360
  })

  it('a porta principal SOZINHA perde para qualquer critério mais forte isolado', () => {
    const r = determinarFacing([
      face('Porta', 0, 'porta-principal'),
      face('Vista', 180, 'agua-ou-vazio'),
    ])
    expect(r.principal!.face.id).toBe('Vista')
  })

  it('critérios duplicados na mesma face não contam duas vezes', () => {
    const r = determinarFacing([face('Rua', 90, 'yang', 'yang', 'yang')])
    expect(r.principal!.score).toBe(CRITERIOS_FACING['yang'].peso)
    expect(r.principal!.criteriosAtendidos).toEqual(['yang'])
  })

  it('ordena todas as hipóteses da maior para a menor', () => {
    const r = determinarFacing([
      face('C', 0, 'porta-principal'),
      face('A', 90, 'yang', 'fachada-arquitetonica'),
      face('B', 180, 'agua-ou-vazio'),
    ])
    expect(r.todas.map(h => h.face.id)).toEqual(['A', 'B', 'C'])
  })

  it('faces sem nenhum critério não entram no ranking', () => {
    const r = determinarFacing([face('Rua', 90, 'yang'), face('Lateral', 180)])
    expect(r.todas).toHaveLength(1)
    expect(r.todas[0].face.id).toBe('Rua')
  })
})

describe('determinarFacing — ambiguidade (a honestidade metodológica do §2.5)', () => {
  it('dois lados fortes e próximos são declarados ambíguos, com as duas hipóteses', () => {
    const r = determinarFacing([
      face('Rua', 90, 'yang'),                    // 5
      face('Sacada', 270, 'sacada-maior-abertura'), // 4 → diferença 1
    ])
    expect(r.ambiguo).toBe(true)
    expect(r.concorrente).not.toBeNull()
    expect(r.concorrente!.face.id).toBe('Sacada')
    expect(r.avisos.some(a => a.includes('ambíguo'))).toBe(true)
    expect(r.avisos.some(a => a.includes('gere as duas cartas'))).toBe(true)
  })

  it('empate exato de score também é ambíguo', () => {
    const r = determinarFacing([
      face('A', 0, 'fachada-arquitetonica'),
      face('B', 180, 'sacada-maior-abertura'),
    ])
    expect(r.principal!.score).toBe(r.todas[1].score)
    expect(r.ambiguo).toBe(true)
  })

  it('diferença acima do limiar NÃO é ambígua', () => {
    const r = determinarFacing([
      face('A', 0, 'yang', 'fachada-arquitetonica'), // 9
      face('B', 180, 'agua-ou-vazio'),               // 3 → diferença 6
    ])
    expect(r.ambiguo).toBe(false)
    expect(r.concorrente).toBeNull()
  })

  it('a fronteira do limiar é inclusiva', () => {
    // Diferença exatamente igual ao limiar deve contar como ambíguo.
    const r = determinarFacing([
      face('A', 0, 'yang'),                       // 5
      face('B', 180, 'agua-ou-vazio'),            // 3 → diferença 2 == LIMIAR
    ])
    expect(r.principal!.score - r.todas[1].score).toBe(LIMIAR_AMBIGUIDADE)
    expect(r.ambiguo).toBe(true)
  })
})

describe('determinarFacing — avisos e fail-closed', () => {
  it('FAIL-CLOSED: nenhum critério marcado devolve null em vez de eleger a 1ª face', () => {
    const r = determinarFacing([face('A', 0), face('B', 180)])
    expect(r.principal).toBeNull()
    expect(r.facingGraus).toBeNull()
    expect(r.sittingGraus).toBeNull()
    expect(r.avisos[0]).toContain('Nenhum critério foi marcado')
  })

  it('lista vazia também é fail-closed, sem estourar', () => {
    const r = determinarFacing([])
    expect(r.principal).toBeNull()
    expect(r.todas).toEqual([])
  })

  it('vencer APENAS pela porta principal dispara o alerta do erro clássico', () => {
    const r = determinarFacing([face('Porta', 0, 'porta-principal')])
    expect(r.principal!.face.id).toBe('Porta')
    expect(r.avisos.some(a => a.includes('APENAS por ter a porta principal'))).toBe(true)
  })

  it('porta principal ACOMPANHADA de critério forte não dispara o alerta', () => {
    const r = determinarFacing([face('Rua', 0, 'yang', 'porta-principal')])
    expect(r.avisos.some(a => a.includes('APENAS por ter a porta principal'))).toBe(false)
  })

  it('caso claro e sem porta isolada não gera aviso nenhum', () => {
    const r = determinarFacing([
      face('Rua', 90, 'yang', 'fachada-arquitetonica'),
      face('Fundos', 270, 'porta-principal'),
    ])
    expect(r.avisos).toEqual([])
  })
})

describe('cenário realista de apartamento (§2.5)', () => {
  it('a sacada vence a porta do corredor interno', () => {
    const r = determinarFacing([
      face('Sacada', 45, 'sacada-maior-abertura', 'yang', 'agua-ou-vazio'),
      face('Porta do corredor', 225, 'porta-principal'),
    ])
    expect(r.principal!.face.id).toBe('Sacada')
    expect(r.facingGraus).toBe(45)
    expect(r.sittingGraus).toBe(225)
    expect(r.ambiguo).toBe(false)
  })
})
