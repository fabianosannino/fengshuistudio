'use client'

import { useMemo, useState } from 'react'
import { normalizarGraus } from '../../src/lib/graus'
import { montanhaDoGrau } from '../../src/lib/montanhas'
import {
  determinarFacing, CRITERIOS_FACING, ORDEM_CRITERIOS,
  type CriterioFacing, type FaceCandidata,
} from '../../src/lib/facing'

/**
 * Questionário de determinação de Facing (§2.5 do documento de referência).
 *
 * O ponto do componente não é "calcular o facing" — é tornar visível que
 * determinar a frente do imóvel é um JULGAMENTO, com critérios de forças
 * diferentes, e que às vezes o julgamento é genuinamente ambíguo. Quando é,
 * o resultado mostra as duas hipóteses concorrentes em vez de esconder a
 * dúvida atrás de um número único.
 *
 * Toda a pontuação e a detecção de ambiguidade moram em `src/lib/facing.ts`
 * (puro e testado); aqui só existe UI.
 */

const FACES_INICIAIS: FaceCandidata[] = [
  { id: 'Face A', graus: 0, criterios: [] },
  { id: 'Face B', graus: 180, criterios: [] },
]

export interface QuestionarioFacingProps {
  /** Chamado quando o consultor aceita uma hipótese. Recebe o facing em graus. */
  onAceitar: (facingGraus: number) => void
}

export default function QuestionarioFacing({ onAceitar }: QuestionarioFacingProps) {
  const [faces, setFaces] = useState<FaceCandidata[]>(FACES_INICIAIS)

  const resultado = useMemo(() => determinarFacing(faces), [faces])

  function atualizarFace(indice: number, mudanca: Partial<FaceCandidata>) {
    setFaces(prev => prev.map((f, i) => (i === indice ? { ...f, ...mudanca } : f)))
  }

  function alternarCriterio(indice: number, criterio: CriterioFacing) {
    setFaces(prev => prev.map((f, i) => {
      if (i !== indice) return f
      const tem = f.criterios.includes(criterio)
      return { ...f, criterios: tem ? f.criterios.filter(c => c !== criterio) : [...f.criterios, criterio] }
    }))
  }

  function adicionarFace() {
    setFaces(prev => [...prev, { id: `Face ${String.fromCharCode(65 + prev.length)}`, graus: 90, criterios: [] }])
  }

  function removerFace(indice: number) {
    setFaces(prev => (prev.length <= 2 ? prev : prev.filter((_, i) => i !== indice)))
  }

  return (
    <div style={{ marginTop: '8px', padding: '10px', background: '#fff', borderRadius: '7px', border: '1px solid #E5E7EB' }}>
      <p style={{ margin: '0 0 8px', fontSize: '11px', color: '#374151' }}>
        Determinar a frente (Facing 向) é um <strong>julgamento</strong>, não uma medição. Marque os
        critérios que valem para cada face — os de cima pesam mais que os de baixo.
      </p>

      {faces.map((face, i) => (
        <div key={i} style={{ marginBottom: '10px', padding: '8px', background: '#F9FAFB', borderRadius: '6px', border: '1px solid #E5E7EB' }}>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '6px', flexWrap: 'wrap' }}>
            <input
              type="text" value={face.id}
              onChange={e => atualizarFace(i, { id: e.target.value })}
              data-testid={`face-nome-${i}`}
              style={{ flex: '1 1 120px', minWidth: 0, padding: '4px 7px', border: '1px solid #D1D5DB', borderRadius: '5px', fontSize: '11px', fontWeight: 'bold' }}
            />
            <input
              type="number" min={0} max={359.9} step={0.1} value={face.graus}
              onChange={e => atualizarFace(i, { graus: normalizarGraus(Number(e.target.value) || 0) })}
              data-testid={`face-graus-${i}`}
              style={{ width: '68px', padding: '4px 7px', border: '1px solid #D1D5DB', borderRadius: '5px', fontSize: '11px' }}
            />
            <span style={{ fontSize: '10px', color: '#6B7280' }}>°</span>
            {faces.length > 2 && (
              <button type="button" onClick={() => removerFace(i)} data-testid={`remover-face-${i}`}
                style={{ padding: '3px 8px', fontSize: '10px', background: '#FAEEE9', color: '#B4533A', border: '1px solid #E0A48E', borderRadius: '5px', cursor: 'pointer' }}>
                remover
              </button>
            )}
          </div>
          {ORDEM_CRITERIOS.map(criterio => (
            <label key={criterio} style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', marginBottom: '3px', cursor: 'pointer', fontSize: '10px', color: '#374151' }}>
              <input
                type="checkbox" checked={face.criterios.includes(criterio)}
                onChange={() => alternarCriterio(i, criterio)}
                data-testid={`criterio-${i}-${criterio}`}
                style={{ marginTop: '2px', accentColor: '#2E7D6B' }}
              />
              <span>
                <strong>{CRITERIOS_FACING[criterio].rotulo}</strong>
                <span style={{ color: '#9CA3AF' }}> (peso {CRITERIOS_FACING[criterio].peso})</span>
                <br />
                <span style={{ color: '#6B7280' }}>{CRITERIOS_FACING[criterio].pergunta}</span>
              </span>
            </label>
          ))}
        </div>
      ))}

      <button type="button" onClick={adicionarFace} data-testid="adicionar-face"
        style={{ padding: '4px 10px', fontSize: '10px', fontWeight: 'bold', background: '#F3F4F6', color: '#374151', border: '1px solid #D1D5DB', borderRadius: '5px', cursor: 'pointer' }}>
        + Adicionar face
      </button>

      {/* ── Resultado ── */}
      <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px solid #E5E7EB' }}>
        {resultado.principal == null ? (
          <p style={{ margin: 0, fontSize: '11px', color: '#8A6E2F' }} data-testid="facing-sem-resultado">
            {resultado.avisos[0]}
          </p>
        ) : (
          <>
            <p style={{ margin: '0 0 4px', fontSize: '11px', color: '#374151' }} data-testid="facing-principal">
              {resultado.ambiguo ? 'Hipótese 1' : 'Facing'}: <strong>{resultado.principal.face.id}</strong> —{' '}
              <strong>{resultado.facingGraus!.toFixed(1)}°</strong> ({resultado.principal.score} pts)
              {' · '}Montanha {montanhaDoGrau(resultado.facingGraus!).pinyin}
              <br />
              <span style={{ color: '#6B7280' }}>
                Sitting (坐) oposto: {resultado.sittingGraus!.toFixed(1)}°
              </span>
            </p>

            {resultado.concorrente && (
              <p style={{ margin: '0 0 4px', fontSize: '11px', color: '#374151' }} data-testid="facing-concorrente">
                Hipótese 2: <strong>{resultado.concorrente.face.id}</strong> —{' '}
                <strong>{normalizarGraus(resultado.concorrente.face.graus).toFixed(1)}°</strong> ({resultado.concorrente.score} pts)
                {' · '}Montanha {montanhaDoGrau(resultado.concorrente.face.graus).pinyin}
              </p>
            )}

            {resultado.avisos.map((aviso, i) => (
              <p key={i} style={{ margin: '0 0 5px', fontSize: '10px', color: '#8A6E2F', background: '#FAF3E0', padding: '5px 7px', borderRadius: '5px', border: '1px solid #EEDFB4' }} data-testid={`facing-aviso-${i}`}>
                ⚠ {aviso}
              </p>
            ))}

            <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', marginTop: '5px' }}>
              <button type="button" onClick={() => onAceitar(resultado.facingGraus!)} data-testid="usar-hipotese-1"
                style={{ padding: '4px 10px', background: '#2E7D6B', color: '#fff', border: 'none', borderRadius: '5px', fontSize: '10px', fontWeight: 'bold', cursor: 'pointer' }}>
                Usar {resultado.ambiguo ? 'hipótese 1' : 'este facing'}
              </button>
              {resultado.concorrente && (
                <button type="button" onClick={() => onAceitar(normalizarGraus(resultado.concorrente!.face.graus))} data-testid="usar-hipotese-2"
                  style={{ padding: '4px 10px', background: '#fff', color: '#2E7D6B', border: '1px solid #2E7D6B', borderRadius: '5px', fontSize: '10px', fontWeight: 'bold', cursor: 'pointer' }}>
                  Usar hipótese 2
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
