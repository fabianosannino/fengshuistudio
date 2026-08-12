'use client'

import { redirecionarParaLogin } from '../../../../src/lib/auth-rotas'
import { Fragment, useEffect, useState, useRef } from 'react'
import { CORTE_URGENTE, CORTE_ATENCAO } from '../../../../src/lib/modelos-pontuacao'
import { supabase } from '../../../../src/lib/supabase'
import { useRouter, useParams } from 'next/navigation'
import FlowLayout from '../../../components/FlowLayout'
// jsPDF and html2canvas are lazy-loaded in handleDownloadPDF() to reduce initial bundle size
import { AREA_META, LOSHU_ORDER, RODA_AREAS } from '../../../../src/lib/constants'
import { gerarRecomendacoes, criteriosPorNomeParaArray } from '../../../../src/lib/recomendacoes'
import { comodosDeSetorRow } from '../../../../src/lib/comodo-setor'
import { calcularMingGua } from '../../../../src/lib/ming-gua'
import { calcularKuaDaCasa, compatibilidadeMoradorCasa } from '../../../../src/lib/oito-mansoes'
import { calcularEstrelasVoadoras, type Palacio } from '../../../../src/lib/estrelas-voadoras'
import { periodoDaConsulta, faixaDoPeriodo } from '../../../../src/lib/periodo-do-imovel'
import { RESSALVA_XUAN_KONG } from '../../../../src/lib/sustentacao-do-diagnostico'
import { calcularGradeAnual } from '../../../../src/lib/estrela-anual'
import { dataSolar } from '../../../../src/lib/data-solar'
import { setoresFavoraveis } from '../../../../src/lib/posicionamento-mobiliario'
import { sintetizarImovel } from '../../../../src/lib/sintese-imovel'
import { PERFIS_METODOS, ordenarRemedios, type Remedio } from '../../../../src/lib/sintese-metodos'
import { gerarRemedios } from '../../../../src/lib/remedios'
import { useUrlsAssinadas } from '../../../components/useUrlsAssinadas'
import { normalizarChecklist, resumirChi } from '../../../../src/lib/fluxo-chi'
import { CHECKLIST_CHI } from '../../../../src/lib/checklist-chi'
import { FORMATOS, secoesDoFormato, formatoCorrespondente, paginasEstimadas } from '../../../../src/lib/formato-do-relatorio'
import { faseLunar } from '../../../../src/lib/lunar'
import { logger } from '../../../../src/lib/logger'
import { normalizarCores, criarResolvedorCanvas } from '../../../../src/lib/cores-canvas'
import { BUCKET_IMOVEIS } from '../../../../src/lib/storage-imagens'
import { rotuloReferencia } from '../../../../src/lib/declinacao-magnetica'
import { compararSnapshots, type SnapshotScore } from '../../../../src/lib/reavaliacao'
import { AREAS as RODA_12_AREAS, CATEGORIAS as RODA_CATEGORIAS, avg as rodaAvg } from '../../../../src/lib/roda-da-vida-constants'
import type { Consulta, SetorBagua, DiagnosticoCriterio, Profile } from '../../../../src/lib/types'

// ─── CONSTANTS ──────────────────────────────────────────────────────────────

// Chi Flow items
// Os onze pontos vêm de `src/lib/checklist-chi.ts` — a cópia local aqui tinha
// os mesmos ids por sorte, e divergir faria o relatório mostrar «não
// verificado» num ponto que o consultor marcou.
const CHI_ITEMS = CHECKLIST_CHI.map(i => ({ id: i.id, label: i.labelCurto }))

const COMODO_LABELS: Record<string, string> = {
  sala: 'Sala de Estar', quarto_casal: 'Quarto do Casal', quarto_filho: 'Quarto de Filho(a)',
  quarto_hospede: 'Quarto de Hóspede', escritorio: 'Escritório', cozinha: 'Cozinha',
  banheiro: 'Banheiro', lavabo: 'Lavabo', area_servico: 'Área de Serviço',
  garagem: 'Garagem', varanda: 'Varanda', corredor: 'Corredor', despensa: 'Despensa',
  jardim: 'Jardim',
}

// ─── HELPERS ────────────────────────────────────────────────────────────────

function scoreColor(pct: number | null) {
  if (pct === null || pct === undefined) return '#9CA3AF'
  if (pct >= 70) return '#2E7D6B'
  if (pct >= 40) return '#8A6E2F'
  return '#B4533A'
}

function scoreLevelLabel(pct: number | null): { label: string; color: string } {
  if (pct === null || pct === undefined) return { label: 'N/A', color: '#9CA3AF' }
  if (pct >= 80) return { label: 'EXCELENTE', color: '#C9A227' }
  if (pct >= 70) return { label: 'BOM', color: '#2E7D6B' }
  if (pct >= 40) return { label: 'ATENÇÃO', color: '#8A6E2F' }
  return { label: 'URGENTE', color: '#B4533A' }
}

// Rótulos em português dos campos de proveniência de `Remedio` (Parte IV / ADR 0015).
const ROTULO_CUSTO: Record<Remedio['custo'], string> = {
  zero: 'Nenhum', baixo: 'Baixo', medio: 'Médio', alto: 'Alto', estrutural: 'Obra',
}
const ROTULO_REVERSIBILIDADE: Record<Remedio['reversibilidade'], string> = {
  instantanea: 'Na hora', facil: 'Fácil', dificil: 'Difícil', permanente: 'Definitivo',
}
const ROTULO_EVIDENCIA: Record<Remedio['forcaEvidencia'], string> = {
  'consenso-classico': 'Consenso clássico',
  'variante-de-escola': 'Variante de escola',
  'tradicao-popular': 'Tradição popular',
}

function desvioLabel(pct: number | null): { nivel: string; cor: string } {
  if (pct === null || pct === undefined) return { nivel: 'N/A', cor: '#9CA3AF' }
  if (pct >= 70) return { nivel: 'Leve', cor: '#2E7D6B' }
  if (pct >= 40) return { nivel: 'Moderado', cor: '#8A6E2F' }
  if (pct >= 20) return { nivel: 'Acentuado', cor: '#B4533A' }
  return { nivel: 'Ausente', cor: '#8F3F2C' }
}

// ─── COMPONENT ──────────────────────────────────────────────────────────────

/** Espera todas as imagens dentro de `el` carregarem antes da captura (evita PDF em branco). */
async function waitForImages(el: HTMLElement): Promise<void> {
  const imgs = Array.from(el.querySelectorAll('img'))
  await Promise.all(
    imgs.map((img) => {
      if (img.complete && img.naturalWidth > 0) return Promise.resolve()
      return new Promise<void>((resolve) => {
        const done = () => resolve()
        img.addEventListener('load', done, { once: true })
        img.addEventListener('error', done, { once: true })
      })
    })
  )
}

export default function Relatorio() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const printRef = useRef<HTMLDivElement>(null)

  const [consulta, setConsulta] = useState<Consulta | null>(null)
  const [setores, setSetores] = useState<SetorBagua[]>([])
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState(false)
  const [savedRelatorioEm, setSavedRelatorioEm] = useState<string | null>(null)
  const [snapshots, setSnapshots] = useState<Array<{ tipo: string; scores: SnapshotScore[]; criado_em: string }>>([])
  // Nudge para marcar a consulta (entrega) como concluída após gerar o relatório.
  const [showConcluirNudge, setShowConcluirNudge] = useState(false)
  const [concluindo, setConcluindo] = useState(false)
  const [showSelector, setShowSelector] = useState(true)
  const [selectedSections, setSelectedSections] = useState({
    completo: true,
    capa: true,
    introducao: true,
    bagua: true,
    curas: true,
    checklist: true,
    roda_vida: true,
    plano_acao: true,
    evolucao: true,
    fotos: true,
    proximos_passos: true,
    calendario: true,
    divergencias: true,
    conclusao: true,
  })

  // Editable fields for the consultant
  const [textoIntroducao, setTextoIntroducao] = useState('Este relatório apresenta o diagnóstico completo de Feng Shui do imóvel, baseado na Escola Budista da Seita Negra (Black Hat Sect). A análise integra o mapa Ba Guá, a Roda da Vida, o fluxo de Chi e recomendações de curas e ativações para harmonização dos ambientes.')
  const [textoCuras, setTextoCuras] = useState('As curas e ativações abaixo são recomendadas com base no diagnóstico energético de cada setor do Ba Guá. Cada elemento — cristais, plantas, objetos, mudras, meditações e mantras — atua em uma frequência específica para reequilibrar a energia do ambiente.')
  const [textoChi, setTextoChi] = useState('O Fluxo de Chi (energia vital) foi avaliado ponto a ponto no imóvel. «✓» indica onde a circulação energética está adequada e «✕» onde há um ponto a tratar. «–» marca o que não foi verificado nesta visita — é uma lacuna do levantamento, não um problema encontrado.')
  const [textoConclusao, setTextoConclusao] = useState('As recomendações apresentadas neste relatório visam promover o equilíbrio energético do imóvel e o bem-estar de seus ocupantes. Recomenda-se a implementação gradual das sugestões, começando pelas áreas de maior urgência.')
  const [recsAdicionais, setRecsAdicionais] = useState<Record<string, string>>({})
  const [chiCustom, setChiCustom] = useState<{ id: string; label: string }[]>([])

  /**
   * `null` quando o consultor ajustou as caixas à mão. Sem isso o seletor
   * mentiria: com «Resumo» destacado e uma seção extra ligada, ele entregaria
   * um dossiê achando que mandou o resumo.
   */
  const formatoAtual = formatoCorrespondente(selectedSections)

  // Plan-based PDF access
  const _planoEfetivo = (() => {
    const p = (profile?.plano || '').toLowerCase().trim()
    if (p === 'pro' || p === 'profissional') return 'profissional' as const
    if (p === 'simples') return 'simples' as const
    return 'free' as const
  })()
  const isFree = _planoEfetivo === 'free'
  const isSimples = _planoEfetivo === 'simples'
  const needsWatermark = isSimples

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { redirecionarParaLogin(); return }

      const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      setProfile(prof)

      const { data: consulta } = await supabase
        .from('consultas')
        .select('*, clientes(nome_completo, email, telefone, cidade, estado, data_nascimento, genero)')
        .eq('id', id)
        .single()
      if (!consulta) { router.push('/consultas'); return }
      setConsulta(consulta)
      setSavedRelatorioEm(consulta.relatorio_gerado_em ?? null)

      const { data: setoresData } = await supabase
        .from('setores_bagua')
        .select('*, diagnostico_criterios(*)')
        .eq('consulta_id', id)
        .order('numero')
      setSetores(setoresData || [])

      // Snapshots do diagnóstico (evolução antes/depois)
      const { data: snapsData } = await supabase
        .from('diagnostico_snapshots')
        .select('tipo, scores, criado_em')
        .eq('consulta_id', id)
        .order('criado_em', { ascending: true })
      setSnapshots(snapsData || [])

      // Pontos personalizados do checklist de Chi. Viviam em `localStorage` e
      // por isso nunca chegavam ao relatório — que é o entregável ao cliente.
      const { data: custom, error: erroCustom } = await supabase
        .from('consultor_checklist_chi_custom')
        .select('item_id, label')
        .order('criado_em', { ascending: true })
      if (erroCustom) {
        logger.error('Falha ao carregar pontos personalizados do Chi no relatório', {
          route: 'relatorio', action: 'load-chi-custom', error: erroCustom.message,
        })
      } else {
        setChiCustom((custom ?? []).map(r => ({ id: r.item_id as string, label: r.label as string })))
      }

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
      .sort((a, b) => (a.score_percentual ?? Number.POSITIVE_INFINITY) - (b.score_percentual ?? Number.POSITIVE_INFINITY))
      .slice(0, 3)
  }

  function getProximasFasesLunares() {
    // O cálculo vem de `src/lib/lunar.ts`. Estava copiado aqui e no calendário,
    // com a mesma constante de lunação — e duas cópias divergem cedo ou tarde.
    const hoje = new Date()
    const fases: { data: Date; fase: string; emoji: string; sugestao: string }[] = []
    for (let d = 0; d < 30 && fases.length < 3; d++) {
      const date = new Date(hoje.getTime() + d * 86400000)
      const { nome, emoji } = faseLunar(date)
      if (['Nova', 'Quarto Crescente', 'Cheia', 'Quarto Minguante'].includes(nome) && (fases.length === 0 || fases[fases.length-1].fase !== nome)) {
        const sugestoes: Record<string, string> = {
          'Nova': 'Ideal para limpeza energética, definição de intenções e novos começos',
          'Quarto Crescente': 'Momento de expansão — ative setores do Ba Guá com elementos correspondentes',
          'Cheia': 'Energize cristais sob a lua, pratique gratidão e celebre conquistas',
          'Quarto Minguante': 'Desapego e liberação — doe objetos, faça banhos de ervas purificadores',
        }
        fases.push({ data: date, fase: nome, emoji, sugestao: sugestoes[nome] || '' })
      }
    }
    return fases
  }

  function handlePrint() { window.print() }

  async function handleDownloadPDF() {
    if (!printRef.current) return
    setDownloading(true)
    // A geração tem seis etapas e qualquer uma pode falhar. Sem saber qual,
    // «Erro ao gerar PDF» manda o consultor adivinhar e não dá o que investigar.
    let etapa = 'preparar'
    try {
      etapa = 'aguardar imagens'
      await waitForImages(printRef.current)
      etapa = 'carregar bibliotecas'
      const html2canvas = (await import('html2canvas')).default
      const { jsPDF } = await import('jspdf')
      etapa = 'capturar a tela'
      const canvas = await html2canvas(printRef.current, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
        imageTimeout: 15000,
        onclone: (clonedDoc) => {
          // A paleta do app é declarada em oklch(); o Chrome serializa isso
          // como lab(), e o parser do html2canvas (1.4.1, de 2022) não conhece
          // nenhuma das duas — a captura inteira falhava. Converte no clone,
          // deixando a tela do usuário intacta.
          const trocas = normalizarCores(clonedDoc, criarResolvedorCanvas())
          if (trocas > 0) {
            logger.info('Cores normalizadas para a captura', {
              route: 'relatorio', action: 'normalizar-cores', consultaId: id, trocas,
            })
          }

          // Remove editable textareas and show their print-only versions
          const textareas = clonedDoc.querySelectorAll('textarea')
          textareas.forEach(ta => {
            const div = clonedDoc.createElement('div')
            div.style.cssText = 'font-size:13px;color:#374151;line-height:1.6;white-space:pre-wrap;font-family:Helvetica Neue,Arial,sans-serif;'
            div.textContent = ta.value
            ta.parentNode?.replaceChild(div, ta)
          })
          // Remove no-print elements
          const noPrint = clonedDoc.querySelectorAll('.no-print')
          noPrint.forEach(el => el.remove())
        }
      })
      etapa = 'montar o PDF'
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
      if (needsWatermark) {
        const totalPages = pdf.getNumberOfPages()
        for (let i = 1; i <= totalPages; i++) {
          pdf.setPage(i)
          pdf.setFontSize(40)
          pdf.setTextColor(200, 200, 200)
          pdf.saveGraphicsState()
          pdf.text('Gerado com FengShui Studio — Plano Simples', imgWidth / 2, pageHeight / 2, { align: 'center', angle: 45 })
          pdf.restoreGraphicsState()
        }
      }
      // Add page numbers
      const totalPages = pdf.getNumberOfPages()
      for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i)
        pdf.setFontSize(9)
        pdf.setTextColor(170, 170, 170)
        pdf.text(`Página ${i} de ${totalPages}`, 105, 290, { align: 'center' })
      }
      etapa = 'salvar o arquivo'
      const nomeArquivo = `relatorio-${consulta!.nome_imovel?.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'consulta'}.pdf`
      pdf.save(nomeArquivo)

      // Relat\u00f3rio entregue \u2192 sugere concluir a consulta (s\u00f3 nudge; n\u00e3o trava nada).
      if (consulta!.status !== 'finalizada') setShowConcluirNudge(true)

      // Persiste no servidor (best-effort — o download acima já ocorreu)
      try {
        const blob = pdf.output('blob')
        const fd = new FormData()
        fd.append('pdf', blob, nomeArquivo)
        fd.append('consulta_id', id)
        const res = await fetch('/api/consultas/relatorio', { method: 'POST', body: fd })
        if (res.ok) {
          const data = await res.json()
          setSavedRelatorioEm(data.gerado_em ?? new Date().toISOString())
        }
      } catch { /* persistência é best-effort; não atrapalha o download */ }
    } catch (err) {
      // Detalhe técnico na tela de propósito: quem vê isto é o consultor, dono
      // da consulta, e é ele quem vai reportar. Mensagem genérica aqui esconde
      // a informação de quem poderia agir sobre ela (mesma razão do ADR 0019,
      // aplicada na direção oposta — ali o risco era vazar, aqui é omitir).
      const nome = err instanceof Error ? err.name : 'Erro'
      const detalhe = err instanceof Error ? err.message : String(err)
      logger.error('Falha ao gerar PDF do relatório', {
        route: 'relatorio', action: etapa, consultaId: id, error: `${nome}: ${detalhe}`,
      })
      alert(
        `Erro ao gerar o PDF na etapa «${etapa}».\n\n${nome}: ${detalhe}\n\n` +
        'Use a opção Imprimir enquanto isso, e envie esta mensagem para o suporte.'
      )
    } finally {
      setDownloading(false)
    }
  }

  async function baixarVersaoSalva() {
    const res = await fetch(`/api/consultas/relatorio?consulta_id=${id}`)
    if (!res.ok) { alert('Não foi possível abrir o relatório salvo.'); return }
    const data = await res.json()
    if (data.url) window.open(data.url, '_blank', 'noopener,noreferrer')
    else alert('Nenhuma versão salva ainda. Gere o PDF primeiro.')
  }

  /** Marca a consulta (a entrega ao cliente) como concluída. Não altera o Ba Guá. */
  async function marcarConsultaConcluida() {
    setConcluindo(true)
    const { error } = await supabase
      .from('consultas')
      .update({ status: 'finalizada', finalizada_em: new Date().toISOString() })
      .eq('id', id)
    setConcluindo(false)
    if (error) { alert('Não foi possível marcar a consulta como concluída.'); return }
    setConsulta(c => (c ? { ...c, status: 'finalizada' } : c))
    setShowConcluirNudge(false)
  }

  // As fotos do relatório num lote só. `assinandoImagens` importa aqui mais que
  // nas outras telas: capturar o PDF antes das assinaturas chegarem produziria
  // um relatório com buracos no lugar das fotos.
  const fotosDoImovel = [
    consulta?.foto_geral_url ?? null,
    ...((consulta?.fotos_antes as string[] | undefined) ?? []),
    ...((consulta?.fotos_depois as string[] | undefined) ?? []),
  ]
  const { resolver: resolverFoto, carregando: assinandoImagens } = useUrlsAssinadas(fotosDoImovel, BUCKET_IMOVEIS)

  if (loading || !consulta) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F9FAFB', fontFamily: 'var(--font-figtree), sans-serif' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>☯</div>
          <p style={{ color: '#2E7D6B', fontSize: '16px' }}>Gerando relatório...</p>
        </div>
      </div>
    )
  }

  // Free plan: block PDF access entirely
  if (isFree) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FAFAF5', fontFamily: "Georgia, 'Times New Roman', serif" }}>
        <div style={{ textAlign: 'center', maxWidth: '400px', padding: '32px' }}>
          <div style={{ fontSize: '64px', marginBottom: '16px' }}>🔒</div>
          <h1 style={{ color: '#0E1B2C', fontSize: '20px', fontWeight: 'bold', marginBottom: '12px' }}>
            Relatório PDF
          </h1>
          <p style={{ color: '#6B7280', fontSize: '15px', marginBottom: '24px' }}>
            Relatório PDF disponível nos planos pagos.
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <button type="button" onClick={() => router.push('/planos')} style={{
              background: '#2E7D6B', color: '#fff', border: 'none', padding: '10px 28px',
              borderRadius: '8px', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer'
            }}>Ver planos</button>
            <button type="button" onClick={() => router.push(`/consultas/${id}`)} style={{
              display: 'inline-flex', alignItems: 'center', gap: '4px',
              background: 'transparent', color: '#6B7280', border: '1px solid #E5E7EB', padding: '6px 14px',
              borderRadius: '6px', fontSize: '14px', fontWeight: 400, cursor: 'pointer'
            }}>← Voltar</button>
          </div>
        </div>
      </div>
    )
  }

  const geral = scoreGeral()
  const geralLevel = scoreLevelLabel(geral)
  const top3 = getTop3()
  const rodaData = (consulta.roda_da_vida || {}) as Record<string, number>
  const posicaoComando: Record<string, string[]> = consulta.posicao_comando || {}
  const hasRoda = Object.keys(rodaData).length > 0
  // Três estados: conforme, problema e — pela ausência da chave — não
  // verificado. O score é sobre o que foi olhado, e `null` quando nada foi.
  // Ver src/lib/fluxo-chi.ts.
  const chi = normalizarChecklist(consulta.checklist_chi)
  const chiItens = [...CHI_ITEMS, ...chiCustom]
  const resumoChi = resumirChi(chi, chiItens.map(i => i.id))
  const chiScore = resumoChi.score
  const hasChi = resumoChi.conforme + resumoChi.problema > 0

  // Sorted sectors for Ki Flow
  const sortedSetores = [...setores]
    .filter(s => s.score_percentual != null)
    .sort((a, b) => (a.score_percentual ?? Number.POSITIVE_INFINITY) - (b.score_percentual ?? Number.POSITIVE_INFINITY))

  // Urgente / Atenção / Manter groups
  const urgentes = setores.filter(s => s.score_percentual != null && s.score_percentual < CORTE_URGENTE)
  const atencao = setores.filter(s => s.score_percentual != null && s.score_percentual >= CORTE_URGENTE && s.score_percentual < CORTE_ATENCAO)
  const manterSetores = setores.filter(s => s.score_percentual != null && s.score_percentual >= CORTE_ATENCAO)

  // Summary stats
  const avaliados = setores.filter(s => s.score_percentual != null)
  const urgentCount = urgentes.length
  const okCount = manterSetores.length
  const lowestSetor = sortedSetores[0]
  const highestSetor = sortedSetores[sortedSetores.length - 1]

  // ── CSS vars ──
  const gold = '#C9A227'
  const goldLt = '#D4A520'
  const ink = '#1C1C1A'
  const inkLt = '#666'
  const paper = '#FAFAF5'
  const paperWarm = '#F5F0E6'
  const border = 'rgba(184,134,11,0.22)'

  return (
    <>
      <style>{`
        .print-only { display: none; }

        @media print {
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          body { margin: 0; background: #fff; }
          .print-area { padding: 0 !important; box-shadow: none !important; max-width: 100% !important; }

          @page { size: A4 portrait; margin: 1.6cm 1.5cm 2.2cm; }

          /* ── Quebras controladas ────────────────────────────────────────
           * Sem isto o navegador corta onde calhar: um título na última linha
           * de uma página com o conteúdo na seguinte, uma linha de tabela
           * partida ao meio, uma foto cortada na horizontal.
           */
          h1, h2, h3, h4 { break-after: avoid-page; }
          img, table, figure { break-inside: avoid; }
          tr, li { break-inside: avoid; }
          /* Duas linhas órfãs/viúvas no mínimo — uma linha sozinha no pé ou no
           * topo da página é o defeito tipográfico que mais salta à vista. */
          p, li { orphans: 2; widows: 2; }

          /* O fundo dos selos e das faixas some na impressão padrão, e com ele
           * some a distinção entre «em harmonia» e «precisa de cuidado». */
          * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }

          /* Rodapé repetido. O número da página fica com o navegador: o Chrome
           * não implementa as margin boxes do CSS Paged Media, então contar
           * páginas aqui daria um número que só existiria no Firefox. */
          .rodape-impressao {
            display: block !important;
            position: fixed; bottom: 0; left: 0; right: 0;
            padding-top: 6px; border-top: 1px solid #E7E1D6;
            font-size: 9px; color: #6B7280;
            font-family: 'Helvetica Neue', Arial, sans-serif;
            display: flex; justify-content: space-between;
          }

          /* Link impresso não é clicável; o endereço em si raramente ajuda. */
          a { text-decoration: none; color: inherit; }
        }
      `}</style>

      {/* Rodapé que se repete em toda página impressa — quem assina o
          diagnóstico e de quando ele é. Invisível na tela. */}
      <div className="rodape-impressao print-only" aria-hidden="true">
        <span>{profile?.nome_completo || 'FengShui Studio'}{profile?.nome_empresa ? ` · ${profile.nome_empresa}` : ''}</span>
        <span>{consulta?.nome_imovel || ''} · {new Date().toLocaleDateString('pt-BR')}</span>
      </div>

      {/* ── Toolbar ─────────────────────────────────────────────────────── */}
      <div className="no-print" style={{
        background: '#0E1B2C', padding: '12px 32px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '24px', cursor: 'pointer' }} onClick={() => router.push(`/consultas/${id}`)}>☯</span>
          <span style={{ color: gold, fontSize: '18px', fontWeight: 'bold' }}>FengShui Studio</span>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {needsWatermark && (
            <span style={{ color: '#C9A227', fontSize: '12px', background: 'rgba(251,191,36,0.15)', padding: '4px 12px', borderRadius: '20px' }}>
              Plano Simples — PDF com marca d&apos;água
            </span>
          )}
          <button type="button" onClick={() => router.push(`/consultas/${id}`)} style={{
            display: 'inline-flex', alignItems: 'center', gap: '4px',
            background: 'transparent', border: '1px solid rgba(255,255,255,0.25)',
            color: 'rgba(255,255,255,0.7)', padding: '6px 14px', borderRadius: '6px',
            cursor: 'pointer', fontSize: '14px', fontWeight: 400,
          }}>← Voltar</button>
          <button type="button" onClick={() => router.push(`/curas?consultaId=${id}`)} style={{
            background: 'transparent', border: '1px solid rgba(184,134,11,0.5)',
            color: '#C9A227', padding: '6px 14px', borderRadius: '6px', cursor: 'pointer', fontSize: '14px'
          }}>Curas</button>
          {/* Impressão do navegador é o caminho principal: gera texto
              selecionável, respeita as quebras do CSS de impressão e não
              depende de o html2canvas entender a função de cor da vez.
              «Salvar como PDF» no diálogo produz o arquivo. */}
          <button type="button" onClick={handlePrint} title="Abre o diálogo de impressão — escolha «Salvar como PDF»" style={{
            background: gold, border: 'none', color: '#0E1B2C',
            padding: '6px 20px', borderRadius: '6px',
            cursor: 'pointer', fontSize: '14px', fontWeight: 600,
          }}>Imprimir / Salvar PDF</button>
          {/* O caminho antigo continua, e agora diz o que é: fotografa a tela e
              recorta em páginas. Texto vira imagem — não dá para copiar nem
              buscar —, mas sai sem passar pelo diálogo do navegador. */}
          <button type="button" onClick={handleDownloadPDF} disabled={downloading || assinandoImagens}
            title="Gera o arquivo direto, mas o texto vira imagem"
            style={{
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.25)',
              color: (downloading || assinandoImagens) ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.7)',
              padding: '6px 14px', borderRadius: '6px',
              cursor: (downloading || assinandoImagens) ? 'not-allowed' : 'pointer', fontSize: '14px',
            }}>{downloading ? 'Gerando…' : assinandoImagens ? 'Carregando fotos…' : 'Baixar como imagem'}</button>
          {savedRelatorioEm && (
            <button type="button"
              onClick={baixarVersaoSalva}
              className="no-print"
              title={`Última versão salva em ${new Date(savedRelatorioEm).toLocaleString('pt-BR')}`}
              style={{
                background: 'transparent', border: '1px solid rgba(255,255,255,0.25)',
                color: 'rgba(255,255,255,0.7)', padding: '6px 14px', borderRadius: '6px',
                cursor: 'pointer', fontSize: '14px',
              }}
            >Baixar versão salva</button>
          )}
        </div>
      </div>

      {/* ── Nudge: concluir a consulta após gerar o relatório ───────────── */}
      {showConcluirNudge && (
        <div className="no-print" style={{
          maxWidth: '980px', margin: '16px auto 0', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap',
          background: '#F0F6F3', border: '1px solid #DCEAE4', borderRadius: '10px', padding: '14px 20px',
        }}>
          <div style={{ fontSize: '14px', color: '#2E7D6B' }}>
            <strong>Relatório entregue.</strong> Marcar esta consulta como concluída?
            <span style={{ display: 'block', fontSize: '12px', color: '#6B7280', marginTop: '2px' }}>
              Apenas atualiza o status da consulta — o diagnóstico do Ba Guá não é alterado.
            </span>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="button" onClick={() => setShowConcluirNudge(false)} style={{
              background: 'transparent', border: '1px solid #D1D5DB', color: '#6B7280',
              padding: '8px 16px', borderRadius: '6px', fontSize: '13px', cursor: 'pointer',
            }}>Agora não</button>
            <button type="button" onClick={marcarConsultaConcluida} disabled={concluindo} style={{
              background: concluindo ? '#9CA3AF' : '#2E7D6B', border: 'none', color: '#fff',
              padding: '8px 18px', borderRadius: '6px', fontSize: '13px', fontWeight: 600,
              cursor: concluindo ? 'not-allowed' : 'pointer',
            }}>{concluindo ? 'Concluindo…' : 'Marcar como concluída'}</button>
          </div>
        </div>
      )}

      {/* ── Section Selector ───────────────────────────────────────────── */}
      {showSelector && (
        <div className="no-print" style={{ background: '#fff', borderRadius: '12px', padding: '24px', boxShadow: '0 2px 12px rgba(0,0,0,0.08)', marginBottom: '24px', maxWidth: '600px', margin: '24px auto 24px' }}>
          <h2 style={{ color: '#0E1B2C', fontSize: '18px', fontWeight: 'bold', margin: '0 0 16px 0' }}>Montar Relatório</h2>
          {/* Completude indicator */}
          <div style={{ marginBottom: '16px', padding: '12px', background: '#F9FAFB', borderRadius: '8px', border: '1px solid #E5E7EB' }}>
            <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#0E1B2C', marginBottom: '6px' }}>
              📋 Completude da consulta
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', fontSize: '11px' }}>
              {[
                { label: 'Ba Guá', ok: setores.length > 0 },
                { label: 'Roda da Vida', ok: !!(consulta?.roda_da_vida && (consulta.roda_da_vida as Record<string, unknown>)?.respostas) },
                { label: 'Checklist Chi', ok: hasChi },
                { label: 'Foto geral', ok: !!consulta?.foto_geral_url },
                { label: 'Fotos antes', ok: ((consulta?.fotos_antes as string[] | undefined)?.length ?? 0) > 0 },
                { label: 'Fotos depois', ok: ((consulta?.fotos_depois as string[] | undefined)?.length ?? 0) > 0 },
              ].map((item, i) => (
                <span key={i} style={{
                  padding: '3px 8px', borderRadius: '10px', fontWeight: 'bold',
                  background: item.ok ? '#F0F6F3' : '#FAEEE9',
                  color: item.ok ? '#2E7D6B' : '#B4533A',
                }}>{item.ok ? '✓' : '✕'} {item.label}</span>
              ))}
            </div>
          </div>
          {/* Dois formatos em vez de onze caixas em branco. As caixas continuam
              embaixo: a escolha é ponto de partida, não camisa de força. */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
            {(['resumo', 'dossie'] as const).map(formatoId => {
              const f = FORMATOS[formatoId]
              const escolhido = formatoAtual === formatoId
              return (
                <button type="button" key={formatoId}
                  onClick={() => setSelectedSections(prev => ({ ...prev, ...secoesDoFormato(formatoId) }))}
                  aria-pressed={escolhido}
                  style={{
                    textAlign: 'left', padding: '14px', borderRadius: '12px', cursor: 'pointer',
                    background: escolhido ? '#FAF3E0' : '#fff',
                    border: escolhido ? '2px solid #C9A227' : '1px solid #E7E1D6',
                  }}>
                  <span style={{ display: 'block', fontSize: '14px', fontWeight: 700, color: '#0E1B2C', marginBottom: '4px' }}>{f.titulo}</span>
                  <span style={{ display: 'block', fontSize: '12px', color: '#6B7280', lineHeight: 1.5 }}>{f.subtitulo}</span>
                  <span style={{ display: 'block', fontSize: '12px', color: '#8A6E2F', fontWeight: 700, marginTop: '6px' }}>
                    cerca de {paginasEstimadas(f.secoes)} páginas
                  </span>
                </button>
              )
            })}
          </div>

          <p style={{ color: '#6B7280', fontSize: '13px', margin: '0 0 16px 0' }}>
            {formatoAtual
              ? `Formato ${FORMATOS[formatoAtual].titulo.toLowerCase()} · cerca de ${paginasEstimadas(selectedSections)} páginas`
              : `Ajustado à mão · cerca de ${paginasEstimadas(selectedSections)} páginas`}
          </p>
          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0', cursor: 'pointer', borderBottom: '1px solid #E5E7EB', marginBottom: '8px', paddingBottom: '12px' }}>
            <input type="checkbox" checked={selectedSections.completo}
              onChange={e => {
                const val = e.target.checked
                setSelectedSections({
                  completo: val, capa: val, introducao: val, bagua: val, curas: val,
                  checklist: val, roda_vida: val, plano_acao: val, evolucao: val, fotos: val,
                  proximos_passos: val, calendario: val, divergencias: val, conclusao: val,
                })
              }}
              style={{ width: '20px', height: '20px', accentColor: '#2E7D6B' }} />
            <span style={{ fontSize: '15px', color: '#0E1B2C', fontWeight: 'bold' }}>Relatório Completo (selecionar todos)</span>
          </label>
          {[
            { key: 'capa', label: '1. Capa + Dados + KPIs + Planta Baixa' },
            { key: 'introducao', label: '2. Introdução (editável)' },
            { key: 'bagua', label: '3. Ba Guá — Diagnóstico + Recomendações + Curas' },
            { key: 'checklist', label: '4. Checklist de Fluxo de Chi' },
            { key: 'roda_vida', label: '5. Roda da Vida' },
            { key: 'plano_acao', label: '6. Plano de Ação' },
            { key: 'evolucao', label: '6b. Evolução do Tratamento (antes → depois)' },
            { key: 'curas', label: '7. Tabela de Curas Detalhada' },
            { key: 'fotos', label: '8. Fotos do Imóvel' },
            { key: 'proximos_passos', label: '9. Próximos Passos' },
            { key: 'calendario', label: '10. Calendário Lunar' },
            { key: 'divergencias', label: '11. Onde as escolas divergem (síntese de métodos)' },
            { key: 'conclusao', label: '12. Conclusão + Encerramento' },
          ].map(s => (
            <label key={s.key} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 0', cursor: 'pointer' }}>
              <input type="checkbox" checked={selectedSections[s.key as keyof typeof selectedSections]}
                onChange={e => {
                  const next = { ...selectedSections, [s.key]: e.target.checked }
                  const allKeys = ['capa','introducao','bagua','curas','checklist','roda_vida','plano_acao','evolucao','fotos','proximos_passos','calendario','divergencias','conclusao'] as const
                  next.completo = allKeys.every(k => next[k])
                  setSelectedSections(next)
                }}
                style={{ width: '18px', height: '18px', accentColor: '#2E7D6B' }} />
              <span style={{ fontSize: '13px', color: '#374151' }}>{s.label}</span>
            </label>
          ))}
          <button type="button" onClick={() => setShowSelector(false)} style={{
            width: '100%', marginTop: '16px', padding: '12px', background: '#2E7D6B', color: '#fff',
            border: 'none', borderRadius: '8px', fontSize: '15px', fontWeight: 'bold', cursor: 'pointer'
          }}>Visualizar Relatório</button>
        </div>
      )}

      {/* ── Back to Selector Button ──────────────────────────────────────── */}
      {!showSelector && (
        <div className="no-print" style={{ maxWidth: '980px', margin: '24px auto 0' }}>
          <button type="button" onClick={() => setShowSelector(true)} style={{
            marginBottom: '16px', padding: '8px 16px', background: '#F3F4F6', color: '#6B7280',
            border: 'none', borderRadius: '6px', fontSize: '13px', cursor: 'pointer'
          }}>← Alterar seções</button>
        </div>
      )}

      {/* ── Report Body ─────────────────────────────────────────────────── */}
      {!showSelector && <div ref={printRef} className="print-area" style={{
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

        {/* ══════ BRAND HEADER ══════ */}
        <div style={{ textAlign: 'center', marginBottom: '24px', padding: '20px', borderBottom: '2px solid #E5E7EB' }}>
          <div style={{ fontSize: '32px', marginBottom: '8px' }}>☯</div>
          <h1 style={{ color: '#0E1B2C', fontSize: '22px', fontWeight: 'bold', margin: '0 0 8px 0' }}>FENG SHUI STUDIO</h1>
          <p style={{ color: '#6B7280', fontSize: '12px', margin: 0, fontStyle: 'italic' }}>
            Relatório elaborado no Feng Shui Studio, sob análise e responsabilidade do Consultor: {profile?.nome_completo || 'Consultor'}
          </p>
        </div>

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

        {/* ══════ MING GUA DO CLIENTE ══════ */}
        {(() => {
          const cli = consulta.clientes as { nome_completo: string; data_nascimento?: string | null; genero?: string | null } | null
          const mg = calcularMingGua(cli?.data_nascimento, cli?.genero)
          if (!mg) return null
          return (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap',
              background: paperWarm, border: `1px solid ${border}`, borderTop: 'none',
              padding: '0.7rem 1.5rem'
            }}>
              <div style={{ fontSize: '20px', color: gold, lineHeight: 1, fontFamily: "'Noto Serif SC', serif" }}>命卦</div>
              <div style={{ fontSize: '12px', fontFamily: 'Helvetica Neue, Arial, sans-serif' }}>
                <span style={{ fontWeight: 700, color: ink }}>Ming Gua {mg.kua}</span>
                <span style={{ color: inkLt }}> · Grupo {mg.grupo === 'leste' ? 'Leste' : 'Oeste'} — direções favoráveis: </span>
                <span style={{ color: ink }}>Prosperidade <strong>{mg.direcoes.shengChi}</strong></span>
                <span style={{ color: inkLt }}> · </span>
                <span style={{ color: ink }}>Saúde <strong>{mg.direcoes.tienYi}</strong></span>
                <span style={{ color: inkLt }}> · </span>
                <span style={{ color: ink }}>Relacionamentos <strong>{mg.direcoes.yenNien}</strong></span>
                <span style={{ color: inkLt }}> · </span>
                <span style={{ color: ink }}>Estabilidade <strong>{mg.direcoes.fuWei}</strong></span>
              </div>
            </div>
          )
        })()}

        {/* ══════ KUA DA CASA (Oito Mansões) — só quando a Bússola foi usada ══════ */}
        {(() => {
          const be = consulta.bagua_entrada
          if (be?.escola !== 'bussola' || typeof be.orientacao_graus !== 'number') return null
          const casa = calcularKuaDaCasa(be.orientacao_graus)
          const cli = consulta.clientes as { data_nascimento?: string | null; genero?: string | null } | null
          const mgCliente = calcularMingGua(cli?.data_nascimento, cli?.genero)
          const compat = mgCliente ? compatibilidadeMoradorCasa(mgCliente.kua, casa.kua) : null
          return (
            <div style={{
              display: 'flex', flexDirection: 'column', gap: '4px',
              background: '#fff', border: `1px solid ${border}`, borderTop: 'none',
              padding: '0.7rem 1.5rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                <div style={{ fontSize: '20px', color: gold, lineHeight: 1, fontFamily: "'Noto Serif SC', serif" }}>宅卦</div>
                <div style={{ fontSize: '12px', fontFamily: 'Helvetica Neue, Arial, sans-serif' }}>
                  <span style={{ fontWeight: 700, color: ink }}>Kua da Casa {casa.kua}</span>
                  <span style={{ color: inkLt }}> · Grupo {casa.grupo === 'leste' ? 'Leste' : 'Oeste'} (fachada a {be.orientacao_graus}°) — </span>
                  <span style={{ color: ink }}>Prosperidade <strong>{casa.direcoes.shengChi}</strong></span>
                  <span style={{ color: inkLt }}> · </span>
                  <span style={{ color: ink }}>Saúde <strong>{casa.direcoes.tienYi}</strong></span>
                  <span style={{ color: inkLt }}> · </span>
                  <span style={{ color: ink }}>Relacionamentos <strong>{casa.direcoes.yenNien}</strong></span>
                  <span style={{ color: inkLt }}> · </span>
                  <span style={{ color: ink }}>Estabilidade <strong>{casa.direcoes.fuWei}</strong></span>
                </div>
              </div>
              {compat && (
                <div style={{ fontSize: '11px', color: compat.compativel ? '#2E7D6B' : '#8A6E2F', fontFamily: 'Helvetica Neue, Arial, sans-serif' }}>
                  {compat.compativel ? '✓' : '⚠'} {compat.mensagem}
                </div>
              )}
            </div>
          )
        })()}

        {/* ══════ ESTRELAS VOADORAS — só com Bússola + data de construção ══════ */}
        {(() => {
          const be = consulta.bagua_entrada
          if (be?.escola !== 'bussola') return null
          // Colunas primeiro, `data_construcao` como fallback das consultas
          // antigas — ver src/lib/periodo-do-imovel.ts.
          const doImovel = periodoDaConsulta(consulta)
          if (!doImovel) return null
          const mapa = calcularEstrelasVoadoras({ facingGraus: be.orientacao_graus ?? 0, periodo: doImovel.periodo })
          if (!mapa) return null
          const porPalacio = Object.fromEntries(mapa.palacios.map(p => [p.palacio, p]))
          const linhas: Palacio[][] = [['SE', 'S', 'SW'], ['E', 'C', 'W'], ['NE', 'N', 'NW']]
          return (
            <div style={{ padding: '0.9rem 1.5rem', background: paperWarm, border: `1px solid ${border}`, borderTop: 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', fontWeight: 700, color: ink, marginBottom: '0.6rem', fontFamily: 'Helvetica Neue, Arial, sans-serif' }}>
                <span style={{ fontSize: '18px', color: gold, fontFamily: "'Noto Serif SC', serif" }}>飛星</span>
                Estrelas Voadoras — Período {mapa.periodo}
              </div>
              {/* De onde saiu o período. Sem isto o cliente vê um número de 1 a 9
                  sem meio de conferir de que ano ele veio. */}
              <div style={{ fontSize: '11px', color: '#6B7280', marginBottom: '0.5rem', fontFamily: 'Helvetica Neue, Arial, sans-serif' }}>
                Carta natal do Período {mapa.periodo} ({faixaDoPeriodo(doImovel.anoUsado).inicio}–{faixaDoPeriodo(doImovel.anoUsado).fim}),
                {doImovel.daReforma ? ' pela reforma estrutural de ' : ' pela construção de '}{doImovel.anoUsado}.
                {doImovel.ambiguo && ` Como ${doImovel.anoUsado} é ano de virada, uma conclusão de obra anterior a 4 de fevereiro corresponderia ao Período ${doImovel.periodoAnterior}.`}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 64px)', gap: '4px' }}>
                {linhas.flat().map(p => {
                  const est = porPalacio[p]
                  return (
                    <div key={p} style={{ background: '#fff', border: `1px solid ${border}`, borderRadius: '4px', padding: '5px', textAlign: 'center', fontFamily: 'Helvetica Neue, Arial, sans-serif' }}>
                      <div style={{ fontSize: '9px', color: inkLt }}>{est.montanha}</div>
                      <div style={{ fontSize: '15px', fontWeight: 700, color: ink }}>{est.periodo}</div>
                      <div style={{ fontSize: '9px', color: inkLt }}>{est.fachada}</div>
                      {est.temEstrela5 && <div style={{ fontSize: '8px', color: '#B4533A' }}>⚠ Estrela 5</div>}
                    </div>
                  )
                })}
              </div>
              <p style={{ margin: '0.6rem 0 0', fontSize: '11px', color: inkLt, fontFamily: 'Helvetica Neue, Arial, sans-serif' }}>
                Montanha / Período / Fachada.
              </p>
              {/* A ressalva vive em `sustentacao-do-diagnostico.ts` para sair
                  idêntica aqui e na bancada — e em caixa, não em rodapé de 10px. */}
              <div style={{ marginTop: '0.5rem', background: '#FAF3E0', border: '1px solid #EEDFB4', borderRadius: '8px', padding: '11px 13px' }}>
                <p style={{ margin: 0, fontSize: '11px', color: '#6B5220', lineHeight: 1.55, fontFamily: 'Helvetica Neue, Arial, sans-serif' }}>
                  {RESSALVA_XUAN_KONG}
                </p>
              </div>
            </div>
          )
        })()}

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
              { val: `${urgentCount}`, label: 'Áreas Urgentes', color: '#B4533A' },
              null,
              { val: `${okCount}`, label: 'Equilibradas', color: '#2E7D6B' },
              null,
              { val: lowestSetor?.nome || '—', label: 'Prioridade Máxima', color: '#B4533A', sm: true },
              null,
              { val: highestSetor?.nome || '—', label: 'Mais Equilibrada', color: '#2E7D6B', sm: true },
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

        {/* ══════ Ba Gua PLANT IMAGE ══════ */}
        {!showSelector && consulta.bagua_imagem && (
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

        {/* ══════ INTRODUÇÃO (editável) ══════ */}
        {(selectedSections.completo || selectedSections.introducao) && (
        <div style={{ padding: '0 1.5rem 1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '15px', fontWeight: 400, paddingBottom: '8px', borderBottom: `1px solid ${border}`, marginBottom: '1rem' }}>
            <span style={{ fontSize: '20px', color: gold }}>📋</span>
            Introdução
          </div>
          <textarea className="no-print" value={textoIntroducao} onChange={e => setTextoIntroducao(e.target.value)}
            rows={4} style={{ width: '100%', padding: '10px 12px', border: '1px dashed #D1D5DB', borderRadius: '8px', fontSize: '13px', color: '#374151', resize: 'vertical', boxSizing: 'border-box' as const, background: '#FFFDF6', fontFamily: 'Helvetica Neue, Arial, sans-serif', lineHeight: '1.6' }} />
          <div className="print-only" style={{ fontSize: '12px', color: '#374151', lineHeight: 1.7, fontFamily: 'Helvetica Neue, Arial, sans-serif', whiteSpace: 'pre-wrap' }}>{textoIntroducao}</div>
        </div>
        )}

        {/* ══════ CHARTS ROW: Baguá Lo Shu + Roda da Vida ══════ */}
        {(selectedSections.completo || selectedSections.roda_vida || selectedSections.bagua) && (
        <div style={{ display: 'grid', gridTemplateColumns: (selectedSections.completo || selectedSections.bagua) ? (hasRoda && (selectedSections.completo || selectedSections.roda_vida) ? '1fr 1fr' : '1fr') : '1fr', gap: '0', padding: '1rem 1.5rem' }}>

          {/* Baguá Lo Shu Grid */}
          {(selectedSections.completo || selectedSections.bagua) && (
          <div style={{ background: '#fff', border: `1px solid ${border}`, borderRadius: '4px', padding: '1rem', marginRight: hasRoda && (selectedSections.completo || selectedSections.roda_vida) ? '0.5rem' : 0 }}>
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
          )}

          {/* Roda da Vida radar */}
          {(selectedSections.completo || selectedSections.roda_vida) && hasRoda && (() => {
            const respostas = (rodaData as Record<string, unknown>)
            const getVal = (key: string): number => {
              const v = respostas[key]
              if (Array.isArray(v)) return rodaAvg(v)
              if (typeof v === 'number') return v
              return 0
            }
            return (
            <div style={{ background: '#fff', border: `1px solid ${border}`, borderRadius: '4px', padding: '1rem', marginLeft: (selectedSections.completo || selectedSections.bagua) ? '0.5rem' : 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '15px', fontWeight: 400, paddingBottom: '8px', borderBottom: `1px solid ${border}`, marginBottom: '1rem' }}>
                <span style={{ fontSize: '20px', color: gold, lineHeight: 1, fontFamily: "'Noto Serif SC', serif" }}>輪</span>
                Roda da Vida — 12 Áreas
              </div>
              {/* Radar Chart SVG */}
              {(() => {
                const respostas = (consulta?.roda_da_vida as Record<string, unknown> | undefined)?.respostas || consulta?.roda_da_vida || {}
                const getVal = (key: string): number => {
                  const v = (respostas as Record<string, unknown>)[key]
                  if (Array.isArray(v)) return v.reduce((s: number, n: number) => s + n, 0) / v.length
                  if (typeof v === 'number') return v
                  return 0
                }
                const cx = 150, cy = 150, R = 120, n = 12
                const areaKeys = RODA_12_AREAS.map(a => a.key)
                const values = areaKeys.map(k => getVal(k))
                const polar = (r: number, i: number) => {
                  const a = (i * 2 * Math.PI / n) - Math.PI / 2
                  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) }
                }
                const pts = values.map((v, i) => polar(R * v / 10, i))
                const poly = pts.map(p => `${p.x},${p.y}`).join(' ')
                return (
                  <div style={{ textAlign: 'center', marginBottom: '12px' }}>
                    <svg viewBox="0 0 300 300" style={{ width: '280px', height: '280px' }}>
                      {[2,4,6,8,10].map(r => (
                        <polygon key={r} points={Array.from({length:n},(_,i)=>polar(R*r/10,i)).map(p=>`${p.x},${p.y}`).join(' ')} fill="none" stroke="#E5E7EB" strokeWidth={0.5} />
                      ))}
                      {RODA_12_AREAS.map((a, i) => {
                        const lp = polar(R, i)
                        const tp = polar(R + 12, i)
                        return (
                          <g key={a.key}>
                            <line x1={cx} y1={cy} x2={lp.x} y2={lp.y} stroke="#E5E7EB" strokeWidth={0.5} />
                            <text x={tp.x} y={tp.y} textAnchor="middle" dominantBaseline="middle" fontSize={6} fill={a.cor} fontWeight="bold">{a.label.length > 12 ? a.label.split(' ')[0] : a.label}</text>
                          </g>
                        )
                      })}
                      <polygon points={poly} fill="rgba(46,125,107,0.15)" stroke="#2E7D6B" strokeWidth={1.5} />
                      {pts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={3} fill={RODA_12_AREAS[i].cor} />)}
                    </svg>
                  </div>
                )
              })()}
              {RODA_CATEGORIAS.map(cat => {
                const catAvg = rodaAvg(cat.areas.map(k => getVal(k)))
                return (
                  <div key={cat.key} style={{ marginBottom: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: cat.cor, fontFamily: 'Helvetica Neue, Arial, sans-serif' }}>{cat.label}</span>
                      <span style={{ fontSize: '14px', fontWeight: 700, color: cat.cor }}>{catAvg.toFixed(1)}</span>
                    </div>
                    {cat.areas.map(aKey => {
                      const area = RODA_12_AREAS.find(a => a.key === aKey)
                      if (!area) return null
                      const val = getVal(aKey)
                      const pct = val * 10
                      return (
                        <div key={aKey} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px', paddingLeft: '8px' }}>
                          <span style={{ fontSize: '10px', color: ink, width: '110px', fontFamily: 'Helvetica Neue, Arial, sans-serif' }}>{area.label}</span>
                          <div style={{ flex: 1, height: '4px', background: '#E5DDD0', borderRadius: '2px', overflow: 'hidden' }}>
                            <div style={{ width: `${pct}%`, height: '100%', background: area.cor, borderRadius: '2px' }} />
                          </div>
                          <span style={{ fontSize: '10px', fontWeight: 700, color: area.cor, width: '24px', textAlign: 'right' }}>{val.toFixed(1)}</span>
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
            )
          })()}
        </div>
        )}

        {/* ══════ KI FLOW — sorted by priority ══════ */}
        {(selectedSections.completo || selectedSections.bagua) && sortedSetores.length > 0 && (
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
                  const bgRow = isUrgent ? '#FAEEE9' : isWarn ? '#FAF3E0' : '#F0F6F3'
                  const borderCol = isUrgent ? '#B4533A' : isWarn ? '#C9A227' : '#2E7D6B'
                  // Value origin: check if manually adjusted criteria exist
                  const crits = setor.diagnostico_criterios || []
                  const hasManualNotes = crits.some((c: DiagnosticoCriterio) => c.notas && c.notas.trim() !== '')
                  const hasCustomRec = Array.isArray(setor.recomendacoes_custom) && setor.recomendacoes_custom.length > 0
                  const origem = hasManualNotes || hasCustomRec ? 'Ajustado pelo consultor' : crits.length > 0 ? 'Com marcações' : 'Automático'
                  const origemCor = hasManualNotes || hasCustomRec ? '#2E7D6B' : crits.length > 0 ? '#2E7D6B' : '#6B7280'
                  return (
                    <div key={setor.id} style={{
                      display: 'flex', alignItems: 'center', gap: '9px',
                      padding: '7px 11px', borderRadius: '3px',
                      background: bgRow, borderLeft: `3px solid ${borderCol}`
                    }}>
                      <div style={{ fontSize: '11px', width: '105px', flexShrink: 0, fontFamily: 'Helvetica Neue, Arial, sans-serif' }}>
                        {setor.nome}
                        <div style={{ fontSize: '8px', color: origemCor, marginTop: '1px' }}>{origem}</div>
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
        {(selectedSections.completo || selectedSections.checklist) && hasChi && (
          <div style={{ padding: '0 1.5rem 1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '15px', fontWeight: 400, paddingBottom: '8px', borderBottom: `1px solid ${border}`, marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '20px', color: gold }}>🌊</span>
              Fluxo de Chi — Análise de Circulação Energética
            </div>
            <textarea className="no-print" value={textoChi} onChange={e => setTextoChi(e.target.value)}
              rows={3} style={{ width: '100%', padding: '10px 12px', border: '1px dashed #D1D5DB', borderRadius: '8px', fontSize: '12px', color: '#374151', resize: 'vertical', boxSizing: 'border-box' as const, background: '#FFFDF6', fontFamily: 'Helvetica Neue, Arial, sans-serif', lineHeight: '1.6', marginBottom: '0.5rem' }} />
            <div className="print-only" style={{ fontSize: '12px', color: '#374151', lineHeight: 1.7, fontFamily: 'Helvetica Neue, Arial, sans-serif', whiteSpace: 'pre-wrap', marginBottom: '0.5rem' }}>{textoChi}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.9rem' }}>
              {/* Chi checklist */}
              <div style={{ background: '#fff', border: `1px solid ${border}`, borderRadius: '4px', padding: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '8px', borderBottom: `1px solid ${border}`, marginBottom: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 400 }}>
                    <span style={{ fontSize: '18px', color: gold, fontFamily: "'Noto Serif SC', serif" }}>氣</span>
                    Checklist de Chi
                  </div>
                  <span style={{ fontSize: '16px', fontWeight: 700, color: chiScore === null ? '#6B7280' : scoreColor(chiScore) }}>
                    {chiScore === null ? '—' : `${chiScore}%`}
                  </span>
                </div>
                {chiItens.map(item => {
                  // Três símbolos para três estados. Antes, «✕» dizia ao cliente que
                  // o ponto estava errado quando o consultor apenas não o olhou.
                  const estado = chi[item.id]
                  const visual = estado === 'conforme' ? { marca: '✓', cor: '#2E7D6B' }
                    : estado === 'problema' ? { marca: '✕', cor: '#B4533A' }
                    : { marca: '–', cor: '#9CA3AF' }
                  return (
                    <div key={item.id} style={{
                      display: 'flex', alignItems: 'center', gap: '8px',
                      fontSize: '11px', padding: '3px 0', fontFamily: 'Helvetica Neue, Arial, sans-serif'
                    }}>
                      <span style={{ fontWeight: 700, fontSize: '12px', color: visual.cor, width: '14px' }}>
                        {visual.marca}
                      </span>
                      <span style={{ color: estado === undefined ? '#6B7280' : ink }}>{item.label}</span>
                    </div>
                  )
                })}
                {/* Lacuna declarada, não omitida — ADR 0020. */}
                <div style={{
                  marginTop: '8px', paddingTop: '8px', borderTop: `1px solid ${border}`,
                  fontSize: '10px', color: '#6B7280', fontFamily: 'Helvetica Neue, Arial, sans-serif'
                }}>
                  {resumoChi.texto}
                  {resumoChi.naoVerificado > 0 && ' — «–» marca o que não foi verificado nesta visita.'}
                </div>
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
                  const cor = pct >= 70 ? '#2E7D6B' : pct >= 40 ? '#8A6E2F' : '#B4533A'
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

        {/* ══════ RECOMMENDATIONS IN ROWS ══════ */}
        {(selectedSections.completo || selectedSections.bagua) && sortedSetores.length > 0 && (
        <div style={{ padding: '0 1.5rem 1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '15px', fontWeight: 400, paddingBottom: '8px', borderBottom: `1px solid ${border}`, marginBottom: '1rem' }}>
            <span style={{ fontSize: '20px', color: gold, lineHeight: 1, fontFamily: "'Noto Serif SC', serif" }}>薦</span>
            Recomendações Prioritárias
          </div>

          {[
            { label: 'URGENTE', color: '#B4533A', bg: '#FAEEE9', border: '#EBD3C7', filter: (s: SetorBagua) => s.score_percentual != null && s.score_percentual < CORTE_URGENTE },
            { label: 'ATENÇÃO', color: '#8A6E2F', bg: '#FAF3E0', border: '#EEDFB4', filter: (s: SetorBagua) => s.score_percentual != null && s.score_percentual >= CORTE_URGENTE && s.score_percentual < CORTE_ATENCAO },
            { label: 'MANTER', color: '#2E7D6B', bg: '#F0F6F3', border: '#DCEAE4', filter: (s: SetorBagua) => s.score_percentual != null && s.score_percentual >= CORTE_ATENCAO },
          ].map(group => {
            const groupSetores = sortedSetores.filter(group.filter)
            if (groupSetores.length === 0) return null
            return (
              <div key={group.label} style={{ marginBottom: '14px' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 12px', borderRadius: '4px', background: group.bg, border: `1px solid ${group.border}`, marginBottom: '8px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: group.color, fontFamily: 'Helvetica Neue, Arial, sans-serif' }}>{group.label}</span>
                </div>
                {groupSetores.map(setor => {
                  const meta = AREA_META[setor.nome]
                  const criteriosMap = getCriteriosMap(setor)
                  const rec = gerarRecomendacoes({ nomeSetor: setor.nome, scorePct: setor.score_percentual ?? 0, criterios: criteriosPorNomeParaArray(criteriosMap), elemento: setor.elemento, comodos: comodosDeSetorRow(setor) })
                  const customRecs = setor.recomendacoes_custom
                  const hasCustom = Array.isArray(customRecs) && customRecs.length > 0
                  const mainAction = hasCustom
                    ? (customRecs as { tipo: string; texto: string }[])[0].texto
                    : (meta?.action || rec.urgente[0] || rec.melhoria[0] || rec.manutencao[0] || '—')
                  return (
                    <div key={setor.id} style={{ padding: '8px 12px', marginBottom: '4px', borderRadius: '4px', background: '#fff', border: `1px solid ${group.border}`, borderLeft: `3px solid ${group.color}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: ink, fontFamily: 'Helvetica Neue, Arial, sans-serif' }}>
                          {setor.nome} · {meta?.dir || ''} · {meta?.elem || setor.elemento}
                        </span>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: group.color }}>{setor.score_percentual}%</span>
                      </div>
                      <div style={{ fontSize: '11px', color: '#374151', lineHeight: 1.5, fontFamily: 'Helvetica Neue, Arial, sans-serif' }}>
                        {hasCustom && <span style={{ fontSize: '8px', fontWeight: 700, color: '#fff', padding: '1px 5px', borderRadius: '4px', marginRight: '6px', background: '#2E7D6B' }}>★ CONSULTOR</span>}
                        {mainAction}
                      </div>
                      {hasCustom && (customRecs as { tipo: string; texto: string }[]).length > 1 && (
                        <div style={{ fontSize: '10px', color: '#2E7D6B', lineHeight: 1.4, marginTop: '3px', fontFamily: 'Helvetica Neue, Arial, sans-serif' }}>
                          {(customRecs as { tipo: string; texto: string }[]).slice(1, 3).map((cr, ci) => (
                            <div key={ci}>• {cr.texto}</div>
                          ))}
                        </div>
                      )}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px', marginTop: '4px' }}>
                        {[meta?.crystals?.split(',')[0]?.trim(), meta?.plants?.split(',')[0]?.trim(), meta?.colors?.split(',')[0]?.trim()].filter(Boolean).map((tag, ti) => (
                          <span key={ti} style={{ fontSize: '9px', padding: '1px 6px', borderRadius: '2px', background: '#F5F0E5', color: '#666', border: '1px solid #E5DDD0', fontFamily: 'Helvetica Neue, Arial, sans-serif' }}>{tag}</span>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
        )}

        {/* ══════ PLANO DE AÇÃO — remédios tipados por custo/reversibilidade (Parte IV, ADR 0015) ══════ */}
        {(selectedSections.completo || selectedSections.plano_acao) && (() => {
          // Remédios ESTRUTURADOS (conflitos cômodo×setor e Cinco Elementos), com
          // proveniência declarada e ordenados por "custo zero e reversível primeiro".
          // Não repete as dicas de texto livre da seção de Recomendações — aqui o valor
          // é justamente a procedência e o custo, que aquela seção não informa.
          // faltaPct/excessoPct não existem no relatório (dependem de medidas do canvas),
          // então remédios geométricos não aparecem aqui — só no diagnóstico.
          // Escola e ano solar alimentam o alerta específico da Estrela 5 anual.
          // Ano SOLAR (Li Chun), não civil: em janeiro o ano solar ainda é o
          // anterior, e usar getFullYear() apontaria a estrela errada.
          const beRem = consulta.bagua_entrada
          const anoSolarAtual = dataSolar(new Date())?.anoSolar
          const remedios = setores.flatMap(s => {
            // As dicas de texto livre que já se aplicam a este setor. Só as que
            // têm proveniência (fonte nomeada + citação) viram linha aqui — as 8
            // sem fonte localizável seguem só como texto nas seções anteriores.
            // Ver ADR 0015 e ADR 0017.
            const rec = gerarRecomendacoes({
              nomeSetor: s.nome,
              scorePct: s.score_percentual ?? 0,
              criterios: criteriosPorNomeParaArray(
                Object.fromEntries((s.diagnostico_criterios ?? []).map(c => [c.criterio, c.score])),
              ),
              elemento: s.elemento,
              comodos: comodosDeSetorRow(s),
            })
            return gerarRemedios({
              nomeSetor: s.nome,
              scorePct: s.score_percentual ?? 0,
              elemento: s.elemento,
              comodos: comodosDeSetorRow(s),
              dicas: [...rec.urgente, ...rec.melhoria, ...rec.manutencao],
              escola: beRem?.escola,
              anoSolar: anoSolarAtual,
            })
          })
          if (remedios.length === 0) return null
          const ordenados = ordenarRemedios(remedios).slice(0, 12)

          return (
            <div style={{ padding: '0 1.5rem 1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '15px', fontWeight: 400, paddingBottom: '8px', borderBottom: `1px solid ${border}`, marginBottom: '0.8rem' }}>
                <span style={{ fontSize: '20px', color: gold }}>🗂️</span>
                Plano de Ação — do mais barato e reversível ao mais custoso
              </div>
              <p style={{ margin: '0 0 0.8rem', fontSize: '11px', color: inkLt, lineHeight: 1.6, fontFamily: 'Helvetica Neue, Arial, sans-serif' }}>
                Ordem proposital: comece pelo que não custa nada e pode ser desfeito na hora.
                Reposicionar um móvel antes de comprar um objeto. Cada item declara de onde vem
                e o quanto essa recomendação é consolidada entre as escolas.
              </p>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10.5px', fontFamily: 'Helvetica Neue, Arial, sans-serif' }}>
                <thead>
                  <tr style={{ background: paperWarm }}>
                    <th style={{ textAlign: 'left', padding: '5px 6px', borderBottom: `1px solid ${border}`, fontWeight: 700, color: ink }}>Setor</th>
                    <th style={{ textAlign: 'left', padding: '5px 6px', borderBottom: `1px solid ${border}`, fontWeight: 700, color: ink }}>Ação</th>
                    <th style={{ textAlign: 'left', padding: '5px 6px', borderBottom: `1px solid ${border}`, fontWeight: 700, color: ink, whiteSpace: 'nowrap' }}>Custo</th>
                    <th style={{ textAlign: 'left', padding: '5px 6px', borderBottom: `1px solid ${border}`, fontWeight: 700, color: ink, whiteSpace: 'nowrap' }}>Desfazer</th>
                    <th style={{ textAlign: 'left', padding: '5px 6px', borderBottom: `1px solid ${border}`, fontWeight: 700, color: ink }}>Evidência</th>
                  </tr>
                </thead>
                <tbody>
                  {ordenados.map(r => (
                    // Fragment por remédio: a linha da ação e, quando houver, a
                    // linha de ressalvas. As ressalvas vêm da mesma pesquisa que
                    // sustentou a classificação (ADR 0017) — apresentar a cura
                    // sem elas era o que o relatório fazia antes, e é justamente
                    // o que não se deve fazer com "não use planta em quarto de
                    // casal" ou "triângulo nunca em quarto".
                    <Fragment key={r.id}>
                      <tr style={{ pageBreakInside: 'avoid' }}>
                        <td style={{ padding: '5px 6px', borderBottom: r.contraindicacoes.length ? 'none' : `1px solid ${border}`, color: ink, whiteSpace: 'nowrap' }}>{r.setor}</td>
                        <td style={{ padding: '5px 6px', borderBottom: r.contraindicacoes.length ? 'none' : `1px solid ${border}`, color: ink }}>{r.acao}</td>
                        <td style={{ padding: '5px 6px', borderBottom: r.contraindicacoes.length ? 'none' : `1px solid ${border}`, color: r.custo === 'zero' ? '#2E7D6B' : inkLt, whiteSpace: 'nowrap' }}>{ROTULO_CUSTO[r.custo]}</td>
                        <td style={{ padding: '5px 6px', borderBottom: r.contraindicacoes.length ? 'none' : `1px solid ${border}`, color: inkLt, whiteSpace: 'nowrap' }}>{ROTULO_REVERSIBILIDADE[r.reversibilidade]}</td>
                        <td style={{ padding: '5px 6px', borderBottom: r.contraindicacoes.length ? 'none' : `1px solid ${border}`, color: inkLt }}>{ROTULO_EVIDENCIA[r.forcaEvidencia]}</td>
                      </tr>
                      {r.contraindicacoes.length > 0 && (
                        <tr style={{ pageBreakInside: 'avoid' }}>
                          <td />
                          <td colSpan={4} style={{ padding: '0 6px 6px', borderBottom: `1px solid ${border}`, color: '#8A6E2F', fontSize: '9.5px', lineHeight: 1.5 }}>
                            {r.contraindicacoes.map((c, i) => (
                              <div key={i} style={{ marginTop: i === 0 ? 0 : '2px' }}>⚠ {c}</div>
                            ))}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
              <p style={{ margin: '0.7rem 0 0', fontSize: '10px', color: inkLt, lineHeight: 1.6, fontFamily: 'Helvetica Neue, Arial, sans-serif' }}>
                Cada linha declara o custo, se dá para desfazer e o quanto a recomendação é
                consolidada: <strong>consenso clássico</strong> tem âncora explícita em construto
                clássico (ciclo dos Cinco Elementos, Ba Guá, Sheng/Shar Chi) e concordância entre
                fontes; <strong>variante de escola</strong> é característica de uma linhagem, ou as
                fontes divergem; <strong>tradição popular</strong> é uso difundido sem respaldo
                clássico localizado. As ressalvas em ⚠ vêm da mesma leitura que sustentou a
                classificação. Recomendações cuja origem não foi possível localizar na literatura
                não entram nesta tabela — aparecem nas seções anteriores, sem selo de evidência.
                {remedios.length > ordenados.length && ` Mostrando os ${ordenados.length} primeiros de ${remedios.length}.`}
              </p>
            </div>
          )
        })()}

        {/* ══════ EVOLUÇÃO DO TRATAMENTO (antes → depois) ══════ */}
        {(selectedSections.completo || selectedSections.evolucao) && snapshots.length >= 2 && (() => {
          const inicial = snapshots[0]
          const atual = snapshots[snapshots.length - 1]
          const ev = compararSnapshots(inicial.scores, atual.scores)
          const dataFmt = (iso: string) => new Date(iso).toLocaleDateString('pt-BR')
          const deltaCor = (d: number | null) => d == null ? '#9CA3AF' : d > 0 ? '#2E7D6B' : d < 0 ? '#B4533A' : '#6B7280'
          const deltaTxt = (d: number | null) => d == null ? '—' : d > 0 ? `▲ +${d}` : d < 0 ? `▼ ${d}` : '= 0'
          return (
            <div style={{ padding: '0 1.5rem 1rem' }}>
              <div style={{ background: '#fff', border: `1px solid ${border}`, borderRadius: '4px', padding: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '15px', fontWeight: 400, paddingBottom: '8px', borderBottom: `1px solid ${border}`, marginBottom: '0.7rem' }}>
                  <span style={{ fontSize: '20px', color: gold, lineHeight: 1, fontFamily: "'Noto Serif SC', serif" }}>進</span>
                  Evolução do Tratamento — {dataFmt(inicial.criado_em)} → {dataFmt(atual.criado_em)}
                </div>
                {ev.mediaAntes != null && ev.mediaDepois != null && (
                  <div style={{ display: 'flex', gap: '18px', alignItems: 'baseline', marginBottom: '0.7rem', fontFamily: 'Helvetica Neue, Arial, sans-serif' }}>
                    <div style={{ fontSize: '12px', color: inkLt }}>
                      Média geral: <span style={{ fontSize: '18px', color: ink }}>{ev.mediaAntes}%</span>
                      <span style={{ margin: '0 6px' }}>→</span>
                      <span style={{ fontSize: '18px', color: deltaCor(ev.mediaDepois - ev.mediaAntes), fontWeight: 700 }}>{ev.mediaDepois}%</span>
                    </div>
                    <div style={{ fontSize: '11px', color: inkLt }}>
                      <span style={{ color: '#2E7D6B', fontWeight: 700 }}>{ev.melhoraram}</span> melhoraram ·{' '}
                      <span style={{ color: '#6B7280', fontWeight: 700 }}>{ev.estaveis}</span> estáveis ·{' '}
                      <span style={{ color: '#B4533A', fontWeight: 700 }}>{ev.pioraram}</span> pioraram
                    </div>
                  </div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                  {ev.setores.map(s => (
                    <div key={s.numero} style={{ display: 'flex', alignItems: 'center', gap: '8px', border: `1px solid ${border}`, borderRadius: '4px', padding: '6px 10px', fontFamily: 'Helvetica Neue, Arial, sans-serif' }}>
                      <span style={{ flex: 1, fontSize: '11px', color: ink, fontWeight: 600 }}>{s.nome}</span>
                      <span style={{ fontSize: '11px', color: inkLt }}>{s.antes ?? '—'}%</span>
                      <span style={{ fontSize: '10px', color: inkLt }}>→</span>
                      <span style={{ fontSize: '12px', color: ink, fontWeight: 700 }}>{s.depois ?? '—'}%</span>
                      <span style={{ fontSize: '11px', fontWeight: 700, minWidth: '44px', textAlign: 'right', color: deltaCor(s.delta) }}>{deltaTxt(s.delta)}</span>
                    </div>
                  ))}
                </div>
                <p style={{ fontSize: '9px', color: inkLt, margin: '8px 0 0 0', fontFamily: 'Helvetica Neue, Arial, sans-serif' }}>
                  Comparativo entre o diagnóstico inicial e a reavaliação mais recente ({snapshots.length - 1} {snapshots.length > 2 ? 'reavaliações registradas' : 'reavaliação registrada'}).
                </p>
              </div>
            </div>
          )
        })()}

        {/* ══════ CURES & ACTIVATIONS TABLE ══════ */}
        {(selectedSections.completo || selectedSections.curas) && (
        <div style={{ padding: '0 1.5rem 1rem' }}>
          <div style={{ background: '#fff', border: `1px solid ${border}`, borderRadius: '4px', padding: '1rem', overflowX: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '15px', fontWeight: 400, paddingBottom: '8px', borderBottom: `1px solid ${border}`, marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '20px', color: gold, lineHeight: 1, fontFamily: "'Noto Serif SC', serif" }}>治</span>
              Curas &amp; Ativações Detalhadas por Área
            </div>
            <textarea className="no-print" value={textoCuras} onChange={e => setTextoCuras(e.target.value)}
              rows={3} style={{ width: '100%', padding: '8px 10px', border: '1px dashed #D1D5DB', borderRadius: '6px', fontSize: '12px', color: '#374151', resize: 'vertical', boxSizing: 'border-box' as const, background: '#FFFDF6', fontFamily: 'Helvetica Neue, Arial, sans-serif', lineHeight: '1.6', marginBottom: '0.5rem' }} />
            <div className="print-only" style={{ fontSize: '12px', color: '#374151', lineHeight: 1.7, fontFamily: 'Helvetica Neue, Arial, sans-serif', whiteSpace: 'pre-wrap', marginBottom: '0.5rem' }}>{textoCuras}</div>
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
                          background: pct < 40 ? '#FAEEE9' : pct < 70 ? '#FAF3E0' : '#F0F6F3',
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
        )}

        {/* ══════ CURAS DETALHADAS POR SETOR ══════ */}
        {(selectedSections.completo || selectedSections.curas) && setores.length > 0 && (
        <div style={{ padding: '0 1.5rem 1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '15px', fontWeight: 400, paddingBottom: '8px', borderBottom: `1px solid ${border}`, marginBottom: '1rem' }}>
            <span style={{ fontSize: '20px', color: gold }}>💎</span>
            Curas &amp; Ativações — Detalhamento por Setor
          </div>
          {setores.filter(s => s.score_percentual != null && s.score_percentual < CORTE_ATENCAO).sort((a, b) => (a.score_percentual ?? Number.POSITIVE_INFINITY) - (b.score_percentual ?? Number.POSITIVE_INFINITY)).slice(0, 5).map(setor => {
            const meta = AREA_META[setor.nome]
            const lvl = scoreLevelLabel(setor.score_percentual ?? 0)
            return (
              <div key={setor.id} style={{ marginBottom: '14px', border: `1px solid ${border}`, borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ background: meta?.bg || '#0E1B2C', padding: '8px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: meta?.fg || '#fff', fontSize: '13px', fontWeight: 600, fontFamily: 'Helvetica Neue, Arial, sans-serif' }}>
                    {meta?.zh || ''} {setor.nome} · {meta?.elem || setor.elemento}
                  </span>
                  <span style={{ color: meta?.fg || '#fff', fontSize: '12px', fontWeight: 700 }}>{setor.score_percentual}%</span>
                </div>
                <div style={{ padding: '10px 14px', fontSize: '11px', fontFamily: 'Helvetica Neue, Arial, sans-serif', color: ink }}>
                  {/* Cristais */}
                  {meta?.crystals && (
                    <div style={{ marginBottom: '8px' }}>
                      <div style={{ fontWeight: 700, color: '#2E7D6B', marginBottom: '3px' }}>💎 Cristais recomendados</div>
                      <div style={{ color: '#374151', lineHeight: 1.5 }}>{meta.crystals}</div>
                    </div>
                  )}
                  {/* Plantas */}
                  {meta?.plants && (
                    <div style={{ marginBottom: '8px' }}>
                      <div style={{ fontWeight: 700, color: '#2E7D6B', marginBottom: '3px' }}>🌿 Plantas recomendadas</div>
                      <div style={{ color: '#374151', lineHeight: 1.5 }}>{meta.plants}</div>
                    </div>
                  )}
                  {/* Cores */}
                  {meta?.colors && (
                    <div style={{ marginBottom: '8px' }}>
                      <div style={{ fontWeight: 700, color: '#8A6E2F', marginBottom: '3px' }}>🎨 Cores harmônicas</div>
                      <div style={{ color: '#374151', lineHeight: 1.5 }}>{meta.colors}</div>
                    </div>
                  )}
                  {/* Ação principal */}
                  {meta?.action && (
                    <div style={{ marginBottom: '4px' }}>
                      <div style={{ fontWeight: 700, color: '#B4533A', marginBottom: '3px' }}>⚡ Ação prioritária</div>
                      <div style={{ color: '#374151', lineHeight: 1.5 }}>{meta.action}</div>
                    </div>
                  )}
                  {/* Consultant additional recommendation */}
                  {recsAdicionais[setor.id] && (
                    <div style={{ marginTop: '6px', padding: '6px 10px', background: '#EAF4F1', borderLeft: '3px solid #2E7D6B', borderRadius: '2px' }}>
                      <span style={{ fontSize: '8px', fontWeight: 700, color: '#fff', padding: '1px 5px', borderRadius: '4px', marginRight: '6px', background: '#2E7D6B' }}>CONSULTOR</span>
                      <span style={{ color: '#374151' }}>{recsAdicionais[setor.id]}</span>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
        )}

        {/* ══════ DETAILED SECTOR DIAGNOSTICS ══════ */}
        {(selectedSections.completo || selectedSections.bagua) && (
        <div style={{ padding: '0 1.5rem 1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '15px', fontWeight: 400, paddingBottom: '8px', borderBottom: `1px solid ${border}`, marginBottom: '1rem' }}>
            <span style={{ fontSize: '20px', color: gold, lineHeight: 1, fontFamily: "'Noto Serif SC', serif" }}>診</span>
            Diagnóstico Detalhado por Setor
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {setores.map(setor => {
              const pct = setor.score_percentual ?? null
              const criteriosMap = getCriteriosMap(setor)
              const rec = pct != null ? gerarRecomendacoes({ nomeSetor: setor.nome, scorePct: pct, criterios: criteriosPorNomeParaArray(criteriosMap), elemento: setor.elemento, comodos: comodosDeSetorRow(setor) }) : null
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
                    {(setor.diagnostico_criterios?.length ?? 0) > 0 && (() => {
                      const allDefault = setor.diagnostico_criterios!.every((c: DiagnosticoCriterio) => c.score === 2)
                      return allDefault ? (
                        <div style={{ padding: '8px 10px', background: '#F9FAFB', borderRadius: '3px', marginBottom: '10px', fontSize: '11px', color: '#9CA3AF', fontStyle: 'italic', fontFamily: 'Helvetica Neue, Arial, sans-serif' }}>
                          Avaliação detalhada não realizada para este setor.
                        </div>
                      ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', marginBottom: '10px' }}>
                          {setor.diagnostico_criterios!.map((c: DiagnosticoCriterio) => (
                            <div key={c.id} style={{
                              display: 'flex', justifyContent: 'space-between', fontSize: '11px',
                              padding: '4px 8px', background: '#FAFAF5', borderRadius: '3px',
                              fontFamily: 'Helvetica Neue, Arial, sans-serif'
                            }}>
                              <span style={{ color: '#666' }}>{c.criterio}</span>
                              {c.score === 2 ? (
                                <span style={{ color: '#9CA3AF', fontWeight: 400, fontStyle: 'italic' }}>Neutro</span>
                              ) : (
                                <span style={{ color: scoreColor(c.score * 25), fontWeight: 700 }}>{['-2','-1','0','+1','+2'][c.score] ?? c.score}</span>
                              )}
                            </div>
                          ))}
                        </div>
                      )
                    })()}

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
                          <div key={`u${i}`} style={{ padding: '5px 10px', background: '#FAEEE9', borderLeft: '3px solid #B4533A', borderRadius: '2px', marginBottom: '3px', fontSize: '11px', color: '#374151', fontFamily: 'Helvetica Neue, Arial, sans-serif' }}>{d}</div>
                        ))}
                        {rec.melhoria.length > 0 && rec.melhoria.map((d, i) => (
                          <div key={`m${i}`} style={{ padding: '5px 10px', background: '#FAF3E0', borderLeft: '3px solid #C9A227', borderRadius: '2px', marginBottom: '3px', fontSize: '11px', color: '#374151', fontFamily: 'Helvetica Neue, Arial, sans-serif' }}>{d}</div>
                        ))}
                        {rec.manutencao.length > 0 && rec.manutencao.map((d, i) => (
                          <div key={`k${i}`} style={{ padding: '5px 10px', background: '#F0F6F3', borderLeft: '3px solid #2E7D6B', borderRadius: '2px', marginBottom: '3px', fontSize: '11px', color: '#374151', fontFamily: 'Helvetica Neue, Arial, sans-serif' }}>{d}</div>
                        ))}
                      </div>
                    )}

                    {/* Custom consultant recs */}
                    {cRecs.length > 0 && cRecs.map((cr, i) => (
                      <div key={i} style={{
                        padding: '6px 10px', background: paperWarm,
                        borderLeft: `3px solid ${cr.tipo === 'urgente' ? '#B4533A' : cr.tipo === 'melhoria' ? '#8A6E2F' : '#2E7D6B'}`,
                        borderRadius: '2px', marginBottom: '3px', fontSize: '11px',
                        fontFamily: 'Helvetica Neue, Arial, sans-serif'
                      }}>
                        <span style={{
                          fontSize: '8px', fontWeight: 700, color: '#fff', padding: '1px 5px', borderRadius: '4px', marginRight: '6px',
                          background: cr.tipo === 'urgente' ? '#B4533A' : cr.tipo === 'melhoria' ? '#8A6E2F' : '#2E7D6B'
                        }}>{cr.tipo === 'urgente' ? 'URGENTE' : cr.tipo === 'melhoria' ? 'MELHORIA' : 'MANTER'}</span>
                        {cr.texto}
                      </div>
                    ))}

                    {/* Editable additional recommendation per sector */}
                    <div style={{ marginTop: '6px' }}>
                      <textarea className="no-print" value={recsAdicionais[setor.id] || ''} onChange={e => setRecsAdicionais(prev => ({ ...prev, [setor.id]: e.target.value }))}
                        placeholder={`Recomendações adicionais para ${setor.nome}...`} rows={2}
                        style={{ width: '100%', padding: '6px 8px', border: '1px dashed #D1D5DB', borderRadius: '6px', fontSize: '11px', color: '#374151', resize: 'vertical', boxSizing: 'border-box' as const, background: '#FFFDF6', fontFamily: 'Helvetica Neue, Arial, sans-serif' }} />
                      {recsAdicionais[setor.id] && (
                        <div className="print-only" style={{ padding: '6px 10px', background: '#EAF4F1', borderLeft: '3px solid #2E7D6B', borderRadius: '2px', fontSize: '11px', color: '#374151', fontFamily: 'Helvetica Neue, Arial, sans-serif', whiteSpace: 'pre-wrap' }}>
                          <span style={{ fontSize: '8px', fontWeight: 700, color: '#fff', padding: '1px 5px', borderRadius: '4px', marginRight: '6px', background: '#2E7D6B' }}>CONSULTOR</span>
                          {recsAdicionais[setor.id]}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
        )}


        {/* ══════ FOTOS DO IMÓVEL ══════ */}
        {!showSelector && (selectedSections.completo || selectedSections.fotos) && (
          consulta?.foto_geral_url || (consulta?.fotos_antes && (consulta.fotos_antes as string[]).length > 0) || (consulta?.fotos_depois && (consulta.fotos_depois as string[]).length > 0)
        ) && (
        <div style={{ padding: '0 1.5rem 1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '15px', fontWeight: 400, paddingBottom: '8px', borderBottom: '1px solid #EAE5DB', marginBottom: '1rem' }}>
            <span style={{ fontSize: '20px', color: '#C9A96E' }}>📸</span>
            Fotos do Imóvel
          </div>

          {resolverFoto(consulta?.foto_geral_url) && (
            <div style={{ marginBottom: '16px', textAlign: 'center' }}>
              <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#374151', marginBottom: '6px' }}>Foto Geral</div>
              <img src={resolverFoto(consulta?.foto_geral_url)!} alt="Foto geral" style={{ maxWidth: '100%', maxHeight: '300px', borderRadius: '8px', border: '1px solid #E5E7EB' }} />
            </div>
          )}

          {/* Before/After comparison */}
          {((consulta?.fotos_antes as string[] | undefined)?.length ?? 0) > 0 && (
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#374151', marginBottom: '8px' }}>Antes</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                {(consulta?.fotos_antes as string[] || []).slice(0, 6).map((url: string, i: number) => {
                  const assinada = resolverFoto(url)
                  return assinada ? (
                    <img key={i} src={assinada} alt={`Antes ${i+1}`} style={{ width: '100%', height: '120px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #E5E7EB' }} />
                  ) : null
                })}
              </div>
            </div>
          )}

          {((consulta?.fotos_depois as string[] | undefined)?.length ?? 0) > 0 && (
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#2E7D6B', marginBottom: '8px' }}>Depois</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                {(consulta?.fotos_depois as string[] || []).slice(0, 6).map((url: string, i: number) => {
                  const assinada = resolverFoto(url)
                  return assinada ? (
                    <img key={i} src={assinada} alt={`Depois ${i+1}`} style={{ width: '100%', height: '120px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #DCEAE4' }} />
                  ) : null
                })}
              </div>
            </div>
          )}
        </div>
        )}

        {/* ══════ PRÓXIMOS PASSOS ══════ */}
        {!showSelector && (selectedSections.completo || selectedSections.proximos_passos) && (
        <div style={{ padding: '0 1.5rem 1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '15px', fontWeight: 400, paddingBottom: '8px', borderBottom: '1px solid #EAE5DB', marginBottom: '1rem' }}>
            <span style={{ fontSize: '20px', color: '#C9A96E' }}>🎯</span>
            Seus Próximos Passos
          </div>
          {(() => {
            // Generate priorities from data
            const sorted = [...setores].filter(s => s.score_percentual != null).sort((a, b) => (a.score_percentual ?? Number.POSITIVE_INFINITY) - (b.score_percentual ?? Number.POSITIVE_INFINITY))
            const priorities = sorted.slice(0, 3)
            const investLevel = (pct: number) => pct < 40 ? 'Alto' : pct < 70 ? 'Médio' : 'Baixo'
            const prazo = (pct: number) => pct < 40 ? 'Imediato' : pct < 70 ? 'Próximas 2 semanas' : 'Próximo mês'
            return priorities.map((setor, i) => {
              const meta = AREA_META[setor.nome]
              const rec = gerarRecomendacoes({ nomeSetor: setor.nome, scorePct: setor.score_percentual ?? 0, criterios: criteriosPorNomeParaArray(getCriteriosMap(setor)), elemento: setor.elemento, comodos: comodosDeSetorRow(setor) })
              const customRecs = Array.isArray(setor.recomendacoes_custom) ? setor.recomendacoes_custom as {texto:string}[] : []
              const action = customRecs[0]?.texto || rec.urgente[0] || rec.melhoria[0] || meta?.action || 'Avaliar e harmonizar este setor'
              return (
                <div key={setor.id} style={{ padding: '14px 16px', marginBottom: '10px', borderRadius: '8px', background: i === 0 ? '#FAEEE9' : i === 1 ? '#FAF3E0' : '#F0F6F3', border: `1px solid ${i === 0 ? '#EBD3C7' : i === 1 ? '#EEDFB4' : '#DCEAE4'}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#0E1B2C' }}>Prioridade {i + 1} — {setor.nome}</span>
                    <span style={{ fontSize: '11px', fontWeight: 'bold', color: scoreColor(setor.score_percentual ?? 0), background: '#fff', padding: '2px 8px', borderRadius: '10px' }}>{setor.score_percentual}%</span>
                  </div>
                  <div style={{ fontSize: '12px', color: '#374151', marginBottom: '4px' }}><strong>Ação:</strong> {action}</div>
                  <div style={{ display: 'flex', gap: '16px', fontSize: '11px', color: '#6B7280' }}>
                    <span>Prazo: {prazo(setor.score_percentual ?? 0)}</span>
                    <span>Investimento: {investLevel(setor.score_percentual ?? 0)}</span>
                    {meta?.elem && <span>Elemento: {meta.elem}</span>}
                  </div>
                </div>
              )
            })
          })()}
          {/* Calendário Lunar */}
          <div style={{ marginTop: '16px', padding: '14px 16px', background: '#0E1B2C', borderRadius: '10px', color: '#fff' }}>
            <div style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '10px' }}>🌙 Próximas Fases Lunares</div>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              {getProximasFasesLunares().map((f, i) => (
                <div key={i} style={{ flex: 1, minWidth: '140px', padding: '10px', background: 'rgba(255,255,255,0.1)', borderRadius: '8px' }}>
                  <div style={{ fontSize: '20px', marginBottom: '4px' }}>{f.emoji}</div>
                  <div style={{ fontSize: '12px', fontWeight: 'bold' }}>{f.fase}</div>
                  <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)' }}>{f.data.toLocaleDateString('pt-BR')}</div>
                  <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', marginTop: '4px', lineHeight: 1.3 }}>{f.sugestao}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
        )}

        {/* ══════ ONDE AS ESCOLAS DIVERGEM (motor de síntese, ADR 0013) ══════ */}
        {!showSelector && (selectedSections.completo || selectedSections.divergencias) && (() => {
          const be = consulta.bagua_entrada
          // Só a Escola da Bússola produz os métodos que podem conflitar (Fei Xing e Ba Zhai
          // dependem de orientação). Em BTB não há segunda fonte — e o BTB é isolado por decisão
          // de domínio (ADR 0013), então não há síntese a fazer.
          if (be?.escola !== 'bussola' || typeof be.orientacao_graus !== 'number') return null

          const doImovel = periodoDaConsulta(consulta)
          const mapa = doImovel ? calcularEstrelasVoadoras({ facingGraus: be.orientacao_graus, periodo: doImovel.periodo }) : null
          const cli = consulta.clientes as { data_nascimento?: string | null; genero?: string | null } | null
          const mg = calcularMingGua(cli?.data_nascimento, cli?.genero)
          const favoraveis = mg ? setoresFavoraveis(mg.direcoes) : null
          // Ano SOLAR, não civil: a estrela anual muda no Li Chun (~4/fev), então
          // `getFullYear()` daria a estrela errada em janeiro. Mesmo padrão de bagua-planta.
          const anoSolarAtual = dataSolar(new Date())?.anoSolar
          const gradeAnual = anoSolarAtual != null ? calcularGradeAnual(anoSolarAtual) : null

          // Sem nenhuma das duas fontes não há o que sintetizar.
          if (!mapa && !favoraveis) return null

          const sintese = sintetizarImovel({ mapaEstrelas: mapa, gradeAnual: mapa ? gradeAnual : null, baZhaiFavoraveis: favoraveis })

          return (
            <div style={{ padding: '0 1.5rem 1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '15px', fontWeight: 400, paddingBottom: '8px', borderBottom: `1px solid ${border}`, marginBottom: '1rem' }}>
                <span style={{ fontSize: '20px', color: gold, fontFamily: "'Noto Serif SC', serif" }}>合</span>
                Onde as escolas divergem neste imóvel
              </div>

              <p style={{ margin: '0 0 0.8rem', fontSize: '11px', color: inkLt, lineHeight: 1.6, fontFamily: 'Helvetica Neue, Arial, sans-serif' }}>
                Métodos de Feng Shui discordam entre si — isso é normal e esperado. Em vez de esconder a divergência
                atrás de um número único, este relatório mostra qual método prevaleceu e por quê, seguindo a hierarquia
                de precedência adotada: Formas → Estrelas Voadoras → Oito Mansões → Liu Fa.
              </p>

              {sintese.perigosos.length > 0 && (
                <div style={{ background: '#FAEEE9', border: '1px solid #E0A48E', borderRadius: '4px', padding: '0.8rem', marginBottom: '0.8rem', pageBreakInside: 'avoid' }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#991B1B', marginBottom: '5px', fontFamily: 'Helvetica Neue, Arial, sans-serif' }}>
                    Setores que exigem cautela ({sintese.perigosos.length})
                  </div>
                  {sintese.perigosos.map(p => (
                    <div key={p.setor} style={{ fontSize: '11px', color: '#8F3F2C', marginBottom: '3px', fontFamily: 'Helvetica Neue, Arial, sans-serif' }}>
                      <strong>{p.setor}</strong> — {p.resolucao.motivoFinal}
                    </div>
                  ))}
                </div>
              )}

              {sintese.temDivergencia ? (
                sintese.divergentes.map(d => (
                  <div key={d.setor} style={{ background: '#fff', border: `1px solid ${border}`, borderRadius: '4px', padding: '0.8rem', marginBottom: '0.6rem', pageBreakInside: 'avoid', fontFamily: 'Helvetica Neue, Arial, sans-serif' }}>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: ink, marginBottom: '5px' }}>
                      Setor {d.setor}
                    </div>
                    <div style={{ fontSize: '11px', color: ink, marginBottom: '4px' }}>
                      <span style={{ color: '#2E7D6B', fontWeight: 700 }}>Prevaleceu</span>
                      {' — '}
                      {d.resolucao.metodoVencedor ? PERFIS_METODOS[d.resolucao.metodoVencedor].nome : '—'}: {d.resolucao.motivoFinal}
                    </div>
                    {d.resolucao.divergencias.map((div, i) => (
                      <div key={i} style={{ fontSize: '11px', color: inkLt, marginBottom: '2px', paddingLeft: '10px', borderLeft: `2px solid ${border}` }}>
                        <span style={{ fontWeight: 700 }}>{PERFIS_METODOS[div.metodo].nome}</span> discorda: {div.motivo}
                        <br /><span style={{ fontSize: '10px' }}>{div.razaoDaPerda}</span>
                      </div>
                    ))}
                  </div>
                ))
              ) : (
                <p style={{ margin: 0, fontSize: '11px', color: inkLt, fontFamily: 'Helvetica Neue, Arial, sans-serif' }}>
                  Os métodos aplicados concordam em todos os 8 setores — não há divergência a reportar neste imóvel.
                </p>
              )}

              {sintese.avisos.map((aviso, i) => (
                <p key={i} style={{ margin: '0.5rem 0 0', fontSize: '10px', color: '#8A6E2F', fontFamily: 'Helvetica Neue, Arial, sans-serif' }}>
                  ⚠ {aviso}
                </p>
              ))}

              <p style={{ margin: '0.8rem 0 0', fontSize: '10px', color: inkLt, lineHeight: 1.6, fontFamily: 'Helvetica Neue, Arial, sans-serif' }}>
                Escopo desta síntese: participam as Estrelas Voadoras{mapa ? '' : ' (ausentes — falta data de construção)'} e
                as Oito Mansões{favoraveis ? '' : ' (ausentes — falta data de nascimento/gênero do cliente)'}.
                Das Estrelas Voadoras considera-se apenas a Estrela 5 (Wu Huang), cuja gravidade não tem divergência
                entre escolas; as demais combinações não são classificadas automaticamente
                {mapa && gradeAnual && anoSolarAtual != null && `, e a sobreposição anual usada é a do ano solar ${anoSolarAtual}`}.
                Escola das Formas, BaZi e
                Da Gua/San He não participam — dependem de dados que o sistema ainda não captura de forma estruturada.
                Orientação usada: {be.orientacao_graus.toFixed(1)}° em Norte {rotuloReferencia(be.orientacao_referencia === 'verdadeiro' ? 'verdadeiro' : 'magnetico')}.
              </p>
            </div>
          )
        })()}

        {/* ══════ CONCLUSÃO (editável) ══════ */}
        {!showSelector && (selectedSections.completo || selectedSections.conclusao) && (
        <div style={{ padding: '0 1.5rem 1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '15px', fontWeight: 400, paddingBottom: '8px', borderBottom: `1px solid ${border}`, marginBottom: '1rem' }}>
            <span style={{ fontSize: '20px', color: gold }}>📝</span>
            Conclusão
          </div>
          <textarea className="no-print" value={textoConclusao} onChange={e => setTextoConclusao(e.target.value)}
            rows={4} style={{ width: '100%', padding: '10px 12px', border: '1px dashed #D1D5DB', borderRadius: '8px', fontSize: '13px', color: '#374151', resize: 'vertical', boxSizing: 'border-box' as const, background: '#FFFDF6', fontFamily: 'Helvetica Neue, Arial, sans-serif', lineHeight: '1.6' }} />
          <div className="print-only" style={{ fontSize: '12px', color: '#374151', lineHeight: 1.7, fontFamily: 'Helvetica Neue, Arial, sans-serif', whiteSpace: 'pre-wrap' }}>{textoConclusao}</div>
        </div>
        )}

        {/* ══════ ENCERRAMENTO ══════ */}
        {!showSelector && (selectedSections.completo || selectedSections.conclusao) && (
        <div style={{ padding: '1rem 1.5rem', margin: '0 1.5rem 1rem', background: '#0E1B2C', borderRadius: '10px', color: '#fff' }}>
          <div style={{ textAlign: 'center', marginBottom: '16px' }}>
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>☯</div>
            <div style={{ fontSize: '11px', lineHeight: 1.6, color: 'rgba(255,255,255,0.7)', maxWidth: '500px', margin: '0 auto' }}>
              Este relatório foi elaborado com base na Escola Budista da Seita Negra (Black Hat Sect), fundada pelo Mestre Lin Yun Rinpoche. As recomendações são orientações energéticas e não substituem avaliações profissionais de outras áreas.
            </div>
          </div>
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.2)', paddingTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <div>
              {profile?.nome_completo && <div style={{ fontSize: '13px', fontWeight: 'bold' }}>{profile.nome_completo}</div>}
              {profile?.profissao && <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)' }}>{profile.profissao}</div>}
              {profile?.registro_profissional && <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)' }}>{profile.registro_profissional}</div>}
            </div>
            <div style={{ textAlign: 'right' }}>
              {profile?.telefone && <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)' }}>{profile.telefone}</div>}
              {profile?.site && <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)' }}>{profile.site}</div>}
              {profile?.instagram && <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)' }}>@{profile.instagram.replace('@', '')}</div>}
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginTop: '4px' }}>Gerado em {new Date().toLocaleDateString('pt-BR')}</div>
            </div>
          </div>
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

      </div>}
    </>
  )
}
