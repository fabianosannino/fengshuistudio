import { describe, expect, it } from 'vitest'
import {
  resolverConflito, ordenarRemedios, PERFIS_METODOS,
  type AvaliacaoMetodo, type Remedio,
} from '../sintese-metodos'

function av(metodo: AvaliacaoMetodo['metodo'], veredicto: AvaliacaoMetodo['veredicto'], motivo = 'x'): AvaliacaoMetodo {
  return { metodo, veredicto, motivo }
}

describe('PERFIS_METODOS (hierarquia da ADR 0013)', () => {
  it('a precedência é uma ordenação total de 1 a 7, sem empates', () => {
    const precedencias = Object.values(PERFIS_METODOS).map(p => p.precedencia).sort((a, b) => a - b)
    expect(precedencias).toEqual([1, 2, 3, 4, 5, 6, 7])
  })

  it('Formas precede tudo e BTB é o último', () => {
    const ordenados = Object.entries(PERFIS_METODOS).sort((a, b) => a[1].precedencia - b[1].precedencia)
    expect(ordenados[0][0]).toBe('formas')
    expect(ordenados[ordenados.length - 1][0]).toBe('btb')
  })

  it('só o BaZi não pode criar recomendação, e só o BTB é isolado', () => {
    const semCriar = Object.entries(PERFIS_METODOS).filter(([, p]) => !p.podeCriarRecomendacao).map(([k]) => k)
    const isolados = Object.entries(PERFIS_METODOS).filter(([, p]) => p.isolado).map(([k]) => k)
    expect(semCriar).toEqual(['ba-zi'])
    expect(isolados).toEqual(['btb'])
  })
})

describe('resolverConflito', () => {
  it('sem avaliações não-neutras devolve neutro, sem conflito', () => {
    const r = resolverConflito([av('ba-zhai', 'neutro'), av('fei-xing', 'neutro')])
    expect(r.veredictoFinal).toBe('neutro')
    expect(r.metodoVencedor).toBeNull()
    expect(r.houveConflito).toBe(false)
  })

  it('lista vazia devolve neutro (fail-closed, não estoura)', () => {
    const r = resolverConflito([])
    expect(r.veredictoFinal).toBe('neutro')
    expect(r.divergencias).toEqual([])
  })

  it('REGRA CANÔNICA DO DOCUMENTO: Ba Zhai diz favorável, Fei Xing diz 5 Amarelo → Fei Xing vence e o setor fica perigoso', () => {
    const r = resolverConflito([
      av('ba-zhai', 'favoravel', 'Setor Sheng Qi para o morador'),
      av('fei-xing', 'perigoso', 'Estrela 5 Amarelo sobre a porta principal'),
    ])
    expect(r.veredictoFinal).toBe('perigoso')
    expect(r.metodoVencedor).toBe('fei-xing')
    expect(r.houveConflito).toBe(true)
    // A divergência do Ba Zhai NÃO é silenciada.
    expect(r.divergencias).toHaveLength(1)
    expect(r.divergencias[0].metodo).toBe('ba-zhai')
    expect(r.divergencias[0].veredicto).toBe('favoravel')
    expect(r.divergencias[0].motivo).toBe('Setor Sheng Qi para o morador')
    expect(r.divergencias[0].razaoDaPerda).toContain('precedência')
  })

  it('Formas precede até as Estrelas Voadoras (Sha Qi crítico invalida otimização de compasso)', () => {
    const r = resolverConflito([
      av('formas', 'perigoso', 'Via em T apontando para a fachada'),
      av('fei-xing', 'favoravel', 'Combinação 8-8 na fachada'),
    ])
    expect(r.metodoVencedor).toBe('formas')
    expect(r.veredictoFinal).toBe('perigoso')
    expect(r.divergencias.map(d => d.metodo)).toEqual(['fei-xing'])
  })

  it('consenso (todos do mesmo lado) não gera divergência, mesmo com gravidades diferentes', () => {
    const r = resolverConflito([
      av('fei-xing', 'perigoso', 'Estrela 5'),
      av('ba-zhai', 'desfavoravel', 'Setor Jue Ming'),
    ])
    expect(r.veredictoFinal).toBe('perigoso')
    expect(r.metodoVencedor).toBe('fei-xing')
    // 'desfavoravel' e 'perigoso' são o MESMO lado — discordam em grau, não em direção.
    expect(r.houveConflito).toBe(false)
    expect(r.divergencias).toEqual([])
  })

  it('BaZi nunca decide sozinho, mas seu veredicto discordante ainda é reportado', () => {
    const r = resolverConflito([
      av('ba-zi', 'favoravel', 'Favorece o pilar do morador'),
      av('fei-xing', 'perigoso', 'Estrela 5 Amarelo'),
    ])
    expect(r.metodoVencedor).toBe('fei-xing')
    expect(r.divergencias.map(d => d.metodo)).toEqual(['ba-zi'])
    expect(r.divergencias[0].razaoDaPerda).toContain('não origina recomendação')
  })

  it('BaZi sozinho não produz veredicto (não cria recomendação por conta própria)', () => {
    const r = resolverConflito([av('ba-zi', 'favoravel', 'Favorece o morador')])
    expect(r.veredictoFinal).toBe('neutro')
    expect(r.metodoVencedor).toBeNull()
    expect(r.divergencias).toHaveLength(1)
  })

  it('BTB misturado com método de bússola é descartado da decisão, com aviso explícito', () => {
    const r = resolverConflito([
      av('btb', 'favoravel', 'Setor da Prosperidade pelo mapa da porta'),
      av('fei-xing', 'perigoso', 'Estrela 5 Amarelo'),
    ])
    expect(r.metodoVencedor).toBe('fei-xing')
    expect(r.avisos).toHaveLength(1)
    expect(r.avisos[0]).toContain('BTB não pode ser combinado')
    expect(r.divergencias[0].razaoDaPerda).toContain('isolado')
  })

  it('BTB sozinho decide normalmente (análise BTB pura é válida)', () => {
    const r = resolverConflito([av('btb', 'desfavoravel', 'Banheiro no setor da Prosperidade')])
    expect(r.metodoVencedor).toBe('btb')
    expect(r.veredictoFinal).toBe('desfavoravel')
    expect(r.avisos).toEqual([])
    expect(r.houveConflito).toBe(false)
  })

  it('Liu Fa é camada de resgate: perde para Fei Xing quando discorda', () => {
    const r = resolverConflito([
      av('fei-xing', 'desfavoravel', 'Estrutura de carta ruim'),
      av('liu-fa', 'favoravel', 'Ling Shen neste setor'),
    ])
    expect(r.metodoVencedor).toBe('fei-xing')
    expect(r.divergencias.map(d => d.metodo)).toEqual(['liu-fa'])
  })

  it('empate de precedência é impossível por construção, mas o desempate por gravidade é fail-safe', () => {
    // Dois veredictos do MESMO método (ex.: estrela natal e estrela anual) — o mais grave prevalece.
    const r = resolverConflito([
      av('fei-xing', 'favoravel', 'Estrela natal 8'),
      av('fei-xing', 'perigoso', 'Estrela anual 5'),
    ])
    expect(r.veredictoFinal).toBe('perigoso')
    expect(r.motivoFinal).toBe('Estrela anual 5')
  })
})

describe('ordenarRemedios', () => {
  function rem(id: string, custo: Remedio['custo'], rev: Remedio['reversibilidade'], ev: Remedio['forcaEvidencia'] = 'consenso-classico'): Remedio {
    return {
      id, metodo: 'fei-xing', setor: 'N', problema: 'p', acao: 'a',
      mecanismo: 'layout', acaoWuXing: 'nenhuma', custo, reversibilidade: rev,
      forcaEvidencia: ev, contraindicacoes: [], exigeSelecaoDeData: false,
    }
  }

  it('custo zero e reversível vem primeiro (reposicionar cama antes de vender cristal)', () => {
    const ordenado = ordenarRemedios([
      rem('cristal', 'baixo', 'instantanea'),
      rem('reforma', 'estrutural', 'permanente'),
      rem('mover-cama', 'zero', 'instantanea'),
    ])
    expect(ordenado.map(r => r.id)).toEqual(['mover-cama', 'cristal', 'reforma'])
  })

  it('mesmo custo: o mais reversível primeiro', () => {
    const ordenado = ordenarRemedios([
      rem('pintar', 'baixo', 'dificil'),
      rem('almofada', 'baixo', 'instantanea'),
    ])
    expect(ordenado.map(r => r.id)).toEqual(['almofada', 'pintar'])
  })

  it('mesmo custo e reversibilidade: consenso clássico antes de tradição popular', () => {
    const ordenado = ordenarRemedios([
      rem('sapo-da-fortuna', 'zero', 'instantanea', 'tradicao-popular'),
      rem('mover-cama', 'zero', 'instantanea', 'consenso-classico'),
      rem('variante', 'zero', 'instantanea', 'variante-de-escola'),
    ])
    expect(ordenado.map(r => r.id)).toEqual(['mover-cama', 'variante', 'sapo-da-fortuna'])
  })

  it('não muta o array de entrada', () => {
    const entrada = [rem('b', 'alto', 'facil'), rem('a', 'zero', 'facil')]
    const copia = [...entrada]
    ordenarRemedios(entrada)
    expect(entrada).toEqual(copia)
  })
})
