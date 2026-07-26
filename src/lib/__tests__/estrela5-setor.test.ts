import { describe, expect, it } from 'vitest'
import {
  ESTRELA_WU_HUANG, palacioDaEstrela5, estrela5NoSetor, alertaEstrela5,
  calcularGradeAnual,
} from '../estrela-anual'
import { gerarRemedios } from '../remedios'

// 2026: a grade anual põe a Estrela 5 no Sul — e o Sul é o setor da Fama.
const ANO = 2026
const PALACIO_2026 = 'S'

describe('palacioDaEstrela5', () => {
  it('acha o palácio da 5 e ele bate com a grade anual', () => {
    expect(palacioDaEstrela5(ANO)).toBe(PALACIO_2026)
    expect(calcularGradeAnual(ANO)[PALACIO_2026]).toBe(ESTRELA_WU_HUANG)
  })

  it('a 5 existe em exatamente um palácio, em qualquer ano', () => {
    for (let ano = 2020; ano <= 2040; ano++) {
      const grade = calcularGradeAnual(ano)
      const quantos = Object.values(grade).filter(e => e === ESTRELA_WU_HUANG).length
      expect(quantos, String(ano)).toBe(1)
      expect(grade[palacioDaEstrela5(ano)], String(ano)).toBe(ESTRELA_WU_HUANG)
    }
  })

  it('a 5 percorre palácios diferentes ao longo dos anos', () => {
    const vistos = new Set(Array.from({ length: 9 }, (_, i) => palacioDaEstrela5(2024 + i)))
    expect(vistos.size).toBeGreaterThan(1)
  })
})

describe('estrela5NoSetor — só responde onde o método sustenta', () => {
  it('Bússola: Fama é o Sul, então em 2026 a 5 está lá', () => {
    expect(estrela5NoSetor('Fama', ANO, 'bussola')).toBe(true)
    expect(estrela5NoSetor('Fama/Reputação', ANO, 'bussola')).toBe(true)
  })

  it('Bússola: Carreira é o Norte, então em 2026 a 5 NÃO está lá', () => {
    expect(estrela5NoSetor('Carreira', ANO, 'bussola')).toBe(false)
  })

  it('BTB devolve null — não sabe, e null nunca significa "não está"', () => {
    // No BTB o setor não tem direção cardinal (ADR 0018). Responder false
    // seria afirmar ausência sem base; por isso null.
    expect(estrela5NoSetor('Fama', ANO, 'btb')).toBeNull()
  })

  it('escola desconhecida também devolve null (fail-closed)', () => {
    expect(estrela5NoSetor('Fama', ANO, '')).toBeNull()
    expect(estrela5NoSetor('Fama', ANO, 'outra')).toBeNull()
  })

  it('setor irreconhecível devolve null, sem estourar', () => {
    expect(estrela5NoSetor('Setor Inventado', ANO, 'bussola')).toBeNull()
  })
})

describe('alertaEstrela5 — texto para o relatório do cliente', () => {
  it('nomeia o ano e a direção quando se aplica', () => {
    const texto = alertaEstrela5('Fama', ANO, 'bussola')!
    expect(texto).toContain('2026')
    expect(texto).toContain('Sul')
    expect(texto).toContain('Wu Huang')
  })

  it('não cita arquivo de código — é impresso para o cliente', () => {
    const texto = alertaEstrela5('Fama', ANO, 'bussola')!
    expect(texto).not.toMatch(/`|\.tsx?\b|src\/lib/)
  })

  it('devolve null onde não se aplica', () => {
    expect(alertaEstrela5('Carreira', ANO, 'bussola')).toBeNull()
    expect(alertaEstrela5('Fama', ANO, 'btb')).toBeNull()
  })
})

describe('integração com gerarRemedios', () => {
  const base = { nomeSetor: 'Fama', scorePct: 30 }

  it('sem escola/ano, nada muda — o aviso genérico segue valendo', () => {
    const r = gerarRemedios(base)
    expect(r.every(x => !x.contraindicacoes.some(c => c.includes('Wu Huang')))).toBe(true)
  })

  it('na Bússola, os remédios de ATIVAÇÃO do setor recebem o alerta', () => {
    const r = gerarRemedios({ ...base, escola: 'bussola', anoSolar: ANO })
    const ativacoes = r.filter(x =>
      (x.mecanismo === 'elemento' || x.mecanismo === 'ativacao') && x.acaoWuXing !== 'controlar')
    expect(ativacoes.length).toBeGreaterThan(0)
    for (const x of ativacoes) {
      expect(x.contraindicacoes[0], x.id).toContain('Wu Huang')
    }
  })

  it('o alerta cobre o remédio elemental gerado, não só a dica curada', () => {
    // Consistência: estrategiaElemental produz "Ative com ... velas ..." na
    // Fama, que é exatamente o mesmo risco da dica "adicione velas".
    const r = gerarRemedios({
      ...base, escola: 'bussola', anoSolar: ANO,
      dicas: ['Adicione elementos de fogo: velas ou luz vermelha'],
    })
    const elemental = r.find(x => x.id.startsWith('elemento-fortalecer-'))!
    const daDica = r.find(x => x.id.startsWith('dica-'))!
    expect(elemental.contraindicacoes.join(' ')).toContain('Wu Huang')
    expect(daDica.contraindicacoes.join(' ')).toContain('Wu Huang')
  })

  it('remédio de RESTRIÇÃO não recebe o alerta — não há ativação a adiar', () => {
    // "Evite Água em excesso neste setor" tem mecanismo 'elemento', mas
    // acaoWuXing 'controlar'. Dizer "adie ativações de Fogo" ali é incoerente.
    const r = gerarRemedios({ ...base, escola: 'bussola', anoSolar: ANO })
    const restricao = r.find(x => x.acaoWuXing === 'controlar')!
    expect(restricao).toBeDefined()
    expect(restricao.contraindicacoes.join(' ')).not.toContain('Wu Huang')
  })

  it('remédios de layout/comportamento NÃO recebem o alerta', () => {
    // A regra do Wu Huang é não ATIVAR nem revolver o palácio; limpar e
    // desobstruir continuam recomendados ali.
    const r = gerarRemedios({
      ...base, escola: 'bussola', anoSolar: ANO, excessoPct: 30,
      dicas: ['Faça limpeza profunda e reorganize completamente este setor'],
    })
    const naoAtivacao = r.filter(x => x.mecanismo !== 'elemento' && x.mecanismo !== 'ativacao')
    expect(naoAtivacao.length).toBeGreaterThan(0)
    for (const x of naoAtivacao) {
      expect(x.contraindicacoes.join(' '), x.id).not.toContain('Wu Huang')
    }
  })

  it('no BTB nenhum remédio recebe o alerta específico', () => {
    const r = gerarRemedios({ ...base, escola: 'btb', anoSolar: ANO })
    expect(r.every(x => !x.contraindicacoes.some(c => c.includes('Wu Huang')))).toBe(true)
  })

  it('setor onde a 5 não está não recebe alerta, mesmo na Bússola', () => {
    const r = gerarRemedios({ nomeSetor: 'Carreira', scorePct: 30, escola: 'bussola', anoSolar: ANO })
    expect(r.every(x => !x.contraindicacoes.some(c => c.includes('Wu Huang')))).toBe(true)
  })
})
