'use client'

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { montanhaDoGrau } from '../../src/lib/montanhas'
import { calcularFacingVerdadeiro, type ArestaImagem } from '../../src/lib/orientacao-mapa'
import OverlayAlinhamentoMapa, { type TransformAlinhamento } from './OverlayAlinhamentoMapa'

/**
 * Modo C de orientação (fengshui-metodos-referencia.md §2.4) — alinhar a
 * planta baixa sobre uma imagem de satélite para derivar o facing.
 *
 * IMPORTANTE (ver ADR 0012): a parte de carregamento do Google Maps
 * JavaScript API deste arquivo segue a documentação oficial do produto,
 * mas não foi possível testá-la de ponta a ponta neste ambiente — o
 * sandbox de desenvolvimento não tem uma chave de API real do Google Maps
 * (é uma credencial paga, de responsabilidade do usuário). A interação de
 * mover/rotacionar/escalar a sobreposição (`OverlayAlinhamentoMapa`) e a
 * matemática de derivação do facing (`orientacao-mapa.ts`) foram testadas
 * de forma isolada, sem depender do mapa real. Verificação num deploy real
 * com a chave configurada ainda é necessária antes de confiar cegamente
 * neste modo em produção.
 *
 * Escopo excluído, documentado: os "ganhos extras" do §2.4 (detecção de
 * vias em T, curvas, corpos d'água, prédios vizinhos, mapa de sombra) —
 * são análises de imagem/geoprocessamento por si só, não apenas UI.
 * Conversão magnético↔verdadeiro (WMM/IGRF) também não está implementada
 * em lugar nenhum do app ainda (mesmo gap já registrado no Modo A) — o
 * resultado deste modo é entregue como Norte VERDADEIRO, rotulado como tal.
 */

type Estado = 'sem-chave' | 'entrada' | 'geocodificando' | 'erro-geocodificacao' | 'alinhando' | 'resultado'

interface GoogleLatLngLiteral { lat: number; lng: number }
interface GoogleMapInstance {
  setTilt(tilt: number): void
  setHeading(heading: number): void
}
interface GoogleGeocoderResult { geometry: { location: { lat(): number; lng(): number } } }
interface GoogleGeocoder {
  geocode(
    request: { address: string },
    callback: (results: GoogleGeocoderResult[] | null, status: string) => void,
  ): void
}
interface GoogleMapsNamespace {
  Map: new (el: HTMLElement, opts: Record<string, unknown>) => GoogleMapInstance
  Geocoder: new () => GoogleGeocoder
}
declare global {
  interface Window { google?: { maps: GoogleMapsNamespace } }
}

const ZOOM_SATELITE = 20

let carregamentoEmAndamento: Promise<GoogleMapsNamespace> | null = null

function carregarGoogleMaps(apiKey: string): Promise<GoogleMapsNamespace> {
  if (window.google?.maps) return Promise.resolve(window.google.maps)
  if (carregamentoEmAndamento) return carregamentoEmAndamento
  carregamentoEmAndamento = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly`
    script.async = true
    script.onload = () => {
      if (window.google?.maps) resolve(window.google.maps)
      else reject(new Error('Google Maps carregou sem expor window.google.maps'))
    }
    script.onerror = () => reject(new Error('Falha ao carregar o script do Google Maps'))
    document.head.appendChild(script)
  })
  return carregamentoEmAndamento
}

const ROTULO_ARESTA: Record<ArestaImagem, string> = {
  topo: 'Topo da foto', direita: 'Direita da foto', baixo: 'Base da foto', esquerda: 'Esquerda da foto',
}

export interface MapaAlinhamentoProps {
  imagemUrl: string
  onAceitar: (grausVerdadeiros: number) => void
}

export default function MapaAlinhamento({ imagemUrl, onAceitar }: MapaAlinhamentoProps) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  const [estado, setEstado] = useState<Estado>(apiKey ? 'entrada' : 'sem-chave')
  const [endereco, setEndereco] = useState('')
  const [erro, setErro] = useState('')
  const [transform, setTransform] = useState<TransformAlinhamento>({ x: 0, y: 0, escala: 1, rotacaoGraus: 0 })
  const [aresta, setAresta] = useState<ArestaImagem>('topo')
  const mapaDivRef = useRef<HTMLDivElement>(null)
  const mapaRef = useRef<GoogleMapInstance | null>(null)

  const centralizarMapa = useCallback(async (centro: GoogleLatLngLiteral) => {
    if (!apiKey || !mapaDivRef.current) return
    try {
      const maps = await carregarGoogleMaps(apiKey)
      const mapa = new maps.Map(mapaDivRef.current, {
        center: centro, zoom: ZOOM_SATELITE, mapTypeId: 'satellite',
        tilt: 0, heading: 0, disableDefaultUI: true, gestureHandling: 'greedy',
      })
      mapaRef.current = mapa
      // Salvaguarda: em alguns zooms o Google troca automaticamente para imagem oblíqua (45°),
      // o que quebraria a premissa "para cima = Norte verdadeiro". Força de volta sempre que mudar.
      mapa.setTilt(0)
      mapa.setHeading(0)
      setEstado('alinhando')
    } catch {
      setErro('Não foi possível carregar o mapa. Verifique a chave de API e a conexão.')
      setEstado('erro-geocodificacao')
    }
  }, [apiKey])

  const geocodificar = useCallback(async () => {
    if (!apiKey || endereco.trim() === '') return
    setEstado('geocodificando'); setErro('')
    try {
      const maps = await carregarGoogleMaps(apiKey)
      const geocoder = new maps.Geocoder()
      geocoder.geocode({ address: endereco }, (results, status) => {
        if (status === 'OK' && results && results[0]) {
          const loc = results[0].geometry.location
          centralizarMapa({ lat: loc.lat(), lng: loc.lng() })
        } else {
          setErro('Endereço não encontrado. Tente incluir cidade/estado, ou use sua localização atual.')
          setEstado('erro-geocodificacao')
        }
      })
    } catch {
      setErro('Não foi possível carregar o serviço de geocodificação do Google Maps.')
      setEstado('erro-geocodificacao')
    }
  }, [apiKey, endereco, centralizarMapa])

  function usarLocalizacaoAtual() {
    if (!navigator.geolocation) { setErro('Este navegador não expõe geolocalização.'); setEstado('erro-geocodificacao'); return }
    setEstado('geocodificando'); setErro('')
    navigator.geolocation.getCurrentPosition(
      pos => centralizarMapa({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => { setErro('Não foi possível obter sua localização — permissão negada ou indisponível.'); setEstado('erro-geocodificacao') },
    )
  }

  useEffect(() => {
    if (estado !== 'alinhando' || !mapaRef.current) return
    // Reforça tilt/heading=0 sempre que este painel estiver ativo (defesa contra o auto-tilt do Google).
    const id = setInterval(() => { mapaRef.current?.setTilt(0); mapaRef.current?.setHeading(0) }, 1000)
    return () => clearInterval(id)
  }, [estado])

  const facingVerdadeiro = calcularFacingVerdadeiro(aresta, transform.rotacaoGraus)
  const montanha = montanhaDoGrau(facingVerdadeiro)

  if (estado === 'sem-chave') {
    return (
      <div style={estiloAviso}>
        Modo mapa/satélite não configurado nesta instalação (falta <code>NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code>). Use entrada manual ou a bússola virtual.
      </div>
    )
  }

  return (
    <div style={{ marginTop: '8px' }}>
      {(estado === 'entrada' || estado === 'geocodificando' || estado === 'erro-geocodificacao') && (
        <div style={{ padding: '8px', background: '#EEF6F3', borderRadius: '6px', border: '1px solid #CFE6E0' }}>
          <p style={{ margin: '0 0 6px', fontSize: '11px', color: '#374151' }}>Endereço do imóvel (para centralizar o satélite):</p>
          <div style={{ display: 'flex', gap: '5px', marginBottom: '6px' }}>
            <input type="text" value={endereco} onChange={e => setEndereco(e.target.value)} placeholder="Rua, número, cidade, estado"
              style={{ flex: 1, padding: '5px 8px', border: '1px solid #D1D5DB', borderRadius: '5px', fontSize: '11px' }} />
            <button type="button" onClick={geocodificar} disabled={estado === 'geocodificando'} style={estiloBotaoPrimario}>Buscar</button>
          </div>
          <button type="button" onClick={usarLocalizacaoAtual} disabled={estado === 'geocodificando'} style={estiloBotaoSecundario}>📍 Usar minha localização atual</button>
          {estado === 'geocodificando' && <p style={{ margin: '6px 0 0', fontSize: '11px', color: '#6B7280' }}>Buscando…</p>}
          {estado === 'erro-geocodificacao' && <p style={{ margin: '6px 0 0', fontSize: '11px', color: '#B4533A' }}>{erro}</p>}
        </div>
      )}

      {(estado === 'alinhando' || estado === 'resultado') && (
        <div>
          <div style={{ position: 'relative', width: '100%', height: '320px', borderRadius: '7px', overflow: 'hidden', border: '1px solid #D1D5DB' }}>
            <div ref={mapaDivRef} style={{ position: 'absolute', inset: 0 }} data-testid="mapa-satelite" />
            <OverlayAlinhamentoMapa imagemUrl={imagemUrl} onChange={setTransform} />
          </div>
          <div style={{ marginTop: '8px', padding: '8px', background: '#EEF6F3', borderRadius: '6px', border: '1px solid #CFE6E0', fontSize: '11px', color: '#374151' }}>
            <p style={{ margin: '0 0 5px', fontWeight: 'bold' }}>Qual aresta da foto ORIGINAL (antes de girar) é a fachada?</p>
            <div style={{ display: 'flex', gap: '4px', marginBottom: '8px' }}>
              {(['topo', 'direita', 'baixo', 'esquerda'] as ArestaImagem[]).map(a => (
                <button key={a} type="button" onClick={() => setAresta(a)} style={{
                  flex: 1, padding: '4px 2px', fontSize: '10px', fontWeight: 'bold', borderRadius: '5px', cursor: 'pointer',
                  border: '1px solid', borderColor: aresta === a ? '#2E7D6B' : '#D1D5DB',
                  background: aresta === a ? '#E6F2EF' : '#fff', color: aresta === a ? '#2E7D6B' : '#6B7280',
                }}>{ROTULO_ARESTA[a]}</button>
              ))}
            </div>
            <p style={{ margin: '0 0 4px' }}>
              Facing (Norte <strong>verdadeiro</strong>, não magnético): <strong>{facingVerdadeiro.toFixed(1)}°</strong>
            </p>
            <p style={{ margin: '0 0 6px', color: '#245F52' }}>Montanha {montanha.pinyin} {montanha.nome} ({montanha.setor})</p>
            <p style={{ margin: '0 0 8px', fontSize: '10px', color: '#9CA3AF' }}>
              Este valor não corrige a declinação magnética (diferença real entre Norte verdadeiro e magnético, ~8–23° no Brasil). Se precisar do valor magnético clássico, confirme com bússola física.
            </p>
            <button type="button" onClick={() => onAceitar(facingVerdadeiro)} style={estiloBotaoPrimario}>Usar esta leitura</button>
          </div>
        </div>
      )}
    </div>
  )
}

const estiloAviso: CSSProperties = {
  marginTop: '8px', padding: '8px 10px', background: '#F3F4F6', borderRadius: '6px',
  fontSize: '11px', color: '#6B7280', border: '1px solid #E5E7EB',
}
const estiloBotaoPrimario: CSSProperties = {
  padding: '5px 12px', background: '#2E7D6B', color: '#fff', border: 'none', borderRadius: '5px',
  fontSize: '11px', fontWeight: 'bold', cursor: 'pointer',
}
const estiloBotaoSecundario: CSSProperties = {
  padding: '5px 12px', background: '#F3F4F6', color: '#374151', border: '1px solid #D1D5DB', borderRadius: '5px',
  fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', width: '100%',
}
