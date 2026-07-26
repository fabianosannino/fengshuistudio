import { describe, expect, it } from 'vitest'
import { SETOR_DICAS, CRITERIO_DICAS } from '../constants'
import {
  SUGESTOES_MECANICAS, CURADORIA_EVIDENCIA, DICAS_NAO_ACIONAVEIS,
  DICAS_SEM_FONTE_LOCALIZADA, FONTES_CURADORIA, citarFonte,
  classificacaoDaDica, dicasContestadas, dicasSemFonteQueForamCuradas,
  totalDicasCuradas, totalDicasAguardandoCuradoria,
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

describe('curadoria de evidência: proveniência obrigatória', () => {
  it('cobre 68 das 76 dicas acionáveis; as 8 restantes estão declaradas', () => {
    expect(totalDicasCuradas()).toBe(68)
    expect(DICAS_SEM_FONTE_LOCALIZADA).toHaveLength(8)
    expect(totalDicasAguardandoCuradoria()).toBe(8)
    // 68 + 8 = 76: nenhuma dica acionável fica fora das duas listas.
    expect(totalDicasCuradas() + DICAS_SEM_FONTE_LOCALIZADA.length)
      .toBe(Object.keys(SUGESTOES_MECANICAS).length)
  })

  it('as duas listas são disjuntas — nada é curado E declarado sem fonte', () => {
    expect(dicasSemFonteQueForamCuradas()).toEqual([])
  })

  it('TODA entrada tem fonte conhecida, localizador e citação não-trivial', () => {
    for (const [dica, e] of Object.entries(CURADORIA_EVIDENCIA)) {
      expect(FONTES_CURADORIA[e.fonte], `${dica}: fonte '${e.fonte}' inexistente`).toBeDefined()
      expect(e.local.length, `${dica}: sem localizador`).toBeGreaterThan(3)
      // Citação curta não sustenta classificação — é ênfase, não evidência.
      expect(e.citacao.length, `${dica}: citação curta demais`).toBeGreaterThan(25)
      expect(e.forca).toBeTruthy()
    }
  })

  it('nada contestado é vendido como consenso clássico', () => {
    // A regra existe porque "consenso" e "há fonte que contradiz" não podem
    // valer ao mesmo tempo — seria selo de autoridade sobre prática disputada.
    for (const [dica, e] of Object.entries(CURADORIA_EVIDENCIA)) {
      if (e.contestadaPor) expect(e.forca, dica).not.toBe('consenso-classico')
    }
  })

  it('a contestação aponta uma fonte DIFERENTE da que sustenta', () => {
    for (const [dica, e] of Object.entries(CURADORIA_EVIDENCIA)) {
      if (!e.contestadaPor) continue
      expect(FONTES_CURADORIA[e.contestadaPor.fonte], dica).toBeDefined()
      expect(e.contestadaPor.fonte, `${dica}: contestada pela própria fonte`).not.toBe(e.fonte)
    }
  })

  it('as três dicas contestadas achadas na pesquisa seguem sinalizadas', () => {
    expect(dicasContestadas().sort()).toEqual([
      'Adicione cristais negros como obsidiana',
      'Coloque espelho estrategicamente para ampliar o espaço',
      'Elimine distrações e eletrônicos desnecessários',
    ])
  })

  it('citarFonte devolve autor, título, ano e localizador', () => {
    const dica = 'Mantenha o caminho até a porta livre'
    expect(citarFonte(CURADORIA_EVIDENCIA[dica]))
      .toBe('Michael Erlewine, The Art of Feng Shui (2007), Entranceway: Pillar in Hallway, p. 273')
  })

  it('contraindicação não cita arquivo de código — ela é impressa para o cliente', () => {
    // Pego na conferência visual: uma contraindicação dizia "o app já calcula a
    // Estrela 5 em `estrela-anual.ts`", e essa frase aparecia no relatório do
    // cliente. Referência de implementação vai para a ADR, não para o PDF.
    for (const [dica, e] of Object.entries(CURADORIA_EVIDENCIA)) {
      if (!e.contraindicacao) continue
      expect(e.contraindicacao, `${dica}: contraindicação cita código`)
        .not.toMatch(/`|\.tsx?\b|src\/lib/)
    }
  })

  it('a nota de curadoria NÃO vaza para as contraindicações do relatório', () => {
    // A nota é metadado interno ("os 15 minutos são precisão do app", "roxo é
    // Fogo e não fecha com o ciclo"). O relatório vai para cliente pagante:
    // ressalva de uso, sim; discussão de curadoria, não.
    const dica = 'Abra janelas diariamente para renovar o ar pelo menos 15 minutos'
    const e = CURADORIA_EVIDENCIA[dica]
    expect(e.nota).toBeTruthy()
    const c = classificacaoDaDica(dica)!
    expect(c.nota).toBe(e.nota)
    expect(c.contraindicacoes).toEqual([])
  })

  it('dica não-acionável nunca tem classificação', () => {
    expect(classificacaoDaDica(DICAS_NAO_ACIONAVEIS[0])).toBeNull()
  })

  it('dica sem fonte localizada não vira classificação, mesmo tendo sugestão', () => {
    const dica = DICAS_SEM_FONTE_LOCALIZADA[0]
    expect(SUGESTOES_MECANICAS[dica]).toBeDefined()
    expect(classificacaoDaDica(dica)).toBeNull()
  })

  it('texto inexistente devolve null, sem estourar', () => {
    expect(classificacaoDaDica('texto que não existe em lugar nenhum')).toBeNull()
  })
})

describe('gerarRemedios com dicas', () => {
  it('dica sem fonte localizada é ignorada, mesmo tendo sugestão mecânica', () => {
    const semDicas = gerarRemedios({ nomeSetor: 'Carreira', scorePct: 20 })
    const comDicas = gerarRemedios({
      nomeSetor: 'Carreira', scorePct: 20,
      dicas: [...DICAS_SEM_FONTE_LOCALIZADA],
    })
    expect(comDicas).toHaveLength(semDicas.length)
    expect(comDicas.some(r => r.id.startsWith('dica-'))).toBe(false)
  })

  it('dica curada vira remédio com custo, evidência e fonte', () => {
    const dica = 'Mantenha o caminho até a porta livre'
    const c = classificacaoDaDica(dica)!
    expect(c.custo).toBe('zero')
    expect(c.reversibilidade).toBe('instantanea')
    expect(c.mecanismo).toBe('layout')
    expect(c.forcaEvidencia).toBe('consenso-classico')
    expect(c.fonte).toContain('Erlewine')

    const r = gerarRemedios({ nomeSetor: 'Carreira', scorePct: 20, dicas: [dica] })
    const doDica = r.find(x => x.id.startsWith('dica-'))
    expect(doDica).toBeDefined()
    expect(doDica!.acao).toBe(dica)
    expect(doDica!.custo).toBe('zero')
    // Custo zero deve estar no bloco da frente (empatado com outros zero).
    const primeiroNaoZero = r.findIndex(x => x.custo !== 'zero')
    expect(r.findIndex(x => x.id === doDica!.id)).toBeLessThan(primeiroNaoZero)
  })

  it('a contraindicação da pesquisa chega ao Remedio — não fica só no doc', () => {
    // Este é o ganho concreto da curadoria: Too documenta que plantas no quarto
    // de um casal geram briga, e o app não dizia isso a ninguém.
    const dica = 'Adicione plantas de madeira como bambu da sorte'
    const r = gerarRemedios({ nomeSetor: 'Familia', scorePct: 20, dicas: [dica] })
    const doDica = r.find(x => x.id.startsWith('dica-'))!
    expect(doDica.contraindicacoes.join(' ')).toContain('quarto de casal')
  })

  it('dica contestada carrega a contestação, com fonte, para o relatório', () => {
    const dica = 'Coloque espelho estrategicamente para ampliar o espaço'
    const r = gerarRemedios({ nomeSetor: 'Carreira', scorePct: 20, dicas: [dica] })
    const doDica = r.find(x => x.id.startsWith('dica-'))!
    const texto = doDica.contraindicacoes.join(' ')
    expect(doDica.forcaEvidencia).toBe('tradicao-popular')
    expect(texto).toContain('contestada')
    expect(texto).toContain('Erlewine')
  })
})
