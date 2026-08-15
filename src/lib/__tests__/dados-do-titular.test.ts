import { describe, expect, it } from 'vitest'
import {
  fotosDaConsulta, arquivosParaApagar, emailAnonimo,
  COLUNAS_DE_IMAGEM_DA_CONSULTA, COLUNAS_DE_RELATORIO_DA_CONSULTA,
  BUCKETS_DO_TITULAR, MARCA_DE_ANONIMIZACAO,
} from '../dados-do-titular'

/**
 * Uma consulta com arquivo em toda origem conhecida, cada uma na sua forma.
 *
 * O `bagua_entrada` e o `relatorio_pdf_path` estão aqui porque foram os dois
 * que a primeira versão perdeu: um mora dentro de jsonb, o outro aponta para
 * outro bucket.
 */
const CONSULTA_COMPLETA = {
  bagua_imagem: 'consultor-1/bagua.png',
  foto_geral_url: 'consultor-1/geral.jpg',
  fotos_comodos: [
    { comodo: 'sala', fotos: ['consultor-1/sala-1.jpg', 'consultor-1/sala-2.jpg'] },
    { comodo: 'quarto', fotos: ['consultor-1/quarto.jpg'] },
  ],
  fotos_antes: ['consultor-1/antes.jpg'],
  fotos_depois: ['consultor-1/depois.jpg'],
  bagua_entrada: {
    planta_url: 'consultor-1/planta.png',
    planta_nome: 'Planta baixa da Maria.pdf',   // nome de arquivo, não caminho
    etapa: 'metragem',
  },
  planta_url: 'consultor-1/planta-legada.png',
  relatorio_url: 'consultor-1/relatorio-legado.png',
  relatorio_pdf_path: 'consultor-1/relatorio.pdf',
  // Ruído: colunas que não guardam arquivo não podem entrar.
  nome_imovel: 'Casa da Maria',
  endereco_imovel: 'Rua das Flores, 100',
}

describe('fotosDaConsulta', () => {
  it('alcança todas as origens do bucket de imóveis', () => {
    const encontradas = fotosDaConsulta(CONSULTA_COMPLETA, COLUNAS_DE_IMAGEM_DA_CONSULTA)
    for (const esperada of [
      'consultor-1/bagua.png', 'consultor-1/geral.jpg',
      'consultor-1/sala-1.jpg', 'consultor-1/sala-2.jpg', 'consultor-1/quarto.jpg',
      'consultor-1/antes.jpg', 'consultor-1/depois.jpg',
      'consultor-1/planta.png',          // dentro do jsonb `bagua_entrada`
      'consultor-1/planta-legada.png',   // coluna da era antiga
      'consultor-1/relatorio-legado.png',
    ]) {
      expect(encontradas).toContain(esperada)
    }
    expect(encontradas).toHaveLength(10)
  })

  /**
   * O teste que existe por causa de dois erros meus.
   *
   * A primeira versão fazia `select('fotos')` — coluna que não existe. A
   * segunda olhava cinco colunas e perdia `planta_url`, que mora dentro de
   * `bagua_entrada`, e o PDF do relatório, que vive noutro bucket.
   *
   * Nos dois casos a exclusão limparia o banco e deixaria o objeto no bucket:
   * servível por link, e invisível, porque nada no banco aponta para ele.
   */
  it('o PDF do relatório sai por lista própria — é outro bucket', () => {
    const doRelatorio = fotosDaConsulta(CONSULTA_COMPLETA, COLUNAS_DE_RELATORIO_DA_CONSULTA)
    expect(doRelatorio).toEqual(['consultor-1/relatorio.pdf'])

    // E não vaza para o grupo das imagens, senão seria procurado no bucket
    // errado e a remoção falharia em silêncio.
    const deImagem = fotosDaConsulta(CONSULTA_COMPLETA, COLUNAS_DE_IMAGEM_DA_CONSULTA)
    expect(deImagem).not.toContain('consultor-1/relatorio.pdf')
  })

  it('não arrasta texto que não é caminho de arquivo', () => {
    const encontradas = fotosDaConsulta(CONSULTA_COMPLETA, COLUNAS_DE_IMAGEM_DA_CONSULTA)
    expect(encontradas).not.toContain('Casa da Maria')
    expect(encontradas).not.toContain('Rua das Flores, 100')
    // `planta_nome` é o nome que a pessoa deu ao arquivo, não o objeto.
    expect(encontradas).not.toContain('Planta baixa da Maria.pdf')
    // `comodo` é rótulo — foi o que a versão que descia em tudo colhia.
    expect(encontradas).not.toContain('sala')
  })

  it('atravessa consulta parcial e vazia sem estourar', () => {
    // O formato mudou ao longo do tempo e há linha antiga com colunas nulas.
    // Uma exclusão que quebra nelas deixaria a pessoa sem o direito.
    expect(fotosDaConsulta({})).toEqual([])
    expect(fotosDaConsulta({ bagua_imagem: null, fotos_comodos: null })).toEqual([])
    expect(fotosDaConsulta({ fotos_comodos: [] })).toEqual([])
    expect(fotosDaConsulta({ fotos_comodos: [{ comodo: 'sala', fotos: [] }] })).toEqual([])
    expect(fotosDaConsulta({ bagua_entrada: null })).toEqual([])
    expect(fotosDaConsulta({ bagua_entrada: { etapa: 'metragem' } })).toEqual([])
  })

  it('as listas de colunas são as que a rota consulta', () => {
    // Guarda contra a divergência: origem de arquivo nova em `consultas` entra
    // aqui, senão os objetos dela ficam para trás em silêncio. É o defeito que
    // este arquivo inteiro existe para não repetir.
    expect([...COLUNAS_DE_IMAGEM_DA_CONSULTA]).toEqual([
      'bagua_imagem', 'foto_geral_url', 'fotos_comodos', 'fotos_antes',
      'fotos_depois', 'bagua_entrada', 'planta_url', 'relatorio_url',
    ])
    expect([...COLUNAS_DE_RELATORIO_DA_CONSULTA]).toEqual(['relatorio_pdf_path'])
  })
})

describe('arquivosParaApagar', () => {
  it('separa por bucket', () => {
    const grupos = arquivosParaApagar({
      [BUCKETS_DO_TITULAR.clientes]: ['consultor-1/cliente-a.jpg'],
      [BUCKETS_DO_TITULAR.imoveis]: ['consultor-1/imovel-a.jpg', 'consultor-1/imovel-b.jpg'],
      [BUCKETS_DO_TITULAR.relatorios]: ['consultor-1/relatorio.pdf'],
    })
    const porBucket = Object.fromEntries(grupos.map((g) => [g.bucket, g.paths]))
    expect(porBucket[BUCKETS_DO_TITULAR.clientes]).toEqual(['consultor-1/cliente-a.jpg'])
    expect(porBucket[BUCKETS_DO_TITULAR.imoveis]).toHaveLength(2)
    // O terceiro bucket é o que a primeira versão não tinha: `relatorios` não
    // cabia numa assinatura de dois parâmetros posicionais, e ficou de fora.
    expect(porBucket[BUCKETS_DO_TITULAR.relatorios]).toEqual(['consultor-1/relatorio.pdf'])
  })

  it('não repete o mesmo objeto', () => {
    // A mesma foto aparece em mais de uma linha; pedir a remoção duas vezes faz
    // a segunda parecer falha, e o log passaria a mentir sobre o que sobrou.
    const grupos = arquivosParaApagar({
      [BUCKETS_DO_TITULAR.imoveis]: ['consultor-1/a.jpg', 'consultor-1/a.jpg'],
    })
    expect(grupos[0].paths).toEqual(['consultor-1/a.jpg'])
  })

  it('descarta o que não é objeto do bucket', () => {
    // `data:` e URL de outro domínio não têm o que remover. Mandá-los ao
    // storage faria a chamada inteira falhar e nada seria apagado.
    const grupos = arquivosParaApagar({
      [BUCKETS_DO_TITULAR.clientes]: [
        'data:image/png;base64,AAA', 'https://outro.site/foto.jpg', null, undefined, '',
      ],
    })
    expect(grupos).toEqual([])
  })

  it('não devolve grupo vazio', () => {
    expect(arquivosParaApagar({})).toEqual([])
    expect(arquivosParaApagar({ [BUCKETS_DO_TITULAR.imoveis]: [] })).toEqual([])
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
