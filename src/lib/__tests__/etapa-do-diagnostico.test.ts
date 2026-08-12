import { describe, expect, it } from 'vitest'
import { progressoDoDiagnostico, coresDaBarra, ETAPAS } from '../etapa-do-diagnostico'

describe('progressoDoDiagnostico', () => {
  it('consulta recém-criada está na Orientação, com Cadastro já cumprido', () => {
    // Cadastro conta sempre: se há uma consulta, alguém a cadastrou. Barra
    // inteiramente vazia seria lida como «nada foi feito», o que nunca é verdade.
    const p = progressoDoDiagnostico({})
    expect(p.atual).toBe('orientacao')
    expect(p.cumpridas[0]).toBe(true)
    expect(p.rotulo).toBe('Etapa Orientação')
  })

  it('a etapa é a primeira pendente, não a última cumprida', () => {
    // Quem informou a fachada e já prescreveu curas sem fechar o Ba Guá está
    // devendo o Ba Guá — não está na etapa Curas.
    const p = progressoDoDiagnostico({ orientacaoGraus: 42.5, prescricoes: 8 })
    expect(p.atual).toBe('bagua')
  })

  it('setores com score contam como Ba Guá, mesmo sem `finalizada_em`', () => {
    expect(progressoDoDiagnostico({ orientacaoGraus: 0, setoresComScore: 3 }).atual).toBe('curas')
  })

  it('zero graus é leitura, não ausência', () => {
    // Norte exato. Tratar 0 como «não mediu» apagaria uma leitura legítima.
    expect(progressoDoDiagnostico({ orientacaoGraus: 0 }).cumpridas[1]).toBe(true)
    expect(progressoDoDiagnostico({ orientacaoGraus: null }).cumpridas[1]).toBe(false)
  })

  it('com relatório emitido, está completa', () => {
    const p = progressoDoDiagnostico({
      orientacaoGraus: 42.5, baguaFinalizadaEm: '2026-08-01T00:00:00Z',
      prescricoes: 12, relatorioGeradoEm: '2026-08-05T00:00:00Z',
    })
    expect(p.completo).toBe(true)
    expect(p.rotulo).toBe('Concluída')
    expect(p.indice).toBe(ETAPAS.length - 1)
  })
})

describe('coresDaBarra', () => {
  it('jade no cumprido, dourado no atual, translúcido no futuro', () => {
    const cores = coresDaBarra(progressoDoDiagnostico({ orientacaoGraus: 42.5 }))
    expect(cores).toEqual([
      '#2E7D6B', '#2E7D6B', '#C9A227', 'rgba(255,255,255,0.16)', 'rgba(255,255,255,0.16)',
    ])
  })

  it('completa fica toda jade — não sobra segmento dourado', () => {
    const cores = coresDaBarra(progressoDoDiagnostico({
      orientacaoGraus: 1, setoresComScore: 9, prescricoes: 1, relatorioGeradoEm: 'x',
    }))
    expect(new Set(cores)).toEqual(new Set(['#2E7D6B']))
  })
})
