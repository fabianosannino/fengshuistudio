'use client'

import { useRef } from 'react'
import { normalizarGraus } from '../../src/lib/graus'
import { montanhaDoGrau, MONTANHAS } from '../../src/lib/montanhas'

/**
 * Rosa dos ventos com o anel das 24 Montanhas — visualização (e opcionalmente
 * ENTRADA) de uma orientação em graus.
 *
 * Extraída de `BussolaDispositivo` para ser reutilizada na entrada manual
 * (Modo A): mexer em graus só com campo numérico e botões de octante não dá
 * noção de posição, que é justamente o que uma bússola comunica.
 *
 * Quando `onChange` é fornecido, a rosa fica interativa: clicar ou arrastar
 * define o ângulo. O ângulo vem de `atan2` do ponto em relação ao centro, com
 * a mesma convenção de bússola do resto do sistema (0° = Norte = para cima,
 * crescendo no sentido horário).
 */

const CENTRO = 100
const RAIO_EXTERNO = 90
const RAIO_INTERNO = 74
const VIEWBOX_MARGEM = 14

const LABELS_MAJOR: [string, number][] = [
  ['N', 0], ['NE', 45], ['E', 90], ['SE', 135], ['S', 180], ['SW', 225], ['W', 270], ['NW', 315],
]

function anguloParaXY(graus: number, raio: number): { x: number; y: number } {
  const rad = (graus * Math.PI) / 180
  return { x: CENTRO + raio * Math.sin(rad), y: CENTRO - raio * Math.cos(rad) }
}

/** Setor de 15° (uma Montanha) como path SVG, para destacar a Montanha corrente. */
function arcoMontanha(faixaInicioGraus: number): string {
  const a0 = faixaInicioGraus, a1 = faixaInicioGraus + 15
  const p0e = anguloParaXY(a0, RAIO_EXTERNO), p1e = anguloParaXY(a1, RAIO_EXTERNO)
  const p1i = anguloParaXY(a1, RAIO_INTERNO), p0i = anguloParaXY(a0, RAIO_INTERNO)
  return `M ${p0e.x} ${p0e.y} A ${RAIO_EXTERNO} ${RAIO_EXTERNO} 0 0 1 ${p1e.x} ${p1e.y} `
    + `L ${p1i.x} ${p1i.y} A ${RAIO_INTERNO} ${RAIO_INTERNO} 0 0 0 ${p0i.x} ${p0i.y} Z`
}

export interface RosaDosVentosProps {
  graus: number
  /** Quando presente, a rosa aceita clique/arraste para definir o ângulo. */
  onChange?: (graus: number) => void
  /** Lado em px. Padrão 150. */
  tamanho?: number
  /** Destaca a faixa de 15° da Montanha corrente. Padrão true. */
  destacarMontanha?: boolean
  /**
   * Escreve o pinyin das 24 Montanhas no anel, cada um girado para acompanhar
   * a circunferência. Só faz sentido a partir de ~200px: abaixo disso o texto
   * fica ilegível (24 rótulos em 360°). Padrão false.
   */
  mostrarNomesMontanhas?: boolean
}

export default function RosaDosVentos({
  graus, onChange, tamanho = 150, destacarMontanha = true, mostrarNomesMontanhas = false,
}: RosaDosVentosProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const arrastandoRef = useRef(false)
  const interativo = typeof onChange === 'function'

  const montanha = montanhaDoGrau(graus)

  /**
   * Converte a posição do ponteiro em graus de bússola.
   * Usa getBoundingClientRect + as proporções do viewBox, então funciona em
   * qualquer tamanho renderizado sem conta manual de escala.
   */
  function grausDoPonteiro(e: { clientX: number; clientY: number }): number {
    const svg = svgRef.current
    if (!svg) return graus
    const r = svg.getBoundingClientRect()
    const lado = VIEWBOX_MARGEM * 2 + 200
    // Ponto do ponteiro nas coordenadas do viewBox.
    const x = ((e.clientX - r.left) / r.width) * lado - VIEWBOX_MARGEM
    const y = ((e.clientY - r.top) / r.height) * lado - VIEWBOX_MARGEM
    const dx = x - CENTRO
    const dy = y - CENTRO
    // atan2(dx, -dy): 0° para cima (Norte), crescendo no sentido horário —
    // a mesma convenção de bússola usada em todo o sistema.
    return normalizarGraus((Math.atan2(dx, -dy) * 180) / Math.PI)
  }

  function aoApontar(e: React.PointerEvent) {
    if (!interativo) return
    e.currentTarget.setPointerCapture(e.pointerId)
    arrastandoRef.current = true
    onChange!(grausDoPonteiro(e))
  }

  function aoMover(e: React.PointerEvent) {
    if (!interativo || !arrastandoRef.current) return
    onChange!(grausDoPonteiro(e))
  }

  function aoSoltar(e: React.PointerEvent) {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
    arrastandoRef.current = false
  }

  const ponta = anguloParaXY(graus, RAIO_INTERNO - 10)

  return (
    <svg
      ref={svgRef}
      viewBox={`${-VIEWBOX_MARGEM} ${-VIEWBOX_MARGEM} ${VIEWBOX_MARGEM * 2 + 200} ${VIEWBOX_MARGEM * 2 + 200}`}
      width={tamanho}
      height={tamanho}
      onPointerDown={aoApontar}
      onPointerMove={aoMover}
      onPointerUp={aoSoltar}
      onPointerCancel={aoSoltar}
      style={{
        flexShrink: 0,
        cursor: interativo ? 'grab' : 'default',
        touchAction: 'none',
        userSelect: 'none',
      }}
      data-testid="rosa-dos-ventos"
      role={interativo ? 'slider' : 'img'}
      aria-label={interativo
        ? `Orientação da fachada: ${graus.toFixed(1)} graus, Montanha ${montanha.pinyin}. Arraste para ajustar.`
        : `Orientação: ${graus.toFixed(1)} graus, Montanha ${montanha.pinyin}`}
      aria-valuenow={interativo ? Math.round(graus) : undefined}
      aria-valuemin={interativo ? 0 : undefined}
      aria-valuemax={interativo ? 359 : undefined}
    >
      <circle cx={CENTRO} cy={CENTRO} r={RAIO_EXTERNO} fill="#F9FAFB" stroke="#D1D5DB" />

      {/* Faixa da Montanha corrente (15°) */}
      {destacarMontanha && (
        <path d={arcoMontanha(montanha.faixaInicio)} fill="rgba(124,58,237,0.35)" data-testid="rosa-montanha-atual" />
      )}

      {/* Anel das 24 Montanhas: um tique por faixa de 15°, maiores nos 45° */}
      {MONTANHAS.map(m => {
        const ehOctante = m.faixaInicio % 45 === 0
        const p0 = anguloParaXY(m.faixaInicio, RAIO_EXTERNO)
        const p1 = anguloParaXY(m.faixaInicio, ehOctante ? RAIO_INTERNO - 6 : RAIO_INTERNO + 2)
        return (
          <line key={m.numero} x1={p0.x} y1={p0.y} x2={p1.x} y2={p1.y}
            stroke="#9CA3AF" strokeWidth={ehOctante ? 1.4 : 0.7} />
        )
      })}

      {/* Pinyin das 24 Montanhas dentro da faixa do anel, girado para acompanhar
          a circunferência (como num Luo Pan). O meio de cada faixa é faixaInicio+7,5. */}
      {mostrarNomesMontanhas && MONTANHAS.map(m => {
        const meio = normalizarGraus(m.faixaInicio + 7.5)
        const raioTexto = (RAIO_INTERNO + RAIO_EXTERNO) / 2
        // Na metade inferior (90°–270°) o giro do anel deixaria o texto de cabeça
        // para baixo. Num Luo Pan físico isso é normal — você gira o instrumento —
        // mas na tela não dá, então esses rótulos levam +180° e são posicionados
        // do outro lado do centro para continuarem na mesma faixa.
        const invertido = meio > 90 && meio < 270
        const rotacao = invertido ? meio + 180 : meio
        const y = invertido ? CENTRO + raioTexto : CENTRO - raioTexto
        return (
          <text
            key={`nome-${m.numero}`}
            x={CENTRO} y={y}
            fontSize="6" fill="#4B5563" textAnchor="middle" dominantBaseline="middle"
            transform={`rotate(${rotacao} ${CENTRO} ${CENTRO})`}
            style={{ pointerEvents: 'none' }}
          >
            {m.pinyin}
          </text>
        )
      })}

      {LABELS_MAJOR.map(([lbl, g]) => {
        const p = anguloParaXY(g, RAIO_EXTERNO + 10)
        return (
          <text key={lbl} x={p.x} y={p.y} fontSize="11" fontWeight="bold" fill="#374151"
            textAnchor="middle" dominantBaseline="middle">{lbl}</text>
        )
      })}

      {/* Agulha */}
      <line x1={CENTRO} y1={CENTRO} x2={ponta.x} y2={ponta.y}
        stroke="#DC2626" strokeWidth={2.5} data-testid="rosa-agulha" />
      {interativo && (
        <circle cx={ponta.x} cy={ponta.y} r={5} fill="#DC2626" stroke="#fff" strokeWidth={1.5}
          style={{ cursor: 'grab' }} data-testid="rosa-alca" />
      )}
      <circle cx={CENTRO} cy={CENTRO} r={3} fill="#374151" />
    </svg>
  )
}
