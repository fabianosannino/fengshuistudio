import { describe, it, expect } from 'vitest'
import {
  STATUS_LIBERAM_VAGA,
  STATUS_OCUPAM_VAGA,
  limiteClientes,
  limiteImoveis,
  mensagemLimiteClientes,
  mensagemLimiteImoveis,
  planoEfetivo,
  planoLabel,
  podeCalendario,
  podeClientes,
  podeHistorico,
  podeMultiplasAnalises,
  podePDF,
  podeParceiros,
  resumoDoPlano,
} from '../plano-utils'

// ─── planoEfetivo ────────────────────────────────────────────────────────────

describe('planoEfetivo', () => {
  it('normalizes "pro" to "profissional"', () => {
    expect(planoEfetivo('pro')).toBe('profissional')
  })

  it('normalizes "profissional" to "profissional"', () => {
    expect(planoEfetivo('profissional')).toBe('profissional')
  })

  it('normalizes "freemium" to "free"', () => {
    expect(planoEfetivo('freemium')).toBe('free')
  })

  it('returns "free" for null', () => {
    expect(planoEfetivo(null)).toBe('free')
  })

  it('returns "free" for undefined', () => {
    expect(planoEfetivo(undefined)).toBe('free')
  })

  it('returns "free" for empty string', () => {
    expect(planoEfetivo('')).toBe('free')
  })

  it('keeps "simples" as "simples"', () => {
    expect(planoEfetivo('simples')).toBe('simples')
  })

  it('is case-insensitive', () => {
    expect(planoEfetivo('PRO')).toBe('profissional')
    expect(planoEfetivo('Simples')).toBe('simples')
    expect(planoEfetivo('FREEMIUM')).toBe('free')
  })

  it('trims whitespace', () => {
    expect(planoEfetivo('  pro  ')).toBe('profissional')
    expect(planoEfetivo(' simples ')).toBe('simples')
  })

  it('returns "free" for unknown plan names', () => {
    expect(planoEfetivo('enterprise')).toBe('free')
    expect(planoEfetivo('premium')).toBe('free')
  })
})

// ─── planoLabel ──────────────────────────────────────────────────────────────

describe('planoLabel', () => {
  it('returns "Profissional" for profissional plan', () => {
    expect(planoLabel('pro')).toBe('Profissional')
    expect(planoLabel('profissional')).toBe('Profissional')
  })

  it('returns "Simples" for simples plan', () => {
    expect(planoLabel('simples')).toBe('Simples')
  })

  it('returns "Free" for free/null/undefined plans', () => {
    expect(planoLabel('free')).toBe('Free')
    expect(planoLabel('freemium')).toBe('Free')
    expect(planoLabel(null)).toBe('Free')
    expect(planoLabel(undefined)).toBe('Free')
  })
})

// ─── limiteImoveis ───────────────────────────────────────────────────────────

describe('limiteImoveis', () => {
  it('returns 3 for free plan', () => {
    expect(limiteImoveis('free')).toBe(3)
  })

  it('o plano pago não pode ser mais restrito que o gratuito', () => {
    // O Simples permitia 1 imóvel contra os 3 do Free — um plano pago que
    // entrega menos que o grátis. Decisão de 12/08: 10 ativos, mantendo o
    // «ilimitado» como diferencial real do Profissional.
    expect(limiteImoveis('simples')).toBe(10)
    expect(limiteImoveis('simples')!).toBeGreaterThan(limiteImoveis('free')!)
  })

  it('returns null (unlimited) for profissional plan', () => {
    expect(limiteImoveis('profissional')).toBeNull()
  })
})

// ─── podeClientes ────────────────────────────────────────────────────────────

describe('podeClientes', () => {
  it('Free é para a própria casa; os pagos atendem cliente', () => {
    // Havia três respostas para a mesma pergunta: `podeClientes` dizia não a
    // tudo fora do Profissional, `/api/clientes` permitia 5 ao Free, e a tela
    // dizia «disponível no plano Profissional». Vence o que foi vendido na
    // página de preços — cliente é recurso de plano pago.
    expect(podeClientes('profissional')).toBe(true)
    expect(podeClientes('simples')).toBe(true)
    expect(podeClientes('free')).toBe(false)
  })
})

// ─── podeCalendario ──────────────────────────────────────────────────────────

describe('podeCalendario', () => {
  it('returns false for free plan', () => {
    expect(podeCalendario('free')).toBe(false)
  })

  it('returns true for simples and profissional', () => {
    expect(podeCalendario('simples')).toBe(true)
    expect(podeCalendario('profissional')).toBe(true)
  })
})

// ─── podePDF ─────────────────────────────────────────────────────────────────

describe('podePDF', () => {
  it('o Free gera PDF com marca d\'água, como a página de preços promete', () => {
    // O contrato dizia «Relatório com marca d'água» e o código devolvia
    // 'bloqueado'. Entre mudar o texto e cumprir o prometido, cumpre-se o
    // prometido: o mecanismo de marca d'água já existe no relatório.
    expect(podePDF('free')).toBe('marca_dagua')
  })

  it('returns "marca_dagua" for simples plan', () => {
    expect(podePDF('simples')).toBe('marca_dagua')
  })

  it('returns "limpo" for profissional plan', () => {
    expect(podePDF('profissional')).toBe('limpo')
  })
})

// ─── podeParceiros ───────────────────────────────────────────────────────────

describe('podeParceiros', () => {
  it('returns "bloqueado" for free plan', () => {
    expect(podeParceiros('free')).toBe('bloqueado')
  })

  it('returns "visualizar" for simples plan', () => {
    expect(podeParceiros('simples')).toBe('visualizar')
  })

  it('returns "completo" for profissional plan', () => {
    expect(podeParceiros('profissional')).toBe('completo')
  })
})

// ─── podeMultiplasAnalises ───────────────────────────────────────────────────

describe('podeMultiplasAnalises', () => {
  it('returns true only for profissional', () => {
    expect(podeMultiplasAnalises('profissional')).toBe(true)
    expect(podeMultiplasAnalises('simples')).toBe(false)
    expect(podeMultiplasAnalises('free')).toBe(false)
  })
})

// ─── podeHistorico ───────────────────────────────────────────────────────────

describe('podeHistorico', () => {
  it('returns true only for profissional', () => {
    expect(podeHistorico('profissional')).toBe(true)
    expect(podeHistorico('simples')).toBe(false)
    expect(podeHistorico('free')).toBe(false)
  })
})

// ─── Coerência entre planos — o que a auditoria de design encontrou ──────────

describe('coerência da escada de planos', () => {
  it('nenhum plano pago entrega menos que o gratuito', () => {
    // Era o caso: Simples (pago) permitia 1 imóvel contra os 3 do Free.
    for (const pago of ['simples', 'profissional'] as const) {
      const limitePago = limiteImoveis(pago)
      if (limitePago !== null) {
        expect(limitePago, pago).toBeGreaterThanOrEqual(limiteImoveis('free')!)
      }
    }
  })

  it('toda mensagem de limite diz o que fazer, não só o que falhou', () => {
    // Uma mensagem que só anuncia o bloqueio manda o usuário adivinhar a saída.
    for (const plano of ['free', 'simples'] as const) {
      const msg = mensagemLimiteImoveis(plano)
      expect(msg, plano).toBeTruthy()
      expect(msg!, plano).toMatch(/Arquive|mude de plano/)
    }
  })

  it('plano sem limite não produz mensagem de limite', () => {
    expect(mensagemLimiteImoveis('profissional')).toBeNull()
    expect(mensagemLimiteClientes('profissional')).toBeNull()
  })

  it('o resumo do plano nunca promete o que a regra não entrega', () => {
    // A página de preços é gerada daqui, então uma divergência aqui vira
    // promessa falsa na tabela de preços.
    for (const plano of ['free', 'simples', 'profissional'] as const) {
      const resumo = resumoDoPlano(plano).join(' | ')
      if (podePDF(plano) === 'bloqueado') expect(resumo, plano).not.toContain('PDF')
      if (!podeCalendario(plano)) expect(resumo, plano).not.toContain('Calendário')
      if (limiteClientes(plano) === 0) expect(resumo, plano).not.toContain('Clientes ilimitados')
    }
  })

  it('arquivada e deletada não ocupam vaga, e o valor do enum está certo', () => {
    // A rota filtrava `status != 'arquivado'`, no masculino; o enum é
    // 'arquivada'. O filtro nunca casava, então arquivar não liberava vaga —
    // e a mensagem mandava o usuário arquivar.
    expect(STATUS_LIBERAM_VAGA).toContain('arquivada')
    expect(STATUS_LIBERAM_VAGA).toContain('deletada')
    expect(STATUS_LIBERAM_VAGA).not.toContain('arquivado')
    for (const s of STATUS_OCUPAM_VAGA) {
      expect(STATUS_LIBERAM_VAGA as readonly string[], s).not.toContain(s)
    }
  })
})
