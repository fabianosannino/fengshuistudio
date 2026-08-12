import { describe, expect, it } from 'vitest'
import { papelDoUsuario, ehClienteFinal, metadadosDoPapel } from '../papel-do-usuario'

describe('papelDoUsuario', () => {
  it('lê os cinco valores antigos sem remigrar ninguém', () => {
    for (const tipo of ['arquiteto', 'feng_shui', 'decorador', 'outro_profissional', 'consultor']) {
      expect(papelDoUsuario({ tipo_usuario: tipo }), tipo).toBe('consultor')
    }
    expect(papelDoUsuario({ tipo_usuario: 'pessoal' })).toBe('pessoal')
  })

  it('não se confunde com espaço e caixa', () => {
    expect(papelDoUsuario({ tipo_usuario: '  Pessoal ' })).toBe('pessoal')
  })

  it('cai para `role` quando `tipo_usuario` está vazio', () => {
    expect(papelDoUsuario({ tipo_usuario: '', role: 'pessoal' })).toBe('pessoal')
    expect(papelDoUsuario({ tipo_usuario: null, role: 'consultor' })).toBe('consultor')
  })

  it('sem nada, assume consultor', () => {
    // Contas antigas e criadas fora do cadastro. Mostrar a home reduzida do
    // cliente final a um consultor esconderia clientes e consultas que existem.
    expect(papelDoUsuario({})).toBe('consultor')
    expect(papelDoUsuario(null)).toBe('consultor')
    expect(papelDoUsuario(undefined)).toBe('consultor')
  })

  it('admin é consultor, não cliente final', () => {
    expect(papelDoUsuario({ role: 'admin' })).toBe('consultor')
  })
})

describe('ehClienteFinal', () => {
  it('é o espelho de papelDoUsuario', () => {
    expect(ehClienteFinal({ tipo_usuario: 'pessoal' })).toBe(true)
    expect(ehClienteFinal({ tipo_usuario: 'feng_shui' })).toBe(false)
  })
})

describe('metadadosDoPapel', () => {
  it('grava tipo e role coerentes', () => {
    expect(metadadosDoPapel('pessoal')).toEqual({ tipo_usuario: 'pessoal', role: 'pessoal' })
    expect(metadadosDoPapel('consultor')).toEqual({ tipo_usuario: 'consultor', role: 'consultor' })
  })

  it('o que se grava é o que se lê de volta', () => {
    for (const papel of ['consultor', 'pessoal'] as const) {
      expect(papelDoUsuario(metadadosDoPapel(papel)), papel).toBe(papel)
    }
  })
})
