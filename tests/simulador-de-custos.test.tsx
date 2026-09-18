import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import SimuladorDeCustos from '../app/components/marketing/SimuladorDeCustos'

function informar(recebimento: string, custo: string, quantidade = '1') {
  fireEvent.change(screen.getByLabelText('Recebimento por consulta (R$)'), { target: { value: recebimento } })
  fireEvent.change(screen.getByLabelText('Custos por consulta (R$)'), { target: { value: custo } })
  fireEvent.change(screen.getByLabelText('Consultas no mês'), { target: { value: quantidade } })
}

describe('simulação com valores do visitante', () => {
  it('não inventa recebimento nem considera campo vazio como zero', () => {
    render(<SimuladorDeCustos />)
    expect(screen.getByRole('status')).toHaveTextContent('Preencha os valores')
    informar('100', '')
    expect(screen.getByRole('status')).toHaveTextContent('Preencha os valores')
  })

  it('desconta custos e assinatura usando centavos, com arredondamento de consultas para cima', () => {
    render(<SimuladorDeCustos />)
    informar('40.20', '20.10', '3')
    expect(screen.getByRole('status')).toHaveTextContent('10,40')
    expect(screen.getByRole('status')).toHaveTextContent('3 consulta(s)')
  })

  it.each([['0', '0'], ['20', '50']])('mostra custo descoberto para margem não positiva (%s / %s)', (recebimento, custo) => {
    render(<SimuladorDeCustos />)
    informar(recebimento, custo)
    expect(screen.getByRole('status')).toHaveTextContent('não cobrem o custo')
    expect(screen.getByRole('status')).not.toHaveTextContent('Infinity')
  })

  it('aceita zero consultas sem prever clientes futuros', () => {
    render(<SimuladorDeCustos />)
    informar('100', '0', '0')
    expect(screen.getByRole('status')).toHaveTextContent('R$ -49,90')
  })

  it.each(['-1', '1.5', '10001', ''])('recusa quantidade inválida: %s', quantidade => {
    render(<SimuladorDeCustos />)
    informar('100', '10', quantidade)
    expect(screen.getByRole('status')).toHaveTextContent('Preencha os valores')
  })

  it('acompanha o custo equivalente anual selecionado sem apagar entradas', () => {
    const { rerender } = render(<SimuladorDeCustos />)
    informar('100', '20')
    expect(screen.getByRole('status')).toHaveTextContent('30,10')
    rerender(<SimuladorDeCustos mensalidadeCentavos={3430} ciclo="anual" />)
    expect(screen.getByRole('status')).toHaveTextContent('45,70')
    expect(screen.getByText(/custo equivalente no pagamento anual/)).toBeTruthy()
  })
})
