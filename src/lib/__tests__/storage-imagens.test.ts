import { describe, expect, it } from 'vitest'
import {
  caminhoDoObjeto,
  ehImagemDireta,
  pastaRaiz,
  BUCKET_IMOVEIS,
  BUCKET_CLIENTES,
} from '../storage-imagens'

const PROJETO = 'https://airijuazookdnstyfady.supabase.co'

describe('caminhoDoObjeto', () => {
  it('extrai o path de uma URL pública legada — o formato que está gravado hoje', () => {
    expect(caminhoDoObjeto(
      `${PROJETO}/storage/v1/object/public/${BUCKET_IMOVEIS}/consulta-1/geral/foto.jpg`,
      BUCKET_IMOVEIS
    )).toBe('consulta-1/geral/foto.jpg')
  })

  it('extrai o path de uma URL assinada, descartando o token', () => {
    expect(caminhoDoObjeto(
      `${PROJETO}/storage/v1/object/sign/${BUCKET_CLIENTES}/user-1/cliente-9.png?token=eyJhbGciOi`,
      BUCKET_CLIENTES
    )).toBe('user-1/cliente-9.png')
  })

  it('aceita um path já normalizado — é o que passamos a gravar', () => {
    expect(caminhoDoObjeto('consulta-1/bagua-planta/planta.png', BUCKET_IMOVEIS))
      .toBe('consulta-1/bagua-planta/planta.png')
  })

  it('decodifica percent-encoding vindo da URL', () => {
    expect(caminhoDoObjeto(
      `${PROJETO}/storage/v1/object/public/${BUCKET_IMOVEIS}/consulta-1/quarto%20casal/foto.jpg`,
      BUCKET_IMOVEIS
    )).toBe('consulta-1/quarto casal/foto.jpg')
  })

  it('devolve null para data: e blob:, que não têm o que assinar', () => {
    expect(caminhoDoObjeto('data:image/png;base64,iVBORw0KGgo=', BUCKET_IMOVEIS)).toBeNull()
    expect(caminhoDoObjeto('blob:https://app.test/9f8a', BUCKET_IMOVEIS)).toBeNull()
  })

  it('devolve null para vazio, nulo e indefinido', () => {
    for (const vazio of [null, undefined, '', '   ']) {
      expect(caminhoDoObjeto(vazio, BUCKET_IMOVEIS), String(vazio)).toBeNull()
    }
  })

  it('não confunde bucket: URL de um bucket não resolve como path do outro', () => {
    const url = `${PROJETO}/storage/v1/object/public/${BUCKET_CLIENTES}/user-1/foto.png`
    expect(caminhoDoObjeto(url, BUCKET_IMOVEIS)).toBeNull()
    expect(caminhoDoObjeto(url, BUCKET_CLIENTES)).toBe('user-1/foto.png')
  })

  it('recusa travessia de pastas', () => {
    // A primeira pasta é o que prova a posse; `..` permitiria sair dela e pedir
    // assinatura para o arquivo de outro consultor.
    expect(caminhoDoObjeto('consulta-1/../consulta-2/foto.jpg', BUCKET_IMOVEIS)).toBeNull()
    expect(caminhoDoObjeto(
      `${PROJETO}/storage/v1/object/public/${BUCKET_IMOVEIS}/consulta-1/..%2Fconsulta-2/foto.jpg`,
      BUCKET_IMOVEIS
    )).toBeNull()
  })

  it('devolve null para URL de outro domínio', () => {
    expect(caminhoDoObjeto('https://exemplo.test/foto.jpg', BUCKET_IMOVEIS)).toBeNull()
  })
})

describe('ehImagemDireta', () => {
  it('reconhece data: e blob:', () => {
    expect(ehImagemDireta('data:image/png;base64,AAAA')).toBe(true)
    expect(ehImagemDireta('blob:https://app.test/9f8a')).toBe(true)
  })

  it('não confunde com URL de storage nem com path', () => {
    expect(ehImagemDireta(`${PROJETO}/storage/v1/object/public/x/y.png`)).toBe(false)
    expect(ehImagemDireta('consulta-1/foto.jpg')).toBe(false)
    expect(ehImagemDireta(null)).toBe(false)
  })
})

describe('pastaRaiz', () => {
  it('devolve o segmento que carrega a posse', () => {
    expect(pastaRaiz('consulta-1/geral/foto.jpg')).toBe('consulta-1')
    expect(pastaRaiz('user-1/cliente-9.png')).toBe('user-1')
  })

  it('devolve null quando não há pasta', () => {
    expect(pastaRaiz('')).toBeNull()
  })
})
