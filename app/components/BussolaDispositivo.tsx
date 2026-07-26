'use client'

import { useEffect, useState, type CSSProperties } from 'react'
import { normalizarGraus } from '../../src/lib/graus'
import { montanhaDoGrau } from '../../src/lib/montanhas'
import { processarAmostrasBussola, type ResultadoAmostragemBussola } from '../../src/lib/bussola-dispositivo'

/**
 * Bússola virtual (Modo B de orientação, fengshui-metodos-referencia.md
 * §2.3) — lê o magnetômetro do dispositivo via `DeviceOrientationEvent` e
 * entrega uma leitura de fachada, com o fluxo de calibração/amostragem/
 * confiança descrito no documento. Componente de UI puro: toda a
 * matemática de outlier/confiança mora em `src/lib/bussola-dispositivo.ts`
 * (testável sem simular eventos de sensor).
 *
 * Reversão deliberada de uma decisão de produto anterior (ver ADR 0011):
 * o MVP da Bússola havia optado por NÃO usar o sensor, por inconsistência
 * real entre navegadores/iOS. Este componente existe para reduzir esse
 * risco, não para escondê-lo: nunca afirma equivalência com um Luo Pan
 * físico, bloqueia o uso da leitura quando o desvio é alto, e se recusa a
 * fingir uma leitura de bússola quando o navegador só expõe orientação
 * RELATIVA (sem `absolute`/`webkitCompassHeading`) — nesse caso o valor
 * não é Norte de verdade, e apresentá-lo enganaria o consultor.
 *
 * Escopo excluído, documentado: detecção de interferência magnética por
 * magnitude do campo (µT) — exigiria a Generic Sensor API `Magnetometer`,
 * com suporte de navegador atualmente raro demais para valer a pena.
 */

type Estado =
  | 'inicial' | 'nao-suportado' | 'solicitando-permissao' | 'permissao-negada'
  | 'calibrando' | 'amostrando' | 'sem-heading-absoluto' | 'resultado'

const DURACAO_CALIBRACAO_MS = 3000
const DURACAO_AMOSTRAGEM_MS = 5000
const RAIO_EXTERNO = 90
const RAIO_INTERNO = 74
const CENTRO = 100

function anguloParaXY(headingGraus: number, raio: number): { x: number; y: number } {
  const rad = (headingGraus * Math.PI) / 180
  return { x: CENTRO + raio * Math.sin(rad), y: CENTRO - raio * Math.cos(rad) }
}

function arcoSetor(faixaInicioGraus: number, raioInterno: number, raioExterno: number): string {
  const a0 = faixaInicioGraus, a1 = faixaInicioGraus + 15
  const p0ext = anguloParaXY(a0, raioExterno), p1ext = anguloParaXY(a1, raioExterno)
  const p1int = anguloParaXY(a1, raioInterno), p0int = anguloParaXY(a0, raioInterno)
  return `M ${p0ext.x} ${p0ext.y} A ${raioExterno} ${raioExterno} 0 0 1 ${p1ext.x} ${p1ext.y} L ${p1int.x} ${p1int.y} A ${raioInterno} ${raioInterno} 0 0 0 ${p0int.x} ${p0int.y} Z`
}

const LABELS_MAJOR: [string, number][] = [['N', 0], ['NE', 45], ['E', 90], ['SE', 135], ['S', 180], ['SW', 225], ['W', 270], ['NW', 315]]

const TEXTO_CONFIANCA: Record<'high' | 'medium' | 'low', { rotulo: string; cor: string }> = {
  high: { rotulo: 'Alta confiança', cor: '#15803D' },
  medium: { rotulo: 'Confiança média', cor: '#D97706' },
  low: { rotulo: 'Confiança baixa', cor: '#DC2626' },
}

export interface BussolaDispositivoProps {
  onAceitar: (graus: number) => void
}

export default function BussolaDispositivo({ onAceitar }: BussolaDispositivoProps) {
  // Este componente só é montado no cliente, sob demanda (o painel de configuração parte fechado
  // e nunca aparece no HTML do SSR) — checar `window` já no estado inicial é seguro, sem risco de
  // mismatch de hidratação, e evita precisar de um efeito só para essa checagem síncrona.
  const [estado, setEstado] = useState<Estado>(() => (
    typeof window !== 'undefined' && 'DeviceOrientationEvent' in window ? 'inicial' : 'nao-suportado'
  ))
  const [ultimaLeitura, setUltimaLeitura] = useState<number | null>(null)
  const [resultado, setResultado] = useState<ResultadoAmostragemBussola | null>(null)

  useEffect(() => {
    if (estado !== 'calibrando') return
    const t = setTimeout(() => setEstado('amostrando'), DURACAO_CALIBRACAO_MS)
    return () => clearTimeout(t)
  }, [estado])

  useEffect(() => {
    if (estado !== 'amostrando') return
    const amostras: number[] = []
    let recebeuAbsoluto = false

    function onOrientacao(e: DeviceOrientationEvent) {
      const anyE = e as DeviceOrientationEvent & { webkitCompassHeading?: number }
      let heading: number | null = null
      if (typeof anyE.webkitCompassHeading === 'number') {
        // iOS Safari: já é heading de bússola absoluto (sentido horário a partir do Norte).
        heading = anyE.webkitCompassHeading
      } else if (e.absolute && typeof e.alpha === 'number') {
        // Android/outros: alpha cresce anti-horário a partir do Norte quando absolute=true.
        heading = 360 - e.alpha
      }
      // Sem absolute/webkitCompassHeading, `alpha` é orientação RELATIVA ao ponto de partida do
      // dispositivo — não é Norte. Descartar em vez de apresentar como bússola (enganaria o consultor).
      if (heading === null) return
      recebeuAbsoluto = true
      const normalizado = normalizarGraus(heading)
      amostras.push(normalizado)
      setUltimaLeitura(normalizado)
    }

    window.addEventListener('deviceorientation', onOrientacao)
    const t = setTimeout(() => {
      window.removeEventListener('deviceorientation', onOrientacao)
      if (!recebeuAbsoluto) { setEstado('sem-heading-absoluto'); return }
      setResultado(processarAmostrasBussola(amostras))
      setEstado('resultado')
    }, DURACAO_AMOSTRAGEM_MS)

    return () => { window.removeEventListener('deviceorientation', onOrientacao); clearTimeout(t) }
  }, [estado])

  async function iniciar() {
    const DOE = window.DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<'granted' | 'denied'> }
    if (typeof DOE?.requestPermission === 'function') {
      setEstado('solicitando-permissao')
      try {
        const resposta = await DOE.requestPermission()
        setEstado(resposta === 'granted' ? 'calibrando' : 'permissao-negada')
      } catch {
        setEstado('permissao-negada')
      }
    } else {
      setEstado('calibrando')
    }
  }

  function reiniciar() {
    setUltimaLeitura(null); setResultado(null); setEstado('inicial')
  }

  const headingExibido = estado === 'resultado' ? resultado?.media ?? null : ultimaLeitura
  const montanhaAtual = headingExibido !== null ? montanhaDoGrau(headingExibido) : null

  return (
    <div style={{ marginTop: '8px', padding: '10px', background: '#fff', borderRadius: '7px', border: '1px solid #E5E7EB' }}>
      <div style={{ display: 'flex', gap: '14px', alignItems: 'center', flexWrap: 'wrap' }}>
        {/* viewBox com margem de 12 além do círculo (0–200): os rótulos N/E/S/W ficam no raio
            RAIO_EXTERNO+10=100, exatamente na borda de um viewBox 0–200 — sem a margem, ficam cortados. */}
        <svg viewBox="-12 -12 224 224" width="140" height="140" style={{ flexShrink: 0 }} data-testid="bussola-svg">
          <circle cx={CENTRO} cy={CENTRO} r={RAIO_EXTERNO} fill="#F9FAFB" stroke="#D1D5DB" />
          {Array.from({ length: 24 }, (_, i) => i * 15).map(g => {
            const p0 = anguloParaXY(g, RAIO_EXTERNO), p1 = anguloParaXY(g, g % 45 === 0 ? RAIO_INTERNO - 6 : RAIO_INTERNO + 2)
            return <line key={g} x1={p0.x} y1={p0.y} x2={p1.x} y2={p1.y} stroke="#9CA3AF" strokeWidth={g % 45 === 0 ? 1.4 : 0.7} />
          })}
          {montanhaAtual && estado === 'resultado' && (
            <path d={arcoSetor(montanhaAtual.faixaInicio, RAIO_INTERNO, RAIO_EXTERNO)} fill="rgba(124,58,237,0.35)" data-testid="bussola-setor-atual" />
          )}
          {LABELS_MAJOR.map(([lbl, g]) => {
            const p = anguloParaXY(g, RAIO_EXTERNO + 10)
            return <text key={lbl} x={p.x} y={p.y} fontSize="11" fontWeight="bold" fill="#374151" textAnchor="middle" dominantBaseline="middle">{lbl}</text>
          })}
          {headingExibido !== null && (()=> {
            const ponta = anguloParaXY(headingExibido, RAIO_INTERNO - 10)
            return <line x1={CENTRO} y1={CENTRO} x2={ponta.x} y2={ponta.y} stroke="#DC2626" strokeWidth={2.5} data-testid="bussola-agulha" />
          })()}
          <circle cx={CENTRO} cy={CENTRO} r={3} fill="#374151" />
        </svg>

        <div style={{ flex: 1, minWidth: '180px', fontSize: '11px', color: '#374151' }}>
          {estado === 'inicial' && (
            <>
              <p style={{ margin: '0 0 6px' }}>Lê o magnetômetro do celular/tablet para estimar a direção da fachada.</p>
              <button type="button" onClick={iniciar} style={estiloBotaoPrimario}>🧭 Iniciar bússola virtual</button>
            </>
          )}
          {estado === 'nao-suportado' && (
            <p style={{ margin: 0, color: '#DC2626' }}>Este navegador/dispositivo não expõe sensor de orientação. Use entrada manual.</p>
          )}
          {estado === 'solicitando-permissao' && <p style={{ margin: 0 }}>Aguardando permissão de acesso ao sensor de movimento…</p>}
          {estado === 'permissao-negada' && (
            <>
              <p style={{ margin: '0 0 6px', color: '#DC2626' }}>Permissão negada. Ative o acesso a sensores de movimento nas configurações do navegador para usar a bússola virtual.</p>
              <button type="button" onClick={reiniciar} style={estiloBotaoSecundario}>Tentar novamente</button>
            </>
          )}
          {estado === 'calibrando' && (
            <>
              <p style={{ margin: '0 0 4px', fontWeight: 'bold' }}>Calibrando…</p>
              <p style={{ margin: 0 }}>Segure o aparelho na horizontal e mova-o lentamente em forma de <strong>oito</strong> por alguns segundos.</p>
            </>
          )}
          {estado === 'amostrando' && (
            <>
              <p style={{ margin: '0 0 4px', fontWeight: 'bold' }}>Lendo… mantenha o aparelho parado, encostado na fachada.</p>
              {ultimaLeitura !== null && <p style={{ margin: 0 }}>Leitura atual: <strong>{ultimaLeitura.toFixed(0)}°</strong></p>}
            </>
          )}
          {estado === 'sem-heading-absoluto' && (
            <>
              <p style={{ margin: '0 0 6px', color: '#DC2626' }}>
                Este navegador só expõe orientação relativa (sem referência de Norte confiável) — não é seguro usar como bússola. Use entrada manual ou tente em outro navegador/aparelho.
              </p>
              <button type="button" onClick={reiniciar} style={estiloBotaoSecundario}>Tentar novamente</button>
            </>
          )}
          {estado === 'resultado' && resultado?.media != null && resultado.confianca && montanhaAtual && (
            <>
              <p style={{ margin: '0 0 3px' }}>
                Leitura: <strong>{resultado.media.toFixed(1)}°</strong> · desvio <strong>{resultado.desvio?.toFixed(1)}°</strong>
              </p>
              <p style={{ margin: '0 0 3px', color: TEXTO_CONFIANCA[resultado.confianca].cor, fontWeight: 'bold' }}>
                {TEXTO_CONFIANCA[resultado.confianca].rotulo}
                {resultado.amostrasDescartadas > 0 && ` · ${resultado.amostrasDescartadas} amostra(s) descartada(s) de ${resultado.amostrasTotais}`}
              </p>
              <p style={{ margin: '0 0 6px', color: '#6D28D9' }}>
                Montanha <strong>{montanhaAtual.pinyin} {montanhaAtual.nome}</strong> ({montanhaAtual.setor})
              </p>
              {resultado.confianca === 'low' ? (
                <>
                  <p style={{ margin: '0 0 6px', color: '#DC2626' }}>Desvio alto demais — não é seguro usar esta leitura. Repita, use o assistente de 3 leituras ou meça com um Luo Pan físico.</p>
                  <button type="button" onClick={reiniciar} style={estiloBotaoSecundario}>Tentar novamente</button>
                </>
              ) : (
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button type="button" onClick={() => onAceitar(resultado.media as number)} style={estiloBotaoPrimario}>Usar esta leitura</button>
                  <button type="button" onClick={reiniciar} style={estiloBotaoSecundario}>Repetir</button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
      <p style={{ margin: '8px 0 0', fontSize: '10px', color: '#9CA3AF' }}>
        Aproximação por sensor do navegador — não substitui um Luo Pan físico. Para uso profissional, valide com instrumento físico.
      </p>
    </div>
  )
}

const estiloBotaoPrimario: CSSProperties = {
  padding: '5px 12px', background: '#7C3AED', color: '#fff', border: 'none', borderRadius: '5px',
  fontSize: '11px', fontWeight: 'bold', cursor: 'pointer',
}
const estiloBotaoSecundario: CSSProperties = {
  padding: '5px 12px', background: '#F3F4F6', color: '#374151', border: '1px solid #D1D5DB', borderRadius: '5px',
  fontSize: '11px', fontWeight: 'bold', cursor: 'pointer',
}
