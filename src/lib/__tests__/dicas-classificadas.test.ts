import { describe, expect, it } from 'vitest'
import { SETOR_DICAS, CRITERIO_DICAS } from '../constants'
import { CATALOGO_DICAS, classificacaoDaDica, totalDicasCuradas } from '../dicas-classificadas'
import { gerarRemedios } from '../remedios'

/** Todas as dicas de texto livre existentes hoje, das duas fontes. */
function todasAsDicas(): string[] {
  return [
    ...Object.values(SETOR_DICAS).flat(),
    ...Object.values(CRITERIO_DICAS).flat(),
  ]
}

describe('integridade do catálogo (guarda contra desligamento silencioso)', () => {
  it('TODA chave do catálogo existe no conteúdo de origem', () => {
    // Esta é a razão de existir deste arquivo. A chave do catálogo é o texto
    // exato da dica; se alguém editar a redação em constants.ts, a
    // classificação se desligaria em silêncio. Aqui isso vira erro de teste.
    const existentes = new Set(todasAsDicas())
    const orfas = Object.keys(CATALOGO_DICAS).filter(k => !existentes.has(k))
    expect(orfas, `Chaves do catálogo que não existem mais em SETOR_DICAS/CRITERIO_DICAS: ${JSON.stringify(orfas, null, 2)}`).toEqual([])
  })

  it('nenhuma entrada do catálogo é parcial — proveniência é tudo-ou-nada', () => {
    for (const [dica, c] of Object.entries(CATALOGO_DICAS)) {
      expect(c.custo, `custo ausente em: ${dica}`).toBeTruthy()
      expect(c.reversibilidade, `reversibilidade ausente em: ${dica}`).toBeTruthy()
      expect(c.forcaEvidencia, `forcaEvidencia ausente em: ${dica}`).toBeTruthy()
      expect(c.mecanismo, `mecanismo ausente em: ${dica}`).toBeTruthy()
    }
  })
})

describe('estado da curadoria', () => {
  it('o volume de dicas a curar é o esperado (94 = 70 por setor + 24 por critério)', () => {
    // Trava o número que a ADR 0015 e a planilha de curadoria afirmam. Se
    // alguém acrescentar ou remover dicas, este teste avisa que os documentos
    // ficaram desatualizados.
    expect(Object.values(SETOR_DICAS).flat()).toHaveLength(70)
    expect(Object.values(CRITERIO_DICAS).flat()).toHaveLength(24)
    expect(todasAsDicas()).toHaveLength(94)
  })

  it('dica não curada devolve null, sem inventar classificação', () => {
    expect(classificacaoDaDica('Mantenha o caminho até a porta livre')).toBeNull()
    expect(classificacaoDaDica('texto que não existe em lugar nenhum')).toBeNull()
  })

  it('totalDicasCuradas reflete o catálogo', () => {
    expect(totalDicasCuradas()).toBe(Object.keys(CATALOGO_DICAS).length)
  })
})

describe('gerarRemedios com dicas', () => {
  it('dicas NÃO curadas são ignoradas — não viram remédio sem proveniência', () => {
    const semDicas = gerarRemedios({ nomeSetor: 'Carreira', scorePct: 20 })
    const comDicas = gerarRemedios({
      nomeSetor: 'Carreira', scorePct: 20,
      dicas: Object.values(SETOR_DICAS).flat().slice(0, 10),
    })
    // Com o catálogo vazio, passar dicas não muda nada.
    expect(comDicas).toHaveLength(semDicas.length)
    expect(comDicas.some(r => r.id.startsWith('dica-'))).toBe(false)
  })

  it('passar lista de dicas vazia ou ausente é equivalente', () => {
    const a = gerarRemedios({ nomeSetor: 'Carreira', scorePct: 20 })
    const b = gerarRemedios({ nomeSetor: 'Carreira', scorePct: 20, dicas: [] })
    expect(a.map(r => r.id)).toEqual(b.map(r => r.id))
  })

  it('uma dica curada VIRA remédio com a proveniência declarada (simulando curadoria)', () => {
    // Injeta uma entrada temporária para provar que o caminho funciona de ponta
    // a ponta — sem afirmar nada sobre a classificação real desta dica.
    const dica = 'Mantenha o caminho até a porta livre'
    expect(Object.values(SETOR_DICAS).flat()).toContain(dica)
    CATALOGO_DICAS[dica] = {
      custo: 'zero', reversibilidade: 'instantanea',
      forcaEvidencia: 'consenso-classico', mecanismo: 'layout',
    }
    try {
      const r = gerarRemedios({ nomeSetor: 'Carreira', scorePct: 20, dicas: [dica] })
      const doDica = r.find(x => x.id.startsWith('dica-'))
      expect(doDica).toBeDefined()
      expect(doDica!.acao).toBe(dica)
      expect(doDica!.custo).toBe('zero')
      expect(doDica!.forcaEvidencia).toBe('consenso-classico')
      // Sendo custo zero + instantâneo, precisa estar no bloco da frente — junto
      // dos outros de custo zero, não depois de nenhum de custo baixo. Não afirmo
      // índice 0: o remédio elemental de "evitar" também é zero/instantâneo/clássico,
      // ou seja, um empate legítimo em que a ordem é a de inserção.
      const indiceDica = r.findIndex(x => x.id === doDica!.id)
      const primeiroCustoBaixo = r.findIndex(x => x.custo !== 'zero')
      expect(indiceDica).toBeLessThan(primeiroCustoBaixo)
      expect(r.slice(0, primeiroCustoBaixo).every(x => x.custo === 'zero')).toBe(true)
    } finally {
      delete CATALOGO_DICAS[dica]
    }
  })
})
