'use client'

import { useEffect, useState, useRef } from 'react'
import { supabase } from '../../../../src/lib/supabase'
import { useRouter, useParams } from 'next/navigation'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
import { CRITERIOS, AREA_META, SETOR_DICAS, CRITERIO_DICAS, LOSHU_ORDER, RODA_AREAS } from '../../../../src/lib/constants'
import type { Consulta, SetorBagua, DiagnosticoCriterio, Profile } from '../../../../src/lib/types'

// ─── CONSTANTS ──────────────────────────────────────────────────────────────

// Chi Flow items
const CHI_ITEMS = [
  { id: 'porta_abre', label: 'Porta principal abre completamente' },
  { id: 'entrada_livre', label: 'Entrada livre e acolhedora' },
  { id: 'sem_corredor_longo', label: 'Sem corredores longos e estreitos' },
  { id: 'sem_portas_alinhadas', label: 'Sem portas alinhadas (porta-a-porta)' },
  { id: 'sem_escada_porta', label: 'Sem escada frente à porta principal' },
  { id: 'banheiro_fora_centro', label: 'Banheiro fora do centro da casa' },
  { id: 'sem_vigas_expostas', label: 'Sem vigas expostas sobre áreas de estar' },
  { id: 'espelhos_ok', label: 'Espelhos não refletem a porta de entrada' },
  { id: 'sem_cantos_agressivos', label: 'Sem cantos agressivos para áreas de estar' },
  { id: 'fluxo_suave', label: 'Fluxo de circulação suave' },
  { id: 'luz_natural', label: 'Iluminação natural adequada' },
]

const COMODO_LABELS: Record<string, string> = {
  sala: 'Sala de Estar', quarto_casal: 'Quarto do Casal', quarto_filho: 'Quarto de Filho(a)',
  quarto_hospede: 'Quarto de Hóspede', escritorio: 'Escritório', cozinha: 'Cozinha',
  banheiro: 'Banheiro', lavabo: 'Lavabo', area_servico: 'Área de Serviço',
  garagem: 'Garagem', varanda: 'Varanda', corredor: 'Corredor', despensa: 'Despensa',
  jardim: 'Jardim',
}

// ─── HELPERS ────────────────────────────────────────────────────────────────

function gerarRecomendacoes(nomeSetor: string, scorePct: number, criteriosSetor: Record<string, number>) {
  const urgente: string[] = []
  const melhoria: string[] = []
  const manutencao: string[] = []

  CRITERIOS.forEach((criterio, ci) => {
    const val = criteriosSetor[criterio] ?? -1
    const dicas = CRITERIO_DICAS[ci] || []
    if (val === 0) urgente.push(...dicas.slice(0, 2))
    else if (val === 1) melhoria.push(dicas[0] || '')
  })

  const dicasSetor = SETOR_DICAS[nomeSetor] ?? []
  if (scorePct < 40) urgente.push(...dicasSetor.slice(0, 3))
  else if (scorePct < 70) melhoria.push(...dicasSetor.slice(0, 2))
  else manutencao.push(...dicasSetor.slice(3, 5))

  return {
    urgente: [...new Set(urgente)].filter(Boolean).slice(0, 4),
    melhoria: [...new Set(melhoria)].filter(Boolean).slice(0, 4),
    manutencao: [...new Set(manutencao)].filter(Boolean).slice(0, 3),
  }
}

function scoreColor(pct: number | null) {
  if (pct === null || pct === undefined) return '#9CA3AF'
  if (pct >= 70) return '#16A34A'
  if (pct >= 40) return '#D97706'
  return '#DC2626'
}

function scoreLevelLabel(pct: number | null): { label: string; color: string } {
  if (pct === null || pct === undefined) return { label: 'N/A', color: '#9CA3AF' }
  if (pct >= 80) return { label: 'EXCELENTE', color: '#B8860B' }
  if (pct >= 70) return { label: 'BOM', color: '#16A34A' }
  if (pct >= 40) return { label: 'ATENÇÃO', color: '#D97706' }
  return { label: 'URGENTE', color: '#DC2626' }
}

function desvioLabel(pct: number | null): { nivel: string; cor: string } {
  if (pct === null || pct === undefined) return { nivel: 'N/A', cor: '#9CA3AF' }
  if (pct >= 70) return { nivel: 'Leve', cor: '#16A34A' }
  if (pct >= 40) return { nivel: 'Moderado', cor: '#D97706' }
  if (pct >= 20) return { nivel: 'Acentuado', cor: '#DC2626' }
  return { nivel: 'Ausente', cor: '#7F1D1D' }
}

// ─── COMPONENT ──────────────────────────────────────────────────────────────

export default function Relatorio() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const printRef = useRef<HTMLDivElement>(null)

  const [consulta, setConsulta] = useState<(Consulta & { clientes?: { nome_completo: string; email?: string; telefone?: string; cidade?: string; estado?: string } | null }) | null>(null)
  const [setores, setSetores] = useState<SetorBagua[]>([])
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState(false)

  const isFree = profile?.plano !== 'pro'

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      setProfile(prof)

      const { data: consulta } = await supabase
        .from('consultas')
        .select('*, clientes(nome_completo, email, telefone, cidade, estado)')
        .eq('id', id)
        .single()
      if (!consulta) { router.push('/consultas'); return }
      setConsulta(consulta)

      const { data: setoresData } = await supabase
        .from('setores_bagua')
        .select('*, diagnostico_criterios(*)')
        .eq('consulta_id', id)
        .order('numero')
      setSetores(setoresData || [])
      setLoading(false)
    }
    load()
  }, [id, router])

  function scoreGeral() {
    const avaliados = setores.filter(s => s.score_percentual != null)
    if (avaliados.length === 0) return null
    const soma = avaliados.reduce((a: number, s: SetorBagua) => a + (s.score_percentual ?? 0), 0)
    return Math.round(soma / avaliados.length)
  }

  function getCriteriosMap(setor: SetorBagua): Record<string, number> {
    const map: Record<string, number> = {}
    setor.diagnostico_criterios?.forEach((c: DiagnosticoCriterio) => { map[c.criterio] = c.score })
    return map
  }

  function findSetorByName(nome: string) {
    return setores.find(s =>
      s.nome === nome ||
      s.nome === nome.replace('Úteis', 'Uteis') ||
      s.nome === nome.replace('Uteis', 'Úteis') ||
      (s.nome === 'Centro/Saúde' && nome === 'Centro') ||
      (s.nome === 'Fama/Reputação' && nome === 'Fama') ||
      (s.nome === 'Filhos' && nome === 'Criatividade') ||
      (s.nome === 'Conhecimento' && nome === 'Conhecimento')
    )
  }

  function getTop3() {
    return setores
      .filter(s => s.score_percentual != null)
      .sort((a, b) => (a.score_percentual ?? 100) - (b.score_percentual ?? 100))
      .slice(0, 3)
  }

  function handlePrint() { window.print() }

  async function handleDownloadPDF() {
    if (!printRef.current) return
    setDownloading(true)
    try {
      const canvas = await html2canvas(printRef.current, {
        scale: 2, useCORS: true, backgroundColor: '#ffffff', logging: false,
      })
      const imgWidth = 210
      const pageHeight = 297
      const imgHeight = (canvas.height * imgWidth) / canvas.width
      const pdf = new jsPDF('p', 'mm', 'a4')
      let heightLeft = imgHeight
      let position = 0
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, position, imgWidth, imgHeight)
      heightLeft -= pageHeight
      while (heightLeft > 0) {
        position = position - pageHeight
        pdf.addPage()
        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, position, imgWidth, imgHeight)
        heightLeft -= pageHeight
      }
      if (isFree) {
        const totalPages = pdf.getNumberOfPages()
        for (let i = 1; i <= totalPages; i++) {
          pdf.setPage(i)
          pdf.setFontSize(50)
          pdf.setTextColor(200, 200, 200)
          pdf.saveGraphicsState()
          pdf.text('VERSAO GRATUITA', imgWidth / 2, pageHeight / 2, { align: 'center', angle: 45 })
          pdf.restoreGraphicsState()
        }
      }
      const nomeArquivo = `relatorio-${consulta!.nome_imovel?.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'consulta'}.pdf`
      pdf.save(nomeArquivo)
    } catch (err) {
      console.error('Erro ao gerar PDF:', err)
      alert('Erro ao gerar PDF. Tente usar a opção Imprimir.')
    } finally {
      setDownloading(false)
    }
  }

  if (loading || !consulta) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FAFAF5', fontFamily: "Georgia, 'Times New Roman', serif" }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '48px', color: '#B8860B', marginBottom: '16px' }}>風水</div>
          <p style={{ color: '#B8860B', fontSize: '14px' }}>Gerando relatório...</p>
        </div>
      </div>
    )
  }

  const geral = scoreGeral()
  const geralLevel = scoreLevelLabel(geral)
  const top3 = getTop3()
  const rodaData: Record<string, number> = consulta.roda_da_vida || {}
  const checklistChi: string[] = consulta.checklist_chi || []
  const posicaoComando: Record<string, string[]> = consulta.posicao_comando || {}
  const hasRoda = Object.keys(rodaData).length > 0
  const hasChi = checklistChi.length > 0
  const chiScore = Math.round((checklistChi.length / CHI_ITEMS.length) * 100)

  // Sorted sectors for Ki Flow
  const sortedSetores = [...setores]
    .filter(s => s.score_percentual != null)
    .sort((a, b) => (a.score_percentual ?? 100) - (b.score_percentual ?? 100))

  // Urgente / Atenção / Manter groups
  const urgentes = setores.filter(s => s.score_percentual != null && s.score_percentual < 40)
  const atencao = setores.filter(s => s.score_percentual != null && s.score_percentual >= 40 && s.score_percentual < 70)
  const manterSetores = setores.filter(s => s.score_percentual != null && s.score_percentual >= 70)

  // Summary stats
  const avaliados = setores.filter(s => s.score_percentual != null)
  const urgentCount = urgentes.length
  const okCount = manterSetores.length
  const lowestSetor = sortedSetores[0]
  const highestSetor = sortedSetores[sortedSetores.length - 1]

  // ── CSS vars ──
  const gold = '#B8860B'
  const goldLt = '#D4A520'
  const ink = '#1C1C1A'
  const inkLt = '#666'
  const paper = '#FAFAF5'
  const paperWarm = '#F5F0E6'
  const border = 'rgba(184,134,11,0.22)'

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { margin: 0; background: #fff; }
          .print-area { padding: 0 !important; box-shadow: none !important; max-width: 100% !important; }
          @page { size: A4 portrait; margin: 1.5cm; }
        }
      `}</style>

      {/* ── Toolbar ─────────────────────────────────────────────────────── */}
      <div className="no-print" style={{
        background: '#1E3A5F', padding: '12px 32px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '24px', cursor: 'pointer' }} onClick={() => router.push(`/consultas/${id}`)}>☯</span>
          <span style={{ color: gold, fontSize: '18px', fontWeight: 'bold' }}>FengShui Studio</span>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {isFree && (
            <span style={{ color: '#FBBF24', fontSize: '12px', background: 'rgba(251,191,36,0.15)', padding: '4px 12px', borderRadius: '20px' }}>
              Plano Free — PDF com marca d&apos;agua
            </span>
          )}
          <button onClick={() => router.push(`/consultas/${id}`)} style={{
            background: 'transparent', border: '1px solid rgba(255,255,255,0.3)',
            color: '#ffffff', padding: '8px 20px', borderRadius: '4px', cursor: 'pointer', fontSize: '13px'
          }}>← Voltar</button>
          <button onClick={() => router.push(`/curas?consultaId=${id}`)} style={{
            background: 'transparent', border: '1px solid rgba(184,134,11,0.5)',
            color: '#b8860b', padding: '8px 20px', borderRadius: '4px', cursor: 'pointer', fontSize: '13px'
          }}>治 Curas</button>
          <button onClick={handlePrint} style={{
            background: 'transparent', border: '1px solid rgba(255,255,255,0.3)',
            color: '#ffffff', padding: '8px 20px', borderRadius: '4px', cursor: 'pointer', fontSize: '13px'
          }}>Imprimir</button>
          <button onClick={handleDownloadPDF} disabled={downloading} style={{
            background: downloading ? '#9CA3AF' : gold, border: 'none',
            color: '#ffffff', padding: '8px 24px', borderRadius: '4px',
            cursor: downloading ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: '600',
            letterSpacing: '0.05em'
          }}>{downloading ? 'Gerando PDF...' : 'Baixar PDF'}</button>
        </div>
      </div>

      {/* ── Report Body ─────────────────────────────────────────────────── */}
      <div ref={printRef} className="print-area" style={{
        background: '#ffffff', maxWidth: '980px', margin: '24px auto',
        padding: '0', fontFamily: "Georgia, 'Times New Roman', serif",
        boxShadow: '0 4px 20px rgba(0,0,0,0.08)', borderRadius: '4px',
        position: 'relative', overflow: 'hidden', color: ink, fontSize: '13px', lineHeight: 1.6
      }}>

        {/* Watermark */}
        {isFree && (
          <div style={{
            position: 'absolute', top: '50%', left: '50%',
            transform: 'translate(-50%, -50%) rotate(-45deg)',
            fontSize: '60px', fontWeight: 'bold', color: 'rgba(184,134,11,0.06)',
            whiteSpace: 'nowrap', pointerEvents: 'none', zIndex: 1,
            userSelect: 'none', letterSpacing: '8px'
          }}>VERSAO GRATUITA</div>
        )}

        {/* ══════ HEADER ══════ */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
          background: '#fff', borderBottom: `1px solid ${border}`, borderTop: `3px solid ${gold}`,
          padding: '1.2rem 1.5rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ fontSize: '36px', color: gold, lineHeight: 1, fontFamily: "'Noto Serif SC', serif" }}>風水</div>
            <div>
              <div style={{ fontSize: '20px', fontWeight: 400, letterSpacing: '0.02em' }}>
                Relatório de Harmonização Feng Shui
              </div>
              <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.12em', color: inkLt, marginTop: '2px', fontFamily: 'Helvetica Neue, Arial, sans-serif' }}>
                Escola Budista da Seita Negra · Diagnóstico Integrado · Roda da Vida &amp; Baguá
              </div>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '12px', color: inkLt, fontFamily: 'Helvetica Neue, Arial, sans-serif' }}>
              {profile?.nome_completo}
            </div>
            <div style={{ fontSize: '11px', color: inkLt, fontFamily: 'Helvetica Neue, Arial, sans-serif' }}>
              {new Date(consulta.criado_em).toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </div>
          </div>
        </div>

        {/* ══════ CLIENT BAR ══════ */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem',
          background: paperWarm, border: `1px solid ${border}`, borderTop: 'none',
          padding: '0.9rem 1.5rem'
        }}>
          {[
            { label: 'Cliente', value: consulta.clientes?.nome_completo },
            { label: 'Imóvel', value: `${consulta.nome_imovel}${consulta.endereco_imovel ? ` — ${consulta.endereco_imovel}` : ''}` },
            { label: 'Tipo', value: `${consulta.tipo_imovel || ''}${consulta.area_total_m2 ? ` · ${consulta.area_total_m2}m²` : ''}` },
            { label: 'Porta Principal', value: consulta.porta_posicao?.replace(/_/g, ' ') },
          ].map((f, i) => (
            <div key={i}>
              <div style={{ fontSize: '9px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.12em', color: gold, marginBottom: '4px', fontFamily: 'Helvetica Neue, Arial, sans-serif' }}>
                {f.label}
              </div>
              <div style={{ fontSize: '13px', color: ink, borderBottom: `1px solid ${border}`, paddingBottom: '2px' }}>
                {f.value || '—'}
              </div>
            </div>
          ))}
        </div>

        {/* ══════ SUMMARY BAR ══════ */}
        {geral !== null && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 0,
            background: paperWarm, border: `1px solid ${border}`, borderTop: 'none',
            padding: '0.7rem 1.5rem', overflow: 'hidden'
          }}>
            {[
              { val: `${geral}%`, label: 'Média Geral', color: geralLevel.color },
              null,
              { val: `${urgentCount}`, label: 'Áreas Urgentes', color: '#DC2626' },
              null,
              { val: `${okCount}`, label: 'Equilibradas', color: '#16A34A' },
              null,
              { val: lowestSetor?.nome || '—', label: 'Prioridade Máxima', color: '#DC2626', sm: true },
              null,
              { val: highestSetor?.nome || '—', label: 'Mais Equilibrada', color: '#16A34A', sm: true },
            ].map((item, idx) =>
              item === null ? (
                <div key={idx} style={{ width: '1px', background: border, height: '36px', flexShrink: 0 }} />
              ) : (
                <div key={idx} style={{ textAlign: 'center', flex: 1, padding: '0 0.5rem' }}>
                  <div style={{ fontSize: item.sm ? '14px' : '22px', color: item.color, lineHeight: 1, fontWeight: 400 }}>
                    {item.val}
                  </div>
                  <div style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.09em', color: inkLt, marginTop: '2px', fontFamily: 'Helvetica Neue, Arial, sans-serif' }}>
                    {item.label}
                  </div>
                </div>
              )
            )}
          </div>
        )}

        {/* ══════ CHARTS ROW: Roda da Vida + Baguá Lo Shu ══════ */}
        <div style={{ display: 'grid', gridTemplateColumns: hasRoda ? '1fr 1fr' : '1fr', gap: '0', padding: '1rem 1.5rem' }}>

          {/* Roda da Vida radar */}
          {hasRoda && (
            <div style={{ background: '#fff', border: `1px solid ${border}`, borderRadius: '4px', padding: '1rem', marginRight: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '15px', fontWeight: 400, paddingBottom: '8px', borderBottom: `1px solid ${border}`, marginBottom: '1rem' }}>
                <span style={{ fontSize: '20px', color: gold, lineHeight: 1, fontFamily: "'Noto Serif SC', serif" }}>輪</span>
                Roda da Vida
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px' }}>
                {RODA_AREAS.map(area => {
                  const val = rodaData[area.key]
                  if (val === undefined) return null
                  const setorMatch = findSetorByName(area.gua)
                  const setorPct = setorMatch?.score_percentual ?? null
                  const lvl = scoreLevelLabel(val * 10)
                  return (
                    <div key={area.key} style={{
                      padding: '8px 10px', borderRadius: '3px',
                      background: val <= 4 ? '#FEF2F2' : val <= 6 ? '#FFFBEB' : '#F0FDF4',
                      borderLeft: `3px solid ${lvl.color}`
                    }}>
                      <div style={{ fontSize: '10px', fontWeight: 600, color: ink, fontFamily: 'Helvetica Neue, Arial, sans-serif', marginBottom: '2px' }}>
                        {area.label}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '18px', fontWeight: 700, color: lvl.color }}>{val}</span>
                        <div style={{ flex: 1, height: '4px', background: '#E5DDD0', borderRadius: '2px', overflow: 'hidden' }}>
                          <div style={{ width: `${val * 10}%`, height: '100%', background: lvl.color, borderRadius: '2px' }} />
                        </div>
                      </div>
                      {setorPct !== null && (
                        <div style={{ fontSize: '9px', color: inkLt, marginTop: '2px', fontFamily: 'Helvetica Neue, Arial, sans-serif' }}>
                          Guá: {setorPct}%
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Baguá Lo Shu Grid */}
          <div style={{ background: '#fff', border: `1px solid ${border}`, borderRadius: '4px', padding: '1rem', marginLeft: hasRoda ? '0.5rem' : 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '15px', fontWeight: 400, paddingBottom: '8px', borderBottom: `1px solid ${border}`, marginBottom: '1rem' }}>
              <span style={{ fontSize: '20px', color: gold, lineHeight: 1, fontFamily: "'Noto Serif SC', serif" }}>八卦</span>
              Baguá · Mapa Energético Lo Shu
            </div>
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
              gridTemplateRows: 'repeat(3, 1fr)', gap: '3px', aspectRatio: '1'
            }}>
              {LOSHU_ORDER.map((nome, idx) => {
                const setor = findSetorByName(nome)
                const meta = AREA_META[nome] || AREA_META[setor?.nome || '']
                const pct = setor?.score_percentual ?? null
                const lvl = scoreLevelLabel(pct)
                const bg = meta?.bg || '#555'
                const fg = meta?.fg || '#ddd'
                const zh = meta?.zh || '?'
                const dir = meta?.dir || ''
                const trig = meta?.trig || ''
                const elem = meta?.elem || setor?.elemento || ''
                return (
                  <div key={idx} style={{
                    background: bg, color: fg, borderRadius: '3px',
                    padding: '7px 8px', display: 'flex', flexDirection: 'column',
                    justifyContent: 'space-between', position: 'relative', overflow: 'hidden',
                    minHeight: '80px'
                  }}>
                    {/* Top color line */}
                    <div style={{
                      position: 'absolute', top: 0, left: 0, right: 0, height: '3px',
                      background: lvl.color
                    }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ fontSize: '8px', textTransform: 'uppercase', letterSpacing: '0.07em', opacity: 0.75, lineHeight: 1.3, fontFamily: 'Helvetica Neue, Arial, sans-serif' }}>
                        {dir}<br />{trig}
                      </div>
                      <div style={{ fontSize: '22px', lineHeight: 1, opacity: 0.85, fontFamily: "'Noto Serif SC', serif" }}>{zh}</div>
                    </div>
                    <div style={{ fontSize: '10px', fontWeight: 600, lineHeight: 1.3, margin: '3px 0 2px', fontFamily: 'Helvetica Neue, Arial, sans-serif' }}>
                      {nome}
                    </div>
                    <div style={{ fontSize: '8px', opacity: 0.7, letterSpacing: '0.03em', fontFamily: 'Helvetica Neue, Arial, sans-serif' }}>
                      {elem}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '5px' }}>
                      <div style={{ fontSize: '18px', fontWeight: 700, lineHeight: 1, minWidth: '20px', fontFamily: 'Helvetica Neue, Arial, sans-serif' }}>
                        {pct !== null ? `${pct}` : '—'}
                      </div>
                      <div style={{ flex: 1, height: '3px', borderRadius: '2px', background: 'rgba(255,255,255,0.2)', overflow: 'hidden' }}>
                        <div style={{ height: '100%', background: 'rgba(255,255,255,0.72)', borderRadius: '2px', width: `${pct ?? 0}%` }} />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
            <div style={{ fontSize: '9px', color: inkLt, textAlign: 'center', marginTop: '6px', fontFamily: 'Helvetica Neue, Arial, sans-serif' }}>
              Escola Black Hat — Porta principal na base do mapa
            </div>
          </div>
        </div>

        {/* ══════ KI FLOW — sorted by priority ══════ */}
        {sortedSetores.length > 0 && (
          <div style={{ padding: '0 1.5rem 1rem' }}>
            <div style={{ background: '#fff', border: `1px solid ${border}`, borderRadius: '4px', padding: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '15px', fontWeight: 400, paddingBottom: '8px', borderBottom: `1px solid ${border}`, marginBottom: '1rem' }}>
                <span style={{ fontSize: '20px', color: gold, lineHeight: 1, fontFamily: "'Noto Serif SC', serif" }}>氣</span>
                Fluxo de Ki · Diagnóstico por Setor (por prioridade)
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '7px' }}>
                {sortedSetores.map(setor => {
                  const pct = setor.score_percentual ?? 0
                  const lvl = scoreLevelLabel(pct)
                  const isUrgent = pct < 40
                  const isWarn = pct >= 40 && pct < 70
                  const bgRow = isUrgent ? '#FEF2F2' : isWarn ? '#FFFBEB' : '#F0FDF4'
                  const borderCol = isUrgent ? '#EF4444' : isWarn ? '#F59E0B' : '#22C55E'
                  return (
                    <div key={setor.id} style={{
                      display: 'flex', alignItems: 'center', gap: '9px',
                      padding: '7px 11px', borderRadius: '3px',
                      background: bgRow, borderLeft: `3px solid ${borderCol}`
                    }}>
                      <div style={{ fontSize: '11px', width: '105px', flexShrink: 0, fontFamily: 'Helvetica Neue, Arial, sans-serif' }}>
                        {setor.nome}
                      </div>
                      <div style={{ flex: 1, height: '6px', background: '#EAE5DB', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', borderRadius: '3px', background: lvl.color, width: `${pct}%`, transition: 'width 0.5s ease' }} />
                      </div>
                      <div style={{
                        fontSize: '9px', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase',
                        width: '68px', textAlign: 'right', flexShrink: 0, color: lvl.color,
                        fontFamily: 'Helvetica Neue, Arial, sans-serif'
                      }}>{lvl.label}</div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* ══════ CHI FLOW + COMMAND POSITION ══════ */}
        {hasChi && (
          <div style={{ padding: '0 1.5rem 1rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.9rem' }}>
              {/* Chi checklist */}
              <div style={{ background: '#fff', border: `1px solid ${border}`, borderRadius: '4px', padding: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '8px', borderBottom: `1px solid ${border}`, marginBottom: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 400 }}>
                    <span style={{ fontSize: '18px', color: gold, fontFamily: "'Noto Serif SC', serif" }}>氣</span>
                    Checklist de Chi
                  </div>
                  <span style={{ fontSize: '16px', fontWeight: 700, color: scoreColor(chiScore) }}>{chiScore}%</span>
                </div>
                {CHI_ITEMS.map(item => {
                  const ok = checklistChi.includes(item.id)
                  return (
                    <div key={item.id} style={{
                      display: 'flex', alignItems: 'center', gap: '8px',
                      fontSize: '11px', padding: '3px 0', fontFamily: 'Helvetica Neue, Arial, sans-serif'
                    }}>
                      <span style={{ fontWeight: 700, fontSize: '12px', color: ok ? '#16A34A' : '#DC2626', width: '14px' }}>
                        {ok ? '✓' : '✕'}
                      </span>
                      <span style={{ color: ink }}>{item.label}</span>
                    </div>
                  )
                })}
              </div>
              {/* Command position */}
              <div style={{ background: '#fff', border: `1px solid ${border}`, borderRadius: '4px', padding: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 400, paddingBottom: '8px', borderBottom: `1px solid ${border}`, marginBottom: '10px' }}>
                  <span style={{ fontSize: '18px', color: gold, fontFamily: "'Noto Serif SC', serif" }}>位</span>
                  Posição de Comando
                </div>
                {Object.entries(posicaoComando).filter(([_, checks]) => checks.length > 0).map(([room, checks]) => {
                  const roomLabels: Record<string, string> = { quarto: 'Quarto', escritorio: 'Escritório', cozinha: 'Cozinha', sala: 'Sala' }
                  const roomChecks: Record<string, number> = { quarto: 5, escritorio: 5, cozinha: 4, sala: 4 }
                  const total = roomChecks[room] || checks.length
                  const pct = Math.round((checks.length / total) * 100)
                  const cor = pct >= 70 ? '#16A34A' : pct >= 40 ? '#D97706' : '#DC2626'
                  return (
                    <div key={room} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '6px 0', borderBottom: `1px solid #F0EDE5`, fontFamily: 'Helvetica Neue, Arial, sans-serif'
                    }}>
                      <span style={{ fontSize: '12px', color: ink }}>{roomLabels[room] || room}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <div style={{ width: '60px', height: '6px', background: '#EAE5DB', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ width: `${pct}%`, height: '100%', background: cor, borderRadius: '3px' }} />
                        </div>
                        <span style={{ fontSize: '11px', fontWeight: 700, color: cor, width: '32px', textAlign: 'right' }}>{pct}%</span>
                      </div>
                    </div>
                  )
                })}
                {Object.entries(posicaoComando).filter(([_, c]) => c.length > 0).length === 0 && (
                  <p style={{ fontSize: '11px', color: '#aaa', fontStyle: 'italic', margin: 0, fontFamily: 'Helvetica Neue, Arial, sans-serif' }}>Nenhum cômodo avaliado</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ══════ 3-COLUMN RECOMMENDATIONS ══════ */}
        <div style={{ padding: '0 1.5rem 1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '15px', fontWeight: 400, paddingBottom: '8px', borderBottom: `1px solid ${border}`, marginBottom: '1rem' }}>
            <span style={{ fontSize: '20px', color: gold, lineHeight: 1, fontFamily: "'Noto Serif SC', serif" }}>建</span>
            Recomendações Prioritárias
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.9rem' }}>
            {[
              { list: urgentes, title: 'Urgente', count: urgentes.length, bg: '#EF4444', icon: '⚑' },
              { list: atencao, title: 'Atenção', count: atencao.length, bg: '#F59E0B', icon: '◉' },
              { list: manterSetores, title: 'Manter', count: manterSetores.length, bg: '#22C55E', icon: '✓' },
            ].map(col => (
              <div key={col.title}>
                <div style={{
                  fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em',
                  padding: '7px 12px', borderRadius: '3px 3px 0 0', background: col.bg, color: '#fff',
                  display: 'flex', alignItems: 'center', gap: '6px', fontFamily: 'Helvetica Neue, Arial, sans-serif'
                }}>
                  {col.icon} {col.title} ({col.count})
                </div>
                <div style={{ background: '#fff', border: `1px solid ${border}`, borderTop: 'none', borderRadius: '0 0 3px 3px', minHeight: '40px' }}>
                  {col.list.length === 0 ? (
                    <div style={{ padding: '18px 12px', fontSize: '11px', color: '#aaa', textAlign: 'center', fontStyle: 'italic', fontFamily: 'Helvetica Neue, Arial, sans-serif' }}>
                      Nenhuma área neste nível
                    </div>
                  ) : col.list.map(setor => {
                    const meta = AREA_META[setor.nome]
                    const criteriosMap = getCriteriosMap(setor)
                    const rec = gerarRecomendacoes(setor.nome, setor.score_percentual ?? 0, criteriosMap)
                    const mainAction = meta?.action || rec.urgente[0] || rec.melhoria[0] || '—'
                    return (
                      <div key={setor.id} style={{ padding: '9px 12px', borderBottom: '1px dashed #EAE5DB' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '3px', fontSize: '11px', fontWeight: 600, fontFamily: 'Helvetica Neue, Arial, sans-serif' }}>
                          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: meta?.bg || '#666', flexShrink: 0 }} />
                          {setor.nome} · {meta?.dir || setor.posicao_grid}
                        </div>
                        <div style={{ fontSize: '11px', color: '#666', lineHeight: 1.5, marginBottom: '4px', fontFamily: 'Helvetica Neue, Arial, sans-serif' }}>
                          {mainAction}
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
                          {[meta?.elem, meta?.crystals?.split(',')[0]?.trim(), meta?.plants?.split(',')[0]?.trim(), meta?.colors?.split(',')[0]?.trim()].filter(Boolean).map((tag, ti) => (
                            <span key={ti} style={{
                              fontSize: '9px', padding: '1px 6px', borderRadius: '2px',
                              background: '#F5F0E5', color: '#666', border: '1px solid #E5DDD0',
                              fontFamily: 'Helvetica Neue, Arial, sans-serif'
                            }}>{tag}</span>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ══════ CURES & ACTIVATIONS TABLE ══════ */}
        <div style={{ padding: '0 1.5rem 1rem' }}>
          <div style={{ background: '#fff', border: `1px solid ${border}`, borderRadius: '4px', padding: '1rem', overflowX: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '15px', fontWeight: 400, paddingBottom: '8px', borderBottom: `1px solid ${border}`, marginBottom: '1rem' }}>
              <span style={{ fontSize: '20px', color: gold, lineHeight: 1, fontFamily: "'Noto Serif SC', serif" }}>治</span>
              Curas &amp; Ativações Detalhadas por Área
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', fontFamily: 'Helvetica Neue, Arial, sans-serif' }}>
              <thead>
                <tr>
                  {['Área · Guá', 'Nota', 'Nível', 'Elemento', 'Cores', 'Cristais', 'Plantas', 'Ação Principal'].map(th => (
                    <th key={th} style={{
                      textAlign: 'left', padding: '6px 9px', fontSize: '9px', fontWeight: 600,
                      textTransform: 'uppercase', letterSpacing: '0.1em', color: inkLt,
                      borderBottom: `1px solid ${border}`, whiteSpace: 'nowrap'
                    }}>{th}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedSetores.map((setor, idx) => {
                  const pct = setor.score_percentual ?? 0
                  const lvl = scoreLevelLabel(pct)
                  const meta = AREA_META[setor.nome]
                  return (
                    <tr key={setor.id} style={{ background: idx % 2 === 0 ? 'transparent' : '#FAFAF5' }}>
                      <td style={{ padding: '8px 9px', borderBottom: '1px solid #F0EDE5', verticalAlign: 'top' }}>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: '5px',
                          padding: '3px 8px', borderRadius: '2px', fontSize: '10px', fontWeight: 600,
                          background: meta?.bg || '#555', color: meta?.fg || '#ddd', whiteSpace: 'nowrap'
                        }}>
                          {meta?.zh || ''} {setor.nome}
                        </span>
                      </td>
                      <td style={{ padding: '8px 9px', borderBottom: '1px solid #F0EDE5', verticalAlign: 'top' }}>
                        <span style={{
                          display: 'inline-block', padding: '2px 8px', borderRadius: '10px',
                          fontSize: '11px', fontWeight: 700,
                          background: pct < 40 ? '#FEF2F2' : pct < 70 ? '#FFFBEB' : '#F0FDF4',
                          color: lvl.color
                        }}>{pct}%</span>
                      </td>
                      <td style={{ padding: '8px 9px', borderBottom: '1px solid #F0EDE5', color: lvl.color, fontWeight: 600, fontSize: '10px', verticalAlign: 'top' }}>
                        {lvl.label}
                      </td>
                      <td style={{ padding: '8px 9px', borderBottom: '1px solid #F0EDE5', verticalAlign: 'top' }}>{meta?.elem || setor.elemento}</td>
                      <td style={{ padding: '8px 9px', borderBottom: '1px solid #F0EDE5', color: lvl.color, verticalAlign: 'top' }}>
                        {meta?.colors?.split(',').slice(0, 2).join(', ').trim() || '—'}
                      </td>
                      <td style={{ padding: '8px 9px', borderBottom: '1px solid #F0EDE5', verticalAlign: 'top' }}>
                        {meta?.crystals?.split(',').slice(0, 2).join(', ').trim() || '—'}
                      </td>
                      <td style={{ padding: '8px 9px', borderBottom: '1px solid #F0EDE5', verticalAlign: 'top' }}>
                        {meta?.plants?.split(',')[0]?.trim() || '—'}
                      </td>
                      <td style={{ padding: '8px 9px', borderBottom: '1px solid #F0EDE5', color: '#555', verticalAlign: 'top', maxWidth: '200px' }}>
                        {meta?.action || '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* ══════ DETAILED SECTOR DIAGNOSTICS ══════ */}
        <div style={{ padding: '0 1.5rem 1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '15px', fontWeight: 400, paddingBottom: '8px', borderBottom: `1px solid ${border}`, marginBottom: '1rem' }}>
            <span style={{ fontSize: '20px', color: gold, lineHeight: 1, fontFamily: "'Noto Serif SC', serif" }}>診</span>
            Diagnóstico Detalhado por Setor
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {setores.map(setor => {
              const pct = setor.score_percentual ?? null
              const criteriosMap = getCriteriosMap(setor)
              const rec = pct != null ? gerarRecomendacoes(setor.nome, pct, criteriosMap) : null
              const temRec = rec ? (rec.urgente.length + rec.melhoria.length + rec.manutencao.length > 0) : false
              const meta = AREA_META[setor.nome]
              const lvl = scoreLevelLabel(pct)
              const cRecs: { tipo: string; texto: string; produtos: string[] }[] = Array.isArray(setor.recomendacoes_custom) ? setor.recomendacoes_custom : []
              const comodoLabel = setor.comodo_tipo ? (COMODO_LABELS[setor.comodo_tipo] || setor.comodo_tipo) : null

              return (
                <div key={setor.id} style={{
                  border: `1px solid ${border}`, borderRadius: '4px', overflow: 'hidden',
                  pageBreakInside: 'avoid'
                }}>
                  {/* Header */}
                  <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '10px 14px', background: meta?.bg || '#F9FAFB',
                    color: meta?.fg || ink
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '20px', fontFamily: "'Noto Serif SC', serif", opacity: 0.85 }}>
                        {meta?.zh || setor.numero}
                      </span>
                      <div>
                        <span style={{ fontWeight: 600, fontSize: '14px', fontFamily: 'Helvetica Neue, Arial, sans-serif' }}>{setor.nome}</span>
                        <span style={{ fontSize: '11px', marginLeft: '8px', opacity: 0.75, fontFamily: 'Helvetica Neue, Arial, sans-serif' }}>
                          {setor.elemento} · {meta?.dir || setor.posicao_grid}
                          {comodoLabel && ` · ${comodoLabel}`}
                        </span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{
                        fontSize: '9px', fontWeight: 600, padding: '2px 8px', borderRadius: '10px',
                        background: `${lvl.color}25`, color: lvl.color, letterSpacing: '0.06em',
                        fontFamily: 'Helvetica Neue, Arial, sans-serif'
                      }}>{lvl.label}</span>
                      {pct !== null && (
                        <span style={{
                          display: 'inline-block', padding: '2px 10px', borderRadius: '10px',
                          fontSize: '13px', fontWeight: 700, background: 'rgba(255,255,255,0.2)', color: meta?.fg || lvl.color
                        }}>{pct}%</span>
                      )}
                    </div>
                  </div>

                  <div style={{ padding: '12px 14px', background: '#fff' }}>
                    {/* Criteria */}
                    {(setor.diagnostico_criterios?.length ?? 0) > 0 && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', marginBottom: '10px' }}>
                        {setor.diagnostico_criterios!.map((c: DiagnosticoCriterio) => (
                          <div key={c.id} style={{
                            display: 'flex', justifyContent: 'space-between', fontSize: '11px',
                            padding: '4px 8px', background: '#FAFAF5', borderRadius: '3px',
                            fontFamily: 'Helvetica Neue, Arial, sans-serif'
                          }}>
                            <span style={{ color: '#666' }}>{c.criterio}</span>
                            <span style={{ color: scoreColor(c.score * 33), fontWeight: 700 }}>{c.score}/3</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Notes */}
                    {setor.diagnostico_criterios?.some((c: DiagnosticoCriterio) => c.notas) && (
                      <div style={{ marginBottom: '10px', padding: '8px 10px', background: paperWarm, borderRadius: '3px', border: `1px solid ${border}` }}>
                        <div style={{ fontSize: '9px', fontWeight: 600, color: gold, marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'Helvetica Neue, Arial, sans-serif' }}>
                          Observações
                        </div>
                        {setor.diagnostico_criterios.filter((c: DiagnosticoCriterio) => c.notas).map((c: DiagnosticoCriterio) => (
                          <p key={c.id} style={{ margin: '2px 0', fontSize: '11px', color: '#555', fontFamily: 'Helvetica Neue, Arial, sans-serif' }}>
                            <strong>{c.criterio}:</strong> {c.notas}
                          </p>
                        ))}
                      </div>
                    )}

                    {/* Recommendations */}
                    {temRec && rec && (
                      <div style={{ marginBottom: cRecs.length > 0 ? '10px' : '0' }}>
                        {rec.urgente.length > 0 && rec.urgente.map((d, i) => (
                          <div key={`u${i}`} style={{ padding: '5px 10px', background: '#FEF2F2', borderLeft: '3px solid #EF4444', borderRadius: '2px', marginBottom: '3px', fontSize: '11px', color: '#374151', fontFamily: 'Helvetica Neue, Arial, sans-serif' }}>{d}</div>
                        ))}
                        {rec.melhoria.length > 0 && rec.melhoria.map((d, i) => (
                          <div key={`m${i}`} style={{ padding: '5px 10px', background: '#FFFBEB', borderLeft: '3px solid #F59E0B', borderRadius: '2px', marginBottom: '3px', fontSize: '11px', color: '#374151', fontFamily: 'Helvetica Neue, Arial, sans-serif' }}>{d}</div>
                        ))}
                        {rec.manutencao.length > 0 && rec.manutencao.map((d, i) => (
                          <div key={`k${i}`} style={{ padding: '5px 10px', background: '#F0FDF4', borderLeft: '3px solid #22C55E', borderRadius: '2px', marginBottom: '3px', fontSize: '11px', color: '#374151', fontFamily: 'Helvetica Neue, Arial, sans-serif' }}>{d}</div>
                        ))}
                      </div>
                    )}

                    {/* Custom consultant recs */}
                    {cRecs.length > 0 && cRecs.map((cr, i) => (
                      <div key={i} style={{
                        padding: '6px 10px', background: paperWarm,
                        borderLeft: `3px solid ${cr.tipo === 'urgente' ? '#DC2626' : cr.tipo === 'melhoria' ? '#D97706' : '#16A34A'}`,
                        borderRadius: '2px', marginBottom: '3px', fontSize: '11px',
                        fontFamily: 'Helvetica Neue, Arial, sans-serif'
                      }}>
                        <span style={{
                          fontSize: '8px', fontWeight: 700, color: '#fff', padding: '1px 5px', borderRadius: '4px', marginRight: '6px',
                          background: cr.tipo === 'urgente' ? '#DC2626' : cr.tipo === 'melhoria' ? '#D97706' : '#16A34A'
                        }}>{cr.tipo === 'urgente' ? 'URGENTE' : cr.tipo === 'melhoria' ? 'MELHORIA' : 'MANTER'}</span>
                        {cr.texto}
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* ══════ Ba Gua PLANT IMAGE ══════ */}
        {consulta.bagua_imagem && (
          <div style={{ padding: '0 1.5rem 1rem', textAlign: 'center' }}>
            <img
              src={consulta.bagua_imagem}
              alt="Planta Ba Gua"
              style={{ maxWidth: '100%', maxHeight: '380px', borderRadius: '4px', border: `1px solid ${border}`, objectFit: 'contain' }}
            />
            <p style={{ color: '#aaa', fontSize: '10px', margin: '6px 0 0 0', fontFamily: 'Helvetica Neue, Arial, sans-serif' }}>
              Planta com grid Ba Gua — análise geométrica automática
            </p>
          </div>
        )}

        {/* ══════ FOOTER ══════ */}
        <div style={{
          textAlign: 'center', padding: '0.9rem 1.5rem',
          borderTop: `1px solid ${border}`, marginTop: '0.5rem',
          fontFamily: 'Helvetica Neue, Arial, sans-serif', fontSize: '10px', color: '#aaa', letterSpacing: '0.06em'
        }}>
          Relatório Feng Shui · Escola Budista da Seita Negra ·
          {profile?.nome_completo && ` Consultor(a): ${profile.nome_completo}`}
          {profile?.registro_profissional && ` · ${profile.registro_profissional}`}
          {' '} · Gerado em: {new Date().toLocaleDateString('pt-BR')}
        </div>

      </div>
    </>
  )
}
