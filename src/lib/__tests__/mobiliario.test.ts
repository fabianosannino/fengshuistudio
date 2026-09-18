import { describe, expect, it } from 'vitest'
import { novoMobiliario, validarItensMobiliario, direcaoNaPlanta, fimDaSeta, setorDoPonto, leituraMobiliario, nomesDosQuadrantes } from '../mobiliario'
import type { BaguaEntrada } from '../types'
const planta: BaguaEntrada = { escola: 'btb', bordas: { x: 100, y: 100, w: 600, h: 600 }, orientacao_graus: 180, orientacao_estado: 'confirmada', orientacao_referencia: 'magnetico', orientacao_origem: 'manual', orientacao_confirmada_em: '2026-09-18T12:00:00Z' }
describe('D-MOB-01 — cadastro e leitura independente', () => {
  it('permite vários móveis do mesmo ambiente/setor sem duplicar identidade', () => {
    const mesa = { ...novoMobiliario(), ambiente: 'Cozinha' }, fogao = { ...novoMobiliario(), ambiente: 'Cozinha', tipo: 'fogao' as const }
    expect(validarItensMobiliario([mesa, fogao])).toBe(true)
    expect(validarItensMobiliario([mesa, mesa])).toBe(false)
  })
  it('rejeita data incompleta, futura, setor inexistente e direção fora dos limites; vazio não vira zero', () => {
    const base = { ...novoMobiliario(), ambiente: 'Quarto' }
    expect(base.direcao).toBeNull()
    for (const patch of [{ nascimento: '10/10' }, { nascimento: '2001-02-30' }, { nascimento: '2099-12-31' }, { direcao: 360 }, { direcao: NaN }, { setor: 0 }, { setor: 10 }, { ambiente: '' }]) expect(validarItensMobiliario([{ ...base, ...patch }])).toBe(false)
    expect(validarItensMobiliario([{ ...base, direcao: 0 }])).toBe(true)
  })
  it('não deduz a orientação pelo nome do guá BTB', () => {
    expect(nomesDosQuadrantes(planta)[0]).toBe('1 · Prosperidade')
    expect(direcaoNaPlanta({ x: 100, y: 100 }, { x: 100, y: 200 }, { ...planta, orientacao_estado: 'nao_confirmada' })).toBeNull()
  })
  it('converte seta da imagem com fachada na base e grau exato, preservando zero', () => {
    expect(direcaoNaPlanta({ x: 200, y: 200 }, { x: 200, y: 100 }, planta)).toBe(0)
    expect(direcaoNaPlanta({ x: 200, y: 200 }, { x: 300, y: 200 }, planta)).toBe(90)
    expect(direcaoNaPlanta({ x: 200, y: 200 }, { x: 300, y: 200 }, { ...planta, orientacao_graus: 270 })).toBe(180)
    expect(direcaoNaPlanta({ x: 200, y: 200 }, { x: 200, y: 200 }, planta)).toBeNull()
  })
  it('a seta persistida usa a mesma referência da planta, inclusive ao reabrir', () => {
    const m = {...novoMobiliario(),posicao:{x:200,y:200},direcao:90,referencia:'magnetico' as const}
    expect(fimDaSeta(m,planta,60)).toEqual({x:260,y:200})
    expect(fimDaSeta({...m,referencia:'verdadeiro'},planta,60)).toBeNull()
  })
  it('distingue posições no mesmo quadrante e respeita limites', () => {
    expect(setorDoPonto({ x: 150, y: 150 }, planta)).toBe(1)
    expect(setorDoPonto({ x: 200, y: 200 }, planta)).toBe(1)
    expect(setorDoPonto({ x: 700, y: 700 }, planta)).toBe(9)
    expect(setorDoPonto({ x: 701, y: 700 }, planta)).toBeNull()
  })
  it('explica dados faltantes, conversão de Norte e não promete móvel bem posicionado', () => {
    const m = { ...novoMobiliario(), ambiente: 'Quarto' }
    expect(leituraMobiliario(m, planta)).toMatch(/Sem avaliação/)
    const completo = { ...m, nascimento: '1980-10-10', sexo: 'masculino' as const, direcao: 0, referencia: 'verdadeiro' as const }
    expect(leituraMobiliario(completo, planta)).toMatch(/declinação/)
    const texto = leituraMobiliario({ ...completo, referencia: 'magnetico' }, planta)
    expect(texto).toMatch(/Ming Gua/); expect(texto).toMatch(/avaliação separada/)
  })
})
