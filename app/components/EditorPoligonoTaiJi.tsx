'use client'

import { useCallback, useRef, useState } from 'react'
import {
  calcularTaiJi, coberturaPorCelula, setoresAusentes, setoresExtensao,
  retanguloDelimitador, type Ponto,
} from '../../src/lib/poligono'

/**
 * Editor de polígono para o Tai Ji real do imóvel — DESACOPLADO do canvas
 * principal de app/bagua-planta/page.tsx (que hoje só desenha um retângulo
 * ajustável). Espaço de coordenadas próprio (0–TAMANHO_VIEWBOX), não
 * alinhado ainda à foto real da planta.
 *
 * Decisão de escopo (ver ADR 0010): construir e testar este editor de forma
 * independente primeiro, sem mexer na máquina de arrastar já existente
 * (densa, duplicada entre visualização normal/tela cheia, em produção) —
 * sobrepor isso com precisão de pixel na foto real fica para uma etapa de
 * integração dedicada e separada.
 */

export interface EditorPoligonoTaiJiProps {
  pontosIniciais?: Ponto[]
  onChange?: (pontos: Ponto[]) => void
}

const TAMANHO_VIEWBOX = 400
const MARGEM = 40
const MINIMO_VERTICES = 3

const RETANGULO_PADRAO: Ponto[] = [
  { x: MARGEM, y: MARGEM },
  { x: TAMANHO_VIEWBOX - MARGEM, y: MARGEM },
  { x: TAMANHO_VIEWBOX - MARGEM, y: TAMANHO_VIEWBOX - MARGEM },
  { x: MARGEM, y: TAMANHO_VIEWBOX - MARGEM },
]

export default function EditorPoligonoTaiJi({ pontosIniciais, onChange }: EditorPoligonoTaiJiProps) {
  const [pontos, setPontos] = useState<Ponto[]>(pontosIniciais ?? RETANGULO_PADRAO)
  const [arrastando, setArrastando] = useState<number | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  const atualizarPontos = useCallback((novo: Ponto[]) => {
    setPontos(novo)
    onChange?.(novo)
  }, [onChange])

  function coordenadasSvg(e: { clientX: number; clientY: number }): Ponto {
    const svg = svgRef.current!
    const rect = svg.getBoundingClientRect()
    return {
      x: ((e.clientX - rect.left) / rect.width) * TAMANHO_VIEWBOX,
      y: ((e.clientY - rect.top) / rect.height) * TAMANHO_VIEWBOX,
    }
  }

  function iniciarArrastoVertice(indice: number) {
    return (e: React.PointerEvent) => {
      e.stopPropagation()
      setArrastando(indice)
    }
  }

  function moverPonteiro(e: React.PointerEvent) {
    if (arrastando === null) return
    const p = coordenadasSvg(e)
    const novo = pontos.map((ponto, i) => (i === arrastando ? p : ponto))
    atualizarPontos(novo)
  }

  function soltarPonteiro() {
    setArrastando(null)
  }

  function adicionarVerticeNaAresta(indiceAresta: number) {
    return (e: React.PointerEvent) => {
      e.stopPropagation()
      const a = pontos[indiceAresta]
      const b = pontos[(indiceAresta + 1) % pontos.length]
      const meio: Ponto = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
      const novo = [...pontos.slice(0, indiceAresta + 1), meio, ...pontos.slice(indiceAresta + 1)]
      atualizarPontos(novo)
    }
  }

  function removerVertice(indice: number) {
    return (e: React.MouseEvent) => {
      e.stopPropagation()
      if (pontos.length <= MINIMO_VERTICES) return
      atualizarPontos(pontos.filter((_, i) => i !== indice))
    }
  }

  function restaurarRetangulo() {
    atualizarPontos(RETANGULO_PADRAO)
  }

  const taiJi = calcularTaiJi(pontos)
  const bbox = retanguloDelimitador(pontos)
  const celulas = coberturaPorCelula(pontos)
  const ausentes = setoresAusentes(pontos)
  const extensoes = setoresExtensao(pontos)
  const ehAusente = (linha: number, coluna: number) => ausentes.some(c => c.linha === linha && c.coluna === coluna)
  const ehExtensao = (linha: number, coluna: number) => extensoes.some(c => c.linha === linha && c.coluna === coluna)

  return (
    <div>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${TAMANHO_VIEWBOX} ${TAMANHO_VIEWBOX}`}
        onPointerMove={moverPonteiro}
        onPointerUp={soltarPonteiro}
        onPointerLeave={soltarPonteiro}
        style={{
          width: '100%', maxWidth: '400px', aspectRatio: '1',
          background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: '8px',
          touchAction: 'none',
        }}
        data-testid="editor-poligono-tai-ji"
      >
        <polygon
          points={pontos.map(p => `${p.x},${p.y}`).join(' ')}
          fill="#EDE9FE"
          stroke="#7C3AED"
          strokeWidth={2}
        />

        {bbox && celulas.map(c => {
          const larguraCelula = bbox.w / 3
          const alturaCelula = bbox.h / 3
          const ausente = ehAusente(c.linha, c.coluna)
          const extensao = ehExtensao(c.linha, c.coluna)
          if (!ausente && !extensao) return null
          return (
            <rect
              key={`celula-${c.linha}-${c.coluna}`}
              x={bbox.x + c.coluna * larguraCelula} y={bbox.y + c.linha * alturaCelula}
              width={larguraCelula} height={alturaCelula}
              fill={ausente ? 'rgba(220,38,38,0.15)' : 'rgba(217,119,6,0.2)'}
              stroke={ausente ? '#DC2626' : '#D97706'}
              strokeWidth={1} strokeDasharray="4 3"
              pointerEvents="none"
              data-testid={ausente ? `celula-ausente-${c.linha}-${c.coluna}` : `celula-extensao-${c.linha}-${c.coluna}`}
            />
          )
        })}

        {pontos.map((p, i) => {
          const proximo = pontos[(i + 1) % pontos.length]
          const meio: Ponto = { x: (p.x + proximo.x) / 2, y: (p.y + proximo.y) / 2 }
          return (
            <circle
              key={`meio-${i}`}
              cx={meio.x} cy={meio.y} r={5}
              fill="#fff" stroke="#A78BFA" strokeWidth={1.5}
              style={{ cursor: 'copy' }}
              onPointerDown={adicionarVerticeNaAresta(i)}
              data-testid={`handle-meio-${i}`}
            />
          )
        })}

        {pontos.map((p, i) => (
          <circle
            key={`vertice-${i}`}
            cx={p.x} cy={p.y} r={7}
            fill="#7C3AED" stroke="#fff" strokeWidth={2}
            style={{ cursor: 'grab' }}
            onPointerDown={iniciarArrastoVertice(i)}
            onDoubleClick={removerVertice(i)}
            data-testid={`vertice-${i}`}
          />
        ))}

        {taiJi && (
          <circle
            cx={taiJi.centro.x} cy={taiJi.centro.y} r={6}
            fill={taiJi.centroForaDaArea ? '#DC2626' : '#059669'}
            stroke="#fff" strokeWidth={2}
            data-testid="tai-ji-marcador"
          />
        )}
      </svg>

      <div style={{ marginTop: '8px', fontSize: '12px', color: '#6B7280' }}>
        {taiJi?.centroForaDaArea && (
          <p style={{ color: '#DC2626', fontWeight: 'bold', margin: '0 0 4px' }} data-testid="aviso-centro-fora">
            ⚠ O centro (Tai Ji) cai fora da área construída — comum em plantas em L, U ou T. É um diagnóstico em si, não um erro de desenho.
          </p>
        )}
        {ausentes.length > 0 && (
          <p style={{ color: '#DC2626', margin: '0 0 4px' }} data-testid="resumo-ausentes">
            Setor ausente (área hachurada vermelha): {ausentes.length} célula(s) da grade 3×3.
          </p>
        )}
        {extensoes.length > 0 && (
          <p style={{ color: '#D97706', margin: '0 0 4px' }} data-testid="resumo-extensoes">
            Extensão (área hachurada laranja): {extensoes.length} célula(s) da grade 3×3.
          </p>
        )}
        <p style={{ margin: '0 0 8px' }}>
          Arraste os pontos roxos para desenhar o contorno real do imóvel. Clique nos pontos brancos menores para
          adicionar um vértice; duplo-clique num vértice roxo para removê-lo (mínimo {MINIMO_VERTICES}).
        </p>
        <button
          type="button"
          onClick={restaurarRetangulo}
          style={{
            padding: '5px 10px', fontSize: '11px', fontWeight: 'bold',
            background: '#F3F4F6', color: '#374151', border: '1px solid #D1D5DB',
            borderRadius: '6px', cursor: 'pointer',
          }}
        >
          Restaurar retângulo
        </button>
      </div>
    </div>
  )
}
