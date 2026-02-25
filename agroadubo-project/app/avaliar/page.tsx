'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { PlantInfo, RegiaoInfo, SoloInfo, ProducaoInfo, ProblemaInfo, Resultado, AIIdentificationResult } from '../lib/types'
import { PLANT_DATABASE, REGIOES, TIPOS_SOLO, TIPOS_PRODUCAO, PROBLEMAS } from '../lib/data'
import { gerarRecomendacao } from '../lib/recommendation-engine'

export default function PlantasPage() {
  const [step, setStep] = useState(0)
  const [plantaSelecionada, setPlantaSelecionada] = useState<PlantInfo | null>(null)
  const [regiaoSelecionada, setRegiaoSelecionada] = useState<RegiaoInfo | null>(null)
  const [soloSelecionado, setSoloSelecionado] = useState<SoloInfo | null>(null)
  const [producaoSelecionada, setProducaoSelecionada] = useState<ProducaoInfo | null>(null)
  const [problemasSelecionados, setProblemasSelecionados] = useState<ProblemaInfo[]>([])
  const [resultado, setResultado] = useState<Resultado | null>(null)
  const [busca, setBusca] = useState('')
  const [fotoPreview, setFotoPreview] = useState<string | null>(null)
  const [identificando, setIdentificando] = useState(false)
  const [geolocalizando, setGeolocalizando] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [darkMode, setDarkMode] = useState(false)
  const [aiResult, setAiResult] = useState<AIIdentificationResult | null>(null)
  const [aiError, setAiError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [transitioning, setTransitioning] = useState(false)
  const [slideDirection, setSlideDirection] = useState<'left' | 'right'>('left')
  const [activeResultTab, setActiveResultTab] = useState<'tubete' | 'adubos' | 'solo' | 'manejo' | 'resumo'>('tubete')
  const [cameraActive, setCameraActive] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)

  useEffect(() => {
    const saved = localStorage.getItem('agroadubo-dark')
    if (saved === 'true') setDarkMode(true)
  }, [])

  // Cleanup camera stream when component unmounts or step changes
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track: MediaStreamTrack) => track.stop())
      streamRef.current = null
    }
    setCameraActive(false)
    setCameraError(null)
  }, [])

  useEffect(() => {
    return () => { stopCamera() }
  }, [stopCamera])

  async function startCamera() {
    setCameraError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      })
      streamRef.current = stream
      setCameraActive(true)
      // Wait for video ref to be rendered
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.play()
        }
      }, 100)
    } catch (err) {
      const error = err as Error
      if (error.name === 'NotAllowedError') {
        setCameraError('Permissao para camera negada. Habilite nas configuracoes do navegador.')
      } else if (error.name === 'NotFoundError') {
        setCameraError('Nenhuma camera encontrada neste dispositivo.')
      } else {
        setCameraError('Nao foi possivel acessar a camera. Tente enviar uma foto do arquivo.')
      }
    }
  }

  function captureFromCamera() {
    if (!videoRef.current) return
    const video = videoRef.current
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(video, 0, 0)
    const base64 = canvas.toDataURL('image/jpeg', 0.8)
    stopCamera()
    // Process the captured image
    processImage(base64)
  }

  async function processImage(base64: string) {
    setFotoPreview(base64)
    setIdentificando(true)
    setAiError(null)
    setAiResult(null)

    try {
      const compressed = await compressImage(base64)
      const response = await fetch('/api/identify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: compressed }),
      })

      const data = await response.json()

      if (!response.ok) {
        setAiError(data.error || 'Erro ao identificar a planta')
        setIdentificando(false)
        return
      }

      setAiResult(data)

      if (data.identified && data.plantId && data.confidence >= 0.7) {
        const matched = PLANT_DATABASE.find(p => p.id === data.plantId)
        if (matched) setPlantaSelecionada(matched)
      }
    } catch {
      setAiError('Falha na conexao. Verifique sua internet e tente novamente.')
    } finally {
      setIdentificando(false)
    }
  }

  const t = {
    bg: darkMode ? '#0f172a' : '#F9FAFB',
    card: darkMode ? '#1e293b' : '#ffffff',
    text: darkMode ? '#e2e8f0' : '#111827',
    textSoft: darkMode ? '#94a3b8' : '#6B7280',
    border: darkMode ? '#334155' : '#E5E7EB',
    accent: '#16a34a',
    accentLight: darkMode ? 'rgba(22, 163, 74, 0.15)' : 'rgba(22, 163, 74, 0.08)',
    accentBorder: darkMode ? 'rgba(22, 163, 74, 0.4)' : 'rgba(22, 163, 74, 0.25)',
  }

  const STEPS = ['Identificar Planta', 'Regiao', 'Tipo de Solo', 'Tipo de Producao', 'Problemas', 'Resultado']

  function compressImage(base64: string, maxWidth: number = 800): Promise<string> {
    return new Promise((resolve) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const ratio = Math.min(maxWidth / img.width, maxWidth / img.height, 1)
        canvas.width = img.width * ratio
        canvas.height = img.height * ratio
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/jpeg', 0.7))
      }
      img.src = base64
    })
  }

  async function handleFotoCaptura(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 5 * 1024 * 1024) {
      setAiError('Imagem muito grande. Maximo 5MB.')
      return
    }

    const reader = new FileReader()
    reader.onloadend = async () => {
      const base64 = reader.result as string
      processImage(base64)
    }
    reader.readAsDataURL(file)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file && file.type.startsWith('image/')) {
      const syntheticEvent = { target: { files: [file] } } as unknown as React.ChangeEvent<HTMLInputElement>
      handleFotoCaptura(syntheticEvent)
    }
  }

  function handleGeolocalizar() {
    setGeolocalizando(true)
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude
          let regiao
          if (lat < -5) {
            if (lat > -15) regiao = REGIOES.find(r => r.id === 'nordeste')
            else if (lat > -20) regiao = REGIOES.find(r => r.id === 'centro-oeste')
            else if (lat > -24) regiao = REGIOES.find(r => r.id === 'sudeste')
            else regiao = REGIOES.find(r => r.id === 'sul')
          } else {
            regiao = REGIOES.find(r => r.id === 'norte')
          }
          if (regiao) setRegiaoSelecionada(regiao)
          setGeolocalizando(false)
        },
        () => {
          setGeolocalizando(false)
          alert('Nao foi possivel obter sua localizacao. Selecione manualmente.')
        }
      )
    } else {
      setGeolocalizando(false)
      alert('Geolocalizacao nao suportada neste navegador.')
    }
  }

  function toggleProblema(problema: ProblemaInfo) {
    if (problema.id === 'nenhum') {
      setProblemasSelecionados([problema])
      return
    }
    setProblemasSelecionados(prev => {
      const filtered = prev.filter(p => p.id !== 'nenhum')
      const exists = filtered.find(p => p.id === problema.id)
      if (exists) return filtered.filter(p => p.id !== problema.id)
      return [...filtered, problema]
    })
  }

  function gerarResultado() {
    if (!plantaSelecionada || !regiaoSelecionada || !soloSelecionado || !producaoSelecionada) return
    const probs = problemasSelecionados.length === 0 ? [PROBLEMAS[PROBLEMAS.length - 1]] : problemasSelecionados
    const res = gerarRecomendacao(plantaSelecionada, regiaoSelecionada, soloSelecionado, producaoSelecionada, probs)
    setResultado(res)
    setActiveResultTab('tubete')
    setStep(5)
  }

  function resetar() {
    stopCamera()
    setStep(0)
    setPlantaSelecionada(null)
    setRegiaoSelecionada(null)
    setSoloSelecionado(null)
    setProducaoSelecionada(null)
    setProblemasSelecionados([])
    setResultado(null)
    setFotoPreview(null)
    setBusca('')
    setAiResult(null)
    setAiError(null)
  }

  const canAdvance = () => {
    switch (step) {
      case 0: return !!plantaSelecionada
      case 1: return !!regiaoSelecionada
      case 2: return !!soloSelecionado
      case 3: return !!producaoSelecionada
      case 4: return true
      default: return false
    }
  }

  function handleNext() {
    if (step === 4) {
      gerarResultado()
    } else if (canAdvance()) {
      setSlideDirection('left')
      setTransitioning(true)
      setTimeout(() => {
        setStep(step + 1)
        setTransitioning(false)
      }, 200)
    }
  }

  function handleBack() {
    setSlideDirection('right')
    setTransitioning(true)
    setTimeout(() => {
      setStep(Math.max(0, step - 1))
      setTransitioning(false)
    }, 200)
  }

  const plantasFiltradas = PLANT_DATABASE.filter(p =>
    p.nome.toLowerCase().includes(busca.toLowerCase()) ||
    p.categoria.toLowerCase().includes(busca.toLowerCase()) ||
    p.nomeCientifico.toLowerCase().includes(busca.toLowerCase())
  )

  const cardStyle: React.CSSProperties = { background: t.card, borderRadius: '16px', padding: '24px', border: `1px solid ${t.border}`, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }
  const btnPrimary: React.CSSProperties = { background: 'linear-gradient(135deg, #16a34a, #15803d)', color: '#fff', border: 'none', padding: '14px 36px', borderRadius: '12px', fontSize: '15px', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s ease' }
  const btnSecondary: React.CSSProperties = { background: 'transparent', color: t.textSoft, border: `1px solid ${t.border}`, padding: '14px 36px', borderRadius: '12px', fontSize: '15px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s ease' }
  const selectableCard = (selected: boolean): React.CSSProperties => ({
    background: selected ? t.accentLight : t.card, borderRadius: '16px', padding: '20px',
    border: `2px solid ${selected ? '#16a34a' : t.border}`, cursor: 'pointer',
    transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)', position: 'relative',
    boxShadow: selected ? '0 0 0 3px rgba(22,163,74,0.12), 0 4px 16px rgba(22,163,74,0.08)' : '0 1px 3px rgba(0,0,0,0.04)',
  })

  return (
    <div style={{ minHeight: '100vh', background: t.bg, transition: 'background 0.3s ease' }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes scanLine { 0% { transform: translateY(-100%); } 100% { transform: translateY(200%); } }
        @keyframes slideIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes successPulse { 0%,100% { box-shadow: 0 0 0 0 rgba(22,163,74,0.4); } 50% { box-shadow: 0 0 0 12px rgba(22,163,74,0); } }
        .selectable-card:hover { border-color: rgba(22,163,74,0.4) !important; box-shadow: 0 4px 16px rgba(0,0,0,0.06) !important; }
        .btn-hover:hover { transform: translateY(-1px); box-shadow: 0 8px 24px rgba(22,163,74,0.3); }
        .btn-hover:active { transform: translateY(0); }
        .result-tab:hover { transform: translateY(-1px); }
        @media (min-width: 768px) { .step-label { display: inline !important; } }
      `}</style>

      <header style={{ background: darkMode ? '#1e293b' : '#ffffff', borderBottom: `1px solid ${t.border}`, padding: '0 24px', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 30 }}>
        <a href="/" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
          <span style={{ fontSize: '24px' }}>{'\uD83C\uDF31'}</span>
          <span style={{ color: '#16a34a', fontSize: '18px', fontWeight: 800 }}>AgroAdubo</span>
        </a>
        <button onClick={() => { const next = !darkMode; setDarkMode(next); localStorage.setItem('agroadubo-dark', String(next)) }} style={{ background: 'none', border: `1px solid ${t.border}`, borderRadius: '8px', padding: '6px 14px', cursor: 'pointer', color: t.text, fontSize: '14px' }}>
          {darkMode ? '\u2600\uFE0F Claro' : '\uD83C\uDF19 Escuro'}
        </button>
      </header>

      <main style={{ padding: '24px', maxWidth: '900px', margin: '0 auto' }}>
        <div style={{ marginBottom: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <span style={{ fontSize: '32px' }}>{'\uD83C\uDF31'}</span>
            <h1 style={{ color: t.text, fontSize: '28px', fontWeight: 800, margin: 0 }}>Avaliacao de Planta</h1>
          </div>
          <p style={{ color: t.textSoft, fontSize: '15px', margin: 0 }}>Avaliacao inteligente com IA e recomendacao de adubos e tubetes de polpa moldada</p>
        </div>

        {/* Progress Steps */}
        {step < 5 && (
          <div style={{ ...cardStyle, marginBottom: '24px', padding: '20px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
              {STEPS.slice(0, 5).map((s, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', flex: i < 4 ? 1 : '0 0 auto' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                    <div style={{
                      width: '36px', height: '36px', borderRadius: '50%',
                      background: i === step ? 'linear-gradient(135deg, #16a34a, #15803d)' : i < step ? '#86efac' : (darkMode ? '#334155' : '#f1f5f9'),
                      color: i <= step ? '#fff' : t.textSoft,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '14px', fontWeight: 700,
                      boxShadow: i === step ? '0 4px 12px rgba(22,163,74,0.3)' : 'none',
                      transition: 'all 0.3s ease', flexShrink: 0,
                    }}>{i < step ? '\u2713' : i + 1}</div>
                    <span style={{ color: i === step ? t.text : t.textSoft, fontSize: '11px', fontWeight: i === step ? 700 : 400, display: 'none', whiteSpace: 'nowrap' }} className="step-label">{s}</span>
                  </div>
                  {i < 4 && <div style={{ flex: 1, height: '3px', margin: '0 8px', background: i < step ? '#86efac' : (darkMode ? '#334155' : '#e5e7eb'), borderRadius: '2px', transition: 'background 0.3s ease' }} />}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step Content with Transition */}
        <div style={{
          opacity: transitioning ? 0 : 1,
          transform: transitioning ? `translateX(${slideDirection === 'left' ? '-20px' : '20px'})` : 'translateX(0)',
          transition: 'all 0.2s ease-out',
        }}>

        {/* STEP 0 */}
        {step === 0 && (
          <div style={cardStyle}>
            <h2 style={{ color: t.text, fontSize: '20px', fontWeight: 700, marginBottom: '6px' }}>{'\uD83D\uDCF7'} Identificar Planta</h2>
            <p style={{ color: t.textSoft, fontSize: '14px', marginBottom: '24px' }}>Tire uma foto para identificacao por IA ou selecione na lista abaixo</p>

            {/* Live Camera View */}
            {cameraActive && (
              <div style={{ borderRadius: '14px', overflow: 'hidden', marginBottom: '24px', position: 'relative', background: '#000' }}>
                <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', maxHeight: '400px', objectFit: 'cover', display: 'block' }} />
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '16px', background: 'linear-gradient(transparent, rgba(0,0,0,0.7))', display: 'flex', justifyContent: 'center', gap: '12px' }}>
                  <button onClick={captureFromCamera} style={{ background: '#fff', color: '#111', border: 'none', padding: '12px 28px', borderRadius: '30px', fontSize: '15px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {'\uD83D\uDCF8'} Capturar Foto
                  </button>
                  <button onClick={stopCamera} style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', border: '1px solid rgba(255,255,255,0.3)', padding: '12px 20px', borderRadius: '30px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {/* Photo Upload / Camera Area */}
            {!cameraActive && (
              <div
                style={{
                  border: `2px dashed ${dragOver ? '#16a34a' : t.border}`, borderRadius: '14px', padding: '32px', textAlign: 'center', marginBottom: '24px',
                  background: dragOver ? (darkMode ? 'rgba(22,163,74,0.08)' : 'rgba(22,163,74,0.04)') : (darkMode ? 'rgba(255,255,255,0.02)' : '#fafafa'),
                  transition: 'all 0.2s ease',
                }}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
              >
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFotoCaptura} style={{ display: 'none' }} />

                {identificando ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                    <div style={{ position: 'relative' }}>
                      <img src={fotoPreview!} alt="Analisando" style={{ maxWidth: '200px', maxHeight: '200px', borderRadius: '12px', objectFit: 'cover', filter: 'brightness(0.7)' }} />
                      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: '12px', overflow: 'hidden' }}>
                        <div style={{ width: '100%', height: '100%', background: 'linear-gradient(180deg, transparent 40%, rgba(22,163,74,0.3) 50%, transparent 60%)', animation: 'scanLine 2s ease-in-out infinite' }} />
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '20px', height: '20px', border: '3px solid rgba(22,163,74,0.2)', borderTopColor: '#16a34a', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                      <span style={{ color: '#16a34a', fontWeight: 600, fontSize: '14px' }}>Identificando planta com IA...</span>
                    </div>
                    <p style={{ color: t.textSoft, fontSize: '12px', margin: 0 }}>A imagem esta sendo analisada por inteligencia artificial</p>
                  </div>
                ) : fotoPreview ? (
                  <div>
                    <img src={fotoPreview} alt="Foto da planta" style={{ maxWidth: '250px', maxHeight: '250px', borderRadius: '12px', marginBottom: '12px', objectFit: 'cover', border: `3px solid ${t.accent}` }} />
                    <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '8px', flexWrap: 'wrap' }}>
                      <button onClick={() => startCamera()} style={{ ...btnSecondary, padding: '8px 20px', fontSize: '13px' }}>{'\uD83D\uDCF8'} Abrir camera</button>
                      <button onClick={() => fileInputRef.current?.click()} style={{ ...btnSecondary, padding: '8px 20px', fontSize: '13px' }}>{'\uD83D\uDCC2'} Escolher arquivo</button>
                      <button onClick={() => { setFotoPreview(null); setAiResult(null); setAiError(null) }} style={{ ...btnSecondary, padding: '8px 20px', fontSize: '13px', color: '#dc2626' }}>Remover foto</button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div style={{ fontSize: '48px', marginBottom: '16px' }}>{'\uD83C\uDF31'}</div>
                    <p style={{ color: t.text, fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>Identifique sua planta</p>
                    <p style={{ color: t.textSoft, fontSize: '14px', marginBottom: '20px' }}>Use a camera ou envie uma foto para identificacao por IA</p>
                    <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
                      <button onClick={() => startCamera()} className="btn-hover" style={{ ...btnPrimary, padding: '12px 24px', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {'\uD83D\uDCF8'} Abrir Camera
                      </button>
                      <button onClick={() => fileInputRef.current?.click()} style={{ ...btnSecondary, padding: '12px 24px', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {'\uD83D\uDCC2'} Enviar Foto
                      </button>
                    </div>
                    <p style={{ color: t.textSoft, fontSize: '12px', marginTop: '16px', opacity: 0.7 }}>ou arraste uma imagem para esta area</p>
                    {cameraError && (
                      <div style={{ marginTop: '16px', padding: '12px', borderRadius: '10px', background: darkMode ? 'rgba(239,68,68,0.1)' : '#fef2f2', border: '1px solid rgba(239,68,68,0.2)' }}>
                        <p style={{ color: '#dc2626', fontSize: '13px', margin: 0 }}>{cameraError}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* AI Result Banner */}
            {aiResult && !identificando && (
              <div style={{
                marginBottom: '20px', padding: '16px', borderRadius: '12px', animation: 'slideIn 0.3s ease-out',
                background: aiResult.identified && aiResult.plantId && aiResult.confidence >= 0.7
                  ? (darkMode ? 'rgba(22,163,74,0.12)' : '#f0fdf4')
                  : aiResult.identified ? (darkMode ? 'rgba(234,179,8,0.12)' : '#fefce8') : (darkMode ? 'rgba(239,68,68,0.12)' : '#fef2f2'),
                border: `1px solid ${aiResult.identified && aiResult.plantId && aiResult.confidence >= 0.7 ? 'rgba(22,163,74,0.3)' : aiResult.identified ? 'rgba(234,179,8,0.3)' : 'rgba(239,68,68,0.3)'}`,
              }}>
                {aiResult.identified && aiResult.plantId && aiResult.confidence >= 0.7 ? (
                  <>
                    <p style={{ fontWeight: 700, color: '#16a34a', margin: '0 0 4px 0', fontSize: '15px' }}>{'\u2705'} Planta identificada: {aiResult.plantName} ({Math.round(aiResult.confidence * 100)}% confianca)</p>
                    <p style={{ fontSize: '13px', color: t.textSoft, margin: '0 0 8px 0' }}>{aiResult.description}</p>
                    <p style={{ fontSize: '12px', color: t.textSoft, margin: 0 }}>Planta selecionada automaticamente. Nao e esta? Selecione outra abaixo.</p>
                  </>
                ) : aiResult.identified ? (
                  <>
                    <p style={{ fontWeight: 700, color: '#d97706', margin: '0 0 4px 0', fontSize: '15px' }}>{'\uD83D\uDD0D'} Sugestao da IA: {aiResult.plantName} ({Math.round(aiResult.confidence * 100)}% confianca)</p>
                    <p style={{ fontSize: '13px', color: t.textSoft, margin: '0 0 8px 0' }}>{aiResult.description}</p>
                    {aiResult.suggestion && <p style={{ fontSize: '12px', color: t.textSoft, margin: 0 }}>Sugestao: {aiResult.suggestion}. Confirme selecionando abaixo.</p>}
                  </>
                ) : (
                  <>
                    <p style={{ fontWeight: 600, color: '#dc2626', margin: '0 0 4px 0' }}>Nao foi possivel identificar a planta na foto</p>
                    <p style={{ fontSize: '13px', color: t.textSoft, margin: 0 }}>{aiResult.description || 'Selecione manualmente na lista abaixo.'}</p>
                  </>
                )}
              </div>
            )}

            {aiError && !identificando && (
              <div style={{ marginBottom: '20px', padding: '14px', borderRadius: '12px', background: darkMode ? 'rgba(239,68,68,0.1)' : '#fef2f2', border: '1px solid rgba(239,68,68,0.2)', animation: 'slideIn 0.3s ease-out' }}>
                <p style={{ color: '#dc2626', fontSize: '14px', fontWeight: 600, margin: 0 }}>{aiError}</p>
                <p style={{ color: t.textSoft, fontSize: '13px', margin: '4px 0 0 0' }}>Selecione a planta manualmente abaixo.</p>
              </div>
            )}

            <div style={{ position: 'relative', marginBottom: '20px' }}>
              <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', fontSize: '16px' }}>{'\uD83D\uDD0D'}</span>
              <input type="text" placeholder="Buscar planta pelo nome, categoria..." value={busca} onChange={e => setBusca(e.target.value)}
                style={{ width: '100%', padding: '14px 14px 14px 42px', borderRadius: '12px', border: `1px solid ${t.border}`, background: darkMode ? '#0f172a' : '#fff', color: t.text, fontSize: '15px', outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.2s ease' }}
                onFocus={(e) => e.target.style.borderColor = '#16a34a'} onBlur={(e) => e.target.style.borderColor = t.border}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: '12px' }}>
              {plantasFiltradas.map(planta => (
                <div key={planta.id} onClick={() => setPlantaSelecionada(planta)} className="selectable-card" style={selectableCard(plantaSelecionada?.id === planta.id)}>
                  {plantaSelecionada?.id === planta.id && <div style={{ position: 'absolute', top: '8px', right: '8px', width: '22px', height: '22px', borderRadius: '50%', background: '#16a34a', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700 }}>{'\u2713'}</div>}
                  <div style={{ fontSize: '36px', marginBottom: '8px' }}>{planta.icon}</div>
                  <p style={{ color: t.text, fontSize: '15px', fontWeight: 700, margin: '0 0 2px 0' }}>{planta.nome}</p>
                  <p style={{ color: t.textSoft, fontSize: '11px', margin: '0 0 4px 0', fontStyle: 'italic' }}>{planta.nomeCientifico}</p>
                  <span style={{ display: 'inline-block', background: darkMode ? 'rgba(134,239,172,0.15)' : '#f0fdf4', color: '#16a34a', padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 600 }}>{planta.categoria}</span>
                </div>
              ))}
            </div>

            {plantaSelecionada && (
              <div style={{ marginTop: '20px', padding: '16px', borderRadius: '12px', background: darkMode ? 'rgba(22,163,74,0.1)' : '#f0fdf4', border: '1px solid rgba(22,163,74,0.2)', animation: 'slideIn 0.3s ease-out' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                  <span style={{ fontSize: '24px' }}>{plantaSelecionada.icon}</span>
                  <div>
                    <p style={{ color: t.text, fontWeight: 700, fontSize: '16px', margin: 0 }}>{plantaSelecionada.nome}</p>
                    <p style={{ color: t.textSoft, fontSize: '12px', margin: 0 }}>{plantaSelecionada.nomeCientifico}</p>
                  </div>
                </div>
                <p style={{ color: t.textSoft, fontSize: '13px', lineHeight: 1.6, margin: '0 0 8px 0' }}>{plantaSelecionada.descricao}</p>
                <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                  <span style={{ color: t.textSoft, fontSize: '12px' }}>pH: <strong style={{ color: t.text }}>{plantaSelecionada.phIdeal}</strong></span>
                  <span style={{ color: t.textSoft, fontSize: '12px' }}>Temp: <strong style={{ color: t.text }}>{plantaSelecionada.tempIdeal}</strong></span>
                  <span style={{ color: t.textSoft, fontSize: '12px' }}>Ciclo: <strong style={{ color: t.text }}>{plantaSelecionada.ciclo}</strong></span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* STEP 1 */}
        {step === 1 && (
          <div style={cardStyle}>
            <h2 style={{ color: t.text, fontSize: '20px', fontWeight: 700, marginBottom: '6px' }}>{'\uD83D\uDCCD'} Regiao / Localizacao</h2>
            <p style={{ color: t.textSoft, fontSize: '14px', marginBottom: '24px' }}>Informe sua regiao para sugestoes de solo e clima adequadas</p>
            <button onClick={handleGeolocalizar} disabled={geolocalizando} className="btn-hover" style={{ ...btnPrimary, width: '100%', marginBottom: '20px', opacity: geolocalizando ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              {geolocalizando ? (<><div style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />Detectando localizacao...</>) : (<>{'\uD83D\uDCCD'} Usar minha localizacao automaticamente</>)}
            </button>
            <div style={{ textAlign: 'center', color: t.textSoft, fontSize: '13px', marginBottom: '20px' }}>ou selecione manualmente</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {REGIOES.map(regiao => (
                <div key={regiao.id} onClick={() => setRegiaoSelecionada(regiao)} className="selectable-card" style={selectableCard(regiaoSelecionada?.id === regiao.id)}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <p style={{ color: t.text, fontSize: '16px', fontWeight: 700, margin: '0 0 4px 0' }}>{regiao.nome}</p>
                      <p style={{ color: t.textSoft, fontSize: '13px', margin: '0 0 4px 0' }}>{regiao.estados}</p>
                      <p style={{ color: t.textSoft, fontSize: '12px', margin: '0 0 4px 0' }}>Clima: <strong style={{ color: t.text }}>{regiao.clima}</strong></p>
                      <p style={{ color: t.textSoft, fontSize: '12px', margin: 0 }}>Solo tipico: <strong style={{ color: t.text }}>{regiao.soloTipico}</strong></p>
                    </div>
                    {regiaoSelecionada?.id === regiao.id && <div style={{ width: '26px', height: '26px', borderRadius: '50%', background: '#16a34a', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 700, flexShrink: 0 }}>{'\u2713'}</div>}
                  </div>
                </div>
              ))}
            </div>
            {regiaoSelecionada && (
              <div style={{ marginTop: '16px', padding: '14px', borderRadius: '10px', background: darkMode ? 'rgba(22,163,74,0.1)' : '#f0fdf4', border: '1px solid rgba(22,163,74,0.2)' }}>
                <p style={{ color: t.textSoft, fontSize: '13px', margin: 0, lineHeight: 1.6 }}>{'\u2139\uFE0F'} <strong style={{ color: t.text }}>{regiaoSelecionada.nome}:</strong> {regiaoSelecionada.caracteristicas}</p>
              </div>
            )}
          </div>
        )}

        {/* STEP 2 */}
        {step === 2 && (
          <div style={cardStyle}>
            <h2 style={{ color: t.text, fontSize: '20px', fontWeight: 700, marginBottom: '6px' }}>{'\uD83E\uDEA8'} Tipo de Solo</h2>
            <p style={{ color: t.textSoft, fontSize: '14px', marginBottom: '8px' }}>Selecione o tipo de solo predominante na sua area</p>
            {regiaoSelecionada && <p style={{ color: '#16a34a', fontSize: '13px', marginBottom: '24px', background: darkMode ? 'rgba(22,163,74,0.1)' : '#f0fdf4', padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(22,163,74,0.15)' }}>{'\uD83D\uDCA1'} Solo tipico da regiao <strong>{regiaoSelecionada.nome}</strong>: {regiaoSelecionada.soloTipico}</p>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {TIPOS_SOLO.map(solo => (
                <div key={solo.id} onClick={() => setSoloSelecionado(solo)} className="selectable-card" style={selectableCard(soloSelecionado?.id === solo.id)}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <span style={{ fontSize: '28px', flexShrink: 0 }}>{solo.icon}</span>
                    <div style={{ flex: 1 }}>
                      <p style={{ color: t.text, fontSize: '16px', fontWeight: 700, margin: '0 0 4px 0' }}>{solo.nome}</p>
                      <p style={{ color: t.textSoft, fontSize: '13px', margin: '0 0 4px 0' }}>{solo.descricao}</p>
                      <p style={{ color: t.textSoft, fontSize: '12px', margin: 0 }}>Correcao: <span style={{ color: '#d97706' }}>{solo.correcao}</span></p>
                    </div>
                    {soloSelecionado?.id === solo.id && <div style={{ width: '26px', height: '26px', borderRadius: '50%', background: '#16a34a', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 700, flexShrink: 0 }}>{'\u2713'}</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* STEP 3 */}
        {step === 3 && (
          <div style={cardStyle}>
            <h2 style={{ color: t.text, fontSize: '20px', fontWeight: 700, marginBottom: '6px' }}>{'\uD83C\uDFE1'} Tipo de Producao</h2>
            <p style={{ color: t.textSoft, fontSize: '14px', marginBottom: '24px' }}>Informe o tipo e escala da sua producao</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '12px' }}>
              {TIPOS_PRODUCAO.map(prod => (
                <div key={prod.id} onClick={() => setProducaoSelecionada(prod)} className="selectable-card" style={selectableCard(producaoSelecionada?.id === prod.id)}>
                  {producaoSelecionada?.id === prod.id && <div style={{ position: 'absolute', top: '8px', right: '8px', width: '22px', height: '22px', borderRadius: '50%', background: '#16a34a', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700 }}>{'\u2713'}</div>}
                  <div style={{ fontSize: '32px', marginBottom: '8px' }}>{prod.icon}</div>
                  <p style={{ color: t.text, fontSize: '15px', fontWeight: 700, margin: '0 0 4px 0' }}>{prod.nome}</p>
                  <p style={{ color: t.textSoft, fontSize: '12px', margin: '0 0 6px 0' }}>{prod.descricao}</p>
                  <span style={{ display: 'inline-block', background: darkMode ? 'rgba(59,130,246,0.15)' : '#eff6ff', color: '#3b82f6', padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 600 }}>Escala: {prod.escala}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* STEP 4 */}
        {step === 4 && (
          <div style={cardStyle}>
            <h2 style={{ color: t.text, fontSize: '20px', fontWeight: 700, marginBottom: '6px' }}>{'\u26A0\uFE0F'} Problemas Identificados</h2>
            <p style={{ color: t.textSoft, fontSize: '14px', marginBottom: '24px' }}>Selecione os problemas que voce observa na planta ou no solo (pode selecionar varios)</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px' }}>
              {PROBLEMAS.map(prob => {
                const selected = problemasSelecionados.some(p => p.id === prob.id)
                return (
                  <div key={prob.id} onClick={() => toggleProblema(prob)} className="selectable-card" style={selectableCard(selected)}>
                    {selected && <div style={{ position: 'absolute', top: '8px', right: '8px', width: '22px', height: '22px', borderRadius: '50%', background: '#16a34a', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700 }}>{'\u2713'}</div>}
                    <div style={{ fontSize: '28px', marginBottom: '8px' }}>{prob.icon}</div>
                    <p style={{ color: t.text, fontSize: '14px', fontWeight: 700, margin: '0 0 4px 0' }}>{prob.nome}</p>
                    <p style={{ color: t.textSoft, fontSize: '12px', margin: 0 }}>{prob.descricao}</p>
                  </div>
                )
              })}
            </div>
            {problemasSelecionados.length > 0 && problemasSelecionados[0].id !== 'nenhum' && (
              <div style={{ marginTop: '16px', padding: '14px', borderRadius: '10px', background: darkMode ? 'rgba(234,179,8,0.1)' : '#fefce8', border: '1px solid rgba(234,179,8,0.2)' }}>
                <p style={{ color: '#a16207', fontSize: '13px', margin: 0, fontWeight: 600 }}>{problemasSelecionados.length} problema(s) selecionado(s) - recomendacoes corretivas serao incluidas no resultado</p>
              </div>
            )}
          </div>
        )}

        {/* STEP 5: Results */}
        {step === 5 && resultado && (
          <div style={{ animation: 'slideIn 0.4s ease-out' }}>
            <div style={{ ...cardStyle, background: 'linear-gradient(135deg, #16a34a, #15803d)', border: 'none', marginBottom: '20px', color: '#fff' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                <div style={{ animation: 'successPulse 2s ease-in-out 1' }}><span style={{ fontSize: '48px' }}>{resultado.planta.icon}</span></div>
                <div style={{ flex: 1 }}>
                  <h2 style={{ fontSize: '24px', fontWeight: 800, margin: '0 0 4px 0' }}>Recomendacao Completa</h2>
                  <p style={{ fontSize: '16px', opacity: 0.9, margin: '0 0 8px 0' }}>{resultado.planta.nome} ({resultado.planta.nomeCientifico})</p>
                  <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    <span style={{ background: 'rgba(255,255,255,0.2)', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 600 }}>{'\uD83D\uDCCD'} {resultado.regiao.nome}</span>
                    <span style={{ background: 'rgba(255,255,255,0.2)', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 600 }}>{resultado.solo.icon} {resultado.solo.nome}</span>
                    <span style={{ background: 'rgba(255,255,255,0.2)', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 600 }}>{resultado.producao.icon} {resultado.producao.nome}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', marginBottom: '20px', paddingBottom: '4px' }}>
              {([
                { id: 'tubete' as const, label: 'Tubete', icon: '\uD83C\uDF31' },
                { id: 'adubos' as const, label: 'Adubos', icon: '\uD83E\uDDEA' },
                { id: 'solo' as const, label: 'Solo', icon: '\uD83E\uDEA8' },
                { id: 'manejo' as const, label: 'Manejo', icon: '\uD83C\uDF3F' },
                { id: 'resumo' as const, label: 'Resumo', icon: '\uD83D\uDCCB' },
              ]).map(tab => (
                <button key={tab.id} onClick={() => setActiveResultTab(tab.id)} className="result-tab"
                  style={{ padding: '10px 18px', borderRadius: '10px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
                    border: activeResultTab === tab.id ? '2px solid #16a34a' : `1px solid ${t.border}`,
                    background: activeResultTab === tab.id ? t.accentLight : t.card,
                    color: activeResultTab === tab.id ? '#16a34a' : t.textSoft, transition: 'all 0.2s ease' }}>
                  {tab.icon} {tab.label}
                </button>
              ))}
            </div>

            {activeResultTab === 'tubete' && (
              <div style={{ ...cardStyle, marginBottom: '20px', borderLeft: '4px solid #16a34a', background: darkMode ? 'rgba(22,163,74,0.08)' : '#f0fdf4' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                  <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#16a34a', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px' }}>{'\uD83C\uDF31'}</div>
                  <div>
                    <h3 style={{ color: t.text, fontSize: '18px', fontWeight: 800, margin: 0 }}>Tubete de Polpa Moldada</h3>
                    <p style={{ color: '#16a34a', fontSize: '13px', fontWeight: 600, margin: 0 }}>Recomendacao personalizada para fase inicial</p>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px', marginBottom: '20px' }}>
                  {[{ label: 'Tamanho', value: resultado.tubete.tamanho }, { label: 'Volume', value: resultado.tubete.volume }, { label: 'Tempo Muda', value: resultado.tubete.tempoMuda }].map((item, i) => (
                    <div key={i} style={{ background: darkMode ? 'rgba(255,255,255,0.05)' : '#fff', borderRadius: '10px', padding: '14px', border: `1px solid ${t.border}` }}>
                      <p style={{ color: t.textSoft, fontSize: '12px', margin: '0 0 4px 0', fontWeight: 600 }}>{item.label}</p>
                      <p style={{ color: t.text, fontSize: '16px', fontWeight: 700, margin: 0 }}>{item.value}</p>
                    </div>
                  ))}
                </div>
                <div style={{ marginBottom: '16px' }}><p style={{ color: t.textSoft, fontSize: '13px', fontWeight: 600, margin: '0 0 6px 0' }}>Substrato:</p><p style={{ color: t.text, fontSize: '14px', margin: 0 }}>{resultado.tubete.substrato}</p></div>
                <div style={{ marginBottom: '16px' }}><p style={{ color: t.textSoft, fontSize: '13px', fontWeight: 600, margin: '0 0 6px 0' }}>Adubo Base:</p><p style={{ color: t.text, fontSize: '14px', margin: 0, fontWeight: 600 }}>{resultado.tubete.aduboBase}</p></div>
                <div><p style={{ color: t.textSoft, fontSize: '13px', fontWeight: 600, margin: '0 0 10px 0' }}>Instrucoes:</p>
                  <ol style={{ margin: 0, paddingLeft: '20px' }}>{resultado.tubete.instrucoes.map((inst, i) => <li key={i} style={{ color: t.text, fontSize: '13px', lineHeight: 1.8, marginBottom: '4px' }}>{inst}</li>)}</ol>
                </div>
              </div>
            )}

            {activeResultTab === 'adubos' && (
              <div style={{ ...cardStyle, marginBottom: '20px' }}>
                <h3 style={{ color: t.text, fontSize: '18px', fontWeight: 700, margin: '0 0 16px 0' }}>{'\uD83E\uDDEA'} Adubos Recomendados</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {resultado.adubos.map((adubo, i) => (
                    <div key={i} style={{ borderRadius: '12px', padding: '16px', border: `1px solid ${t.border}`, borderLeft: `4px solid ${adubo.tipo.includes('Corretivo') ? '#d97706' : adubo.tipo.includes('Organico') ? '#78716c' : '#16a34a'}`, background: darkMode ? 'rgba(255,255,255,0.03)' : '#fafafa' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                        <span style={{ fontSize: '20px' }}>{adubo.icon}</span>
                        <div style={{ flex: 1 }}><p style={{ color: t.text, fontSize: '15px', fontWeight: 700, margin: 0 }}>{adubo.nome}</p><p style={{ color: t.textSoft, fontSize: '12px', margin: 0 }}>{adubo.tipo}</p></div>
                        <span style={{ background: darkMode ? 'rgba(22,163,74,0.15)' : '#f0fdf4', color: '#16a34a', padding: '4px 12px', borderRadius: '8px', fontSize: '13px', fontWeight: 700 }}>NPK {adubo.npk}</span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '8px' }}>
                        <div><span style={{ color: t.textSoft, fontSize: '11px', fontWeight: 600 }}>Aplicacao</span><p style={{ color: t.text, fontSize: '13px', margin: '2px 0 0 0' }}>{adubo.aplicacao}</p></div>
                        <div><span style={{ color: t.textSoft, fontSize: '11px', fontWeight: 600 }}>Dosagem</span><p style={{ color: t.text, fontSize: '13px', margin: '2px 0 0 0', fontWeight: 600 }}>{adubo.dosagem}</p></div>
                        <div><span style={{ color: t.textSoft, fontSize: '11px', fontWeight: 600 }}>Frequencia</span><p style={{ color: t.text, fontSize: '13px', margin: '2px 0 0 0' }}>{adubo.frequencia}</p></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeResultTab === 'solo' && (
              <div style={{ ...cardStyle, marginBottom: '20px' }}>
                <h3 style={{ color: t.text, fontSize: '18px', fontWeight: 700, margin: '0 0 16px 0' }}>{'\uD83E\uDEA8'} Correcoes de Solo</h3>
                <ul style={{ margin: 0, paddingLeft: '20px' }}>{resultado.correcoesSolo.map((c, i) => <li key={i} style={{ color: t.text, fontSize: '14px', lineHeight: 1.8, marginBottom: '6px' }}>{c}</li>)}</ul>
              </div>
            )}

            {activeResultTab === 'manejo' && (
              <div style={{ ...cardStyle, marginBottom: '20px' }}>
                <h3 style={{ color: t.text, fontSize: '18px', fontWeight: 700, margin: '0 0 16px 0' }}>{'\uD83C\uDF3F'} Manejo e Cuidados</h3>
                <ul style={{ margin: 0, paddingLeft: '20px' }}>{resultado.manejo.map((m, i) => <li key={i} style={{ color: t.text, fontSize: '14px', lineHeight: 1.8, marginBottom: '6px' }}>{m}</li>)}</ul>
              </div>
            )}

            {activeResultTab === 'resumo' && (
              <div style={{ ...cardStyle, marginBottom: '20px' }}>
                <h3 style={{ color: t.text, fontSize: '18px', fontWeight: 700, margin: '0 0 16px 0' }}>{'\uD83D\uDCCB'} Resumo da Planta</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '14px' }}>
                  {[{ label: 'pH Ideal', value: resultado.planta.phIdeal }, { label: 'Temperatura', value: resultado.planta.tempIdeal }, { label: 'Ciclo', value: resultado.planta.ciclo }, { label: 'Nitrogenio (N)', value: resultado.planta.nutrientes.N }, { label: 'Fosforo (P)', value: resultado.planta.nutrientes.P }, { label: 'Potassio (K)', value: resultado.planta.nutrientes.K }].map((item, i) => (
                    <div key={i} style={{ background: darkMode ? 'rgba(255,255,255,0.03)' : '#fafafa', borderRadius: '10px', padding: '14px', border: `1px solid ${t.border}` }}>
                      <p style={{ color: t.textSoft, fontSize: '12px', margin: '0 0 4px 0', fontWeight: 600 }}>{item.label}</p>
                      <p style={{ color: t.text, fontSize: '15px', fontWeight: 700, margin: 0 }}>{item.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <button onClick={resetar} className="btn-hover" style={btnPrimary}>{'\uD83D\uDD04'} Nova Avaliacao</button>
            </div>
          </div>
        )}

        </div>

        {/* Navigation */}
        {step < 5 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '24px', gap: '12px' }}>
            <button onClick={handleBack} disabled={step === 0} style={{ ...btnSecondary, opacity: step === 0 ? 0.4 : 1 }}>{'\u2190'} Voltar</button>
            <button onClick={handleNext} disabled={!canAdvance() && step !== 4} className="btn-hover" style={{ ...btnPrimary, opacity: (!canAdvance() && step !== 4) ? 0.5 : 1 }}>{step === 4 ? '\uD83D\uDD0D Gerar Recomendacao' : 'Proximo \u2192'}</button>
          </div>
        )}
      </main>
    </div>
  )
}
