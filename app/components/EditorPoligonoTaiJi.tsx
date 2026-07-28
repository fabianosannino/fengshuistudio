'use client'

import { useCallback, useRef, useState } from 'react'
import {
  calcularTaiJi, coberturaPorCelula, setoresAusentes, setoresExtensao,
  retanguloDelimitador, type Ponto,
} from '../../src/lib/poligono'

/**
 * Editor de polígono para o Tai Ji real do imóvel. Espaço de coordenadas
 * PRÓPRIO (0–largura, 0–altura, padrão 400×400) — quem usa o componente
 * decide o que essas unidades significam.
 *
 * Dois modos de uso:
 * - Standalone (`transparente` omitido/false): caixa autocontida com fundo
 *   próprio, do jeito que foi construído e testado originalmente (ver ADR
 *   0010) — desacoplado do canvas de app/bagua-planta/page.tsx.
 * - Overlay (`transparente=true`): preenche 100% do elemento pai sem fundo
 *   nem caixa própria, pensado para ser posicionado por cima de uma imagem
 *   real (ex.: a foto da planta) por quem usa o componente — mesma técnica
 *   de sobreposição já usada no marcador de entrada em bagua-planta/page.tsx
 *   (viewBox nas unidades "naturais" da imagem + getBoundingClientRect para
 *   mapear cliques, sem precisar saber nada sobre zoom/CSS scale).
 */

export interface EditorPoligonoTaiJiProps {
  pontosIniciais?: Ponto[]
  onChange?: (pontos: Ponto[]) => void
  /** Unidades do viewBox — não precisam ser pixels de tela. Padrão 400×400. */
  largura?: number
  altura?: number
  /** Preenche 100% do elemento pai, sem fundo próprio — para uso como overlay. */
  transparente?: boolean
}

const MINIMO_VERTICES = 3

function retanguloPadrao(largura: number, altura: number): Ponto[] {
  const margem = Math.min(largura, altura) * 0.1
  return [
    { x: margem, y: margem },
    { x: largura - margem, y: margem },
    { x: largura - margem, y: altura - margem },
    { x: margem, y: altura - margem },
  ]
}

export default function EditorPoligonoTaiJi({
  pontosIniciais, onChange, largura = 400, altura = 400, transparente = false,
}: EditorPoligonoTaiJiProps) {
  const [pontos, setPontos] = useState<Ponto[]>(pontosIniciais ?? retanguloPadrao(largura, altura))
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
      x: ((e.clientX - rect.left) / rect.width) * largura,
      y: ((e.clientY - rect.top) / rect.height) * altura,
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
    atualizarPontos(retanguloPadrao(largura, altura))
  }

  // Raio dos handles em unidades do viewBox — proporcional, não um pixel fixo:
  // numa foto real de milhares de unidades de largura, um raio fixo de "7" seria invisível.
  const raioVertice = Math.min(largura, altura) * 0.02
  const raioMeio = raioVertice * 0.7
  const raioTaiJi = raioVertice * 0.85
  const larguraTraco = Math.max(1, raioVertice * 0.15)

  const taiJi = calcularTaiJi(pontos)
  const bbox = retanguloDelimitador(pontos)
  const celulas = coberturaPorCelula(pontos)
  const ausentes = setoresAusentes(pontos)
  const extensoes = setoresExtensao(pontos)
  const ehAusente = (linha: number, coluna: number) => ausentes.some(c => c.linha === linha && c.coluna === coluna)
  const ehExtensao = (linha: number, coluna: number) => extensoes.some(c => c.linha === linha && c.coluna === coluna)

  return (
    <div style={transparente ? { width: '100%', height: '100%' } : undefined}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${largura} ${altura}`}
        preserveAspectRatio="none"
        onPointerMove={moverPonteiro}
        onPointerUp={soltarPonteiro}
        onPointerLeave={soltarPonteiro}
        style={transparente ? {
          width: '100%', height: '100%', display: 'block', touchAction: 'none',
        } : {
          width: '100%', maxWidth: '400px', aspectRatio: `${largura} / ${altura}`,
          background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: '8px',
          touchAction: 'none',
        }}
        data-testid="editor-poligono-tai-ji"
      >
        <polygon
          points={pontos.map(p => `${p.x},${p.y}`).join(' ')}
          fill={transparente ? 'rgba(124,58,237,0.15)' : '#E6F2EF'}
          stroke="#2E7D6B"
          strokeWidth={larguraTraco * 1.3}
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
              strokeWidth={larguraTraco} strokeDasharray={`${larguraTraco * 4} ${larguraTraco * 3}`}
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
              cx={meio.x} cy={meio.y} r={raioMeio}
              fill="#fff" stroke="#6FB3A3" strokeWidth={larguraTraco}
              style={{ cursor: 'copy' }}
              onPointerDown={adicionarVerticeNaAresta(i)}
              data-testid={`handle-meio-${i}`}
            />
          )
        })}

        {pontos.map((p, i) => (
          <circle
            key={`vertice-${i}`}
            cx={p.x} cy={p.y} r={raioVertice}
            fill="#2E7D6B" stroke="#fff" strokeWidth={larguraTraco}
            style={{ cursor: 'grab' }}
            onPointerDown={iniciarArrastoVertice(i)}
            onDoubleClick={removerVertice(i)}
            data-testid={`vertice-${i}`}
          />
        ))}

        {taiJi && (
          <circle
            cx={taiJi.centro.x} cy={taiJi.centro.y} r={raioTaiJi}
            fill={taiJi.centroForaDaArea ? '#DC2626' : '#059669'}
            stroke="#fff" strokeWidth={larguraTraco}
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
