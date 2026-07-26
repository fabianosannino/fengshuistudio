'use client'

import { useCallback, useRef, useState } from 'react'

/**
 * Camada de sobreposição da planta baixa sobre um fundo qualquer (mapa de
 * satélite, no uso real — mas o componente não sabe nem precisa saber
 * disso). Decoupled do Google Maps de propósito, mesmo padrão já usado em
 * `EditorPoligonoTaiJi` (ADR 0010): construir e testar a interação
 * isoladamente antes de compor sobre algo que não dá para simular de
 * ponta a ponta neste ambiente (ver ADR 0012).
 *
 * "Pinça" do documento de referência (§2.4) é substituída por um slider de
 * escala — decisão deliberada de simplificação para desktop-first, não uma
 * lacuna silenciosa (documentada na ADR).
 */

export interface TransformAlinhamento {
  x: number
  y: number
  escala: number
  rotacaoGraus: number
}

export interface OverlayAlinhamentoMapaProps {
  imagemUrl: string
  onChange?: (t: TransformAlinhamento) => void
}

const TRANSFORM_INICIAL: TransformAlinhamento = { x: 0, y: 0, escala: 1, rotacaoGraus: 0 }

export default function OverlayAlinhamentoMapa({ imagemUrl, onChange }: OverlayAlinhamentoMapaProps) {
  const [transform, setTransform] = useState<TransformAlinhamento>(TRANSFORM_INICIAL)
  const [opacidade, setOpacidade] = useState(0.6)
  const arrastoRef = useRef<{ inicioX: number; inicioY: number; xBase: number; yBase: number } | null>(null)

  const atualizar = useCallback((novo: TransformAlinhamento) => {
    setTransform(novo)
    onChange?.(novo)
  }, [onChange])

  function iniciarArrasto(e: React.PointerEvent) {
    // setPointerCapture é essencial aqui: a própria imagem se move junto com o ponteiro, então
    // sem captura ela "escapa" de baixo do cursor e o arrasto morre num pointerleave — o
    // deslocamento aplicado fica muito menor que o movimento real do mouse (bug pego em teste).
    e.currentTarget.setPointerCapture(e.pointerId)
    arrastoRef.current = { inicioX: e.clientX, inicioY: e.clientY, xBase: transform.x, yBase: transform.y }
  }

  function moverArrasto(e: React.PointerEvent) {
    const a = arrastoRef.current
    if (!a) return
    atualizar({ ...transform, x: a.xBase + (e.clientX - a.inicioX), y: a.yBase + (e.clientY - a.inicioY) })
  }

  function soltarArrasto(e: React.PointerEvent) {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
    arrastoRef.current = null
  }

  function resetar() {
    atualizar(TRANSFORM_INICIAL)
  }

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }} data-testid="overlay-alinhamento">
      {/* eslint-disable-next-line @next/next/no-img-element -- imagem do usuário (planta baixa), não um asset estático do site */}
      <img
        src={imagemUrl}
        alt="Planta baixa a alinhar com o mapa"
        onPointerDown={iniciarArrasto}
        onPointerMove={moverArrasto}
        onPointerUp={soltarArrasto}
        onPointerCancel={soltarArrasto}
        /* Sem isto o navegador inicia o drag-and-drop NATIVO da imagem, que dispara um
           pointercancel e mata o arrasto depois de ~2 eventos (bug pego em teste: um arrasto
           de 40px aplicava só 5px). */
        draggable={false}
        data-testid="overlay-imagem"
        style={{
          position: 'absolute', left: '50%', top: '50%', maxWidth: 'none', width: '260px',
          transform: `translate(-50%, -50%) translate(${transform.x}px, ${transform.y}px) rotate(${transform.rotacaoGraus}deg) scale(${transform.escala})`,
          opacity: opacidade, cursor: 'move', touchAction: 'none', userSelect: 'none',
        }}
      />

      <div style={{
        position: 'absolute', bottom: '8px', left: '8px', right: '8px', background: 'rgba(255,255,255,0.94)',
        borderRadius: '7px', padding: '8px 10px', fontSize: '11px', color: '#374151', pointerEvents: 'auto',
      }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
          <span style={{ width: '58px' }}>Rotação</span>
          <input type="range" min={-180} max={180} step={0.5} value={transform.rotacaoGraus}
            onChange={e => atualizar({ ...transform, rotacaoGraus: Number(e.target.value) })}
            style={{ flex: 1 }} data-testid="slider-rotacao" />
          <span style={{ width: '42px', textAlign: 'right' }}>{transform.rotacaoGraus.toFixed(0)}°</span>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
          <span style={{ width: '58px' }}>Escala</span>
          <input type="range" min={0.2} max={3} step={0.05} value={transform.escala}
            onChange={e => atualizar({ ...transform, escala: Number(e.target.value) })}
            style={{ flex: 1 }} data-testid="slider-escala" />
          <span style={{ width: '42px', textAlign: 'right' }}>{transform.escala.toFixed(2)}×</span>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
          <span style={{ width: '58px' }}>Opacidade</span>
          <input type="range" min={0.2} max={1} step={0.05} value={opacidade}
            onChange={e => setOpacidade(Number(e.target.value))}
            style={{ flex: 1 }} data-testid="slider-opacidade" />
          <span style={{ width: '42px', textAlign: 'right' }}>{Math.round(opacidade * 100)}%</span>
        </label>
        <button type="button" onClick={resetar} style={{
          padding: '4px 10px', fontSize: '10px', fontWeight: 'bold', background: '#F3F4F6',
          color: '#374151', border: '1px solid #D1D5DB', borderRadius: '5px', cursor: 'pointer',
        }}>
          Resetar posição
        </button>
      </div>
    </div>
  )
}
