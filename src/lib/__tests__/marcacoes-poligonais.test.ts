import { describe, expect, it } from 'vitest'
import { calcularSetores, type Marcacao } from '../geometria-bagua'
import { cantos, erroMarcacao, erroPoligono, limitesDosPontos } from '../marcacoes-poligonais'
import { corGeo, rotuloGeo } from '../escala-score'
import { referenciaDaAnalise, estadoDaAnalise } from '../analise-bagua'

const b = { x: 100, y: 100, w: 600, h: 600 }, tercos = [1 / 3, 2 / 3]
const marca = (tipo: Marcacao['tipo'], pontos: { x: number; y: number }[], id = tipo): Marcacao => ({ id, tipo, pontos, ...limitesDosPontos(pontos) })
const falta = marca('falta', cantos({ x: 100, y: 100, w: 100, h: 100 }))
const excesso = marca('excesso', cantos({ x: 100, y: 50, w: 100, h: 50 }))
const calcular = (m: Marcacao[]) => calcularSetores(b, tercos, tercos, m, 'saldo-v2')

describe('E-POL-01 — geometria integrada e saldo', () => {
  it('saldo pequeno, mas real, não é mascarado pelo limiar visual legado de 0,5%', () => {
    const s = calcular([marca('falta', cantos({x:100,y:100,w:10,h:10}))])[0]
    expect(s.geo).toBe(99.75);expect(rotuloGeo(s.geo,s)).toBe('Falta')
  })
  it('mais falta que excesso: 10.000 - 5.000 = falta líquida de 5.000, em setor de 40.000', () => {
    const s = calcular([falta, excesso])[0]
    expect(s).toMatchObject({ faltaArea: 10_000, excessoArea: 5_000, faltaPct: 25, excessoPct: 12.5, geo: 87.5 })
    expect(rotuloGeo(s.geo, s)).toBe('Falta'); expect(corGeo(s.geo, s)).toBe('#B4533A')
  })
  it('mais excesso: mantém áreas brutas e classifica em verde', () => {
    const e = marca('excesso', cantos({ x: 100, y: 0, w: 150, h: 100 }))
    const s = calcular([falta, e])[0]
    expect(s.geo).toBe(87.5); expect(rotuloGeo(s.geo, s)).toBe('Excesso'); expect(corGeo(s.geo, s)).toBe('#24724F')
  })
  it('igualdade resulta em equilíbrio por saldo sem apagar falta/excesso', () => {
    const s = calcular([falta, marca('excesso', cantos({ x: 100, y: 0, w: 100, h: 100 }))])[0]
    expect(s).toMatchObject({ faltaArea: 10_000, excessoArea: 10_000, geo: 100 })
    expect(rotuloGeo(s.geo, s)).toBe('Equilibrado por saldo')
  })
  it('não soma interseções duas vezes, inclusive triângulos côncavos/duplicados', () => {
    const t = marca('falta', [{ x: 100, y: 100 }, { x: 300, y: 100 }, { x: 100, y: 300 }])
    expect(calcular([t, { ...t, id: 'duplicado' }])[0].faltaArea).toBe(20_000)
    const l = marca('falta', [{ x: 100, y: 100 }, { x: 300, y: 100 }, { x: 300, y: 150 }, { x: 150, y: 150 }, { x: 150, y: 300 }, { x: 100, y: 300 }])
    expect(calcular([l])[0].faltaArea).toBe(17_500)
  })
  it('reprodução do excesso que deslocava os nove quadrantes: somente setor periférico muda', () => {
    const antes = structuredClone(b), sem = calcular([falta]), com = calcular([falta, excesso])
    expect(b).toEqual(antes)
    expect(com.slice(1)).toEqual(sem.slice(1))
    expect(com[0].faltaArea).toBe(sem[0].faltaArea)
    expect(com[4].excessoArea).toBe(0)
  })
  it('legado retangular mantém a penalização antiga até confirmação explícita', () => {
    const retangulos = [falta, excesso].map(m => ({id:m.id,tipo:m.tipo,x:m.x,y:m.y,w:m.w,h:m.h}))
    expect(calcularSetores(b, tercos, tercos, retangulos)[0].geo).toBe(62.5)
    expect(calcular(retangulos)[0].geo).toBe(87.5)
    const be = { escola: 'btb', bordas: b, marcacoes: retangulos }
    const ref = referenciaDaAnalise(be)
    expect(estadoDaAnalise({ ...be, analise_referencia: ref })).toBe('atual')
    expect(estadoDaAnalise({ ...be, geometria_regra: 'saldo-v2', analise_referencia: ref })).toBe('desatualizada')
  })
  it('rejeita pontos sem área, NaN, cruzamento, quantidade excessiva e regra incompatível', () => {
    expect(erroPoligono([{ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }, { x: 10, y: 0 }])).toMatch(/cruzam/)
    expect(erroPoligono([{ x: NaN, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 10 }])).toMatch(/inválidas/)
    expect(erroPoligono(Array.from({ length: 101 }, () => ({ x: 1, y: 1 })))).toMatch(/100/)
    expect(() => calcularSetores(b, tercos, tercos, [falta])).toThrow()
  })
})
describe('E-POL-02 — conexão obrigatória e recorte', () => {
  it('aceita falta e excesso com trecho compartilhado, inclusive cruzando a borda', () => {
    expect(erroMarcacao(falta.pontos!, 'falta', b)).toBeNull()
    expect(erroMarcacao(excesso.pontos!, 'excesso', b)).toBeNull()
    const cruzando = cantos({ x: 100, y: 50, w: 100, h: 100 })
    expect(erroMarcacao(cruzando, 'falta', b)).toBeNull()
    expect(erroMarcacao(cruzando, 'excesso', b)).toBeNull()
  })
  it('avisa sobre área isolada, contato apenas por um ponto e marcação do lado errado', () => {
    expect(erroMarcacao(cantos({ x: 150, y: 150, w: 20, h: 20 }), 'falta', b)).toMatch(/Conecte/)
    expect(erroMarcacao(cantos({ x: 50, y: 50, w: 50, h: 50 }), 'excesso', b)).toMatch(/Conecte/)
    expect(erroMarcacao(falta.pontos!, 'excesso', b)).toMatch(/fora/)
    expect(erroMarcacao(excesso.pontos!, 'falta', b)).toMatch(/dentro/)
  })
})
