import { describe, expect, it } from 'vitest'
import {
  montarPendencias, DIAS_ATE_COBRAR_RELATORIO, DIAS_ATE_CONSULTA_PARADA,
  type EntradasDePendencias,
} from '../pendencias'

const AGORA = new Date('2026-08-12T10:00:00-03:00')

/** 'yyyy-mm-dd' de N dias atrás, no mesmo fuso de AGORA. */
function diasAtras(n: number): string {
  const d = new Date(AGORA)
  d.setDate(d.getDate() - n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function isoDiasAtras(n: number): string {
  return new Date(AGORA.getTime() - n * 86_400_000).toISOString()
}

const VAZIO: EntradasDePendencias = { consultas: [], pagamentos: [], rituais: [] }

/** Consulta sem nenhuma pendência: tudo preenchido e tocada hoje. */
const CONSULTA_OK = {
  id: 'c1',
  nome_imovel: 'Apto Vila Madalena',
  status: 'em_andamento',
  atualizado_em: isoDiasAtras(0),
  ano_construcao: 1998,
  bagua_entrada: { orientacao_graus: 42.5 },
  clientes: { nome_completo: 'Carlos Tavares' },
}

describe('parcela vencida', () => {
  it('vencido é derivado da data, não lido do status', () => {
    // O status gravado e a data discordam porque nada roda um job diário para
    // virar 'pendente' em 'atrasado'. Quem sabe é a data.
    const r = montarPendencias({
      ...VAZIO,
      pagamentos: [{ id: 'p1', descricao: 'Parcela 2/3', valor: 950, status: 'pendente', data_vencimento: diasAtras(1) }],
    }, AGORA)
    expect(r).toHaveLength(1)
    expect(r[0].tipo).toBe('parcela_vencida')
    expect(r[0].detalhe).toContain('ontem')
  })

  it('parcela paga nunca vira pendência, mesmo vencida', () => {
    const r = montarPendencias({
      ...VAZIO,
      pagamentos: [{ id: 'p1', valor: 950, status: 'pago', data_vencimento: diasAtras(30) }],
    }, AGORA)
    expect(r).toHaveLength(0)
  })

  it('parcela que vence hoje ainda não está vencida', () => {
    const r = montarPendencias({
      ...VAZIO,
      pagamentos: [{ id: 'p1', valor: 100, status: 'pendente', data_vencimento: diasAtras(0) }],
    }, AGORA)
    expect(r).toHaveLength(0)
  })
})

describe('relatório não emitido', () => {
  it('cobra só depois da carência', () => {
    // Emitir o PDF no mesmo dia em que se fecha o diagnóstico é o fluxo normal.
    const base = { id: 'c9', nome_imovel: 'Casa Granja Viana', status: 'finalizada', ano_construcao: 2000, bagua_entrada: { orientacao_graus: 10 } }

    const recem = montarPendencias({ ...VAZIO, consultas: [{ ...base, finalizada_em: isoDiasAtras(DIAS_ATE_COBRAR_RELATORIO - 1), atualizado_em: isoDiasAtras(0) }] }, AGORA)
    expect(recem.filter(p => p.tipo === 'relatorio_nao_emitido')).toHaveLength(0)

    const atrasado = montarPendencias({ ...VAZIO, consultas: [{ ...base, finalizada_em: isoDiasAtras(3), atualizado_em: isoDiasAtras(0) }] }, AGORA)
    expect(atrasado.filter(p => p.tipo === 'relatorio_nao_emitido')).toHaveLength(1)
  })

  it('com o PDF emitido não cobra nada', () => {
    const r = montarPendencias({
      ...VAZIO,
      consultas: [{
        id: 'c9', nome_imovel: 'X', status: 'finalizada', ano_construcao: 2000,
        bagua_entrada: { orientacao_graus: 10 },
        finalizada_em: isoDiasAtras(30), relatorio_gerado_em: isoDiasAtras(29),
        atualizado_em: isoDiasAtras(29),
      }],
    }, AGORA)
    expect(r.filter(p => p.tipo === 'relatorio_nao_emitido')).toHaveLength(0)
  })
})

describe('lacunas do método', () => {
  it('sem fachada, diz a consequência, não repete o título', () => {
    const r = montarPendencias({
      ...VAZIO,
      consultas: [{ ...CONSULTA_OK, bagua_entrada: null }],
    }, AGORA)
    const sem = r.find(p => p.tipo === 'sem_fachada')
    expect(sem?.detalhe).toContain('Kua da Casa')
  })

  it('o campo legado `data_construcao` conta como ano informado', () => {
    // Consultas anteriores à migration têm o dado lá. Cobrar seria pedir o que
    // já existe.
    const r = montarPendencias({
      ...VAZIO,
      consultas: [{
        ...CONSULTA_OK, ano_construcao: null,
        bagua_entrada: { orientacao_graus: 42.5, data_construcao: '2004-06-15' },
      }],
    }, AGORA)
    expect(r.filter(p => p.tipo === 'sem_ano_construcao')).toHaveLength(0)
  })

  it('reforma sozinha basta', () => {
    const r = montarPendencias({
      ...VAZIO,
      consultas: [{ ...CONSULTA_OK, ano_construcao: null, ano_reforma_estrutural: 2015 }],
    }, AGORA)
    expect(r.filter(p => p.tipo === 'sem_ano_construcao')).toHaveLength(0)
  })

  it('consulta arquivada não cobra lacuna nenhuma', () => {
    const r = montarPendencias({
      ...VAZIO,
      consultas: [{ id: 'c2', nome_imovel: 'Antiga', status: 'arquivada', atualizado_em: isoDiasAtras(400) }],
    }, AGORA)
    expect(r).toHaveLength(0)
  })
})

describe('consulta parada', () => {
  it('só a partir do limite', () => {
    const quase = montarPendencias({ ...VAZIO, consultas: [{ ...CONSULTA_OK, atualizado_em: isoDiasAtras(DIAS_ATE_CONSULTA_PARADA - 1) }] }, AGORA)
    expect(quase.filter(p => p.tipo === 'consulta_parada')).toHaveLength(0)

    const parada = montarPendencias({ ...VAZIO, consultas: [{ ...CONSULTA_OK, atualizado_em: isoDiasAtras(DIAS_ATE_CONSULTA_PARADA) }] }, AGORA)
    expect(parada.filter(p => p.tipo === 'consulta_parada')).toHaveLength(1)
  })
})

describe('ritual', () => {
  it('só o de hoje entra — o de amanhã é agenda', () => {
    const r = montarPendencias({
      ...VAZIO,
      rituais: [
        { id: 'r1', titulo: 'Limpeza da sala', data_ritual: diasAtras(0), horario: '18:30:00', status: 'pendente', clientes: { nome_completo: 'Marina' } },
        { id: 'r2', titulo: 'Ativação Carreira', data_ritual: diasAtras(-3), status: 'pendente' },
      ],
    }, AGORA)
    expect(r).toHaveLength(1)
    expect(r[0].titulo).toContain('18:30')
    expect(r[0].detalhe).toBe('Marina')
  })

  it('ritual concluído não aparece', () => {
    const r = montarPendencias({
      ...VAZIO,
      rituais: [{ id: 'r1', data_ritual: diasAtras(0), status: 'concluido' }],
    }, AGORA)
    expect(r).toHaveLength(0)
  })
})

describe('composição e ordem', () => {
  it('dinheiro vencido vem antes de tudo; lacuna de método depois', () => {
    const r = montarPendencias({
      consultas: [{ id: 'c3', nome_imovel: 'Loft', status: 'em_andamento', atualizado_em: isoDiasAtras(0) }],
      pagamentos: [{ id: 'p1', valor: 950, status: 'pendente', data_vencimento: diasAtras(2) }],
      rituais: [{ id: 'r1', data_ritual: diasAtras(0), status: 'pendente' }],
    }, AGORA)
    expect(r.map(p => p.tipo)).toEqual([
      'parcela_vencida', 'ritual_hoje', 'sem_fachada', 'sem_ano_construcao',
    ])
  })

  it('a mesma consulta pode ter dois problemas diferentes, com ações diferentes', () => {
    const r = montarPendencias({
      ...VAZIO,
      consultas: [{ id: 'c4', nome_imovel: 'Parada', status: 'em_andamento', atualizado_em: isoDiasAtras(30) }],
    }, AGORA)
    expect(new Set(r.map(p => p.tipo))).toEqual(
      new Set(['sem_fachada', 'sem_ano_construcao', 'consulta_parada'])
    )
    expect(new Set(r.map(p => p.id)).size).toBe(r.length) // ids únicos
  })

  it('nada pendente, lista vazia — e vazia é um estado, não um erro', () => {
    expect(montarPendencias({ ...VAZIO, consultas: [CONSULTA_OK] }, AGORA)).toEqual([])
  })
})
