import { describe, expect, it } from 'vitest'
import { grausConfirmados, lerOrientacao } from '../orientacao'
import { calcularGridOrder, gridOrderBussola } from '../bagua-grid'
import { calcularEstrelasVoadoras } from '../estrelas-voadoras'
import { estadoDaAnalise, impedimentoDaAnalise, introducaoDoMetodo, referenciaDaAnalise } from '../analise-bagua'
import type { BaguaEntrada } from '../types'

const norte = { escola: 'bussola', orientacao_graus: 0, orientacao_estado: 'confirmada', orientacao_referencia: 'magnetico', orientacao_origem: 'manual', orientacao_confirmada_em: '2026-09-18T00:00:00.000Z' } as BaguaEntrada

describe('orientação com procedência', () => {
  it.each([undefined, null, {}, { orientacao_graus: NaN }, { orientacao_graus: Infinity }])('ausência não vira Norte: %j', dado => {
    expect(lerOrientacao(dado).estado).toBe('ausente')
    expect(grausConfirmados(dado)).toBeNull()
  })
  it.each([0, 90, -90, 360])('conserva leitura legada %s sem confirmar retroativamente', graus => {
    expect(lerOrientacao({ orientacao_graus: graus }).estado).toBe('nao_confirmada')
    expect(grausConfirmados({ orientacao_graus: graus })).toBeNull()
  })
  it('zero confirmado é Norte e não ausência', () => {
    expect(grausConfirmados(norte)).toBe(0)
    expect(calcularGridOrder('bussola', { orientacaoGraus: grausConfirmados(norte) })).toEqual(gridOrderBussola(0))
    expect(grausConfirmados({ ...norte, orientacao_graus: -90 })).toBe(270)
  })
  it.each(['orientacao_referencia', 'orientacao_origem', 'orientacao_confirmada_em', 'orientacao_estado'] as const)('confirmação incompleta: %s', campo => {
    expect(grausConfirmados({ ...norte, [campo]: undefined })).toBeNull()
  })
  it.each([null, undefined, NaN, Infinity])('não cria grade nem carta sem fachada finita: %s', graus => {
    expect(calcularGridOrder('bussola', { orientacaoGraus: graus })).toBeNull()
    expect(calcularEstrelasVoadoras({ facingGraus: graus, periodo: 9 })).toBeNull()
    expect(calcularGridOrder('btb', { orientacaoGraus: graus })).toHaveLength(9)
  })
  it('recusa período fracionário', () => {
    expect(calcularEstrelasVoadoras({ facingGraus: 0, periodo: 8.5 })).toBeNull()
  })
})

describe('análise derivada e relatório', () => {
  const be = { ...norte, planta_url: 'consulta/planta.png', rotacao: 0, lh: [1/3, 2/3], lv: [1/3, 2/3] }
  const analisada = { ...be, analise_referencia: referenciaDaAnalise(be) }
  it('não reescreve a referência anterior', () => {
    expect(estadoDaAnalise(analisada)).toBe('atual')
    const antiga = JSON.stringify(analisada)
    for (const mudanca of [{ escola: 'btb' }, { planta_url: 'outra.png' }, { rotacao: 90 }, { lh: [.2, .5] }, { orientacao_graus: 90 }]) {
      expect(estadoDaAnalise({ ...analisada, ...mudanca })).toBe('desatualizada')
    }
    expect(JSON.stringify(analisada)).toBe(antiga)
    expect(estadoDaAnalise({ ...analisada, finalizada_em: '2026-09-19' })).toBe('atual')
    expect(estadoDaAnalise({ ...analisada, analise_referencia: { ...analisada.analise_referencia, versao: 'antiga' } })).toBe('desatualizada')
  })
  it('exige revisão da bússola legada e deixa BTB independente da orientação', () => {
    expect(impedimentoDaAnalise(be, { bagua: true })).toMatch(/revisada/)
    expect(impedimentoDaAnalise({ ...be, orientacao_estado: 'nao_confirmada' }, { bagua: true })).toMatch(/Confirme/)
    expect(impedimentoDaAnalise(analisada, { bagua: true })).toBeNull()
    expect(impedimentoDaAnalise({ escola: 'btb' } as BaguaEntrada, { bagua: true })).toBeNull()
    expect(impedimentoDaAnalise(be, { fotos: true, introducao: true })).toBeNull()
  })
  it('narrativa acompanha a escola', () => {
    expect(introducaoDoMetodo('bussola')).toContain('experimental')
    expect(introducaoDoMetodo('bussola')).not.toContain('BTB')
    expect(introducaoDoMetodo('btb')).toContain('não depende de bússola')
    expect(introducaoDoMetodo()).toContain('não foi informada')
  })
})
