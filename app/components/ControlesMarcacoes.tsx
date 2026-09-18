'use client'

import type { ModoEdicaoPlanta } from '../../src/lib/edicao-marcacoes'
import { areaSobreposta, excessoAreaExterna, type Bounds, type Marcacao } from '../../src/lib/geometria-bagua'

export default function ControlesMarcacoes({ modo, aoMudarModo, marcacoes, selecionada, aoSelecionar, aoExcluir, semSobreposicoes, aoComparar, bordas }: {
  modo: ModoEdicaoPlanta
  aoMudarModo: (modo: ModoEdicaoPlanta) => void
  marcacoes: Marcacao[]
  selecionada: string | null
  aoSelecionar: (id: string) => void
  aoExcluir: (id: string) => void
  semSobreposicoes: boolean
  aoComparar: (valor: boolean) => void
  bordas: Bounds | null
}) {
  const atual = marcacoes.find(m => m.id === selecionada)
  const semArea = atual && bordas && (atual.tipo === 'falta'
    ? areaSobreposta(atual, bordas.x, bordas.y, bordas.w, bordas.h)
    : excessoAreaExterna(atual, bordas)) === 0
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, width: '100%', color: '#0E1B2C', background: '#fff', borderRadius: 8, padding: 10, boxSizing: 'border-box' }}>
      {([
        ['marcarFalta', '▭ Marcar Falta', '#B4533A'],
        ['marcarExcesso', '▭ Marcar Excesso', '#8A6E2F'],
        ['editarMarcacao', 'Editar marcações', '#245F52'],
      ] as const).map(([valor, texto, cor]) => (
        <button key={valor} type="button" aria-pressed={modo === valor} onClick={() => aoMudarModo(modo === valor ? 'nenhum' : valor)}
          style={{ background: modo === valor ? cor : '#fff', color: modo === valor ? '#fff' : cor, border: `2px solid ${cor}`, padding: '8px 12px', borderRadius: 6, minHeight: 44, fontSize: 13, cursor: 'pointer' }}>
          {texto}
        </button>
      ))}
      <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, minHeight: 44 }}>
        <input type="checkbox" checked={semSobreposicoes} onChange={e => aoComparar(e.target.checked)} />
        Ver planta sem sobreposições
      </label>
      {modo === 'editarMarcacao' && <>
        <label style={{ fontSize: 13 }}>Marcação para editar{' '}
          <select value={selecionada ?? ''} onChange={e => aoSelecionar(e.target.value)} style={{ minHeight: 44, maxWidth: '100%' }}>
            <option value="">Selecione na planta ou nesta lista</option>
            {marcacoes.map((m, i) => <option key={m.id} value={m.id}>{m.tipo === 'falta' ? 'Falta' : 'Excesso'} {i + 1}</option>)}
          </select>
        </label>
        <button type="button" disabled={!atual} onClick={() => atual && aoExcluir(atual.id)} style={{ minHeight: 44 }}>Excluir marcação selecionada</button>
      </>}
      <p role="status" style={{ width: '100%', fontSize: 13, lineHeight: 1.5, margin: 0 }}>
        {semSobreposicoes ? 'A planta original e as bordas de referência continuam visíveis. As marcações foram apenas ocultadas.'
          : modo === 'marcarFalta' || modo === 'marcarExcesso'
            ? 'Arraste para desenhar uma nova área, mesmo sobre outra marcação. As bordas não mudam. Depois, clique em Recalcular.'
            : modo === 'editarMarcacao'
              ? 'Selecione uma marcação. Arraste o interior para mover ou um dos quatro cantos para redimensionar. Esc cancela o gesto.'
              : 'Falta considera o vazio dentro das bordas; excesso considera somente a parte fora delas. Não altere as bordas apenas para desenhar.'}
      </p>
      {semArea && <p role="status" style={{ width: '100%', color: '#8A6E2F', fontSize: 13, margin: 0 }}>
        {atual.tipo === 'excesso'
          ? 'Este excesso está inteiramente dentro das bordas e não altera o cálculo. Marque a extensão externa ao retângulo-base; a parte interna não conta como excesso.'
          : 'Esta falta está fora das bordas e não altera o cálculo. Marque o vazio dentro do retângulo-base.'}
      </p>}
    </div>
  )
}
