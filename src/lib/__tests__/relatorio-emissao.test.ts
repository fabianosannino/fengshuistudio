import { describe, expect, it } from 'vitest'
import { criarEntradaRelatorio, idValido, jsonCanonico, pdfTemAssinatura, referenciaValida, validarEdicao, type FonteRelatorio } from '../relatorio-emissao'
import { secoesDoFormato } from '../formato-do-relatorio'

const edicao = { secoes: secoesDoFormato('resumo'), textos: { introducao: 'Teste', curas: '', chi: '', conclusao: '' }, recomendacoes: {} }
const fonte = { consulta: { bagua_entrada: { escola: 'bussola', orientacao_graus: 0 } }, perfil: {}, setores: [], evolucao: [], chi_custom: [] } as unknown as FonteRelatorio

describe('contrato de emissão', () => {
  it('hash canônico independe da ordem das chaves, mas preserva ordem dos arrays', () => {
    expect(jsonCanonico({ b: [2, 1], a: { z: 0, y: null } })).toBe(jsonCanonico({ a: { y: null, z: 0 }, b: [2, 1] }))
    expect(jsonCanonico([1, 2])).not.toBe(jsonCanonico([2, 1]))
  })
  it.each([NaN, Infinity, undefined, () => 1])('recusa entrada não JSON: %s', valor => {
    expect(() => jsonCanonico({ valor })).toThrow()
  })
  it('não transforma o Norte armazenado em medição confirmada', () => {
    const entrada = criarEntradaRelatorio(fonte, edicao, '2026-09-18T02:00:00.000Z', 'America/Sao_Paulo')
    expect(entrada.orientacao).toMatchObject({ estado: 'nao_confirmada', graus: 0, origem: 'nao_registrada' })
    expect(entrada.metodo).toBe('bussola')
    expect(entrada.variante).toBe('ba-zhai-assento-octantes')
    expect(entrada.execucoes_metodos.baZhai).toMatchObject({ estado: 'incompleto', resultado: null, versao: '1.0.0' })
  })
  it('preserva ausência e não inventa método', () => {
    const sem = { ...fonte, consulta: { ...fonte.consulta, bagua_entrada: null } }
    const entrada = criarEntradaRelatorio(sem, edicao, '2026-09-18T02:00:00.000Z', 'UTC')
    expect(entrada.orientacao).toMatchObject({ estado: 'ausente', graus: null })
    expect(entrada.metodo).toBe('nao_informado')
  })
  it('valida e copia textos/seções sem compartilhar mutações', () => {
    const copia = validarEdicao(edicao, [])!
    copia.textos.introducao = 'Alterado'
    expect(edicao.textos.introducao).toBe('Teste')
  })
  it.each([
    { ...edicao, extra: true },
    { ...edicao, secoes: { capa: true } },
    { ...edicao, textos: { ...edicao.textos, chi: 'x'.repeat(10001) } },
    { ...edicao, recomendacoes: { 'setor-de-outra-consulta': 'Texto' } },
  ])('recusa edição inválida', valor => expect(validarEdicao(valor, [])).toBeNull())
  it('recusa referências temporais vencidas, futuras e fusos inválidos', () => {
    const agora = new Date('2026-09-18T02:01:00.000Z')
    expect(referenciaValida('2026-09-18T02:00:00.000Z', 'America/Sao_Paulo', agora)).toBe(true)
    expect(referenciaValida('2026-09-19T02:00:00.000Z', 'UTC', agora)).toBe(false)
    expect(referenciaValida('2026-09-16T02:00:00.000Z', 'UTC', agora)).toBe(false)
    expect(referenciaValida('2026-09-18T02:00:00.000Z', 'Inexistente/Fuso', agora)).toBe(false)
  })
  it('verifica assinatura e encerramento do arquivo, não apenas MIME', () => {
    const bytes = (s: string) => new TextEncoder().encode(s)
    expect(pdfTemAssinatura(bytes('%PDF-1.4\nsynthetic\n%%EOF\n'))).toBe(true)
    expect(pdfTemAssinatura(bytes('<html>not a pdf</html>'))).toBe(false)
    expect(pdfTemAssinatura(bytes('%PDF-1.4\ntruncated'))).toBe(false)
  })
  it('recusa caminhos e IDs inválidos', () => {
    expect(idValido('../../relatorio.pdf')).toBe(false)
    expect(idValido('00000000-0000-4000-8000-000000000001')).toBe(true)
  })
})
