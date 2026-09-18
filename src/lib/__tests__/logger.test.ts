// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import { logger } from '../logger'
import { contextoDoLog } from '../contexto-do-log'

afterEach(() => vi.restoreAllMocks())

describe('logs com dados mínimos', () => {
  it('não publica mensagens brutas, dados pessoais, URLs assinadas ou payloads', () => {
    const destino = vi.spyOn(console, 'error').mockImplementation(() => {})
    logger.error('Falha ao preparar checkout', { route: '/api/stripe/subscribe?email=pessoa@example.invalid#token',
      userId: 'pessoa-identificavel', assunto: 'Consulta de Maria', caminho: 'privado/foto', error: 'SQL contém CPF e token secreto',
      dados: { telefone: '11987654321' }, stack: 'Bearer credencial', customer: 'cus_secreto', timestamp: 'inventado', level: 'info', message: 'sobrescrita' })
    const registro = JSON.parse(destino.mock.calls[0][0])
    expect(registro).toEqual({ route: '/api/stripe/subscribe', erro_presente: true, level: 'error',
      message: 'Falha ao preparar checkout', timestamp: expect.any(String) })
    expect(Number.isFinite(Date.parse(registro.timestamp))).toBe(true)
  })

  it('mantém correlação de evento/emissão, códigos conhecidos e contagens sem nomes arbitrários', () => {
    expect(contextoDoLog({ eventId: 'evt_123', emissaoId: '00000000-0000-4000-8000-000000000001',
      code: '23505', status: 503, plano: 'profissional', ciclo: 'yearly', total: 3,
      resumo: { ausente_no_banco: 2, 'pessoa@example.invalid': 9 }, problemas: ['ambiente', 'segredo', 'valor_ou_moeda'] }))
      .toEqual({ eventId: 'evt_123', emissaoId: '00000000-0000-4000-8000-000000000001', code: '23505', status: 503,
        plano: 'profissional', ciclo: 'yearly', total: 3, resumo: { ausente_no_banco: 2 }, problemas: ['ambiente', 'valor_ou_moeda'] })
  })

  it('recusa rotas pessoais, códigos livres e valores inválidos', () => {
    expect(contextoDoLog({ route: '/clientes/joana', action: 'nome-do-cliente', code: 'SEGREDO', status: 'informação pessoal',
      eventId: 'evt_sk_live_segredo', emissaoId: 'nome-do-cliente', total: Infinity, trocas: -1, currentlyDueCount: 0.5 })).toEqual({})
  })

  it('não executa getters ou toJSON do contexto nem falha com ciclos e bigint', () => {
    const getter = vi.fn(() => { throw new Error('não executar') })
    const contexto = { total: BigInt(7), dados: {} as unknown, toJSON: getter }
    contexto.dados = contexto
    Object.defineProperty(contexto, 'route', { get: getter })
    expect(contextoDoLog(contexto)).toEqual({})
    expect(getter).not.toHaveBeenCalled()
    expect(contextoDoLog(new Proxy({}, { ownKeys: getter }))).toEqual({})
  })

  it('não executa acessores de listas e limita os códigos de catálogo', () => {
    const problemas = Array.from({ length: 30 }, () => 'ambiente')
    Object.defineProperty(problemas, '0', { get: () => { throw new Error('não executar') } })
    expect(contextoDoLog({ problemas }).problemas).toHaveLength(19)
  })

  it.each(['warn', 'info'] as const)('preserva o nível %s com o mesmo filtro', nivel => {
    const destino = vi.spyOn(console, nivel === 'info' ? 'log' : 'warn').mockImplementation(() => {})
    logger[nivel]('Evento técnico', { route: 'rate-limit', action: 'sem-upstash', token: 'secreto' })
    expect(JSON.parse(destino.mock.calls[0][0])).toMatchObject({ level: nivel, action: 'sem-upstash' })
    expect(String(destino.mock.calls[0][0])).not.toContain('secreto')
  })
})
