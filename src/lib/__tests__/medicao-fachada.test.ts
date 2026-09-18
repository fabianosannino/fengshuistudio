import { describe, expect, it } from 'vitest'
import {
  avaliarTresLeituras,
  converterMedicaoFachada,
  lerMedicaoFachada,
  resumirMedicaoFachada,
  type MedicaoFachada,
} from '../medicao-fachada'
import { secoesDoFormato } from '../formato-do-relatorio'
import { criarEntradaRelatorio } from '../relatorio-emissao'
import { fonteAnaliseTeste } from '../../../tests/fixtures/fonte-analise'

const medicao: MedicaoFachada = {
  versao: 1,
  leituras: [358, 0, 2],
  referencia: 'magnetico',
  registrada_em: '2026-09-18T12:00:00Z',
}
describe('D2-ORI — medições preservadas e limites angulares', () => {
  it('atravessa o Norte: três valores originais, média 0 e dispersão 2 sem mudar faixa', () => {
    expect(avaliarTresLeituras(medicao.leituras)).toMatchObject({
      aplicada: 0,
      mudaSetor: false,
      mudaMontanha: false,
      repetir: false,
    })
    expect(avaliarTresLeituras(medicao.leituras)?.dispersao).toBeCloseTo(2)
    const lida = lerMedicaoFachada(medicao)!
    lida.leituras[0] = 3
    expect(medicao.leituras[0]).toBe(358)
  })
  it.each(
    [
      [],
      [1, 2],
      [1, 2, 3, 4],
      [NaN, 1, 2],
      [Infinity, 1, 2],
      [-1, 0, 1],
      [360, 0, 1],
      [0, 120, 240],
    ].map((valores) => ({ valores })),
  )(
    'recusa entrada incompleta/inválida ou média indefinida: %j',
    ({ valores }) => {
      expect(avaliarTresLeituras(valores)).toBeNull()
      expect(lerMedicaoFachada({ ...medicao, leituras: valores })).toBeNull()
    },
  )
  it('distingue cruzamento de Montanha, setor e efeito do arredondamento', () => {
    expect(avaliarTresLeituras([7.4, 7.5, 7.6])).toMatchObject({
      mudaMontanha: true,
      mudaSetor: false,
    })
    expect(avaliarTresLeituras([22.4, 22.5, 22.6])).toMatchObject({
      mudaMontanha: true,
      mudaSetor: true,
    })
    expect(avaliarTresLeituras([22.49, 22.49, 22.49])).toMatchObject({
      aplicada: 22.5,
      arredondamentoMudaFaixa: true,
    })
    expect(avaliarTresLeituras([0, 10, 20])).toMatchObject({ repetir: true })
  })
  it('converte desde os originais sem acumular conversões e conserva referência/data', () => {
    const convertida = converterMedicaoFachada(medicao, 'verdadeiro', -20)
    expect(convertida.leituras).toEqual([358, 0, 2])
    expect(resumirMedicaoFachada(convertida).atual.aplicada).toBe(340)
    expect(convertida.registrada_em).toBe(medicao.registrada_em)
    const volta = converterMedicaoFachada(convertida, 'magnetico', -15)
    expect(volta).toEqual(medicao)
    expect(resumirMedicaoFachada(volta).atual.aplicada).toBe(0)
    expect(() =>
      converterMedicaoFachada(medicao, 'verdadeiro', Infinity),
    ).toThrow()
  })
  it.each([
    undefined,
    null,
    { ...medicao, referencia: 'desconhecido' },
    { ...medicao, registrada_em: 'inválida' },
    { ...medicao, leituras: ['358', 0, 2] },
    { ...medicao, conversao: { referencia: 'verdadeiro', declinacao: 90 } },
  ])(
    'não inventa originais para legado ou dados inconsistentes: %j',
    (valor) => {
      expect(lerMedicaoFachada(valor)).toBeNull()
    },
  )
  it('inclui medições e conversão na fonte de novas emissões, sem exigir em fontes antigas', () => {
    const fonte = fonteAnaliseTeste('bussola')
    fonte.consulta.bagua_entrada!.orientacao_medicao = converterMedicaoFachada(
      medicao,
      'verdadeiro',
      -20,
    )
    const edicao = {
      secoes: secoesDoFormato('resumo'),
      textos: { introducao: '', conclusao: '', curas: '', chi: '' },
      recomendacoes: {},
    }
    const entrada = criarEntradaRelatorio(
      fonte,
      edicao,
      '2026-09-18T12:00:00Z',
      'America/Sao_Paulo',
    )
    expect(
      entrada.fonte.consulta.bagua_entrada!.orientacao_medicao?.leituras,
    ).toEqual([358, 0, 2])
    expect(
      entrada.fonte.consulta.bagua_entrada!.orientacao_medicao?.conversao
        ?.declinacao,
    ).toBe(-20)
    expect(
      criarEntradaRelatorio(
        fonteAnaliseTeste(),
        edicao,
        '2026-09-18T12:00:00Z',
        'America/Sao_Paulo',
      ).fonte.consulta.bagua_entrada!.orientacao_medicao,
    ).toBeUndefined()
  })
})
