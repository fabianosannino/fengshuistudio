import { describe, it, expect } from 'vitest'
import { dataSolar } from '../data-solar'

describe('dataSolar', () => {
  it('data ausente/inválida → null (fail-closed)', () => {
    expect(dataSolar(null)).toBeNull()
    expect(dataSolar(undefined)).toBeNull()
    expect(dataSolar('data-invalida')).toBeNull()
  })

  it('meados do ano: ano solar igual ao civil', () => {
    expect(dataSolar('1990-06-15')).toEqual({ anoCivil: 1990, anoSolar: 1990 })
  })

  it('nascido em janeiro pertence ao ano solar anterior', () => {
    expect(dataSolar('1990-01-10')).toEqual({ anoCivil: 1990, anoSolar: 1989 })
  })

  it('data civil que pode cruzar Li Chun permanece indeterminada', () => {
    expect(dataSolar('1990-02-04')).toBeNull()
  })

  it('não deduz o fuso pelo computador', () => {
    expect(dataSolar('1990-02-03')).toBeNull()
    expect(dataSolar('1990-02-03', 'Asia/Hong_Kong')).toEqual({ anoCivil: 1990, anoSolar: 1989 })
  })

  it('aceita Date além de string ISO, com o mesmo resultado', () => {
    expect(dataSolar(new Date(2024, 0, 15))).toEqual({ anoCivil: 2024, anoSolar: 2023 })
  })

  it('Date inválido → null', () => {
    expect(dataSolar(new Date('não é uma data'))).toBeNull()
  })
})
