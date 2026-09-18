import { describe, expect, it } from 'vitest'
import { sustentacaoDoDiagnostico, resumoDaSustentacao } from '../sustentacao-do-diagnostico'
import { executarMetodos, type DadosParaMetodos } from '../execucao-metodos'

const fonte: DadosParaMetodos = {
  bagua_entrada: { escola: 'bussola', orientacao_graus: 0, orientacao_referencia: 'magnetico', orientacao_estado: 'confirmada', orientacao_origem: 'manual', orientacao_confirmada_em: '2026-09-18T12:00:00Z' },
  ano_construcao: 2011, clientes: { data_nascimento: '1990-06-15', genero: 'masculino' },
}
const completo = () => ({ execucoes: executarMetodos(fonte), setoresComScore: 9, temPoligonoTaiJi: true })

describe('D0-02 — disponibilidade deriva do cálculo, com limites visíveis', () => {
  it('dados completos não promovem um mapa experimental', () => {
    const metodos = sustentacaoDoDiagnostico(completo())
    expect(metodos.find(m => m.nome === 'Estrelas Voadoras')).toMatchObject({ disponivel: false, estado: 'experimental' })
    expect(resumoDaSustentacao(metodos)).toBe('4 de 5 métodos sustentados no escopo atual · 1 experimental')
  })
  it('data preenchida mas inválida não sustenta Ming Gua', () => {
    const metodos = sustentacaoDoDiagnostico({ ...completo(), execucoes: executarMetodos({ ...fonte, clientes: { data_nascimento: '1990-02-30', genero: 'masculino' } }) })
    expect(metodos.find(m => m.nome === 'Ming Gua do morador')).toMatchObject({ disponivel: false, estado: 'indeterminado', oQueFalta: expect.stringContaining('data válida') })
  })
  it('método indisponível continua na lista e explica por quê', () => {
    const metodos = sustentacaoDoDiagnostico({ ...completo(), execucoes: executarMetodos({ ...fonte, ano_construcao: null }) })
    expect(metodos.find(m => m.nome === 'Estrelas Voadoras')).toMatchObject({ disponivel: false, oQueFalta: expect.stringContaining('ano de construção') })
  })
  it('BTB mantém os métodos clássicos visíveis, como não aplicáveis', () => {
    const metodos = sustentacaoDoDiagnostico({ ...completo(), execucoes: executarMetodos({ ...fonte, bagua_entrada: { escola: 'btb' } }) })
    expect(metodos.find(m => m.nome.startsWith('Kua da Casa'))).toMatchObject({ disponivel: false, estado: 'nao_aplicavel', oQueFalta: expect.stringContaining('BTB') })
  })
  it('não confunde um único setor avaliado com levantamento completo', () => {
    const parcial = sustentacaoDoDiagnostico({ ...completo(), setoresComScore: 1 })[0]
    expect(parcial.disponivel).toBe(true)
    expect(parcial.limitacoes).toEqual(['Avaliação parcial: 1 de 9 setores avaliados.'])
  })
  it('sem contorno a limitação geométrica permanece declarada', () => {
    const r = sustentacaoDoDiagnostico({ ...completo(), temPoligonoTaiJi: false })[1]
    expect(r.disponivel).toBe(false)
    expect(r.oQueFalta).toContain('marcações de falta e excesso são calculadas separadamente')
  })
  it('consulta recém-criada não sustenta nada', () => {
    const r = sustentacaoDoDiagnostico({ execucoes: executarMetodos({}) })
    expect(r).toHaveLength(5)
    expect(resumoDaSustentacao(r)).toBe('Nenhum dos 5 métodos está sustentado ainda')
  })
})
