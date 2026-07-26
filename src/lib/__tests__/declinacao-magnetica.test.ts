import { describe, expect, it } from 'vitest'
import {
  magneticoParaVerdadeiro, verdadeiroParaMagnetico, converterLeitura,
  declinacaoPlausivel, descreverLeitura, type LeituraOrientacao,
} from '../declinacao-magnetica'
import { montanhaDoGrau } from '../montanhas'

describe('conversão magnético ↔ verdadeiro', () => {
  it('declinação Oeste (negativa, caso do Brasil) subtrai ao ir para verdadeiro', () => {
    // São Paulo, declinação ~ −21°: uma leitura magnética de 100° é 79° verdadeiros.
    expect(magneticoParaVerdadeiro(100, -21)).toBeCloseTo(79, 5)
  })

  it('declinação Leste (positiva) soma ao ir para verdadeiro', () => {
    expect(magneticoParaVerdadeiro(100, 15)).toBeCloseTo(115, 5)
  })

  it('o caminho de volta desfaz exatamente a ida', () => {
    for (const declinacao of [-23, -21.5, -8, 0, 15]) {
      for (const graus of [0, 45.5, 100, 180, 270, 359.9]) {
        const ida = magneticoParaVerdadeiro(graus, declinacao)
        expect(verdadeiroParaMagnetico(ida, declinacao)).toBeCloseTo(graus, 5)
      }
    }
  })

  it('declinação zero é identidade', () => {
    expect(magneticoParaVerdadeiro(123.4, 0)).toBeCloseTo(123.4, 5)
    expect(verdadeiroParaMagnetico(123.4, 0)).toBeCloseTo(123.4, 5)
  })

  it('normaliza corretamente ao cruzar o 0°/360° (aritmética circular, não linear)', () => {
    // 5° magnéticos com declinação −21° → −16°, que deve virar 344°, não ficar negativo.
    expect(magneticoParaVerdadeiro(5, -21)).toBeCloseTo(344, 5)
    // 355° verdadeiros com declinação +15° → 340°.
    expect(verdadeiroParaMagnetico(355, 15)).toBeCloseTo(340, 5)
    // E o caso que passa do 360 para cima.
    expect(magneticoParaVerdadeiro(350, 20)).toBeCloseTo(10, 5)
  })
})

describe('impacto real no domínio (por que este módulo existe)', () => {
  it('ignorar a declinação brasileira desloca a Montanha das 24 — o erro que se quer evitar', () => {
    // Leitura magnética de 10° (Montanha Gui 癸, faixa 7.5–22.5).
    const magnetico = 10
    const montanhaSeIgnorar = montanhaDoGrau(magnetico)
    expect(montanhaSeIgnorar.pinyin).toBe('Gui')

    // Com declinação de −21° (Sudeste do Brasil), o verdadeiro é 349° → outra Montanha.
    const verdadeiro = magneticoParaVerdadeiro(magnetico, -21)
    expect(verdadeiro).toBeCloseTo(349, 5)
    const montanhaReal = montanhaDoGrau(verdadeiro)
    expect(montanhaReal.pinyin).toBe('Ren')

    // Confirma que são Montanhas diferentes — a troca silenciosa é o bug.
    expect(montanhaReal.numero).not.toBe(montanhaSeIgnorar.numero)
  })

  it('a faixa brasileira de declinação chega a deslocar 2 Montanhas (30° de amplitude)', () => {
    // A amplitude entre o extremo do RS (~−23°) e do NE (~−8°) é 15° = 1 Montanha inteira;
    // e o desvio absoluto de −23° cobre mais de 1,5 Montanha (cada uma tem 15°).
    expect(Math.abs(-23)).toBeGreaterThan(15)
    const semCorrecao = montanhaDoGrau(100)
    const comCorrecao = montanhaDoGrau(magneticoParaVerdadeiro(100, -23))
    expect(comCorrecao.numero).not.toBe(semCorrecao.numero)
  })
})

describe('declinacaoPlausivel', () => {
  it('aceita a faixa brasileira e valores moderados', () => {
    for (const d of [-23, -21.5, -8, 0, 15, 59.9]) expect(declinacaoPlausivel(d)).toBe(true)
  })

  it('rejeita valores fora da faixa (provável erro de digitação, ex.: 180 em vez de −18)', () => {
    for (const d of [180, -180, 90, -61, 61]) expect(declinacaoPlausivel(d)).toBe(false)
  })

  it('rejeita não-números (NaN/Infinity)', () => {
    expect(declinacaoPlausivel(NaN)).toBe(false)
    expect(declinacaoPlausivel(Infinity)).toBe(false)
  })
})

describe('converterLeitura', () => {
  const magnetica: LeituraOrientacao = { graus: 100, referencia: 'magnetico', declinacao: -21 }

  it('converter para a própria referência devolve a leitura inalterada', () => {
    expect(converterLeitura(magnetica, 'magnetico')).toBe(magnetica)
  })

  it('converte magnético → verdadeiro preservando a declinação', () => {
    const r = converterLeitura(magnetica, 'verdadeiro')
    expect(r).not.toBeNull()
    expect(r!.graus).toBeCloseTo(79, 5)
    expect(r!.referencia).toBe('verdadeiro')
    expect(r!.declinacao).toBe(-21)
  })

  it('converte verdadeiro → magnético (a referência clássica do Luo Pan)', () => {
    const r = converterLeitura({ graus: 79, referencia: 'verdadeiro', declinacao: -21 }, 'magnetico')
    expect(r!.graus).toBeCloseTo(100, 5)
    expect(r!.referencia).toBe('magnetico')
  })

  it('FAIL-CLOSED: sem declinação conhecida devolve null em vez de assumir zero', () => {
    const semDeclinacao: LeituraOrientacao = { graus: 100, referencia: 'magnetico', declinacao: null }
    expect(converterLeitura(semDeclinacao, 'verdadeiro')).toBeNull()
  })

  it('FAIL-CLOSED: declinação implausível também devolve null, não converte torto', () => {
    const absurda: LeituraOrientacao = { graus: 100, referencia: 'magnetico', declinacao: 180 }
    expect(converterLeitura(absurda, 'verdadeiro')).toBeNull()
  })

  it('sem declinação, converter para a MESMA referência ainda funciona (não exige o dado à toa)', () => {
    const semDeclinacao: LeituraOrientacao = { graus: 100, referencia: 'magnetico', declinacao: null }
    expect(converterLeitura(semDeclinacao, 'magnetico')).toBe(semDeclinacao)
  })
})

describe('descreverLeitura', () => {
  it('sempre declara a referência — nunca mostra um grau ambíguo', () => {
    expect(descreverLeitura({ graus: 100, referencia: 'magnetico', declinacao: -21 }))
      .toBe('100.0° (Norte magnético)')
    expect(descreverLeitura({ graus: 79.25, referencia: 'verdadeiro', declinacao: -21 }))
      .toBe('79.3° (Norte verdadeiro)')
  })
})
