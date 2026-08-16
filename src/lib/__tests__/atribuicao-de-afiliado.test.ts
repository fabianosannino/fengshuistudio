import { describe, expect, it } from 'vitest'
import {
  JANELA_DE_ATRIBUICAO_DIAS, COOKIE_DO_VISITANTE_DIAS,
  ehCodigoDeAfiliadoValido, novaIdentidadeDeVisitante, hashDoVisitante,
  expiraEm, indicacaoQueAtribui, atribuicaoValida,
  type IndicacaoRegistrada,
} from '../atribuicao-de-afiliado'

/**
 * A regra é «último clique, janela de 30 dias», e o que se testa aqui é a
 * parte que decide dinheiro: **de quem** é a venda.
 *
 * Errar para mais paga duas vezes a mesma comissão; errar para menos toma de
 * alguém o que foi prometido. Nenhum dos dois aparece sozinho — quem divulga
 * não tem como conferir, e é por isso que a regra precisa estar num lugar só,
 * testada, em vez de espalhada em consultas.
 */

const AGORA = new Date('2026-08-16T12:00:00Z')

function emDias(dias: number): string {
  return new Date(AGORA.getTime() + dias * 24 * 60 * 60 * 1000).toISOString()
}

function indicacao(over: Partial<IndicacaoRegistrada> = {}): IndicacaoRegistrada {
  return {
    id: 'ind-1',
    afiliado_perfil_id: 'afiliado-1',
    criada_em: emDias(-1),
    expira_em: emDias(29),
    ...over,
  }
}

describe('forma do código', () => {
  it('aceita o que cabe num impresso e se dita ao telefone', () => {
    expect(ehCodigoDeAfiliadoValido('maria')).toBe(true)
    expect(ehCodigoDeAfiliadoValido('feng-shui-2026')).toBe(true)
    expect(ehCodigoDeAfiliadoValido('AB12')).toBe(true)
  })

  it('recusa o que quebraria a URL ou a leitura em voz alta', () => {
    expect(ehCodigoDeAfiliadoValido('ab')).toBe(false)             // curto demais
    expect(ehCodigoDeAfiliadoValido('a'.repeat(33))).toBe(false)   // longo demais
    expect(ehCodigoDeAfiliadoValido('maria silva')).toBe(false)    // espaço
    expect(ehCodigoDeAfiliadoValido('maria/../admin')).toBe(false) // caminho
    expect(ehCodigoDeAfiliadoValido('')).toBe(false)
    expect(ehCodigoDeAfiliadoValido(null)).toBe(false)
    expect(ehCodigoDeAfiliadoValido(undefined)).toBe(false)
  })
})

describe('identidade do visitante', () => {
  it('é aleatória — duas visitas nunca colidem', () => {
    const a = novaIdentidadeDeVisitante()
    const b = novaIdentidadeDeVisitante()
    expect(a).not.toBe(b)
    expect(a).toHaveLength(48)
  })

  it('o banco guarda o hash, nunca o valor do cookie', () => {
    // Guardar o valor cru deixaria quem lesse a tabela forjar o cookie e
    // reivindicar a atribuição de outro afiliado.
    const identidade = novaIdentidadeDeVisitante()
    const hash = hashDoVisitante(identidade)
    expect(hash).not.toBe(identidade)
    expect(hash).toHaveLength(64)
    expect(hashDoVisitante(identidade)).toBe(hash)
  })
})

describe('a janela', () => {
  it('são 30 dias a partir do clique', () => {
    expect(expiraEm(AGORA).toISOString()).toBe(emDias(JANELA_DE_ATRIBUICAO_DIAS))
  })

  it('o cookie dura mais que a janela', () => {
    // Expirando junto, um clique feito no último minuto perderia o portador
    // antes de a indicação vencer — atribuição morta por contagem de segundos.
    expect(COOKIE_DO_VISITANTE_DIAS).toBeGreaterThan(JANELA_DE_ATRIBUICAO_DIAS)
  })
})

describe('indicacaoQueAtribui — último clique', () => {
  it('sem clique nenhum, não há atribuição', () => {
    // Ausência ≠ zero: pedido sem indicação não é pedido com afiliado de
    // valor nenhum, é pedido que não veio de afiliado.
    expect(indicacaoQueAtribui([], AGORA)).toBeNull()
  })

  it('entre duas vivas, ganha a mais recente', () => {
    const antiga = indicacao({ id: 'antiga', criada_em: emDias(-10) })
    const nova = indicacao({ id: 'nova', criada_em: emDias(-1), afiliado_perfil_id: 'afiliado-2' })

    expect(indicacaoQueAtribui([antiga, nova], AGORA)?.id).toBe('nova')
    // A ordem da lista não decide — quem decide é a data.
    expect(indicacaoQueAtribui([nova, antiga], AGORA)?.id).toBe('nova')
  })

  it('a mais recente vencida não rouba da mais antiga viva', () => {
    // O caso que um `[0]` depois de ordenar por data erraria: a última é a
    // vencida, e quem leva é a anterior, que ainda vale.
    const viva = indicacao({ id: 'viva', criada_em: emDias(-20), expira_em: emDias(10) })
    const vencida = indicacao({ id: 'vencida', criada_em: emDias(-2), expira_em: emDias(-1) })

    expect(indicacaoQueAtribui([viva, vencida], AGORA)?.id).toBe('viva')
  })

  it('todas vencidas, não há atribuição', () => {
    const vencida = indicacao({ expira_em: emDias(-1) })
    expect(indicacaoQueAtribui([vencida], AGORA)).toBeNull()
  })

  it('a validade é do instante da compra, não do de agora', () => {
    // A data gravada é uma promessa feita no momento da divulgação. Comprar
    // dentro dela vale; comprar depois, não — e o mesmo dado responde as duas
    // perguntas conforme quando se pergunta.
    const ind = indicacao({ expira_em: emDias(5) })
    const dentro = new Date(AGORA.getTime() + 4 * 24 * 60 * 60 * 1000)
    const fora = new Date(AGORA.getTime() + 6 * 24 * 60 * 60 * 1000)

    expect(indicacaoQueAtribui([ind], dentro)).not.toBeNull()
    expect(indicacaoQueAtribui([ind], fora)).toBeNull()
  })

  it('expirando exatamente agora já não vale', () => {
    // A fronteira precisa de lado escolhido. «Até» significa antes de, e a
    // alternativa é discutir milissegundos com quem esperava a comissão.
    const ind = indicacao({ expira_em: AGORA.toISOString() })
    expect(indicacaoQueAtribui([ind], AGORA)).toBeNull()
  })
})

describe('atribuicaoValida — ninguém indica a si mesmo', () => {
  it('afiliado comprando pelo próprio link não gera atribuição', () => {
    // Não é fraude sofisticada: é o primeiro pensamento de qualquer pessoa que
    // receba um código. Uma regra que depende de ninguém ter esse pensamento
    // não é regra.
    const ind = indicacao({ afiliado_perfil_id: 'perfil-x' })
    expect(atribuicaoValida(ind, 'perfil-x')).toBe(false)
  })

  it('outra pessoa pelo link do afiliado gera atribuição', () => {
    const ind = indicacao({ afiliado_perfil_id: 'perfil-x' })
    expect(atribuicaoValida(ind, 'perfil-y')).toBe(true)
  })

  it('comprador sem conta passa — é o caso normal da loja', () => {
    // O comprador da loja não tem cadastro. Sem perfil não há o que comparar,
    // e recusar por precaução tiraria a comissão de toda venda de verdade.
    expect(atribuicaoValida(indicacao(), null)).toBe(true)
    expect(atribuicaoValida(indicacao(), undefined)).toBe(true)
  })

  it('sem indicação, não há atribuição a validar', () => {
    expect(atribuicaoValida(null, 'perfil-x')).toBe(false)
    expect(atribuicaoValida(null, null)).toBe(false)
  })
})
