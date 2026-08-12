import { describe, expect, it } from 'vitest'
import { sustentacaoDoDiagnostico, resumoDaSustentacao } from '../sustentacao-do-diagnostico'

const COMPLETO = {
  orientacaoGraus: 42.5,
  setoresComScore: 9,
  anoDoImovel: 2011,
  nascimentoDoCliente: '1978-03-14',
  generoDoCliente: 'feminino',
  temPoligonoTaiJi: true,
  escola: 'bussola',
}

function porNome(dados: Parameters<typeof sustentacaoDoDiagnostico>[0], nome: string) {
  return sustentacaoDoDiagnostico(dados).find(m => m.nome.startsWith(nome))!
}

describe('sustentacaoDoDiagnostico', () => {
  it('com tudo preenchido, tudo sustentado', () => {
    const metodos = sustentacaoDoDiagnostico(COMPLETO)
    expect(metodos.every(m => m.disponivel)).toBe(true)
    expect(metodos.every(m => m.oQueFalta === undefined)).toBe(true)
  })

  it('o método indisponível continua na lista — sumir esconderia que ele existe', () => {
    // Era o defeito: um imóvel sem ano simplesmente não tinha a seção de
    // Estrelas Voadoras, e nada dizia por quê.
    const metodos = sustentacaoDoDiagnostico({ ...COMPLETO, anoDoImovel: null })
    const estrelas = metodos.find(m => m.nome === 'Estrelas Voadoras')
    expect(estrelas).toBeDefined()
    expect(estrelas!.disponivel).toBe(false)
    expect(estrelas!.oQueFalta).toContain('ano de construção')
  })

  it('o que falta é a consequência, não o nome do campo', () => {
    const taiJi = porNome({ ...COMPLETO, temPoligonoTaiJi: false }, 'Tai Ji')
    expect(taiJi.oQueFalta).toContain('falta e excesso de área não são calculáveis')
  })

  it('sem fachada, Kua da Casa e Estrelas Voadoras caem juntos e pelo mesmo motivo', () => {
    const dados = { ...COMPLETO, orientacaoGraus: null }
    expect(porNome(dados, 'Kua da Casa').oQueFalta).toContain('leitura da fachada')
    expect(porNome(dados, 'Estrelas Voadoras').oQueFalta).toContain('leitura da fachada')
  })

  it('grau zero é leitura — Norte exato não é ausência', () => {
    expect(porNome({ ...COMPLETO, orientacaoGraus: 0 }, 'Kua da Casa').disponivel).toBe(true)
  })

  it('no BTB os métodos de orientação aparecem dizendo que a escola não os usa', () => {
    // Sumir daria a impressão de que não existem, e a escola é reversível.
    const metodos = sustentacaoDoDiagnostico({ ...COMPLETO, escola: 'btb' })
    const estrelas = metodos.find(m => m.nome === 'Estrelas Voadoras')!
    expect(estrelas.disponivel).toBe(false)
    expect(estrelas.oQueFalta).toContain('BTB')
    expect(metodos.find(m => m.nome.startsWith('Kua da Casa'))).toBeDefined()
  })

  it('distingue falta de nascimento de falta de gênero', () => {
    expect(porNome({ ...COMPLETO, nascimentoDoCliente: null }, 'Ming Gua').oQueFalta)
      .toContain('data de nascimento')
    expect(porNome({ ...COMPLETO, generoDoCliente: null }, 'Ming Gua').oQueFalta)
      .toContain('gênero')
  })

  it('consulta recém-criada não sustenta nada, e diz isso', () => {
    const metodos = sustentacaoDoDiagnostico({ escola: 'bussola' })
    expect(metodos.some(m => m.disponivel)).toBe(false)
    expect(resumoDaSustentacao(metodos)).toBe('Nenhum dos 5 métodos está sustentado ainda')
  })
})

describe('resumoDaSustentacao', () => {
  it('conta o que está sustentado', () => {
    expect(resumoDaSustentacao(sustentacaoDoDiagnostico(COMPLETO))).toBe('Os 5 métodos estão sustentados')
    expect(resumoDaSustentacao(sustentacaoDoDiagnostico({ ...COMPLETO, anoDoImovel: null })))
      .toBe('4 de 5 métodos sustentados')
  })
})
