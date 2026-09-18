'use client'

import { useId, useState } from 'react'
import { formatarCentavos, PRECOS_DOS_PLANOS } from '../../../src/lib/plano-utils'

const LIMITE_VALOR_REAIS = 1_000_000
const LIMITE_CONSULTAS = 10_000

function centavos(texto: string): number | null {
  if (!texto.trim()) return null
  const valor = Number(texto.replace(',', '.'))
  return Number.isFinite(valor) && valor >= 0 && valor <= LIMITE_VALOR_REAIS ? Math.round(valor * 100) : null
}

export default function SimuladorDeCustos({
  mensalidadeCentavos = PRECOS_DOS_PLANOS.profissional.mensalCentavos,
  ciclo = 'mensal',
}: { mensalidadeCentavos?: number; ciclo?: 'mensal' | 'anual' }) {
  const id = useId()
  const [recebimento, setRecebimento] = useState('')
  const [custo, setCusto] = useState('')
  const [quantidade, setQuantidade] = useState('1')
  const receita = centavos(recebimento), despesa = centavos(custo), consultas = Number(quantidade)
  const valido = receita !== null && despesa !== null && quantidade.trim() !== ''
    && Number.isInteger(consultas) && consultas >= 0 && consultas <= LIMITE_CONSULTAS
  const margem = valido && receita !== null && despesa !== null ? receita - despesa : null
  const saldo = margem === null ? null : margem * consultas - mensalidadeCentavos
  const consultasParaCobrir = margem !== null && margem > 0 ? Math.ceil(mensalidadeCentavos / margem) : null

  return (
    <section className="bg-sand py-14 text-ink" aria-labelledby={`${id}-titulo`}>
      <div className="container max-w-4xl">
        <p className="eyebrow mb-3">Planeje seus custos</p>
        <h2 id={`${id}-titulo`} className="font-display text-2xl md:text-3xl">Simule com os valores do seu trabalho</h2>
        <p className="mt-3 text-ink/80">
          Plano Profissional: {formatarCentavos(mensalidadeCentavos)} por mês{ciclo === 'anual' ? ' de custo equivalente no pagamento anual' : ''}.
          {' '}Informe seus recebimentos e custos para comparar.
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <label htmlFor={`${id}-receita`} className="text-sm font-medium">
            Recebimento por consulta (R$)
            <input id={`${id}-receita`} type="number" min="0" max={LIMITE_VALOR_REAIS} step="0.01" inputMode="decimal"
              value={recebimento} onChange={e => setRecebimento(e.target.value)}
              className="mt-2 w-full rounded-lg border border-ink/40 bg-paper p-3 text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-jade" />
          </label>
          <label htmlFor={`${id}-custo`} className="text-sm font-medium">
            Custos por consulta (R$)
            <input id={`${id}-custo`} type="number" min="0" max={LIMITE_VALOR_REAIS} step="0.01" inputMode="decimal"
              value={custo} onChange={e => setCusto(e.target.value)}
              className="mt-2 w-full rounded-lg border border-ink/40 bg-paper p-3 text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-jade" />
          </label>
          <label htmlFor={`${id}-quantidade`} className="text-sm font-medium">
            Consultas no mês
            <input id={`${id}-quantidade`} type="number" min="0" max={LIMITE_CONSULTAS} step="1" inputMode="numeric"
              value={quantidade} onChange={e => setQuantidade(e.target.value)}
              className="mt-2 w-full rounded-lg border border-ink/40 bg-paper p-3 text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-jade" />
          </label>
        </div>
        <div role="status" aria-live="polite" className="mt-5 rounded-lg border border-ink/20 bg-paper p-4">
          {saldo === null ? <p>Preencha os valores e informe uma quantidade inteira de consultas.</p> : <>
            <p>Saldo após os custos informados e a assinatura: <strong>{formatarCentavos(saldo)}</strong>.</p>
            <p className="mt-2">{consultasParaCobrir !== null
              ? `${consultasParaCobrir} consulta(s) com essa margem cobrem o custo mensal da assinatura.`
              : 'Com essa margem, as consultas não cobrem o custo da assinatura.'}</p>
          </>}
        </div>
        <p className="mt-3 text-sm text-ink/75">
          Cenário com os valores que você informou, sem previsão de novos clientes.
          Inclua nos custos despesas, tributos e remuneração do seu tempo conforme sua realidade.
          Os valores desta simulação ficam apenas nesta página.
        </p>
      </div>
    </section>
  )
}
