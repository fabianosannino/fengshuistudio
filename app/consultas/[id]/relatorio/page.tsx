'use client'

import { useEffect, useState, useRef } from 'react'
import { supabase } from '../../../../src/lib/supabase'
import { useRouter, useParams } from 'next/navigation'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

const CRITERIOS = [
  'Limpeza e organizacao',
  'Iluminacao adequada',
  'Ventilacao e ar fresco',
  'Cores harmonicas',
  'Mobiliario posicionado',
  'Plantas e elementos naturais',
  'Ausencia de objetos quebrados',
  'Fluxo de energia livre',
]

const SETOR_DICAS: Record<string, string[]> = {
  'Carreira':       ['Adicione elemento água: aquário, fonte ou imagem de rio','Use tons pretos, azul escuro e ondulados','Coloque espelho estrategicamente para ampliar o espaço','Mantenha o caminho até a porta livre','Adicione cristais negros como obsidiana'],
  'Conhecimento':   ['Crie espaço de estudo ou leitura tranquilo','Use tons azul-escuro, verde e preto','Adicione livros, mapas ou objetos de aprendizado','Iluminação focada e direta para concentração','Elimine distrações e eletrônicos desnecessários'],
  'Família':        ['Use tons verdes e azuis para harmonia familiar','Coloque fotos da família em momentos felizes','Adicione plantas de madeira como bambu da sorte','Mantenha a área livre de objetos de conflito','Use madeira natural na decoração'],
  'Prosperidade':   ['Adicione plantas saudáveis e viçosas','Use tons roxo, verde e dourado','Coloque símbolos de abundância como moedas ou peixes','Mantenha este setor sempre limpo e iluminado','Ative com fonte de água pequena ou aquário'],
  'Centro':         ['Adicione cristais amarelos ou cerâmicas','Mantenha sempre limpo — centro irradia para todos os setores','Use tons terrosos: amarelo, ocre, marrom'],
  'Centro/Saúde':   ['Adicione cristais amarelos ou cerâmicas','Mantenha sempre limpo — centro irradia para todos os setores','Use tons terrosos: amarelo, ocre, marrom'],
  'Pessoas Uteis':  ['Adicione objetos metálicos e brancos','Use tons cinza, prata e branco','Adicione sinos ou móbiles metálicos'],
  'Pessoas Úteis':  ['Adicione objetos metálicos e brancos','Use tons cinza, prata e branco','Adicione sinos ou móbiles metálicos'],
  'Filhos':         ['Use tons brancos, cinza e pastéis','Adicione elementos metálicos e circulares','Adicione cristais brancos como selenita'],
  'Criatividade':   ['Adicione elementos brancos e metálicos','Use tons brancos, cinza e pastéis','Adicione cristais brancos como selenita'],
  'Relacionamentos':['Use tons rosa, vermelho e branco em pares','Coloque objetos em duplas: velas, porta-retratos','Adicione cristais de quartzo rosa'],
  'Fama':           ['Adicione elementos de fogo: velas ou luz vermelha','Use tons vermelhos e laranja na decoração','Exponha diplomas, prêmios e reconhecimentos'],
  'Fama/Reputação': ['Adicione elementos de fogo: velas ou luz vermelha','Use tons vermelhos e laranja na decoração','Exponha diplomas, prêmios e reconhecimentos'],
  'Espiritualidade':['Crie um espaço de meditação ou altar pessoal','Use tons roxo, azul escuro e branco','Adicione objetos sagrados e significativos'],
}

const CRITERIO_DICAS: Record<number, string[]> = {
  0: ['Faça limpeza profunda e reorganize completamente este setor','Descarte objetos desnecessários — desordem bloqueia fluxo de energia','Elimine poeira e sujeira acumulada nos cantos e sob móveis'],
  1: ['Aumente iluminação com luminárias adicionais ou spots direcionados','Substitua lâmpadas fracas ou queimadas por equivalentes mais potentes','Adicione espelhos estratégicos para refletir e ampliar a luz natural'],
  2: ['Abra janelas diariamente para renovar o ar pelo menos 15 minutos','Adicione plantas purificadoras como espada-de-são-jorge ou lírio-da-paz','Considere um purificador de ar ou difusor de óleos essenciais'],
  3: ['Introduza a cor dominante do elemento deste setor na decoração','Substitua cores dissonantes por tons neutros ou do elemento correto','Use almofadas, quadros ou tapetes nas cores indicadas para ativação'],
  4: ['Reposicione o móvel principal para ficar de costas para parede sólida','Afaste móveis de cantos mortos e garanta passagem de pelo menos 60cm','Remova móveis que bloqueiam portas, janelas ou o fluxo de circulação'],
  5: ['Adicione uma planta saudável e viçosa com folhas arredondadas','Substitua plantas murchas ou secas — plantas doentes geram energia negativa','Coloque um vaso com terra ou elemento natural representando o ciclo vital'],
  6: ['Remova imediatamente objetos quebrados, lascados ou sem funcionalidade','Conserte ou substitua itens danificados — simbolizam situações inacabadas','Verifique equipamentos elétricos com mau funcionamento e conserte-os'],
  7: ['Reorganize a disposição dos móveis para criar fluxo em curvas suaves','Elimine corredores longos e estreitos usando plantas ou biombos','Certifique-se que a porta principal abre completamente sem obstruções'],
}

const PRODUTO_MAP: Record<string, { nome: string; categoria: string }> = {
  'espelho': { nome: 'Espelhos Ba Gua', categoria: 'espelhos' },
  'cristal': { nome: 'Cristais e Pedras', categoria: 'cristais' },
  'cristais': { nome: 'Cristais e Pedras', categoria: 'cristais' },
  'quartzo': { nome: 'Cristais e Pedras', categoria: 'cristais' },
  'obsidiana': { nome: 'Cristais e Pedras', categoria: 'cristais' },
  'selenita': { nome: 'Cristais e Pedras', categoria: 'cristais' },
  'fonte': { nome: 'Fontes de Agua', categoria: 'fontes' },
  'aquário': { nome: 'Fontes de Agua', categoria: 'fontes' },
  'aquario': { nome: 'Fontes de Agua', categoria: 'fontes' },
  'planta': { nome: 'Plantas e Vasos', categoria: 'plantas' },
  'bambu': { nome: 'Plantas e Vasos', categoria: 'plantas' },
  'lírio': { nome: 'Plantas e Vasos', categoria: 'plantas' },
  'sino': { nome: 'Sinos de Vento', categoria: 'sinos' },
  'móbile': { nome: 'Sinos de Vento', categoria: 'sinos' },
  'mobile': { nome: 'Sinos de Vento', categoria: 'sinos' },
  'vela': { nome: 'Velas e Incensos', categoria: 'velas' },
  'incens': { nome: 'Velas e Incensos', categoria: 'velas' },
  'difusor': { nome: 'Velas e Incensos', categoria: 'velas' },
  'moeda': { nome: 'Decoracao e Simbolos', categoria: 'decoracao' },
}

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

function getProdutosSugeridos(recomendacoes: string[]): { nome: string; categoria: string }[] {
  const found = new Map<string, { nome: string; categoria: string }>()
  recomendacoes.forEach(rec => {
    const lower = rec.toLowerCase()
    Object.entries(PRODUTO_MAP).forEach(([keyword, produto]) => {
      if (lower.includes(keyword) && !found.has(produto.categoria)) {
        found.set(produto.categoria, produto)
      }
    })
  })
  return Array.from(found.values())
}

// Ba Gua sector grid layout (3x3) — position mapping
const BAGUA_GRID: { nome: string; elemento: string; cor: string }[][] = [
  [
    { nome: 'Prosperidade', elemento: 'Madeira', cor: '#6B21A8' },
    { nome: 'Fama', elemento: 'Fogo', cor: '#DC2626' },
    { nome: 'Relacionamentos', elemento: 'Terra', cor: '#DB2777' },
  ],
  [
    { nome: 'Família', elemento: 'Madeira', cor: '#15803D' },
    { nome: 'Centro', elemento: 'Terra', cor: '#CA8A04' },
    { nome: 'Criatividade', elemento: 'Metal', cor: '#6B7280' },
  ],
  [
    { nome: 'Conhecimento', elemento: 'Terra', cor: '#1D4ED8' },
    { nome: 'Carreira', elemento: 'Água', cor: '#0F172A' },
    { nome: 'Pessoas Úteis', elemento: 'Metal', cor: '#64748B' },
  ],
]

export default function Relatorio() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const printRef = useRef<HTMLDivElement>(null)

  const [consulta, setConsulta] = useState<any>(null)
  const [setores, setSetores] = useState<any[]>([])
  const [profile, setProfile] = useState<any>(null)
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

  function scoreColor(pct: number | null) {
    if (pct === null || pct === undefined) return '#9CA3AF'
    if (pct >= 70) return '#15803D'
    if (pct >= 40) return '#D97706'
    return '#DC2626'
  }

  function scoreLabel(pct: number | null) {
    if (pct === null || pct === undefined) return 'Nao avaliado'
    if (pct >= 70) return 'Bom'
    if (pct >= 40) return 'Regular'
    return 'Critico'
  }

  function energiaLabel(energia: string | null) {
    if (!energia) return null
    const map: Record<string, { label: string; cor: string; icon: string }> = {
      'falta': { label: 'Falta de Energia', cor: '#DC2626', icon: '▼' },
      'excesso': { label: 'Excesso de Energia', cor: '#D97706', icon: '▲' },
      'normal': { label: 'Energia Normal', cor: '#15803D', icon: '●' },
    }
    return map[energia] || null
  }

  function scoreGeral() {
    const avaliados = setores.filter(s => s.score_percentual !== null)
    if (avaliados.length === 0) return null
    const soma = avaliados.reduce((a, s) => a + s.score_percentual, 0)
    return Math.round(soma / avaliados.length)
  }

  function getCriteriosMap(setor: any): Record<string, number> {
    const map: Record<string, number> = {}
    setor.diagnostico_criterios?.forEach((c: any) => {
      map[c.criterio] = c.score
    })
    return map
  }

  function handlePrint() {
    window.print()
  }

  async function handleDownloadPDF() {
    if (!printRef.current) return
    setDownloading(true)

    try {
      const canvas = await html2canvas(printRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
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
          const centerX = imgWidth / 2
          const centerY = pageHeight / 2
          pdf.text('VERSAO GRATUITA', centerX, centerY, { align: 'center', angle: 45 })
          pdf.restoreGraphicsState()
        }
      }

      const nomeArquivo = `relatorio-${consulta.nome_imovel?.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'consulta'}.pdf`
      pdf.save(nomeArquivo)
    } catch (err) {
      console.error('Erro ao gerar PDF:', err)
      alert('Erro ao gerar PDF. Tente usar a opcao Imprimir.')
    } finally {
      setDownloading(false)
    }
  }

  // Find setor data by name for the Ba Gua grid
  function findSetorByName(nome: string) {
    return setores.find(s =>
      s.nome === nome ||
      s.nome === nome.replace('Úteis', 'Uteis') ||
      s.nome === nome.replace('Uteis', 'Úteis') ||
      s.nome === 'Centro/Saúde' && nome === 'Centro' ||
      s.nome === 'Fama/Reputação' && nome === 'Fama' ||
      s.nome === 'Filhos' && nome === 'Criatividade'
    )
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F9FAFB', fontFamily: 'Arial, sans-serif' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>☯</div>
          <p style={{ color: '#7C3AED', fontSize: '16px' }}>Gerando relatorio...</p>
        </div>
      </div>
    )
  }

  const geral = scoreGeral()

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { margin: 0; }
          .print-area { padding: 0 !important; box-shadow: none !important; }
        }
      `}</style>

      {/* Toolbar */}
      <div className="no-print" style={{
        background: '#1E3A5F', padding: '12px 32px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '24px', cursor: 'pointer' }} onClick={() => router.push(`/consultas/${id}`)}>☯</span>
          <span style={{ color: '#B8860B', fontSize: '18px', fontWeight: 'bold' }}>FengShui Studio</span>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {isFree && (
            <span style={{ color: '#FBBF24', fontSize: '12px', background: 'rgba(251,191,36,0.15)', padding: '4px 12px', borderRadius: '20px' }}>
              Plano Free — PDF com marca d&apos;agua
            </span>
          )}
          <button onClick={() => router.push(`/consultas/${id}`)} style={{
            background: 'transparent', border: '1px solid rgba(255,255,255,0.3)',
            color: '#ffffff', padding: '8px 20px', borderRadius: '6px', cursor: 'pointer', fontSize: '14px'
          }}>← Voltar</button>
          <button onClick={handlePrint} style={{
            background: 'transparent', border: '1px solid rgba(255,255,255,0.3)',
            color: '#ffffff', padding: '8px 20px', borderRadius: '6px', cursor: 'pointer', fontSize: '14px'
          }}>Imprimir</button>
          <button onClick={handleDownloadPDF} disabled={downloading} style={{
            background: downloading ? '#9CA3AF' : '#7C3AED', border: 'none',
            color: '#ffffff', padding: '8px 24px', borderRadius: '6px',
            cursor: downloading ? 'not-allowed' : 'pointer', fontSize: '14px', fontWeight: 'bold'
          }}>{downloading ? 'Gerando PDF...' : 'Baixar PDF'}</button>
        </div>
      </div>

      {/* Relatorio */}
      <div ref={printRef} className="print-area" style={{
        background: '#ffffff', maxWidth: '800px', margin: '32px auto',
        padding: '48px', fontFamily: 'Arial, sans-serif',
        boxShadow: '0 4px 20px rgba(0,0,0,0.1)', borderRadius: '8px',
        position: 'relative', overflow: 'hidden'
      }}>

        {/* Watermark visual for Free plan */}
        {isFree && (
          <div style={{
            position: 'absolute', top: '50%', left: '50%',
            transform: 'translate(-50%, -50%) rotate(-45deg)',
            fontSize: '60px', fontWeight: 'bold', color: 'rgba(124, 58, 237, 0.08)',
            whiteSpace: 'nowrap', pointerEvents: 'none', zIndex: 1,
            userSelect: 'none', letterSpacing: '8px'
          }}>
            VERSAO GRATUITA
          </div>
        )}

        {/* ══════════════════ HEADER ══════════════════ */}
        <div style={{ borderBottom: '3px solid #1E3A5F', paddingBottom: '24px', marginBottom: '32px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '36px', marginBottom: '4px' }}>☯</div>
              <h1 style={{ color: '#1E3A5F', fontSize: '24px', fontWeight: 'bold', margin: '0 0 4px 0' }}>
                FengShui Studio
              </h1>
              <p style={{ color: '#7C3AED', fontSize: '13px', margin: '0' }}>
                Relatorio de Diagnostico Ba Gua
              </p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ color: '#6B7280', fontSize: '12px', margin: '0 0 4px 0' }}>
                Consultor: {profile?.nome_completo}
              </p>
              {profile?.nome_empresa && (
                <p style={{ color: '#6B7280', fontSize: '12px', margin: '0 0 4px 0' }}>{profile.nome_empresa}</p>
              )}
              <p style={{ color: '#6B7280', fontSize: '12px', margin: '0' }}>
                Data: {new Date(consulta.criado_em).toLocaleDateString('pt-BR')}
              </p>
            </div>
          </div>
        </div>

        {/* ══════════════════ DADOS DO IMOVEL / CLIENTE ══════════════════ */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '32px' }}>
          <div style={{ background: '#F9FAFB', borderRadius: '8px', padding: '20px' }}>
            <h3 style={{ color: '#1E3A5F', fontSize: '14px', fontWeight: 'bold', margin: '0 0 12px 0', textTransform: 'uppercase' }}>Imovel</h3>
            <p style={{ margin: '4px 0', fontSize: '14px', color: '#374151' }}><strong>{consulta.nome_imovel}</strong></p>
            {consulta.tipo_imovel && <p style={{ margin: '4px 0', fontSize: '13px', color: '#6B7280' }}>Tipo: {consulta.tipo_imovel}</p>}
            {consulta.area_total_m2 && <p style={{ margin: '4px 0', fontSize: '13px', color: '#6B7280' }}>Area: {consulta.area_total_m2}m²</p>}
            {consulta.endereco_imovel && <p style={{ margin: '4px 0', fontSize: '13px', color: '#6B7280' }}>{consulta.endereco_imovel}</p>}
            <p style={{ margin: '4px 0', fontSize: '13px', color: '#6B7280' }}>Porta: {consulta.porta_posicao?.replace(/_/g, ' ')}</p>
          </div>
          <div style={{ background: '#F9FAFB', borderRadius: '8px', padding: '20px' }}>
            <h3 style={{ color: '#1E3A5F', fontSize: '14px', fontWeight: 'bold', margin: '0 0 12px 0', textTransform: 'uppercase' }}>Cliente</h3>
            <p style={{ margin: '4px 0', fontSize: '14px', color: '#374151' }}><strong>{consulta.clientes?.nome_completo}</strong></p>
            {consulta.clientes?.email && <p style={{ margin: '4px 0', fontSize: '13px', color: '#6B7280' }}>{consulta.clientes.email}</p>}
            {consulta.clientes?.telefone && <p style={{ margin: '4px 0', fontSize: '13px', color: '#6B7280' }}>{consulta.clientes.telefone}</p>}
            {consulta.clientes?.cidade && <p style={{ margin: '4px 0', fontSize: '13px', color: '#6B7280' }}>{consulta.clientes.cidade}{consulta.clientes.estado ? ` - ${consulta.clientes.estado}` : ''}</p>}
          </div>
        </div>

        {/* ══════════════════ SCORE GERAL ══════════════════ */}
        {geral !== null && (
          <div style={{
            background: `linear-gradient(135deg, #1E3A5F, #2d5a8e)`,
            borderRadius: '12px', padding: '24px 32px', marginBottom: '32px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between'
          }}>
            <div>
              <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '13px', margin: '0 0 4px 0' }}>Score Energetico Geral</p>
              <p style={{ color: '#ffffff', fontSize: '28px', fontWeight: 'bold', margin: '0' }}>{consulta.nome_imovel}</p>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{
                width: '80px', height: '80px', borderRadius: '50%',
                background: scoreColor(geral), display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                flexDirection: 'column'
              }}>
                <span style={{ color: '#fff', fontSize: '22px', fontWeight: 'bold' }}>{geral}%</span>
              </div>
              <p style={{ color: '#ffffff', fontSize: '13px', margin: '8px 0 0 0' }}>{scoreLabel(geral)}</p>
            </div>
          </div>
        )}

        {/* ══════════════════ PLANTA BA GUA COM GRID ══════════════════ */}
        <div style={{ marginBottom: '32px' }}>
          <h2 style={{ color: '#1E3A5F', fontSize: '18px', fontWeight: 'bold', marginBottom: '16px' }}>
            Mapa Ba Gua do Imovel
          </h2>

          {/* Ba Gua plant image from canvas */}
          {consulta.bagua_imagem && (
            <div style={{ marginBottom: '16px', textAlign: 'center' }}>
              <img
                src={consulta.bagua_imagem}
                alt="Planta Ba Gua"
                style={{
                  maxWidth: '100%', maxHeight: '400px',
                  borderRadius: '8px', border: '2px solid #E5E7EB',
                  objectFit: 'contain'
                }}
              />
              <p style={{ color: '#9CA3AF', fontSize: '11px', margin: '8px 0 0 0' }}>
                Planta com grid Ba Gua — analise geometrica automatica
              </p>
            </div>
          )}

          {/* 3x3 Ba Gua Grid visual summary */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
            gap: '2px', background: '#E5E7EB', borderRadius: '10px',
            overflow: 'hidden', border: '2px solid #1E3A5F'
          }}>
            {BAGUA_GRID.flat().map((cell, idx) => {
              const setor = findSetorByName(cell.nome)
              const pct = setor?.score_percentual ?? null
              const energia = setor?.avaliacao_geometrica || null
              const enInfo = energiaLabel(energia)
              return (
                <div key={idx} style={{
                  background: '#ffffff', padding: '10px 8px',
                  textAlign: 'center', minHeight: '80px',
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center', gap: '4px'
                }}>
                  <div style={{
                    fontSize: '10px', fontWeight: 'bold', color: cell.cor,
                    textTransform: 'uppercase', letterSpacing: '0.03em'
                  }}>{cell.nome}</div>
                  <div style={{ fontSize: '9px', color: '#9CA3AF' }}>{cell.elemento}</div>
                  {pct !== null ? (
                    <div style={{
                      background: scoreColor(pct), color: '#fff',
                      borderRadius: '12px', padding: '2px 10px',
                      fontSize: '12px', fontWeight: 'bold', marginTop: '2px'
                    }}>{pct}%</div>
                  ) : (
                    <div style={{ fontSize: '10px', color: '#D1D5DB', marginTop: '2px' }}>—</div>
                  )}
                  {enInfo && (
                    <div style={{ fontSize: '9px', color: enInfo.cor, fontWeight: 'bold' }}>
                      {enInfo.icon} {enInfo.label}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          <p style={{ color: '#9CA3AF', fontSize: '11px', margin: '8px 0 0 0', textAlign: 'center' }}>
            Escola Black Hat — Porta principal na base do mapa
          </p>
        </div>

        {/* ══════════════════ DIAGNOSTICO POR SETOR ══════════════════ */}
        <h2 style={{ color: '#1E3A5F', fontSize: '18px', fontWeight: 'bold', marginBottom: '16px' }}>
          Diagnostico por Setor
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '32px' }}>
          {setores.map(setor => {
            const pct = setor.score_percentual
            const criteriosMap = getCriteriosMap(setor)
            const rec = pct !== null ? gerarRecomendacoes(setor.nome, pct, criteriosMap) : null
            const temRec = rec ? (rec.urgente.length + rec.melhoria.length + rec.manutencao.length > 0) : false
            const energia = setor.avaliacao_geometrica || null
            const enInfo = energiaLabel(energia)
            const cRecs: { tipo: string; texto: string; produtos: string[] }[] = Array.isArray(setor.recomendacoes_custom) ? setor.recomendacoes_custom : []

            // Collect products for this sector's recommendations
            const todasRec = rec ? [...rec.urgente, ...rec.melhoria, ...rec.manutencao] : []
            const produtos = getProdutosSugeridos(todasRec)
            // Add custom recommendation products
            cRecs.forEach(cr => {
              cr.produtos?.forEach(cat => {
                if (!produtos.find(p => p.categoria === cat)) {
                  const CATS: Record<string, string> = { espelhos: 'Espelhos Ba Gua', cristais: 'Cristais e Pedras', fontes: 'Fontes de Agua', plantas: 'Plantas e Vasos', sinos: 'Sinos de Vento', velas: 'Velas e Incensos', decoracao: 'Decoracao e Simbolos' }
                  if (CATS[cat]) produtos.push({ nome: CATS[cat], categoria: cat })
                }
              })
            })

            return (
              <div key={setor.id} style={{
                border: '1px solid #E5E7EB', borderRadius: '10px', overflow: 'hidden',
                pageBreakInside: 'avoid'
              }}>
                {/* Sector header */}
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '14px 18px',
                  background: '#F9FAFB', borderBottom: '1px solid #E5E7EB'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                      width: '32px', height: '32px', borderRadius: '50%',
                      background: scoreColor(pct),
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#fff', fontSize: '13px', fontWeight: 'bold'
                    }}>{setor.numero}</div>
                    <div>
                      <span style={{ color: '#1E3A5F', fontWeight: 'bold', fontSize: '15px' }}>{setor.nome}</span>
                      <span style={{ color: '#9CA3AF', fontSize: '12px', marginLeft: '8px' }}>{setor.elemento} • {setor.posicao_grid}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {enInfo && (
                      <span style={{
                        fontSize: '11px', color: enInfo.cor, fontWeight: 'bold',
                        padding: '2px 8px', background: `${enInfo.cor}15`, borderRadius: '12px'
                      }}>
                        {enInfo.icon} {enInfo.label}
                      </span>
                    )}
                    {pct !== null && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{
                          width: '100px', height: '8px', background: '#E5E7EB', borderRadius: '4px', overflow: 'hidden'
                        }}>
                          <div style={{ width: `${pct}%`, height: '100%', background: scoreColor(pct), borderRadius: '4px' }} />
                        </div>
                        <span style={{ color: scoreColor(pct), fontWeight: 'bold', fontSize: '14px', minWidth: '40px' }}>
                          {pct}%
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ padding: '14px 18px' }}>
                  {/* Criteria scores */}
                  {setor.diagnostico_criterios?.length > 0 && (
                    <div style={{ marginBottom: '14px' }}>
                      <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#374151', marginBottom: '8px', textTransform: 'uppercase' }}>
                        Avaliacao dos Criterios
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                        {setor.diagnostico_criterios.map((c: any) => (
                          <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#6B7280', padding: '4px 8px', background: '#F9FAFB', borderRadius: '4px' }}>
                            <span>{c.criterio}</span>
                            <span style={{ color: scoreColor(c.score * 33), fontWeight: 'bold' }}>{c.score}/3</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* User notes/observations */}
                  {setor.diagnostico_criterios?.some((c: any) => c.notas) && (
                    <div style={{ marginBottom: '14px', padding: '10px 12px', background: '#F5F0FF', borderRadius: '8px', border: '1px solid #E9D5FF' }}>
                      <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#7C3AED', marginBottom: '6px', textTransform: 'uppercase' }}>
                        Observacoes do Consultor
                      </div>
                      {setor.diagnostico_criterios.filter((c: any) => c.notas).map((c: any) => (
                        <p key={c.id} style={{ margin: '3px 0', fontSize: '12px', color: '#5B21B6' }}>
                          <strong>{c.criterio}:</strong> {c.notas}
                        </p>
                      ))}
                    </div>
                  )}

                  {/* Recommendations */}
                  {temRec && rec && (
                    <div style={{ marginBottom: produtos.length > 0 ? '14px' : '0' }}>
                      <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#374151', marginBottom: '8px', textTransform: 'uppercase' }}>
                        Recomendacoes
                      </div>

                      {rec.urgente.length > 0 && (
                        <div style={{ marginBottom: '10px' }}>
                          <div style={{ display: 'inline-block', background: '#DC2626', color: '#fff', fontSize: '10px', fontWeight: 'bold', padding: '2px 8px', borderRadius: '10px', marginBottom: '6px' }}>
                            URGENTE
                          </div>
                          {rec.urgente.map((d, i) => (
                            <div key={i} style={{ padding: '6px 10px', background: '#FEF2F2', borderLeft: '3px solid #DC2626', borderRadius: '4px', marginBottom: '4px', fontSize: '12px', color: '#374151' }}>
                              {d}
                            </div>
                          ))}
                        </div>
                      )}

                      {rec.melhoria.length > 0 && (
                        <div style={{ marginBottom: '10px' }}>
                          <div style={{ display: 'inline-block', background: '#D97706', color: '#fff', fontSize: '10px', fontWeight: 'bold', padding: '2px 8px', borderRadius: '10px', marginBottom: '6px' }}>
                            MELHORIA
                          </div>
                          {rec.melhoria.map((d, i) => (
                            <div key={i} style={{ padding: '6px 10px', background: '#FFFBEB', borderLeft: '3px solid #D97706', borderRadius: '4px', marginBottom: '4px', fontSize: '12px', color: '#374151' }}>
                              {d}
                            </div>
                          ))}
                        </div>
                      )}

                      {rec.manutencao.length > 0 && (
                        <div>
                          <div style={{ display: 'inline-block', background: '#15803D', color: '#fff', fontSize: '10px', fontWeight: 'bold', padding: '2px 8px', borderRadius: '10px', marginBottom: '6px' }}>
                            MANUTENCAO
                          </div>
                          {rec.manutencao.map((d, i) => (
                            <div key={i} style={{ padding: '6px 10px', background: '#F0FDF4', borderLeft: '3px solid #15803D', borderRadius: '4px', marginBottom: '4px', fontSize: '12px', color: '#374151' }}>
                              {d}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Custom recommendations from consultant */}
                  {cRecs.length > 0 && (
                    <div style={{ marginBottom: '14px' }}>
                      <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#7C3AED', marginBottom: '8px', textTransform: 'uppercase' }}>
                        Orientacoes do Consultor
                      </div>
                      {cRecs.map((cr, i) => (
                        <div key={i} style={{
                          padding: '8px 10px', background: '#F5F0FF',
                          borderLeft: `3px solid ${cr.tipo === 'urgente' ? '#DC2626' : cr.tipo === 'melhoria' ? '#D97706' : '#15803D'}`,
                          borderRadius: '4px', marginBottom: '4px'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                            <span style={{
                              fontSize: '9px', fontWeight: 'bold', color: '#fff',
                              padding: '1px 5px', borderRadius: '6px',
                              background: cr.tipo === 'urgente' ? '#DC2626' : cr.tipo === 'melhoria' ? '#D97706' : '#15803D'
                            }}>{cr.tipo === 'urgente' ? 'URGENTE' : cr.tipo === 'melhoria' ? 'MELHORIA' : 'MANUTENCAO'}</span>
                          </div>
                          <p style={{ margin: '0', fontSize: '12px', color: '#374151' }}>{cr.texto}</p>
                          {cr.produtos?.length > 0 && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
                              {cr.produtos.map((cat: string) => {
                                const CATS: Record<string, string> = { espelhos: 'Espelhos Ba Gua', cristais: 'Cristais e Pedras', fontes: 'Fontes de Agua', plantas: 'Plantas e Vasos', sinos: 'Sinos de Vento', velas: 'Velas e Incensos', decoracao: 'Decoracao e Simbolos' }
                                return (
                                  <span key={cat} style={{
                                    fontSize: '9px', padding: '2px 6px', background: '#EDE9FE',
                                    color: '#7C3AED', borderRadius: '4px', fontWeight: 'bold'
                                  }}>{CATS[cat] || cat}</span>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Per-sector product suggestions */}
                  {produtos.length > 0 && (
                    <div style={{
                      padding: '10px 12px', background: '#F5F0FF',
                      borderRadius: '8px', border: '1px solid #E9D5FF'
                    }}>
                      <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#7C3AED', marginBottom: '6px' }}>
                        Produtos sugeridos para este setor
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {produtos.map(p => (
                          <span key={p.categoria} style={{
                            padding: '4px 10px', background: '#7C3AED', color: '#fff',
                            borderRadius: '6px', fontSize: '11px', fontWeight: 'bold'
                          }}>{p.nome}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* ══════════════════ RESUMO DE PRODUTOS RECOMENDADOS ══════════════════ */}
        {(() => {
          // Collect all unique products across all sectors
          const allProdutos = new Map<string, { nome: string; categoria: string }>()
          setores.forEach(setor => {
            const pct = setor.score_percentual
            if (pct === null) return
            const criteriosMap = getCriteriosMap(setor)
            const rec = gerarRecomendacoes(setor.nome, pct, criteriosMap)
            const todasRec = [...rec.urgente, ...rec.melhoria, ...rec.manutencao]
            const prods = getProdutosSugeridos(todasRec)
            prods.forEach(p => {
              if (!allProdutos.has(p.categoria)) allProdutos.set(p.categoria, p)
            })
          })
          if (allProdutos.size === 0) return null
          const produtos = Array.from(allProdutos.values())
          return (
            <div style={{ marginBottom: '32px' }}>
              <h2 style={{ color: '#1E3A5F', fontSize: '18px', fontWeight: 'bold', marginBottom: '12px' }}>
                Produtos Recomendados
              </h2>
              <p style={{ color: '#6B7280', fontSize: '13px', margin: '0 0 16px 0' }}>
                Com base no diagnostico completo, recomendamos os seguintes produtos para harmonizacao energetica:
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px' }}>
                {produtos.map(p => (
                  <div key={p.categoria} style={{
                    background: '#F5F0FF', borderRadius: '8px', padding: '14px',
                    border: '1px solid #E9D5FF', textAlign: 'center'
                  }}>
                    <p style={{ color: '#7C3AED', fontSize: '14px', fontWeight: 'bold', margin: '0 0 4px 0' }}>
                      {p.nome}
                    </p>
                    <p style={{ color: '#6B7280', fontSize: '11px', margin: '0' }}>
                      Veja opcoes em Produtos
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )
        })()}

        {/* ══════════════════ FOOTER ══════════════════ */}
        <div style={{ borderTop: '2px solid #E5E7EB', paddingTop: '20px', textAlign: 'center' }}>
          <p style={{ color: '#9CA3AF', fontSize: '12px', margin: '0 0 4px 0' }}>
            Relatorio gerado pelo FengShui Studio • {new Date().toLocaleDateString('pt-BR')} • Escola Black Hat
          </p>
          {profile?.nome_completo && (
            <p style={{ color: '#9CA3AF', fontSize: '11px', margin: '0' }}>
              {profile.nome_completo}{profile?.registro_profissional ? ` • ${profile.registro_profissional}` : ''}
            </p>
          )}
        </div>

      </div>
    </>
  )
}
