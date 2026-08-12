import { describe, expect, it } from 'vitest'
import {
  SECOES, FORMATOS, secoesDoFormato, formatoCorrespondente, paginasEstimadas,
} from '../formato-do-relatorio'

describe('secoesDoFormato', () => {
  it('o dossiê liga tudo', () => {
    expect(Object.values(secoesDoFormato('dossie')).every(Boolean)).toBe(true)
  })

  it('o resumo deixa de fora o que exige vocabulário técnico', () => {
    // Não é que não importem: sem o vocabulário, viram autoridade decorativa.
    const resumo = secoesDoFormato('resumo')
    expect(resumo.divergencias).toBe(false)
    expect(resumo.evolucao).toBe(false)
    expect(resumo.checklist).toBe(false)
  })

  it('o resumo mantém o que o cliente age sobre', () => {
    const resumo = secoesDoFormato('resumo')
    expect(resumo.bagua).toBe(true)
    expect(resumo.curas).toBe(true)
    expect(resumo.plano_acao).toBe(true)
    expect(resumo.proximos_passos).toBe(true)
  })

  it('devolve cópia — mexer no resultado não altera o formato', () => {
    const a = secoesDoFormato('resumo')
    a.divergencias = true
    expect(FORMATOS.resumo.secoes.divergencias).toBe(false)
  })
})

describe('formatoCorrespondente', () => {
  it('reconhece cada formato pelas seções ligadas', () => {
    expect(formatoCorrespondente(secoesDoFormato('resumo'))).toBe('resumo')
    expect(formatoCorrespondente(secoesDoFormato('dossie'))).toBe('dossie')
  })

  it('uma seção a mais já não é o formato — o seletor não pode mentir', () => {
    // Com «Resumo» destacado e uma seção extra ligada, o consultor entregaria
    // um dossiê achando que mandou o resumo.
    const ajustado = { ...secoesDoFormato('resumo'), divergencias: true }
    expect(formatoCorrespondente(ajustado)).toBeNull()
  })

  it('seção ausente conta como desligada', () => {
    const semChaves = { capa: true, introducao: true, bagua: true, curas: true, plano_acao: true, fotos: true, proximos_passos: true, conclusao: true }
    expect(formatoCorrespondente(semChaves)).toBe('resumo')
  })
})

describe('paginasEstimadas', () => {
  it('o resumo cabe numa leitura de uma sentada', () => {
    // Sem número prometido em legenda: a tela mostra o que o estimador calcula,
    // e a legenda diz o que o formato é. Prometer «6 páginas» num texto fixo
    // divergiria do cálculo no primeiro ajuste de peso.
    const paginas = paginasEstimadas(secoesDoFormato('resumo'))
    expect(paginas).toBeGreaterThanOrEqual(5)
    expect(paginas).toBeLessThanOrEqual(10)
  })

  it('`completo` não soma — as seções que ele liga já contam uma a uma', () => {
    expect(paginasEstimadas({ completo: true })).toBe(1)
  })

  it('o dossiê é maior que o resumo', () => {
    expect(paginasEstimadas(secoesDoFormato('dossie')))
      .toBeGreaterThan(paginasEstimadas(secoesDoFormato('resumo')))
  })

  it('nada ligado ainda dá uma página — capa e dados do imóvel saem sempre', () => {
    expect(paginasEstimadas({})).toBe(1)
  })

  it('cobre todas as seções declaradas', () => {
    // Uma seção nova sem peso somaria zero e a estimativa mentiria em silêncio.
    const todasLigadas = Object.fromEntries(SECOES.map(s => [s, true]))
    expect(paginasEstimadas(todasLigadas)).toBe(paginasEstimadas(secoesDoFormato('dossie')))
  })
})
