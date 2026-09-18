import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import RosaDosVentos from '../app/components/RosaDosVentos'

describe('entrada da fachada acessível', () => {
  it('ausência não desenha uma leitura de Norte; teclado cria a leitura explicitamente', () => {
    const mudar = vi.fn()
    render(<RosaDosVentos graus={null} onChange={mudar} />)
    expect(screen.queryByTestId('rosa-agulha')).toBeNull()
    expect(screen.queryByTestId('rosa-montanha-atual')).toBeNull()
    const controle = screen.getByRole('slider', { name: /não informada/ })
    expect(controle.getAttribute('tabindex')).toBe('0')
    fireEvent.keyDown(controle, { key: 'Home' })
    expect(mudar).toHaveBeenCalledWith(0)
  })
  it('zero informado mostra a agulha; setas atravessam o Norte', () => {
    const mudar = vi.fn()
    render(<RosaDosVentos graus={0} onChange={mudar} />)
    expect(screen.getByTestId('rosa-agulha')).toBeTruthy()
    fireEvent.keyDown(screen.getByRole('slider'), { key: 'ArrowLeft' })
    expect(mudar).toHaveBeenCalledWith(359)
  })
})
