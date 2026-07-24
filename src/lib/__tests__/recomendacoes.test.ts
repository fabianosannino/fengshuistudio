import { describe, it, expect } from 'vitest'
import {
  gerarRecomendacoes,
  criteriosPorNomeParaArray,
  LIMIAR_SCORE_CRITICO,
} from '../recomendacoes'
import { CRITERIOS, SETOR_DICAS, CRITERIO_DICAS } from '../constants'

// Setor válido (chave real de SETOR_DICAS)
const SETOR = 'Prosperidade'
// Todos os critérios neutros (2) = nenhuma recomendação de critério
const NEUTROS = Array(CRITERIOS.length).fill(2)

describe('gerarRecomendacoes', () => {
  it('é determinística — mesma entrada, mesma saída', () => {
    const input = { nomeSetor: SETOR, scorePct: 30, criterios: [0, 1, 2, 2, 2, 2, 2, 2] }
    expect(gerarRecomendacoes(input)).toEqual(gerarRecomendacoes(input))
  })

  it('critério crítico (0) vira recomendação urgente com as dicas do critério', () => {
    const criterios = [...NEUTROS]
    criterios[0] = 0 // primeiro critério crítico
    const rec = gerarRecomendacoes({ nomeSetor: SETOR, scorePct: 80, criterios })
    expect(rec.urgente).toContain(CRITERIO_DICAS[0][0])
    expect(rec.urgente).toContain(CRITERIO_DICAS[0][1])
  })

  it('critério ruim (1) vira melhoria', () => {
    const criterios = [...NEUTROS]
    criterios[1] = 1
    const rec = gerarRecomendacoes({ nomeSetor: SETOR, scorePct: 80, criterios })
    expect(rec.melhoria).toContain(CRITERIO_DICAS[1][0])
  })

  it('score baixo adiciona dicas do setor em urgente', () => {
    const rec = gerarRecomendacoes({ nomeSetor: SETOR, scorePct: LIMIAR_SCORE_CRITICO - 1, criterios: NEUTROS })
    expect(rec.urgente).toContain(SETOR_DICAS[SETOR][0])
  })

  it('score alto usa dicas de manutenção do setor', () => {
    const rec = gerarRecomendacoes({ nomeSetor: SETOR, scorePct: 90, criterios: NEUTROS })
    expect(rec.manutencao.length).toBeGreaterThan(0)
    expect(rec.urgente).toHaveLength(0)
  })

  it('inclui recomendação geométrica quando há área faltante', () => {
    const rec = gerarRecomendacoes({ nomeSetor: SETOR, scorePct: 80, criterios: NEUTROS, faltaPct: 20 })
    expect(rec.urgente.some((r) => r.includes('faltante'))).toBe(true)
  })

  it('NÃO inclui geometria quando faltaPct/excessoPct são omitidos (detalhe/PDF)', () => {
    const rec = gerarRecomendacoes({ nomeSetor: SETOR, scorePct: 80, criterios: NEUTROS })
    expect(rec.urgente.some((r) => r.includes('faltante'))).toBe(false)
    expect(rec.melhoria.some((r) => r.includes('excesso'))).toBe(false)
  })

  it('respeita os limites máximos por bloco e não repete itens', () => {
    const criterios = Array(CRITERIOS.length).fill(0) // tudo crítico
    const rec = gerarRecomendacoes({ nomeSetor: SETOR, scorePct: 10, criterios, faltaPct: 50 })
    expect(rec.urgente.length).toBeLessThanOrEqual(5)
    expect(rec.melhoria.length).toBeLessThanOrEqual(5)
    expect(rec.manutencao.length).toBeLessThanOrEqual(3)
    expect(new Set(rec.urgente).size).toBe(rec.urgente.length)
  })

  it('setor inexistente não quebra (sem dicas de setor)', () => {
    const rec = gerarRecomendacoes({ nomeSetor: 'Inexistente', scorePct: 10, criterios: NEUTROS })
    expect(rec).toBeDefined()
    expect(Array.isArray(rec.urgente)).toBe(true)
  })
})

describe('integração dos Cinco Elementos', () => {
  it('setor crítico recebe estratégia elemental (ativar o elemento + a mãe)', () => {
    // Prosperidade = Madeira; mãe = Água; controlador = Metal
    const rec = gerarRecomendacoes({ nomeSetor: SETOR, scorePct: 20, criterios: NEUTROS })
    expect(rec.urgente.some(r => r.includes('elemento Madeira'))).toBe(true)
    expect(rec.urgente.some(r => r.includes('Água'))).toBe(true)
    expect(rec.melhoria.some(r => r.includes('Metal'))).toBe(true)
  })

  it('usa o elemento do banco quando informado (sobrepõe o clássico do setor)', () => {
    const rec = gerarRecomendacoes({ nomeSetor: SETOR, scorePct: 20, criterios: NEUTROS, elemento: 'Fogo' })
    expect(rec.urgente.some(r => r.includes('elemento Fogo'))).toBe(true)
  })

  it('setor bom não recebe intervenção elemental', () => {
    const rec = gerarRecomendacoes({ nomeSetor: SETOR, scorePct: 90, criterios: NEUTROS })
    expect([...rec.urgente, ...rec.melhoria].some(r => r.includes('ciclo'))).toBe(false)
  })
})

describe('integração cômodo×setor', () => {
  it('banheiro na Prosperidade gera conflito urgente com cura', () => {
    const rec = gerarRecomendacoes({ nomeSetor: SETOR, scorePct: 80, criterios: NEUTROS, comodos: ['banheiro'] })
    expect(rec.urgente.some(r => r.includes('Banheiro no setor da Prosperidade'))).toBe(true)
    expect(rec.urgente.some(r => r.includes('tampa'))).toBe(true)
  })

  it('o conflito vem ANTES das demais urgências (sinal mais específico)', () => {
    const criterios = Array(CRITERIOS.length).fill(0)
    const rec = gerarRecomendacoes({ nomeSetor: SETOR, scorePct: 10, criterios, comodos: ['banheiro'] })
    expect(rec.urgente[0]).toContain('Banheiro no setor da Prosperidade')
  })

  it('cômodo sem conflito no setor não gera nada', () => {
    const rec = gerarRecomendacoes({ nomeSetor: SETOR, scorePct: 80, criterios: NEUTROS, comodos: ['sala', 'quarto_casal'] })
    expect(rec.urgente).toHaveLength(0)
  })

  it('sem comodos informados, saída idêntica à de antes (retrocompatível)', () => {
    const a = gerarRecomendacoes({ nomeSetor: SETOR, scorePct: 80, criterios: NEUTROS })
    const b = gerarRecomendacoes({ nomeSetor: SETOR, scorePct: 80, criterios: NEUTROS, comodos: [] })
    expect(a).toEqual(b)
  })
})

describe('criteriosPorNomeParaArray', () => {
  it('converte mapa por nome no array indexado por CRITERIOS', () => {
    const porNome = { [CRITERIOS[0]]: 3, [CRITERIOS[2]]: 1 }
    const arr = criteriosPorNomeParaArray(porNome)
    expect(arr).toHaveLength(CRITERIOS.length)
    expect(arr[0]).toBe(3)
    expect(arr[2]).toBe(1)
    expect(arr[1]).toBe(-1) // ausente vira -1
  })

  it('produz o mesmo resultado que o acesso por nome no algoritmo', () => {
    const porNome: Record<string, number> = { [CRITERIOS[0]]: 0, [CRITERIOS[3]]: 1 }
    const viaArray = gerarRecomendacoes({
      nomeSetor: SETOR,
      scorePct: 50,
      criterios: criteriosPorNomeParaArray(porNome),
    })
    // recalcula manualmente pelo mesmo caminho para garantir equivalência
    expect(viaArray.urgente).toContain(CRITERIO_DICAS[0][0])
    expect(viaArray.melhoria).toContain(CRITERIO_DICAS[3][0])
  })
})
