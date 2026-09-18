import { describe, expect, it } from 'vitest'
import { executarMetodos, type DadosParaMetodos } from '../execucao-metodos'
import { jsonCanonico } from '../relatorio-emissao'

const dados: DadosParaMetodos = {
  bagua_entrada: { escola: 'bussola', orientacao_graus: 0, orientacao_referencia: 'magnetico', orientacao_estado: 'confirmada', orientacao_origem: 'manual', orientacao_confirmada_em: '2026-09-18T12:00:00.000Z' },
  ano_construcao: 2011,
  clientes: { data_nascimento: '1990-06-15', genero: 'masculino' },
}

describe('D0-01 — contratos dos motores existentes', () => {
  it('Norte confirmado usa o assento Sul (Kua 9), com variante e versão; Ming Gua 1990 é 1', () => {
    const r = executarMetodos(dados)
    expect(r.baZhai).toMatchObject({ metodo: 'ba-zhai', variante: 'assento-octantes', versao: '1.0.0', estado: 'calculado', resultado: { kua: 9, grupo: 'leste' } })
    expect(r.mingGua).toMatchObject({ metodo: 'ming-gua', estado: 'calculado', resultado: { kua: 1, grupo: 'leste' } })
    expect(r.feiXing).toMatchObject({ estado: 'experimental', resultado: { periodo: { periodo: 8, anoUsado: 2011 } } })
    expect(r.feiXing.limitacoes.join(' ')).toContain('24 Montanhas')
  })
  it.each([
    {}, { orientacao_graus: 0 }, { ...dados.bagua_entrada, orientacao_estado: 'nao_confirmada' as const },
    { ...dados.bagua_entrada, orientacao_referencia: undefined },
    { ...dados.bagua_entrada, orientacao_origem: 'inventada' },
    { ...dados.bagua_entrada, orientacao_confirmada_em: 'inválido' },
    { ...dados.bagua_entrada, orientacao_graus: NaN },
  ])('sem medição íntegra, não inventa resultado: %j', orientacao => {
    const r = executarMetodos({ ...dados, bagua_entrada: { ...orientacao, escola: 'bussola' } })
    expect(r.baZhai.resultado).toBeNull()
    expect(r.feiXing.resultado).toBeNull()
    expect(r.baZhai.estado).toBe('incompleto')
  })
  it('trocar para BTB não mistura direções clássicas nem modifica a execução anterior', () => {
    const antes = executarMetodos(dados)
    const snapshot = jsonCanonico(antes)
    const depois = executarMetodos({ ...dados, bagua_entrada: { ...dados.bagua_entrada, escola: 'btb' } })
    expect(depois.baZhai.estado).toBe('nao_aplicavel')
    expect(depois.feiXing.resultado).toBeNull()
    expect(jsonCanonico(antes)).toBe(snapshot)
  })
  it.each([NaN, Infinity, 2011.5, 1800, 2201, 10000])('ano inválido %s não aparece disponível nem lança RangeError', ano => {
    const r = executarMetodos({ ...dados, ano_construcao: ano })
    expect(r.feiXing).toMatchObject({ estado: 'indeterminado', resultado: null })
  })
  it('reforma posterior prevalece; reforma anterior declara inconsistência', () => {
    expect(executarMetodos({ ...dados, ano_reforma_estrutural: 2025 }).feiXing.resultado?.periodo)
      .toMatchObject({ anoUsado: 2025, periodo: 9, daReforma: true })
    expect(executarMetodos({ ...dados, ano_reforma_estrutural: 2000 }).feiXing)
      .toMatchObject({ estado: 'indeterminado', resultado: null, motivo: expect.stringContaining('anterior') })
  })
  it('ano de virada não ganha certeza porque os campos estão preenchidos', () => {
    const r = executarMetodos({ ...dados, ano_construcao: 2024 }).feiXing
    expect(r.estado).toBe('experimental')
    expect(r.resultado?.periodo.ambiguo).toBe(true)
    expect(r.limitacoes.join(' ')).toContain('Período 8')
  })
  it.each(['1990-02-04', '1990-02-30', '1890-06-15', '2110-06-15'])('Ming Gua indeterminado para %s não vira disponível', data => {
    expect(executarMetodos({ ...dados, clientes: { data_nascimento: data, genero: 'masculino' } }).mingGua)
      .toMatchObject({ estado: 'indeterminado', resultado: null, motivo: expect.any(String) })
  })
  it('distingue campos ausentes de gênero não reconhecido', () => {
    expect(executarMetodos({}).mingGua.estado).toBe('incompleto')
    expect(executarMetodos({ ...dados, clientes: { ...dados.clientes, genero: 'não informado' } }).mingGua.estado).toBe('indeterminado')
  })
  it.each(['2011-99-99', '10000-01-01', '2201-01-01', '1800-01-01', '2011lixo'])('legado inválido %s não cria uma carta', data => {
    expect(executarMetodos({ ...dados, ano_construcao: null, bagua_entrada: { ...dados.bagua_entrada, data_construcao: data } }).feiXing)
      .toMatchObject({ estado: 'indeterminado', resultado: null })
  })
  it('preserva a leitura do ano legado válido sem inventar um dia de conclusão', () => {
    expect(executarMetodos({ ...dados, ano_construcao: null, bagua_entrada: { ...dados.bagua_entrada, data_construcao: '2011-01-01' } }).feiXing.resultado?.periodo.anoUsado).toBe(2011)
  })
  it('mesma entrada gera o mesmo registro, sem relógio nem mutação compartilhada', () => {
    const original = jsonCanonico(dados)
    const um = executarMetodos(dados)
    const dois = executarMetodos(dados)
    expect(jsonCanonico(um)).toBe(jsonCanonico(dois))
    um.baZhai.limitacoes.push('teste')
    // As direções também precisam pertencer ao resultado, não à tabela global.
    if (um.baZhai.resultado) um.baZhai.resultado.direcoes.shengChi = 'alterado'
    expect(jsonCanonico(executarMetodos(dados))).toBe(jsonCanonico(dois))
    expect(jsonCanonico(dados)).toBe(original)
  })
})
