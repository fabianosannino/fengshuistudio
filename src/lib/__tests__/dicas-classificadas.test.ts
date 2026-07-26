import { describe, expect, it } from 'vitest'
import { SETOR_DICAS, CRITERIO_DICAS } from '../constants'
import {
  SUGESTOES_MECANICAS, CURADORIA_EVIDENCIA, DICAS_NAO_ACIONAVEIS,
  classificacaoDaDica, totalDicasCuradas, totalDicasAguardandoCuradoria,
} from '../dicas-classificadas'
import { gerarRemedios } from '../remedios'

function todasAsDicas(): string[] {
  return [...Object.values(SETOR_DICAS).flat(), ...Object.values(CRITERIO_DICAS).flat()]
}
function dicasUnicas(): string[] {
  return [...new Set(todasAsDicas())]
}

describe('integridade (guarda contra desligamento silencioso)', () => {
  it('TODA chave das sugestões existe no conteúdo de origem', () => {
    // A chave é o texto exato da dica; se alguém editar a redação em
    // constants.ts, a classificação se desligaria em silêncio. Aqui vira erro.
    const existentes = new Set(todasAsDicas())
    const orfas = Object.keys(SUGESTOES_MECANICAS).filter(k => !existentes.has(k))
    expect(orfas, `Sugestões cujo texto não existe mais na origem:\n${orfas.join('\n')}`).toEqual([])
  })

  it('TODA chave da curadoria de evidência existe no conteúdo de origem', () => {
    const existentes = new Set(todasAsDicas())
    const orfas = Object.keys(CURADORIA_EVIDENCIA).filter(k => !existentes.has(k))
    expect(orfas, `Curadorias cujo texto não existe mais na origem:\n${orfas.join('\n')}`).toEqual([])
  })

  it('toda dica marcada como não-acionável existe na origem', () => {
    const existentes = new Set(todasAsDicas())
    for (const d of DICAS_NAO_ACIONAVEIS) expect(existentes.has(d), d).toBe(true)
  })
})

describe('cobertura das sugestões mecânicas', () => {
  it('cobre TODAS as dicas únicas, exceto as declaradas não-acionáveis', () => {
    // Se alguém acrescentar uma dica em constants.ts, este teste falha e avisa
    // que falta classificar — em vez de a dica ficar invisível para o motor.
    const naoAcionaveis = new Set(DICAS_NAO_ACIONAVEIS)
    const esperadas = dicasUnicas().filter(d => !naoAcionaveis.has(d))
    const faltando = esperadas.filter(d => !SUGESTOES_MECANICAS[d])
    expect(faltando, `Dicas sem sugestão mecânica:\n${faltando.join('\n')}`).toEqual([])
  })

  it('nenhuma sugestão inclui força de evidência (é a metade humana)', () => {
    for (const [dica, s] of Object.entries(SUGESTOES_MECANICAS)) {
      expect(s, dica).not.toHaveProperty('forcaEvidencia')
      expect(s.custo, dica).toBeTruthy()
      expect(s.reversibilidade, dica).toBeTruthy()
      expect(s.mecanismo, dica).toBeTruthy()
    }
  })

  it('o volume é o esperado: 94 dicas, 77 únicas, 1 não-acionável, 76 com sugestão', () => {
    // Trava os números que a ADR 0015 e a planilha de curadoria afirmam.
    expect(todasAsDicas()).toHaveLength(94)
    expect(dicasUnicas()).toHaveLength(77)
    expect(DICAS_NAO_ACIONAVEIS).toHaveLength(1)
    expect(Object.keys(SUGESTOES_MECANICAS)).toHaveLength(76)
  })
})

describe('estado da curadoria', () => {
  it('a curadoria de evidência nasce vazia — o software não a preenche', () => {
    expect(Object.keys(CURADORIA_EVIDENCIA)).toEqual([])
    expect(totalDicasCuradas()).toBe(0)
    expect(totalDicasAguardandoCuradoria()).toBe(76)
  })

  it('dica COM sugestão mas SEM evidência ainda devolve null', () => {
    const dica = 'Mantenha o caminho até a porta livre'
    expect(SUGESTOES_MECANICAS[dica]).toBeDefined()
    expect(classificacaoDaDica(dica)).toBeNull()
  })

  it('dica não-acionável nunca tem classificação', () => {
    expect(classificacaoDaDica(DICAS_NAO_ACIONAVEIS[0])).toBeNull()
  })

  it('texto inexistente devolve null, sem estourar', () => {
    expect(classificacaoDaDica('texto que não existe em lugar nenhum')).toBeNull()
  })
})

describe('gerarRemedios com dicas', () => {
  it('dicas sem curadoria de evidência são ignoradas, mesmo tendo sugestão', () => {
    const semDicas = gerarRemedios({ nomeSetor: 'Carreira', scorePct: 20 })
    const comDicas = gerarRemedios({
      nomeSetor: 'Carreira', scorePct: 20,
      dicas: Object.keys(SUGESTOES_MECANICAS).slice(0, 10),
    })
    expect(comDicas).toHaveLength(semDicas.length)
    expect(comDicas.some(r => r.id.startsWith('dica-'))).toBe(false)
  })

  it('curar UMA dica basta para ela virar remédio, com a sugestão aplicada', () => {
    // Injeta a curadoria temporariamente — prova o caminho de ponta a ponta
    // sem afirmar nada sobre a classificação real desta dica.
    const dica = 'Mantenha o caminho até a porta livre'
    CURADORIA_EVIDENCIA[dica] = 'consenso-classico'
    try {
      const c = classificacaoDaDica(dica)
      expect(c).toEqual({
        custo: 'zero', reversibilidade: 'instantanea',
        mecanismo: 'layout', forcaEvidencia: 'consenso-classico',
      })
      const r = gerarRemedios({ nomeSetor: 'Carreira', scorePct: 20, dicas: [dica] })
      const doDica = r.find(x => x.id.startsWith('dica-'))
      expect(doDica).toBeDefined()
      expect(doDica!.acao).toBe(dica)
      expect(doDica!.custo).toBe('zero')
      // Custo zero deve estar no bloco da frente (empatado com outros zero).
      const primeiroNaoZero = r.findIndex(x => x.custo !== 'zero')
      expect(r.findIndex(x => x.id === doDica!.id)).toBeLessThan(primeiroNaoZero)
    } finally {
      delete CURADORIA_EVIDENCIA[dica]
    }
  })
})
