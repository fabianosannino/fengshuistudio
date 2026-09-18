import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import Precos from '../app/precos/page'
import { recursosDoPlano } from '../src/lib/plano-utils'

vi.mock('../app/components/marketing/FadeUp', () => ({ default: ({ children }: { children: ReactNode }) => <>{children}</> }))
vi.mock('../app/components/marketing/Navbar', () => ({ default: () => null }))
vi.mock('../app/components/marketing/Footer', () => ({ default: () => null }))
vi.mock('../app/components/marketing/CtaBand', () => ({ default: () => null }))

describe('contrato comercial e jornada', () => {
  it('preserva plano e ciclo anual até o destino de autenticação e mostra o total', () => {
    render(<Precos />)
    fireEvent.click(screen.getByRole('switch', { name: 'Alternar entre plano mensal e anual' }))
    const href = screen.getByRole('link', { name: 'Assinar Profissional' }).getAttribute('href')!
    const url = new URL(href, 'https://example.invalid')
    expect(url.pathname).toBe('/login')
    expect(url.searchParams.get('cadastro')).toBe('1')
    expect(url.searchParams.get('redirect')).toBe('/planos?plano=profissional&ciclo=yearly')
    expect(screen.getByText(/Total:.*411,60.*por ano/)).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Assinar Simples' }).getAttribute('href')).toContain('ciclo%3Dyearly')
  })
  it('direitos exibidos preservam a matriz efetiva das APIs', () => {
    expect(recursosDoPlano('free')).toEqual(expect.arrayContaining([
      expect.objectContaining({ nome: 'Cadastro de imóveis', valor: 'Até 3' }),
      expect.objectContaining({ nome: 'Cadastro de clientes', disponivel: false }),
      expect.objectContaining({ nome: 'Relatório PDF', disponivel: true, valor: 'Com marca d’água' }),
    ]))
    expect(recursosDoPlano('simples')).toEqual(expect.arrayContaining([
      expect.objectContaining({ nome: 'Cadastro de imóveis', valor: 'Até 10' }),
      expect.objectContaining({ nome: 'Cadastro de clientes', valor: 'Até 25', disponivel: true }),
    ]))
  })
})
