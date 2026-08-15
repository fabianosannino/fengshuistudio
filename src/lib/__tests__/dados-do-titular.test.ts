import { describe, expect, it } from 'vitest'
import {
  fotosDaConsulta, fotosParaApagar, emailAnonimo,
  COLUNAS_DE_FOTO_DA_CONSULTA, MARCA_DE_ANONIMIZACAO,
} from '../dados-do-titular'
import { BUCKET_CLIENTES, BUCKET_IMOVEIS } from '../storage-imagens'

/** Uma consulta com foto em todas as cinco colunas, cada uma na sua forma. */
const CONSULTA_COMPLETA = {
  bagua_imagem: 'consultor-1/bagua.png',
  foto_geral_url: 'consultor-1/geral.jpg',
  fotos_comodos: [
    { comodo: 'sala', fotos: ['consultor-1/sala-1.jpg', 'consultor-1/sala-2.jpg'] },
    { comodo: 'quarto', fotos: ['consultor-1/quarto.jpg'] },
  ],
  fotos_antes: ['consultor-1/antes.jpg'],
  fotos_depois: ['consultor-1/depois.jpg'],
  // Ruído: colunas que não são foto não podem entrar.
  nome_imovel: 'Casa da Maria',
  endereco_imovel: 'Rua das Flores, 100',
}

describe('fotosDaConsulta', () => {
  /**
   * O teste que existe por causa de um erro meu.
   *
   * A primeira versão da rota fazia `select('fotos')` — uma coluna que não
   * existe. A consulta devolveria vazio, a exclusão limparia o banco e deixaria
   * o bucket cheio. Objeto órfão continua servível por link, e ninguém
   * descobre, porque nada no banco diz que ele existe.
   */
  it('alcança as cinco colunas de foto', () => {
    const encontradas = fotosDaConsulta(CONSULTA_COMPLETA)
    expect(encontradas).toHaveLength(7)
    for (const esperada of [
      'consultor-1/bagua.png', 'consultor-1/geral.jpg',
      'consultor-1/sala-1.jpg', 'consultor-1/sala-2.jpg', 'consultor-1/quarto.jpg',
      'consultor-1/antes.jpg', 'consultor-1/depois.jpg',
    ]) {
      expect(encontradas).toContain(esperada)
    }
  })

  it('não arrasta texto que não é foto', () => {
    const encontradas = fotosDaConsulta(CONSULTA_COMPLETA)
    expect(encontradas).not.toContain('Casa da Maria')
    expect(encontradas).not.toContain('Rua das Flores, 100')
  })

  it('atravessa consulta parcial e vazia sem estourar', () => {
    // O formato mudou ao longo do tempo e há linha antiga com colunas nulas.
    // Uma exclusão que quebra nelas deixaria a pessoa sem o direito.
    expect(fotosDaConsulta({})).toEqual([])
    expect(fotosDaConsulta({ bagua_imagem: null, fotos_comodos: null })).toEqual([])
    expect(fotosDaConsulta({ fotos_comodos: [] })).toEqual([])
    expect(fotosDaConsulta({ fotos_comodos: [{ comodo: 'sala', fotos: [] }] })).toEqual([])
  })

  it('a lista de colunas é a que a rota consulta', () => {
    // Guarda contra a divergência: coluna de imagem nova em `consultas` precisa
    // entrar na constante, senão as fotos dela ficam para trás em silêncio.
    expect([...COLUNAS_DE_FOTO_DA_CONSULTA]).toEqual([
      'bagua_imagem', 'foto_geral_url', 'fotos_comodos', 'fotos_antes', 'fotos_depois',
    ])
  })
})

describe('fotosParaApagar', () => {
  it('separa por bucket', () => {
    const grupos = fotosParaApagar(
      ['consultor-1/cliente-a.jpg'],
      ['consultor-1/imovel-a.jpg', 'consultor-1/imovel-b.jpg']
    )
    const porBucket = Object.fromEntries(grupos.map((g) => [g.bucket, g.paths]))
    expect(porBucket[BUCKET_CLIENTES]).toEqual(['consultor-1/cliente-a.jpg'])
    expect(porBucket[BUCKET_IMOVEIS]).toHaveLength(2)
  })

  it('não repete o mesmo objeto', () => {
    // A mesma foto aparece em mais de uma linha; pedir a remoção duas vezes faz
    // a segunda parecer falha, e o log passaria a mentir sobre o que sobrou.
    const grupos = fotosParaApagar([], ['consultor-1/a.jpg', 'consultor-1/a.jpg'])
    expect(grupos[0].paths).toEqual(['consultor-1/a.jpg'])
  })

  it('descarta o que não é objeto do bucket', () => {
    // `data:` e URL de outro domínio não têm o que remover. Mandá-los ao
    // storage faria a chamada inteira falhar e nada seria apagado.
    const grupos = fotosParaApagar(
      ['data:image/png;base64,AAA', 'https://outro.site/foto.jpg', null, undefined, ''],
      []
    )
    expect(grupos).toEqual([])
  })

  it('não devolve grupo vazio', () => {
    expect(fotosParaApagar([], [])).toEqual([])
  })
})

describe('emailAnonimo', () => {
  it('é único por conta e inalcançável', () => {
    const a = emailAnonimo('11111111-1111-1111-1111-111111111111')
    const b = emailAnonimo('22222222-2222-2222-2222-222222222222')
    expect(a).not.toBe(b)
    // `.invalid` é reservado pela RFC 2606: nem erro de configuração manda
    // mensagem para lá.
    expect(a.endsWith('@invalid')).toBe(true)
  })
})

describe('MARCA_DE_ANONIMIZACAO', () => {
  it('explica o que houve para quem ler o pedido depois', () => {
    expect(MARCA_DE_ANONIMIZACAO).toMatch(/LGPD/)
    expect(MARCA_DE_ANONIMIZACAO).toMatch(/remov/i)
  })
})
