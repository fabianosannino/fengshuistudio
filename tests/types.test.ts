import { describe, it, expectTypeOf } from 'vitest'
import type {
  Profile, Cliente, Consulta, Pagamento, Ritual,
  SetorBagua, DiagnosticoCriterio, RecomendacaoCustom,
  PlanType, ConsultaStatus, PagamentoStatus, TipoUsuario,
  StatusChartEntry, AgendaItem,
} from '../src/lib/types'

describe('Type Definitions', () => {
  it('Profile has required fields', () => {
    expectTypeOf<Profile>().toHaveProperty('nome_completo')
    expectTypeOf<Profile>().toHaveProperty('plano')
    expectTypeOf<Profile>().toHaveProperty('tipo_usuario')
    expectTypeOf<Profile>().toHaveProperty('role')
  })

  it('Cliente has required fields', () => {
    expectTypeOf<Cliente>().toHaveProperty('id')
    expectTypeOf<Cliente>().toHaveProperty('consultor_id')
    expectTypeOf<Cliente>().toHaveProperty('nome_completo')
    expectTypeOf<Cliente>().toHaveProperty('ativo')
  })

  it('Consulta has required fields', () => {
    expectTypeOf<Consulta>().toHaveProperty('id')
    expectTypeOf<Consulta>().toHaveProperty('status')
    expectTypeOf<Consulta>().toHaveProperty('consultor_id')
  })

  it('Pagamento has required fields', () => {
    expectTypeOf<Pagamento>().toHaveProperty('descricao')
    expectTypeOf<Pagamento>().toHaveProperty('valor')
    expectTypeOf<Pagamento>().toHaveProperty('status')
  })

  it('PlanType is a valid union', () => {
    expectTypeOf<'freemium'>().toMatchTypeOf<PlanType>()
    expectTypeOf<'pro'>().toMatchTypeOf<PlanType>()
  })

  it('ConsultaStatus has all valid states', () => {
    expectTypeOf<'rascunho'>().toMatchTypeOf<ConsultaStatus>()
    expectTypeOf<'em_andamento'>().toMatchTypeOf<ConsultaStatus>()
    expectTypeOf<'finalizada'>().toMatchTypeOf<ConsultaStatus>()
    expectTypeOf<'arquivada'>().toMatchTypeOf<ConsultaStatus>()
  })

  it('PagamentoStatus has all valid states', () => {
    expectTypeOf<'pendente'>().toMatchTypeOf<PagamentoStatus>()
    expectTypeOf<'pago'>().toMatchTypeOf<PagamentoStatus>()
    expectTypeOf<'atrasado'>().toMatchTypeOf<PagamentoStatus>()
  })

  it('TipoUsuario includes professional types', () => {
    expectTypeOf<'pessoal'>().toMatchTypeOf<TipoUsuario>()
    expectTypeOf<'feng_shui'>().toMatchTypeOf<TipoUsuario>()
    expectTypeOf<'arquiteto'>().toMatchTypeOf<TipoUsuario>()
  })

  it('SetorBagua has diagnostic relations', () => {
    expectTypeOf<SetorBagua>().toHaveProperty('diagnostico_criterios')
    expectTypeOf<SetorBagua>().toHaveProperty('recomendacoes_custom')
  })

  it('DiagnosticoCriterio has score field', () => {
    expectTypeOf<DiagnosticoCriterio>().toHaveProperty('criterio')
    expectTypeOf<DiagnosticoCriterio>().toHaveProperty('score')
  })

  it('RecomendacaoCustom has valid tipo union', () => {
    const rec: RecomendacaoCustom = { tipo: 'urgente', texto: 'test', produtos: [] }
    expectTypeOf(rec).toMatchTypeOf<RecomendacaoCustom>()
  })

  it('Ritual has required scheduling fields', () => {
    expectTypeOf<Ritual>().toHaveProperty('data_ritual')
    expectTypeOf<Ritual>().toHaveProperty('fase_lunar')
    expectTypeOf<Ritual>().toHaveProperty('status')
  })

  it('StatusChartEntry has chart-required fields', () => {
    expectTypeOf<StatusChartEntry>().toHaveProperty('name')
    expectTypeOf<StatusChartEntry>().toHaveProperty('value')
    expectTypeOf<StatusChartEntry>().toHaveProperty('color')
  })

  it('AgendaItem has display fields', () => {
    expectTypeOf<AgendaItem>().toHaveProperty('tipo')
    expectTypeOf<AgendaItem>().toHaveProperty('titulo')
    expectTypeOf<AgendaItem>().toHaveProperty('data')
  })
})
