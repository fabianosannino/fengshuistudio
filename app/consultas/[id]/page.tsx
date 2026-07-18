'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../../src/lib/supabase'
import { useRouter, useParams } from 'next/navigation'
import Image from 'next/image'
import FlowLayout from '../../components/FlowLayout'
import TabRodaDaVida from './TabRodaDaVida'
import TabFluxoChi from './TabFluxoChi'
import TabFotos from './TabFotos'
import { CRITERIOS, SETOR_DICAS, CRITERIO_DICAS } from '../../../src/lib/constants'
import type { Consulta, SetorBagua, DiagnosticoCriterio, FotoComodo } from '../../../src/lib/types'

// Cômodo suggestions for multi-select autocomplete
const COMODO_SUGGESTIONS = [
  'sala', 'quarto_casal', 'quarto_filho', 'quarto_hospede', 'escritorio',
  'cozinha', 'banheiro', 'lavabo', 'area_servico', 'garagem', 'varanda',
  'corredor', 'despensa', 'jardim', 'piscina', 'biblioteca', 'home_office',
  'sala_jantar', 'sala_tv', 'closet', 'sacada', 'terraço', 'quintal'
]

const COMODO_LABELS: Record<string, string> = {
  sala: 'Sala de Estar', quarto_casal: 'Quarto do Casal', quarto_filho: 'Quarto de Filho(a)',
  quarto_hospede: 'Quarto de Hóspede', escritorio: 'Escritório', cozinha: 'Cozinha',
  banheiro: 'Banheiro', lavabo: 'Lavabo', area_servico: 'Área de Serviço',
  garagem: 'Garagem', varanda: 'Varanda', corredor: 'Corredor', despensa: 'Despensa',
  jardim: 'Jardim', piscina: 'Piscina', biblioteca: 'Biblioteca', home_office: 'Home Office',
  sala_jantar: 'Sala de Jantar', sala_tv: 'Sala de TV', closet: 'Closet',
  sacada: 'Sacada', 'terraço': 'Terraço', quintal: 'Quintal',
}

function ComodoAutocomplete({ selected, onChange }: { selected: string[]; onChange: (v: string[]) => void }) {
  const [input, setInput] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)

  const filtered = COMODO_SUGGESTIONS
    .filter(s => !selected.includes(s))
    .filter(s => !input || (COMODO_LABELS[s] || s).toLowerCase().includes(input.toLowerCase()))

  function addItem(item: string) {
    onChange([...selected, item])
    setInput('')
    setShowSuggestions(false)
  }

  function addCustom() {
    if (input.trim() && !selected.includes(input.trim())) {
      onChange([...selected, input.trim()])
      setInput('')
      setShowSuggestions(false)
    }
  }

  return (
    <div style={{ position: 'relative' }}>
      <input
        type="text"
        value={input}
        onChange={e => { setInput(e.target.value); setShowSuggestions(true) }}
        onFocus={() => setShowSuggestions(true)}
        onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustom() } }}
        placeholder="Digite para buscar ou adicionar cômodo..."
        style={{
          width: '100%', padding: '8px 12px', border: '1px solid #D1D5DB',
          borderRadius: '6px', fontSize: '13px', boxSizing: 'border-box'
        }}
      />
      {showSuggestions && (input || filtered.length > 0) && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10,
          background: '#fff', border: '1px solid #E5E7EB', borderRadius: '6px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)', maxHeight: '200px', overflowY: 'auto'
        }}>
          {filtered.slice(0, 8).map(s => (
            <button key={s} onClick={() => addItem(s)} style={{
              display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px',
              border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '13px',
              color: '#374151'
            }}
              onMouseEnter={e => (e.currentTarget.style.background = '#F3F4F6')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              {COMODO_LABELS[s] || s}
            </button>
          ))}
          {input.trim() && !COMODO_SUGGESTIONS.includes(input.trim()) && (
            <button onClick={addCustom} style={{
              display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px',
              border: 'none', borderTop: '1px solid #E5E7EB', background: '#F5F0FF',
              cursor: 'pointer', fontSize: '13px', color: '#7C3AED', fontWeight: 'bold'
            }}>
              + Adicionar &quot;{input.trim()}&quot;
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// Favorability mapping: which rooms are favorable in each Guá
const COMODO_FAVORAVEL: Record<string, { favoravel: string[]; problematico: string[] }> = {
  'Carreira': { favoravel: ['escritorio', 'sala'], problematico: ['banheiro', 'despensa'] },
  'Espiritualidade': { favoravel: ['quarto_casal', 'escritorio'], problematico: ['banheiro', 'cozinha'] },
  'Conhecimento': { favoravel: ['quarto_casal', 'escritorio'], problematico: ['banheiro', 'cozinha'] },
  'Família': { favoravel: ['sala', 'cozinha', 'quarto_casal'], problematico: ['banheiro', 'garagem'] },
  'Prosperidade': { favoravel: ['escritorio', 'sala', 'cozinha'], problematico: ['banheiro', 'area_servico'] },
  'Centro': { favoravel: ['sala'], problematico: ['banheiro', 'escada'] },
  'Centro/Saúde': { favoravel: ['sala'], problematico: ['banheiro', 'escada'] },
  'Fama': { favoravel: ['sala', 'escritorio'], problematico: ['banheiro', 'garagem'] },
  'Fama/Reputação': { favoravel: ['sala', 'escritorio'], problematico: ['banheiro', 'garagem'] },
  'Relacionamentos': { favoravel: ['quarto_casal', 'sala'], problematico: ['banheiro', 'area_servico'] },
  'Criatividade': { favoravel: ['quarto_filho', 'escritorio'], problematico: ['banheiro', 'despensa'] },
  'Filhos': { favoravel: ['quarto_filho', 'escritorio'], problematico: ['banheiro', 'despensa'] },
  'Pessoas Úteis': { favoravel: ['sala', 'escritorio', 'varanda'], problematico: ['banheiro', 'area_servico'] },
  'Pessoas Uteis': { favoravel: ['sala', 'escritorio', 'varanda'], problematico: ['banheiro', 'area_servico'] },
}

// Map recommendation keywords to product categories for affiliate links
const PRODUTO_SUGESTOES: Record<string, { nome: string; categoria: string }> = {
  'espelho': { nome: 'Espelhos Ba Gua', categoria: 'espelhos' },
  'cristal': { nome: 'Cristais e Pedras', categoria: 'cristais' },
  'cristais': { nome: 'Cristais e Pedras', categoria: 'cristais' },
  'quartzo': { nome: 'Cristais e Pedras', categoria: 'cristais' },
  'obsidiana': { nome: 'Cristais e Pedras', categoria: 'cristais' },
  'selenita': { nome: 'Cristais e Pedras', categoria: 'cristais' },
  'ametista': { nome: 'Cristais e Pedras', categoria: 'cristais' },
  'fonte': { nome: 'Fontes de Agua', categoria: 'fontes' },
  'aquário': { nome: 'Fontes de Agua', categoria: 'fontes' },
  'aquario': { nome: 'Fontes de Agua', categoria: 'fontes' },
  'planta': { nome: 'Plantas e Vasos', categoria: 'plantas' },
  'bambu': { nome: 'Plantas e Vasos', categoria: 'plantas' },
  'espada-de-são-jorge': { nome: 'Plantas e Vasos', categoria: 'plantas' },
  'lírio': { nome: 'Plantas e Vasos', categoria: 'plantas' },
  'sino': { nome: 'Sinos de Vento', categoria: 'sinos' },
  'móbile': { nome: 'Sinos de Vento', categoria: 'sinos' },
  'mobile': { nome: 'Sinos de Vento', categoria: 'sinos' },
  'vela': { nome: 'Velas e Incensos', categoria: 'velas' },
  'incens': { nome: 'Velas e Incensos', categoria: 'velas' },
  'difusor': { nome: 'Velas e Incensos', categoria: 'velas' },
  'moeda': { nome: 'Decoracao e Simbolos', categoria: 'decoracao' },
  'buda': { nome: 'Decoracao e Simbolos', categoria: 'decoracao' },
  'elefante': { nome: 'Decoracao e Simbolos', categoria: 'decoracao' },
  'sapo': { nome: 'Decoracao e Simbolos', categoria: 'decoracao' },
}

function getProdutosSugeridos(recomendacoes: string[]): { nome: string; categoria: string }[] {
  const found = new Map<string, { nome: string; categoria: string }>()
  recomendacoes.forEach(rec => {
    const lower = rec.toLowerCase()
    Object.entries(PRODUTO_SUGESTOES).forEach(([keyword, produto]) => {
      if (lower.includes(keyword) && !found.has(produto.categoria)) {
        found.set(produto.categoria, produto)
      }
    })
  })
  return Array.from(found.values())
}

function gerarRecomendacoes(nomeSetor: string, scorePct: number, criteriosSetor: Record<string, number>) {
  const urgente: string[] = []
  const melhoria: string[] = []
  const manutencao: string[] = []

  // Scale: 0=Crítico(-2), 1=Ruim(-1), 2=Neutro(0), 3=Bom(+1), 4=Ótimo(+2)
  CRITERIOS.forEach((criterio, ci) => {
    const val = criteriosSetor[criterio] ?? -1
    const dicas = CRITERIO_DICAS[ci] || []
    if (val === 0) urgente.push(...dicas.slice(0, 2))
    else if (val === 1) melhoria.push(...dicas.slice(0, 2))
    else if (val === 2) melhoria.push(dicas[0] || '')
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

type CustomRec = { tipo: 'urgente' | 'melhoria' | 'manutencao'; texto: string; produtos: string[] }

const PRODUTO_CATEGORIAS = [
  { value: 'espelhos', label: 'Espelhos Ba Gua' },
  { value: 'cristais', label: 'Cristais e Pedras' },
  { value: 'fontes', label: 'Fontes de Agua' },
  { value: 'plantas', label: 'Plantas e Vasos' },
  { value: 'sinos', label: 'Sinos de Vento' },
  { value: 'velas', label: 'Velas e Incensos' },
  { value: 'decoracao', label: 'Decoracao e Simbolos' },
]

function NewRecForm({ onAdd }: { onAdd: (rec: CustomRec) => void }) {
  const [tipo, setTipo] = useState<'urgente' | 'melhoria' | 'manutencao'>('melhoria')
  const [texto, setTexto] = useState('')
  const [produtos, setProdutos] = useState<string[]>([])
  const [open, setOpen] = useState(false)

  function handleAdd() {
    if (!texto.trim()) return
    onAdd({ tipo, texto: texto.trim(), produtos })
    setTexto('')
    setProdutos([])
    setOpen(false)
  }

  function toggleProduto(val: string) {
    setProdutos(prev => prev.includes(val) ? prev.filter(p => p !== val) : [...prev, val])
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} style={{
        width: '100%', padding: '10px', background: '#7C3AED', color: '#fff',
        border: 'none', borderRadius: '8px', cursor: 'pointer',
        fontSize: '13px', fontWeight: 'bold'
      }}>+ Adicionar recomendação</button>
    )
  }

  return (
    <div style={{ background: '#ffffff', borderRadius: '8px', padding: '14px', border: '1px solid #E9D5FF' }}>
      {/* Tipo */}
      <div style={{ marginBottom: '10px' }}>
        <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#374151', display: 'block', marginBottom: '6px' }}>Classificação</label>
        <div style={{ display: 'flex', gap: '6px' }}>
          {([['urgente', 'Urgente', '#DC2626'], ['melhoria', 'Melhoria', '#D97706'], ['manutencao', 'Manutenção', '#15803D']] as const).map(([val, label, color]) => (
            <button key={val} onClick={() => setTipo(val)} style={{
              padding: '6px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold',
              border: 'none', cursor: 'pointer',
              background: tipo === val ? color : '#F3F4F6',
              color: tipo === val ? '#fff' : '#6B7280'
            }}>{label}</button>
          ))}
        </div>
      </div>

      {/* Texto */}
      <div style={{ marginBottom: '10px' }}>
        <label htmlFor="input-orientacao-cliente" style={{ fontSize: '12px', fontWeight: 'bold', color: '#374151', display: 'block', marginBottom: '6px' }}>Orientação ao cliente</label>
        <textarea
          id="input-orientacao-cliente"
          value={texto}
          onChange={e => setTexto(e.target.value)}
          placeholder="Descreva a recomendação, orientação ou direcionamento para o cliente..."
          rows={3}
          style={{
            width: '100%', padding: '10px', border: '1px solid #D1D5DB',
            borderRadius: '6px', fontSize: '13px', resize: 'vertical',
            outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit'
          }}
        />
      </div>

      {/* Produtos */}
      <div style={{ marginBottom: '14px' }}>
        <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#374151', display: 'block', marginBottom: '6px' }}>Produtos sugeridos (opcional)</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {PRODUTO_CATEGORIAS.map(cat => (
            <button key={cat.value} onClick={() => toggleProduto(cat.value)} style={{
              padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 'bold',
              border: produtos.includes(cat.value) ? '2px solid #7C3AED' : '1px solid #D1D5DB',
              background: produtos.includes(cat.value) ? '#EDE9FE' : '#fff',
              color: produtos.includes(cat.value) ? '#7C3AED' : '#6B7280',
              cursor: 'pointer'
            }}>{cat.label}</button>
          ))}
        </div>
      </div>

      {/* Ações */}
      <div style={{ display: 'flex', gap: '8px' }}>
        <button onClick={handleAdd} disabled={!texto.trim()} style={{
          flex: 1, padding: '10px', background: texto.trim() ? '#7C3AED' : '#D1D5DB',
          color: '#fff', border: 'none', borderRadius: '8px', cursor: texto.trim() ? 'pointer' : 'not-allowed',
          fontSize: '13px', fontWeight: 'bold'
        }}>Adicionar</button>
        <button onClick={() => { setOpen(false); setTexto(''); setProdutos([]) }} style={{
          padding: '10px 16px', background: '#F3F4F6', color: '#6B7280',
          border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '13px'
        }}>Cancelar</button>
      </div>
    </div>
  )
}

// ── Tabs ─────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'diagnostico', label: 'Diagnóstico Ba Guá', icon: '☯' },
  { id: 'roda_vida', label: 'Roda da Vida', icon: '◎' },
  { id: 'fluxo_chi', label: 'Fluxo de Chi', icon: '🌊' },
  { id: 'fotos', label: 'Fotos do Imóvel', icon: '📷' },
]

export default function ConsultaDetalhe() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [consulta, setConsulta] = useState<Consulta | null>(null)
  const [setores, setSetores] = useState<SetorBagua[]>([])
  const [criterios, setCriterios] = useState<Record<string, Record<string, number>>>({})
  const [notas, setNotas] = useState<Record<string, Record<string, string>>>({})
  const [customRecs, setCustomRecs] = useState<Record<string, CustomRec[]>>({})
  const [comodoMap, setComodoMap] = useState<Record<string, string[]>>({})
  const [setorAtivo, setSetorAtivo] = useState<string | null>(null)
  const [recModal, setRecModal] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('diagnostico')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  // New data for Roda da Vida & Chi Flow
  const [rodaData, setRodaData] = useState<Record<string, number[] | number>>({})
  const [rodaObservacoes, setRodaObservacoes] = useState<Record<string, string>>({})
  const [rodaObservacaoGeral, setRodaObservacaoGeral] = useState('')
  const [checklistChi, setChecklistChi] = useState<string[]>([])
  const [posicaoComando, setPosicaoComando] = useState<Record<string, string[]>>({})

  // Fotos do imóvel
  const [fotoGeral, setFotoGeral] = useState<string | null>(null)
  const [fotosComodos, setFotosComodos] = useState<FotoComodo[]>([])
  const [fotosAntes, setFotosAntes] = useState<string[]>([])
  const [fotosDepois, setFotosDepois] = useState<string[]>([])

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }

      // Run both queries in parallel (both use the id param, not each other's results)
      const [consultaRes, setoresRes] = await Promise.all([
        supabase
          .from('consultas')
          .select('*, clientes(nome_completo)')
          .eq('id', id)
          .single(),
        supabase
          .from('setores_bagua')
          .select('*, diagnostico_criterios(*)')
          .eq('consulta_id', id)
          .order('numero'),
      ])

      const consulta = consultaRes.data
      if (!consulta) { router.push('/consultas'); return }
      setConsulta(consulta)

      // Load advanced diagnostic data (stored as JSONB)
      // Support both old format { area: number } and new format { respostas: { area: number[] } }
      const rawRoda = consulta.roda_da_vida || {}
      if (rawRoda.respostas) {
        // New format from /roda-da-vida: { respostas: { area: [5,5,5,5,5] }, acoes: [...] }
        setRodaData(rawRoda.respostas)
      } else {
        // Old format: { area: 5 } or empty
        setRodaData(rawRoda)
      }
      setRodaObservacoes(rawRoda.observacoes || {})
      setRodaObservacaoGeral(rawRoda.observacao_geral || '')
      setChecklistChi(consulta.checklist_chi || [])
      setPosicaoComando(consulta.posicao_comando || {})

      // Load fotos
      setFotoGeral(consulta.foto_geral_url || null)
      setFotosComodos(Array.isArray(consulta.fotos_comodos) ? consulta.fotos_comodos : [])
      setFotosAntes(Array.isArray(consulta.fotos_antes) ? consulta.fotos_antes : [])
      setFotosDepois(Array.isArray(consulta.fotos_depois) ? consulta.fotos_depois : [])

      const setoresData = setoresRes.data

      setSetores(setoresData || [])

      const cMap: Record<string, Record<string, number>> = {}
      const nMap: Record<string, Record<string, string>> = {}
      const rMap: Record<string, CustomRec[]> = {}
      const cmMap: Record<string, string[]> = {}
      setoresData?.forEach(setor => {
        cMap[setor.id] = {}
        nMap[setor.id] = {}
        rMap[setor.id] = Array.isArray(setor.recomendacoes_custom) ? setor.recomendacoes_custom : []
        cmMap[setor.id] = Array.isArray(setor.comodos) ? setor.comodos : (setor.comodo_tipo ? [setor.comodo_tipo] : [])
        setor.diagnostico_criterios?.forEach((c: DiagnosticoCriterio) => {
          cMap[setor.id][c.criterio] = c.score
          nMap[setor.id][c.criterio] = c.notas || ''
        })
      })
      setCriterios(cMap)
      setNotas(nMap)
      setCustomRecs(rMap)
      setComodoMap(cmMap)

      if (setoresData && setoresData.length > 0) {
        setSetorAtivo(setoresData[0].id)
      }

      setLoading(false)
    }
    load()

    // Reload on focus (returning from bagua-planta)
    const onFocus = () => load()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [id, router])

  function getScore(setorId: string) {
    const scores = Object.values(criterios[setorId] || {})
    if (scores.length === 0) return null
    const total = scores.reduce((a, b) => a + b, 0)
    return Math.round((total / (scores.length * 4)) * 100)
  }

  function scoreColor(pct: number | null) {
    if (pct === null) return '#D1D5DB'
    if (pct >= 70) return '#15803D'
    if (pct >= 40) return '#D97706'
    return '#DC2626'
  }

  // Room favorability check
  function comodoFavorabilidade(setorNome: string, comodoTipo: string): { label: string; cor: string } | null {
    if (!comodoTipo) return null
    const regra = COMODO_FAVORAVEL[setorNome]
    if (!regra) return null
    if (regra.favoravel.includes(comodoTipo)) return { label: 'Favorável', cor: '#15803D' }
    if (regra.problematico.includes(comodoTipo)) return { label: 'Problemático', cor: '#DC2626' }
    return { label: 'Neutro', cor: '#D97706' }
  }

  async function handleSaveSetor(setorId: string) {
    setSaving(true)
    setMessage('')

    const inserts = CRITERIOS.map(criterio => ({
      setor_id: setorId,
      criterio,
      score: Math.max(0, Math.min(4, criterios[setorId]?.[criterio] ?? 0)),
      notas: notas[setorId]?.[criterio] || null
    }))

    await supabase.from('diagnostico_criterios').delete().eq('setor_id', setorId)
    const { error } = await supabase.from('diagnostico_criterios').insert(inserts)

    if (error) {
      setMessage('Erro ao salvar: ' + error.message)
    } else {
      const pct = getScore(setorId)
      const updateData: Record<string, number | null | string | string[] | CustomRec[]> = {
        score_percentual: pct,
        recomendacoes_custom: customRecs[setorId] || [],
      }
      // Save room mapping (JSONB array)
      updateData.comodos = comodoMap[setorId] || []
      await supabase.from('setores_bagua').update(updateData).eq('id', setorId)
      setSetores(prev => prev.map(s => s.id === setorId ? {
        ...s, score_percentual: pct,
        recomendacoes_custom: customRecs[setorId] || [],
        comodos: comodoMap[setorId] || []
      } : s))
      setMessage('Setor salvo com sucesso!')
      setTimeout(() => setMessage(''), 3000)
    }
    setSaving(false)
  }

  async function handleSaveRoda() {
    setSaving(true)
    setMessage('')
    // Save in the new unified format compatible with /roda-da-vida
    const payload: Record<string, unknown> = {
      respostas: rodaData,
      observacoes: rodaObservacoes,
      observacao_geral: rodaObservacaoGeral,
      acoes: [],
      pessoa_nome: '',
      created_at: new Date().toISOString(),
    }
    // Preserve existing acoes and pessoa_nome if they exist
    const existing = consulta?.roda_da_vida as Record<string, unknown> | null
    if (existing?.acoes) payload.acoes = existing.acoes
    if (existing?.pessoa_nome) payload.pessoa_nome = existing.pessoa_nome
    const { error } = await supabase.from('consultas').update({
      roda_da_vida: payload
    }).eq('id', id)
    if (error) {
      setMessage('Erro ao salvar Roda da Vida: ' + error.message)
    } else {
      setConsulta(prev => prev ? { ...prev, roda_da_vida: payload as Record<string, unknown> } : prev)
      setMessage('Roda da Vida salva com sucesso!')
      setTimeout(() => setMessage(''), 3000)
    }
    setSaving(false)
  }

  async function handleSaveChi() {
    setSaving(true)
    setMessage('')
    const { error } = await supabase.from('consultas').update({
      checklist_chi: checklistChi,
      posicao_comando: posicaoComando
    }).eq('id', id)
    if (error) {
      setMessage('Erro ao salvar: ' + error.message)
    } else {
      setConsulta(prev => prev ? { ...prev, checklist_chi: checklistChi, posicao_comando: posicaoComando } : prev)
      setMessage('Fluxo de Chi salvo com sucesso!')
      setTimeout(() => setMessage(''), 3000)
    }
    setSaving(false)
  }

  async function handleFotosUpdate(newFotoGeral: string | null, newFotosComodos: FotoComodo[]) {
    setFotoGeral(newFotoGeral)
    setFotosComodos(newFotosComodos)
    // Auto-save to database
    const { error } = await supabase.from('consultas').update({
      foto_geral_url: newFotoGeral,
      fotos_comodos: newFotosComodos,
    }).eq('id', id)
    if (error) {
      console.error('Error saving fotos:', error.message)
    } else {
      setConsulta(prev => prev ? { ...prev, foto_geral_url: newFotoGeral, fotos_comodos: newFotosComodos } : prev)
    }
  }

  async function handleFotosAntesUpdate(newFotosAntes: string[]) {
    setFotosAntes(newFotosAntes)
    const { error } = await supabase.from('consultas').update({
      fotos_antes: newFotosAntes,
    }).eq('id', id)
    if (error) {
      console.error('Error saving fotos_antes:', error.message)
    } else {
      setConsulta(prev => prev ? { ...prev, fotos_antes: newFotosAntes } : prev)
    }
  }

  async function handleFotosDepoisUpdate(newFotosDepois: string[]) {
    setFotosDepois(newFotosDepois)
    const { error } = await supabase.from('consultas').update({
      fotos_depois: newFotosDepois,
    }).eq('id', id)
    if (error) {
      console.error('Error saving fotos_depois:', error.message)
    } else {
      setConsulta(prev => prev ? { ...prev, fotos_depois: newFotosDepois } : prev)
    }
  }

  async function handleFinalizar() {
    if (!confirm('Deseja finalizar esta consulta?')) return
    await supabase.from('consultas').update({ status: 'finalizada', finalizada_em: new Date().toISOString() }).eq('id', id)
    router.push('/consultas')
  }

  if (loading || !consulta) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F9FAFB', fontFamily: 'Arial, sans-serif' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>☯</div>
          <p style={{ color: '#7C3AED', fontSize: '16px' }}>Carregando consulta...</p>
        </div>
      </div>
    )
  }

  const setorAtivoData = setores.find(s => s.id === setorAtivo)
  const recSetorData = recModal ? setores.find(s => s.id === recModal) : null

  return (
    <FlowLayout showHeader backLabel="Consultas" backHref="/consultas">

      {/* ── Modal Recomendações ─────────────────────────────────────────────── */}
      {recModal && recSetorData && (() => {
        const pct = recSetorData.score_percentual ?? getScore(recSetorData.id) ?? 50
        const rec = gerarRecomendacoes(recSetorData.nome, pct, criterios[recSetorData.id] || {})
        const temRec = rec.urgente.length + rec.melhoria.length + rec.manutencao.length > 0
        return (
          <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000, padding: '16px'
          }} onClick={() => setRecModal(null)}>
            <div style={{
              background: '#fff', borderRadius: '16px', padding: '28px',
              maxWidth: '540px', width: '100%', maxHeight: '80vh', overflowY: 'auto',
              boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
            }} onClick={e => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div>
                  <h2 style={{ color: '#1E3A5F', fontSize: '18px', fontWeight: 'bold', margin: '0 0 4px 0' }}>
                    Recomendações — {recSetorData.nome}
                  </h2>
                  <p style={{ color: '#6B7280', fontSize: '13px', margin: 0 }}>
                    {recSetorData.elemento} · Score: {pct}%
                  </p>
                </div>
                <button onClick={() => setRecModal(null)} style={{
                  background: '#F3F4F6', border: 'none', borderRadius: '8px',
                  padding: '8px 12px', cursor: 'pointer', fontSize: '16px'
                }}>✕</button>
              </div>

              {!temRec && (
                <div style={{ textAlign: 'center', padding: '32px 0', color: '#9CA3AF' }}>
                  <p style={{ fontSize: '32px', margin: '0 0 8px 0' }}>✓</p>
                  <p>Avalie os critérios deste setor para gerar recomendações.</p>
                </div>
              )}

              {rec.urgente.length > 0 && (
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ display: 'inline-block', background: '#DC2626', color: '#fff', fontSize: '11px', fontWeight: 'bold', padding: '2px 10px', borderRadius: '12px', marginBottom: '10px' }}>
                    URGENTE ({rec.urgente.length})
                  </div>
                  {rec.urgente.map((d, i) => (
                    <div key={i} style={{ padding: '10px 12px', background: '#FEF2F2', borderLeft: '3px solid #DC2626', borderRadius: '6px', marginBottom: '6px', fontSize: '13px', color: '#374151' }}>
                      <span style={{ color: '#DC2626', marginRight: '6px' }}>•</span>{d}
                    </div>
                  ))}
                </div>
              )}

              {rec.melhoria.length > 0 && (
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ display: 'inline-block', background: '#D97706', color: '#fff', fontSize: '11px', fontWeight: 'bold', padding: '2px 10px', borderRadius: '12px', marginBottom: '10px' }}>
                    MELHORIA ({rec.melhoria.length})
                  </div>
                  {rec.melhoria.map((d, i) => (
                    <div key={i} style={{ padding: '10px 12px', background: '#FFFBEB', borderLeft: '3px solid #D97706', borderRadius: '6px', marginBottom: '6px', fontSize: '13px', color: '#374151' }}>
                      <span style={{ color: '#D97706', marginRight: '6px' }}>•</span>{d}
                    </div>
                  ))}
                </div>
              )}

              {rec.manutencao.length > 0 && (
                <div style={{ marginBottom: '8px' }}>
                  <div style={{ display: 'inline-block', background: '#15803D', color: '#fff', fontSize: '11px', fontWeight: 'bold', padding: '2px 10px', borderRadius: '12px', marginBottom: '10px' }}>
                    MANUTENÇÃO ({rec.manutencao.length})
                  </div>
                  {rec.manutencao.map((d, i) => (
                    <div key={i} style={{ padding: '10px 12px', background: '#F0FDF4', borderLeft: '3px solid #15803D', borderRadius: '6px', marginBottom: '6px', fontSize: '13px', color: '#374151' }}>
                      <span style={{ color: '#15803D', marginRight: '6px' }}>•</span>{d}
                    </div>
                  ))}
                </div>
              )}

              {/* Custom consultant recommendations */}
              {(() => {
                const cRecs = customRecs[recSetorData.id] || []
                if (cRecs.length === 0) return null
                return (
                  <div style={{ marginTop: '16px' }}>
                    <div style={{ display: 'inline-block', background: '#7C3AED', color: '#fff', fontSize: '11px', fontWeight: 'bold', padding: '2px 10px', borderRadius: '12px', marginBottom: '10px' }}>
                      DO CONSULTOR ({cRecs.length})
                    </div>
                    {cRecs.map((cr, i) => (
                      <div key={i} style={{
                        padding: '10px 12px', background: '#F5F0FF',
                        borderLeft: `3px solid ${cr.tipo === 'urgente' ? '#DC2626' : cr.tipo === 'melhoria' ? '#D97706' : '#15803D'}`,
                        borderRadius: '6px', marginBottom: '6px'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                          <span style={{
                            fontSize: '9px', fontWeight: 'bold', color: '#fff',
                            padding: '1px 5px', borderRadius: '6px',
                            background: cr.tipo === 'urgente' ? '#DC2626' : cr.tipo === 'melhoria' ? '#D97706' : '#15803D'
                          }}>{cr.tipo === 'urgente' ? 'URGENTE' : cr.tipo === 'melhoria' ? 'MELHORIA' : 'MANUTENÇÃO'}</span>
                        </div>
                        <p style={{ margin: '0 0 4px 0', fontSize: '13px', color: '#374151' }}>{cr.texto}</p>
                        {cr.produtos.length > 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
                            {cr.produtos.map(p => {
                              const cat = PRODUTO_CATEGORIAS.find(c => c.value === p)
                              return (
                                <a key={p} href={`/produtos?categoria=${p}`} style={{
                                  padding: '3px 8px', background: '#7C3AED', color: '#fff',
                                  borderRadius: '4px', fontSize: '10px', fontWeight: 'bold',
                                  textDecoration: 'none'
                                }}>{cat?.label || p}</a>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )
              })()}

              {/* Product suggestions */}
              {(() => {
                const todasRec = [...rec.urgente, ...rec.melhoria, ...rec.manutencao]
                const produtos = getProdutosSugeridos(todasRec)
                const customProds = (customRecs[recSetorData.id] || []).flatMap(cr => cr.produtos)
                const allProds = new Map<string, { nome: string; categoria: string }>()
                produtos.forEach(p => allProds.set(p.categoria, p))
                customProds.forEach(cat => {
                  if (!allProds.has(cat)) {
                    const found = PRODUTO_CATEGORIAS.find(c => c.value === cat)
                    if (found) allProds.set(cat, { nome: found.label, categoria: cat })
                  }
                })
                if (allProds.size === 0) return null
                return (
                  <div style={{
                    marginTop: '16px', padding: '14px 16px',
                    background: '#F5F0FF', borderRadius: '10px',
                    border: '1px solid #E9D5FF'
                  }}>
                    <p style={{ color: '#7C3AED', fontSize: '12px', fontWeight: 'bold', margin: '0 0 10px 0' }}>
                      Produtos recomendados para este setor
                    </p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {Array.from(allProds.values()).map(p => (
                        <a key={p.categoria} href={`/produtos?categoria=${p.categoria}`} style={{
                          padding: '6px 12px', background: '#7C3AED', color: '#fff',
                          borderRadius: '6px', fontSize: '12px', fontWeight: 'bold',
                          textDecoration: 'none', cursor: 'pointer'
                        }}>{p.nome}</a>
                      ))}
                    </div>
                  </div>
                )
              })()}
            </div>
          </div>
        )
      })()}

      <main style={{ padding: '24px 32px', maxWidth: '1200px', margin: '0 auto' }}>

        {/* Foto geral banner */}
        {fotoGeral && (
          <div style={{
            marginBottom: '20px', borderRadius: '14px', overflow: 'hidden',
            maxHeight: '220px', position: 'relative',
          }}>
            <Image src={fotoGeral} alt={consulta.nome_imovel || 'Imóvel'} fill unoptimized style={{
              objectFit: 'cover',
            }} />
            <div style={{
              position: 'absolute', bottom: 0, left: 0, right: 0,
              background: 'linear-gradient(transparent, rgba(0,0,0,0.6))',
              padding: '20px 24px 16px',
            }}>
              <h1 style={{ color: '#ffffff', fontSize: '22px', fontWeight: 'bold', margin: '0 0 4px 0', textShadow: '0 1px 3px rgba(0,0,0,0.5)' }}>
                {consulta.nome_imovel}
              </h1>
              <p style={{ color: 'rgba(255,255,255,0.9)', fontSize: '14px', margin: '0' }}>
                Cliente: {consulta.clientes?.nome_completo} · {consulta.tipo_imovel} {consulta.area_total_m2 ? `· ${consulta.area_total_m2}m²` : ''}
              </p>
            </div>
          </div>
        )}

        {/* Consultation header (without photo) */}
        {!fotoGeral && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h1 style={{ color: '#1E3A5F', fontSize: '22px', fontWeight: 'bold', margin: '0 0 4px 0' }}>
              {consulta.nome_imovel}
            </h1>
            <p style={{ color: '#6B7280', fontSize: '14px', margin: '0' }}>
              Cliente: {consulta.clientes?.nome_completo} · {consulta.tipo_imovel} {consulta.area_total_m2 ? `· ${consulta.area_total_m2}m²` : ''}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button onClick={() => router.push(`/curas?consultaId=${id}`)} style={{
              background: '#7C3AED', color: '#ffffff', border: 'none',
              padding: '10px 24px', borderRadius: '8px', fontSize: '14px',
              fontWeight: 'bold', cursor: 'pointer'
            }}>治 Curas & Ativações</button>
            <button onClick={() => router.push(`/consultas/${id}/relatorio`)} style={{
              background: '#1E3A5F', color: '#ffffff', border: 'none',
              padding: '10px 24px', borderRadius: '8px', fontSize: '14px',
              fontWeight: 'bold', cursor: 'pointer'
            }}>Montar Relatório</button>
            <button onClick={handleFinalizar} style={{
              background: '#15803D', color: '#ffffff', border: 'none',
              padding: '10px 24px', borderRadius: '8px', fontSize: '14px',
              fontWeight: 'bold', cursor: 'pointer'
            }}>Finalizar consulta ✓</button>
          </div>
        </div>
        )}

        {/* Action buttons (when foto geral is shown) */}
        {fotoGeral && (
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap' }}>
            <button onClick={() => router.push(`/curas?consultaId=${id}`)} style={{
              background: '#7C3AED', color: '#ffffff', border: 'none',
              padding: '10px 24px', borderRadius: '8px', fontSize: '14px',
              fontWeight: 'bold', cursor: 'pointer'
            }}>治 Curas & Ativações</button>
            <button onClick={() => router.push(`/consultas/${id}/relatorio`)} style={{
              background: '#1E3A5F', color: '#ffffff', border: 'none',
              padding: '10px 24px', borderRadius: '8px', fontSize: '14px',
              fontWeight: 'bold', cursor: 'pointer'
            }}>Montar Relatório</button>
            <button onClick={handleFinalizar} style={{
              background: '#15803D', color: '#ffffff', border: 'none',
              padding: '10px 24px', borderRadius: '8px', fontSize: '14px',
              fontWeight: 'bold', cursor: 'pointer'
            }}>Finalizar consulta ✓</button>
          </div>
        )}

        {message && (
          <div style={{
            marginBottom: '16px', padding: '10px 16px', borderRadius: '8px',
            background: message.includes('Erro') ? '#FEF2F2' : '#F0FDF4',
            border: `1px solid ${message.includes('Erro') ? '#FECACA' : '#BBF7D0'}`,
            color: message.includes('Erro') ? '#DC2626' : '#15803D', fontSize: '14px'
          }}>{message}</div>
        )}

        {/* ── Ba Gua Planta banner + resumo ───────────────────────────────── */}
        {(() => {
          const baguaEntrada = consulta.bagua_entrada as any
          const finalizada = baguaEntrada?.finalizada_em
          const plantaUrl = baguaEntrada?.planta_url
          const emAndamento = !!plantaUrl && !finalizada
          const temSetores = setores.length > 0
          const etapaMap: Record<string, string> = { upload: 'Upload', configurar: 'Configurar', entrada: 'Entrada', resultado: 'Resultado' }
          const etapaAtual = etapaMap[baguaEntrada?.etapa || 'upload'] || 'Upload'
          // Helper: deviation color
          function devCor(pct: number | null) {
            if (pct === null) return '#D1D5DB'
            if (pct >= 70) return '#15803D'
            if (pct >= 40) return '#D97706'
            return '#DC2626'
          }
          // Top 3 worst sectors
          const sorted3 = [...setores].filter(s => s.score_percentual != null)
            .sort((a, b) => (a.score_percentual ?? 100) - (b.score_percentual ?? 100)).slice(0, 3)

          // Confirm before replacing existing plant
          function alterarPlanta() {
            const msg = finalizada
              ? 'Substituir a planta atual irá apagar:\n• Bordas e configurações definidas\n• Marcações de falta e excesso\n• Ajustes manuais por setor\n• Análise concluída\n\nEsta ação não pode ser desfeita.'
              : 'Substituir a planta atual irá apagar:\n• Bordas e configurações definidas\n• Marcações de falta e excesso\n• Ajustes manuais por setor\n\nEsta ação não pode ser desfeita.'
            if (confirm(msg)) {
              // Clear analysis and redirect to upload
              supabase.from('consultas').update({
                bagua_entrada: null, bagua_imagem: null
              }).eq('id', id).then(() => {
                router.push(`/bagua-planta?consultaId=${id}`)
              })
            }
          }

          return (
            <div style={{
              background: '#ffffff', borderRadius: '14px', marginBottom: '24px',
              boxShadow: '0 2px 12px rgba(0,0,0,0.08)', overflow: 'hidden'
            }}>
              {/* Header */}
              <div style={{
                background: 'linear-gradient(135deg, #1E3A5F 0%, #2D5A8E 100%)',
                padding: '20px 24px',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                flexWrap: 'wrap', gap: '16px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <span style={{ fontSize: '40px' }}>🗺️</span>
                  <div>
                    <div style={{ color: '#ffffff', fontSize: '16px', fontWeight: 'bold', marginBottom: '4px' }}>
                      Análise Ba Gua — Planta Interativa
                    </div>
                    <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '13px' }}>
                      {finalizada
                        ? `✓ Análise concluída`
                        : emAndamento
                          ? `\ud83d\udd50 Análise em andamento`
                          : 'Posicione a planta, defina setores e avalie geometricamente cada área do imóvel'
                      }
                    </div>
                    {finalizada && (
                      <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', marginTop: '2px' }}>
                        Concluída em {new Date(finalizada).toLocaleDateString('pt-BR')} às {new Date(finalizada).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    )}
                    {emAndamento && (
                      <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', marginTop: '2px' }}>
                        {baguaEntrada?.planta_enviada_em && `Enviada em: ${new Date(baguaEntrada.planta_enviada_em).toLocaleDateString('pt-BR')} às ${new Date(baguaEntrada.planta_enviada_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} · `}
                        Etapa atual: {etapaAtual}
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  {/* Estado 1: Sem planta */}
                  {!plantaUrl && !finalizada && (
                    <button onClick={() => router.push(`/bagua-planta?consultaId=${id}`)}
                      style={{ background: '#B8860B', color: '#fff', border: 'none', padding: '10px 28px', borderRadius: '8px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer' }}>
                      + Enviar planta
                    </button>
                  )}
                  {/* Estado 2: Em andamento */}
                  {emAndamento && (
                    <>
                      <button onClick={() => router.push(`/bagua-planta?consultaId=${id}`)}
                        style={{ background: '#B8860B', color: '#fff', border: 'none', padding: '10px 22px', borderRadius: '8px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer' }}>
                        Continuar análise
                      </button>
                      <button onClick={alterarPlanta}
                        style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1px solid rgba(255,255,255,0.3)', padding: '10px 18px', borderRadius: '8px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer' }}>
                        Alterar planta
                      </button>
                    </>
                  )}
                  {/* Estado 3: Concluída */}
                  {finalizada && (
                    <>
                      <button onClick={() => router.push(`/bagua-planta?consultaId=${id}`)}
                        style={{ background: '#B8860B', color: '#fff', border: 'none', padding: '10px 22px', borderRadius: '8px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer' }}>
                        Visualizar / Revisar análise
                      </button>
                      <button onClick={alterarPlanta}
                        style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1px solid rgba(255,255,255,0.3)', padding: '10px 18px', borderRadius: '8px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer' }}>
                        Alterar planta
                      </button>
                    </>
                  )}
                </div>
              </div>
              {/* Summary body (only if sectors exist) */}
              {temSetores && (
                <div style={{ padding: '18px 24px' }}>
                  {/* 9-sector grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', marginBottom: '16px' }}>
                    {setores.map(s => {
                      const pct = s.score_percentual ?? 0
                      return (
                        <div key={s.id} style={{
                          padding: '8px', borderRadius: '6px',
                          background: devCor(pct) + '12', borderLeft: `3px solid ${devCor(pct)}`
                        }}>
                          <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#1E3A5F' }}>{s.nome}</div>
                          <div style={{ fontSize: '16px', fontWeight: 'bold', color: devCor(pct) }}>{pct}%</div>
                          <div style={{ fontSize: '9px', color: '#6B7280' }}>
                            {pct >= 70 ? '✓ Equilibrado' : pct >= 40 ? '⚠ Atenção' : '▼ Urgente'}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  {/* Top 3 priorities */}
                  {sorted3.length > 0 && (
                    <div style={{ padding: '12px 14px', background: '#FEF2F2', borderRadius: '8px', marginBottom: '12px' }}>
                      <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#DC2626', marginBottom: '6px' }}>
                        Prioridades de intervenção
                      </div>
                      {sorted3.map((s, i) => (
                        <div key={s.id} style={{ fontSize: '12px', color: '#7F1D1D', marginBottom: '3px' }}>
                          {i + 1}. <strong>{s.nome}</strong> — {s.score_percentual}%
                        </div>
                      ))}
                    </div>
                  )}
                  {/* Bagua image preview */}
                  {consulta.bagua_imagem && (
                    <div style={{ textAlign: 'center' }}>
                      <Image src={consulta.bagua_imagem} alt="Planta Ba Gua" width={800} height={500} unoptimized style={{
                        width: '100%', height: 'auto', borderRadius: '8px',
                        border: '1px solid #E5E7EB'
                      }} />
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })()}

        {/* ── Tab Navigation ───────────────────────────────────────────────── */}
        <div style={{
          display: 'flex', gap: '4px', marginBottom: '24px',
          background: '#E5E7EB', borderRadius: '10px', padding: '4px'
        }}>
          {TABS.map(tab => {
            const isActive = activeTab === tab.id
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
                flex: 1, padding: '12px 16px', borderRadius: '8px', border: 'none',
                cursor: 'pointer', fontSize: '14px', fontWeight: 'bold',
                background: isActive ? '#ffffff' : 'transparent',
                color: isActive ? '#1E3A5F' : '#6B7280',
                boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                transition: 'all 0.15s',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
              }}>
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            )
          })}
        </div>

        {/* ══════ TAB: Diagnóstico Ba Guá ══════ */}
        {activeTab === 'diagnostico' && (
          <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '24px' }}>

            {/* Sidebar setores */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <h3 style={{ color: '#1E3A5F', fontSize: '14px', fontWeight: 'bold', margin: '0 0 8px 0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Setores Ba Gua
              </h3>
              {setores.map(setor => {
                const pct = setor.score_percentual ?? getScore(setor.id)
                const ativo = setor.id === setorAtivo
                const comodos = comodoMap[setor.id] || []
                const comodoLabel = comodos.length > 0 ? comodos.map(c => COMODO_LABELS[c] || c).join(', ') : null
                const fav = comodos.length === 1 ? comodoFavorabilidade(setor.nome, comodos[0]) : null
                return (
                  <div key={setor.id} style={{
                    padding: '12px 14px', borderRadius: '10px', cursor: 'pointer',
                    background: ativo ? '#1E3A5F' : '#ffffff',
                    border: `2px solid ${ativo ? '#1E3A5F' : '#E5E7EB'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    gap: '8px'
                  }}>
                    <div style={{ flex: 1 }} onClick={() => setSetorAtivo(setor.id)}>
                      <div style={{ color: ativo ? '#ffffff' : '#111827', fontWeight: 'bold', fontSize: '13px' }}>
                        {setor.numero}. {setor.nome}
                      </div>
                      <div style={{ color: ativo ? 'rgba(255,255,255,0.7)' : '#9CA3AF', fontSize: '12px' }}>
                        {setor.elemento}
                        {comodoLabel && (
                          <span> · {comodoLabel}
                            {fav && (
                              <span style={{ color: fav.cor, fontWeight: 'bold' }}> ({fav.label})</span>
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {pct !== null && (
                        <div style={{
                          background: scoreColor(pct), color: '#fff',
                          borderRadius: '20px', padding: '2px 8px',
                          fontSize: '12px', fontWeight: 'bold'
                        }}>{pct}%</div>
                      )}
                      <button
                        onClick={e => { e.stopPropagation(); setRecModal(setor.id) }}
                        title="Ver recomendações"
                        style={{
                          background: ativo ? 'rgba(255,255,255,0.2)' : '#EDE9FE',
                          border: 'none', borderRadius: '7px', padding: '4px 8px',
                          cursor: 'pointer', fontSize: '14px', lineHeight: 1
                        }}>💡</button>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Sector detail panel */}
            {setorAtivoData && (
              <div style={{ background: '#ffffff', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <div>
                    <h2 style={{ color: '#1E3A5F', fontSize: '18px', fontWeight: 'bold', margin: '0 0 4px 0' }}>
                      {setorAtivoData.nome}
                    </h2>
                    <p style={{ color: '#6B7280', fontSize: '13px', margin: '0' }}>
                      Elemento: {setorAtivoData.elemento} · {setorAtivoData.posicao_grid}
                    </p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {getScore(setorAtivoData.id) !== null && (
                      <div style={{
                        background: scoreColor(getScore(setorAtivoData.id)),
                        color: '#fff', borderRadius: '12px', padding: '8px 16px',
                        fontSize: '20px', fontWeight: 'bold'
                      }}>{getScore(setorAtivoData.id)}%</div>
                    )}
                    <button
                      onClick={() => setRecModal(setorAtivoData.id)}
                      style={{
                        background: '#EDE9FE', color: '#7C3AED', border: 'none',
                        borderRadius: '8px', padding: '8px 14px', cursor: 'pointer',
                        fontSize: '13px', fontWeight: 'bold'
                      }}>Recomendações</button>
                  </div>
                </div>

                {/* ── Room Mapping — multi-select with autocomplete ── */}
                <div style={{
                  marginBottom: '20px', padding: '14px 16px',
                  background: '#F5F0FF', borderRadius: '10px', border: '1px solid #E9D5FF'
                }}>
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', color: '#374151', marginBottom: '4px' }}>
                      Cômodo(s) deste setor
                    </label>
                    {/* Selected tags */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '6px' }}>
                      {(comodoMap[setorAtivoData.id] || []).map((comodo, i) => {
                        const fav = comodoFavorabilidade(setorAtivoData.nome, comodo)
                        return (
                          <span key={i} style={{
                            display: 'inline-flex', alignItems: 'center', gap: '4px',
                            background: '#E9D5FF', color: '#7C3AED', padding: '4px 10px',
                            borderRadius: '16px', fontSize: '12px', fontWeight: 'bold'
                          }}>
                            {COMODO_LABELS[comodo] || comodo}
                            {fav && (
                              <span style={{
                                fontSize: '10px', fontWeight: 'bold', marginLeft: '2px',
                                color: fav.cor
                              }}>({fav.label})</span>
                            )}
                            <button onClick={() => {
                              setComodoMap(prev => ({
                                ...prev,
                                [setorAtivoData.id]: (prev[setorAtivoData.id] || []).filter((_, idx) => idx !== i)
                              }))
                            }} style={{
                              background: 'none', border: 'none', color: '#7C3AED',
                              cursor: 'pointer', fontSize: '14px', padding: '0 2px'
                            }}>&times;</button>
                          </span>
                        )
                      })}
                    </div>
                    {/* Input with autocomplete suggestions */}
                    <ComodoAutocomplete
                      selected={comodoMap[setorAtivoData.id] || []}
                      onChange={(newList) => setComodoMap(prev => ({ ...prev, [setorAtivoData.id]: newList }))}
                    />
                  </div>
                </div>

                {/* ── Criteria Scoring ──────────────────────────────── */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
                  {CRITERIOS.map(criterio => (
                    <div key={criterio} style={{ padding: '16px', background: '#F9FAFB', borderRadius: '10px', border: '1px solid #E5E7EB' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <label style={{ color: '#374151', fontSize: '14px', fontWeight: 'bold' }}>{criterio}</label>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          {[0, 1, 2, 3, 4].map(val => {
                            const LABELS=['-2','-1','0','+1','+2']
                            const CORES=['#DC2626','#EA580C','#6B7280','#65A30D','#15803D']
                            const cur = criterios[setorAtivoData.id]?.[criterio]
                            return (
                            <button key={val} onClick={() => {
                              setCriterios(prev => ({
                                ...prev,
                                [setorAtivoData.id]: { ...prev[setorAtivoData.id], [criterio]: val }
                              }))
                            }} style={{
                              width: '36px', height: '36px', borderRadius: '8px', border: 'none',
                              cursor: 'pointer', fontWeight: 'bold', fontSize: '13px',
                              background: cur === val ? CORES[val] : '#E5E7EB',
                              color: cur === val ? '#fff' : '#6B7280'
                            }}>{LABELS[val]}</button>
                            )
                          })}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '6px', fontSize: '11px', color: '#9CA3AF', marginBottom: '8px', flexWrap: 'wrap' }}>
                        <span style={{ color: '#DC2626' }}>-2 Crítico</span>
                        <span style={{ color: '#EA580C' }}>-1 Ruim</span>
                        <span style={{ color: '#6B7280' }}>0 Neutro</span>
                        <span style={{ color: '#65A30D' }}>+1 Bom</span>
                        <span style={{ color: '#15803D' }}>+2 Ótimo</span>
                      </div>
                      <input
                        placeholder="Observação (opcional)"
                        value={notas[setorAtivoData.id]?.[criterio] || ''}
                        onChange={e => setNotas(prev => ({
                          ...prev,
                          [setorAtivoData.id]: { ...prev[setorAtivoData.id], [criterio]: e.target.value }
                        }))}
                        style={{ width: '100%', padding: '8px 12px', border: '1px solid #D1D5DB', borderRadius: '6px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                      />
                    </div>
                  ))}
                </div>

                {/* ── Custom Recommendations ─────────────────────── */}
                <div style={{
                  marginBottom: '24px', padding: '20px', background: '#F5F0FF',
                  borderRadius: '10px', border: '1px solid #E9D5FF'
                }}>
                  <h3 style={{ color: '#7C3AED', fontSize: '15px', fontWeight: 'bold', margin: '0 0 14px 0' }}>
                    Recomendações do Consultor
                  </h3>

                  {(customRecs[setorAtivoData.id] || []).length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                      {(customRecs[setorAtivoData.id] || []).map((rec, ri) => (
                        <div key={ri} style={{
                          padding: '10px 12px', background: '#ffffff', borderRadius: '8px',
                          borderLeft: `3px solid ${rec.tipo === 'urgente' ? '#DC2626' : rec.tipo === 'melhoria' ? '#D97706' : '#15803D'}`,
                          display: 'flex', gap: '8px', alignItems: 'flex-start'
                        }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                              <span style={{
                                fontSize: '10px', fontWeight: 'bold', color: '#fff',
                                padding: '1px 6px', borderRadius: '8px',
                                background: rec.tipo === 'urgente' ? '#DC2626' : rec.tipo === 'melhoria' ? '#D97706' : '#15803D'
                              }}>{rec.tipo === 'urgente' ? 'URGENTE' : rec.tipo === 'melhoria' ? 'MELHORIA' : 'MANUTENÇÃO'}</span>
                            </div>
                            <p style={{ margin: '0 0 4px 0', fontSize: '13px', color: '#374151' }}>{rec.texto}</p>
                            {rec.produtos.length > 0 && (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                {rec.produtos.map(p => {
                                  const cat = PRODUTO_CATEGORIAS.find(c => c.value === p)
                                  return (
                                    <span key={p} style={{
                                      fontSize: '10px', padding: '2px 6px', background: '#EDE9FE',
                                      color: '#7C3AED', borderRadius: '4px', fontWeight: 'bold'
                                    }}>{cat?.label || p}</span>
                                  )
                                })}
                              </div>
                            )}
                          </div>
                          <button onClick={() => {
                            setCustomRecs(prev => ({
                              ...prev,
                              [setorAtivoData.id]: (prev[setorAtivoData.id] || []).filter((_, i) => i !== ri)
                            }))
                          }} style={{
                            background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '6px',
                            padding: '4px 8px', cursor: 'pointer', fontSize: '12px', color: '#DC2626',
                            flexShrink: 0
                          }}>✕</button>
                        </div>
                      ))}
                    </div>
                  )}

                  <NewRecForm onAdd={(rec: CustomRec) => {
                    setCustomRecs(prev => ({
                      ...prev,
                      [setorAtivoData.id]: [...(prev[setorAtivoData.id] || []), rec]
                    }))
                  }} />
                </div>

                <button onClick={() => handleSaveSetor(setorAtivoData.id)} disabled={saving} style={{
                  width: '100%', padding: '14px', background: saving ? '#9CA3AF' : '#7C3AED',
                  color: '#ffffff', border: 'none', borderRadius: '8px',
                  fontSize: '15px', fontWeight: 'bold', cursor: saving ? 'not-allowed' : 'pointer'
                }}>{saving ? 'Salvando...' : 'Salvar avaliação deste setor'}</button>
              </div>
            )}
          </div>
        )}

        {/* ══════ TAB: Roda da Vida ══════ */}
        {activeTab === 'roda_vida' && (
          <TabRodaDaVida
            rodaData={rodaData}
            onChange={setRodaData}
            onSave={handleSaveRoda}
            saving={saving}
            setores={setores}
            observacoes={rodaObservacoes}
            onChangeObservacoes={setRodaObservacoes}
            observacaoGeral={rodaObservacaoGeral}
            onChangeObservacaoGeral={setRodaObservacaoGeral}
          />
        )}

        {/* ══════ TAB: Fluxo de Chi ══════ */}
        {activeTab === 'fluxo_chi' && (
          <TabFluxoChi
            checklistChi={checklistChi}
            posicaoComando={posicaoComando}
            onChangeChi={setChecklistChi}
            onChangePosicao={setPosicaoComando}
            onSave={handleSaveChi}
            saving={saving}
          />
        )}

        {/* ══════ TAB: Fotos do Imóvel ══════ */}
        {activeTab === 'fotos' && (
          <TabFotos
            consultaId={id}
            fotoGeral={fotoGeral}
            fotosComodos={fotosComodos}
            onUpdate={handleFotosUpdate}
            saving={saving}
            fotosAntes={fotosAntes}
            fotosDepois={fotosDepois}
            onUpdateAntes={handleFotosAntesUpdate}
            onUpdateDepois={handleFotosDepoisUpdate}
          />
        )}
      </main>
    </FlowLayout>
  )
}
