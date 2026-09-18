import {
  calcularResultadoAnalise,
  impedimentoParaHistorico,
} from '../calculo-analise'
import { describe, expect, it } from 'vitest'
import { fonteAnaliseTeste } from '../../../tests/fixtures/fonte-analise'
import {
  estadoDoRegistro,
  VERSAO_MOTOR_ANALISE,
  comparacaoPermitida,
  type AnaliseSalva,
} from '../historico-analises'
import { criarEntradaRelatorio } from '../relatorio-emissao'
import { secoesDoFormato } from '../formato-do-relatorio'

describe('D1 — entradas, resultados e diferenças preservados', () => {
  it('calcula áreas analíticas, preserva ausência de nota e separa métodos', () => {
    const btb = calcularResultadoAnalise(fonteAnaliseTeste()),
      bussola = calcularResultadoAnalise(fonteAnaliseTeste('bussola'))
    expect(btb.setores[0]).toMatchObject({
      falta: 25,
      excesso: 0,
      saldo: -25,
      geometria: 75,
      nota: null,
    })
    expect(btb.metodos.baZhai.estado).toBe('nao_aplicavel')
    expect(bussola.metodos.baZhai.estado).toBe('calculado')
    expect(bussola.metodos.feiXing.estado).toBe('experimental')
  })
  it('bloqueia análise não finalizada ou fonte obsoleta', () => {
    const f = fonteAnaliseTeste()
    delete f.consulta.bagua_entrada!.finalizada_em
    expect(impedimentoParaHistorico(f)).toMatch(/Finalize/)
    const alterada = fonteAnaliseTeste()
    alterada.consulta.bagua_entrada!.bordas!.w = 500
    expect(() => calcularResultadoAnalise(alterada)).toThrow(/Revise/)
  })
  it('deriva obsolescência sem alterar registro e não elege escola vencedora', () => {
    const a = {
      versao_motor: VERSAO_MOTOR_ANALISE,
      fonte_sha256: 'a',
      metodo: 'btb',
    } as AnaliseSalva
    expect(estadoDoRegistro(a, 'a')).toMatch(/Corresponde/)
    expect(estadoDoRegistro(a, 'b')).toMatch(/diferentes/)
    expect(estadoDoRegistro({ ...a, versao_motor: 'anterior' }, 'a')).toMatch(
      /anterior/,
    )
    expect(comparacaoPermitida(a, { ...a, metodo: 'bussola' })).toMatch(
      /não definem/,
    )
    expect(a.fonte_sha256).toBe('a')
  })
  it('relatório vincula versão e copia os resultados salvos sem recalcular', () => {
    const f = fonteAnaliseTeste('bussola'),
      resultado = calcularResultadoAnalise(f)
    if (resultado.metodos.baZhai.resultado)
      resultado.metodos.baZhai.resultado.kua = 8
    const a = {
      id: 'analise',
      versao_motor: VERSAO_MOTOR_ANALISE,
      fonte_sha256: 'hash',
      resultado,
    } as AnaliseSalva
    const r = criarEntradaRelatorio(
      f,
      {
        secoes: secoesDoFormato('resumo'),
        textos: { introducao: '', curas: '', chi: '', conclusao: '' },
        recomendacoes: {},
      },
      '2026-09-18T12:00:00.000Z',
      'UTC',
      a,
    )
    expect(r.analise).toEqual({
      id: 'analise',
      fonte_sha256: 'hash',
      versao_motor: VERSAO_MOTOR_ANALISE,
    })
    expect(r.execucoes_metodos.baZhai.resultado?.kua).toBe(8)
    if (resultado.metodos.baZhai.resultado)
      resultado.metodos.baZhai.resultado.kua = 2
    expect(r.execucoes_metodos.baZhai.resultado?.kua).toBe(8)
  })
})
