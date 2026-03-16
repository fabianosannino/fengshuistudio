'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../../src/lib/supabase'
import { useRouter, useParams } from 'next/navigation'
import FlowLayout from '../../components/FlowLayout'
import TabRodaDaVida from './TabRodaDaVida'
import TabFluxoChi from './TabFluxoChi'
import TabFotos from './TabFotos'
import { CRITERIOS } from '../../../src/lib/constants'
import type { Consulta, SetorBagua, DiagnosticoCriterio, FotoComodo } from '../../../src/lib/types'

// Cômodo types for room mapping per Guá
const COMODO_TIPOS = [
  { value: '', label: '— Selecione —' },
  { value: 'sala', label: 'Sala de Estar' },
  { value: 'quarto_casal', label: 'Quarto do Casal' },
  { value: 'quarto_filho', label: 'Quarto de Filho(a)' },
  { value: 'quarto_hospede', label: 'Quarto de Hóspede' },
  { value: 'escritorio', label: 'Escritório / Home Office' },
  { value: 'cozinha', label: 'Cozinha' },
  { value: 'banheiro', label: 'Banheiro' },
  { value: 'lavabo', label: 'Lavabo' },
  { value: 'area_servico', label: 'Área de Serviço' },
  { value: 'garagem', label: 'Garagem' },
  { value: 'varanda', label: 'Varanda / Sacada' },
  { value: 'corredor', label: 'Corredor' },
  { value: 'despensa', label: 'Despensa' },
  { value: 'jardim', label: 'Jardim / Área Externa' },
]

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

const SETOR_DICAS: Record<string, string[]> = {
  'Carreira':       ['Adicione elemento água: aquário, fonte ou imagem de rio','Use tons pretos, azul escuro e ondulados','Coloque espelho estrategicamente para ampliar o espaço','Mantenha o caminho até a porta livre','Adicione cristais negros como obsidiana'],
  'Conhecimento':   ['Crie espaço de estudo ou leitura tranquilo','Use tons azul-escuro, verde e preto','Adicione livros, mapas ou objetos de aprendizado','Iluminação focada e direta para concentração','Elimine distrações e eletrônicos desnecessários'],
  'Espiritualidade':['Crie um espaço de meditação ou altar pessoal','Use tons roxo, azul escuro e branco','Adicione objetos sagrados e significativos','Iluminação suave com velas ou luz indireta','Mantenha silêncio e tranquilidade neste setor'],
  'Família':        ['Use tons verdes e azuis para harmonia familiar','Coloque fotos da família em momentos felizes','Adicione plantas de madeira como bambu da sorte','Mantenha a área livre de objetos de conflito','Use madeira natural na decoração'],
  'Prosperidade':   ['Adicione plantas saudáveis e viçosas','Use tons roxo, verde e dourado','Coloque símbolos de abundância como moedas ou peixes','Mantenha este setor sempre limpo e iluminado','Ative com fonte de água pequena ou aquário'],
  'Centro':         ['Adicione cristais amarelos ou cerâmicas','Mantenha sempre limpo — centro irradia para todos os setores','Use tons terrosos: amarelo, ocre, marrom','Este setor influencia todos os demais','Coloque uma tigela de cristal ou pedras naturais'],
  'Centro/Saúde':   ['Adicione cristais amarelos ou cerâmicas','Mantenha sempre limpo — centro irradia para todos os setores','Use tons terrosos: amarelo, ocre, marrom','Este setor influencia todos os demais','Coloque uma tigela de cristal ou pedras naturais'],
  'Pessoas Uteis':  ['Adicione objetos metálicos e brancos','Use tons cinza, prata e branco','Coloque imagens de mentores ou pessoas admiradas','Mantenha uma lista de contatos importantes visível','Adicione sinos ou móbiles metálicos'],
  'Pessoas Úteis':  ['Adicione objetos metálicos e brancos','Use tons cinza, prata e branco','Coloque imagens de mentores ou pessoas admiradas','Mantenha uma lista de contatos importantes visível','Adicione sinos ou móbiles metálicos'],
  'Filhos':         ['Use tons brancos, cinza e pastéis','Adicione elementos metálicos e circulares','Exponha projetos criativos e expressão artística','Adicione cristais brancos como selenita','Crie espaço para brincadeira e criatividade'],
  'Criatividade':   ['Adicione elementos brancos e metálicos','Use tons brancos, cinza e pastéis','Coloque objetos circulares ou em arco','Exponha trabalhos criativos e projetos em andamento','Adicione cristais brancos como selenita'],
  'Relacionamentos':['Use tons rosa, vermelho e branco em pares','Coloque objetos em duplas: velas, porta-retratos','Adicione cristais de quartzo rosa','Exponha fotos felizes com pessoas amadas','Remova imagens de solidão ou objetos únicos'],
  'Fama':           ['Adicione elementos de fogo: velas ou luz vermelha','Use tons vermelhos e laranja na decoração','Exponha diplomas, prêmios e reconhecimentos','Adicione objetos triangulares ou em forma de chama','Coloque imagens de animais com força e presença'],
  'Fama/Reputação': ['Adicione elementos de fogo: velas ou luz vermelha','Use tons vermelhos e laranja na decoração','Exponha diplomas, prêmios e reconhecimentos','Adicione objetos triangulares ou em forma de chama','Coloque imagens de animais com força e presença'],
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
  const [comodoMap, setComodoMap] = useState<Record<string, string>>({})
  const [setorAtivo, setSetorAtivo] = useState<string | null>(null)
  const [recModal, setRecModal] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('diagnostico')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  // New data for Roda da Vida & Chi Flow
  const [rodaData, setRodaData] = useState<Record<string, number>>({})
  const [checklistChi, setChecklistChi] = useState<string[]>([])
  const [posicaoComando, setPosicaoComando] = useState<Record<string, string[]>>({})

  // Fotos do imóvel
  const [fotoGeral, setFotoGeral] = useState<string | null>(null)
  const [fotosComodos, setFotosComodos] = useState<FotoComodo[]>([])

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }

      const { data: consulta } = await supabase
        .from('consultas')
        .select('*, clientes(nome_completo)')
        .eq('id', id)
        .single()

      if (!consulta) { router.push('/consultas'); return }
      setConsulta(consulta)

      // Load advanced diagnostic data (stored as JSONB)
      setRodaData(consulta.roda_da_vida || {})
      setChecklistChi(consulta.checklist_chi || [])
      setPosicaoComando(consulta.posicao_comando || {})

      // Load fotos
      setFotoGeral(consulta.foto_geral_url || null)
      setFotosComodos(Array.isArray(consulta.fotos_comodos) ? consulta.fotos_comodos : [])

      const { data: setoresData } = await supabase
        .from('setores_bagua')
        .select('*, diagnostico_criterios(*)')
        .eq('consulta_id', id)
        .order('numero')

      setSetores(setoresData || [])

      const cMap: Record<string, Record<string, number>> = {}
      const nMap: Record<string, Record<string, string>> = {}
      const rMap: Record<string, CustomRec[]> = {}
      const cmMap: Record<string, string> = {}
      setoresData?.forEach(setor => {
        cMap[setor.id] = {}
        nMap[setor.id] = {}
        rMap[setor.id] = Array.isArray(setor.recomendacoes_custom) ? setor.recomendacoes_custom : []
        cmMap[setor.id] = setor.comodo_tipo || ''
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
    return Math.round((total / (scores.length * 3)) * 100)
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
      score: criterios[setorId]?.[criterio] ?? 0,
      notas: notas[setorId]?.[criterio] || null
    }))

    await supabase.from('diagnostico_criterios').delete().eq('setor_id', setorId)
    const { error } = await supabase.from('diagnostico_criterios').insert(inserts)

    if (error) {
      setMessage('Erro ao salvar: ' + error.message)
    } else {
      const pct = getScore(setorId)
      const updateData: Record<string, number | null | string | CustomRec[]> = {
        score_percentual: pct,
        recomendacoes_custom: customRecs[setorId] || [],
      }
      // Save room mapping if column exists
      if (comodoMap[setorId] !== undefined) {
        updateData.comodo_tipo = comodoMap[setorId] || null
      }
      await supabase.from('setores_bagua').update(updateData).eq('id', setorId)
      setSetores(prev => prev.map(s => s.id === setorId ? {
        ...s, score_percentual: pct,
        recomendacoes_custom: customRecs[setorId] || [],
        comodo_tipo: comodoMap[setorId] || null
      } : s))
      setMessage('Setor salvo com sucesso!')
      setTimeout(() => setMessage(''), 3000)
    }
    setSaving(false)
  }

  async function handleSaveRoda() {
    setSaving(true)
    setMessage('')
    const { error } = await supabase.from('consultas').update({
      roda_da_vida: rodaData
    }).eq('id', id)
    if (error) {
      setMessage('Erro ao salvar Roda da Vida: ' + error.message)
    } else {
      setConsulta(prev => prev ? { ...prev, roda_da_vida: rodaData } : prev)
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
            <img src={fotoGeral} alt={consulta.nome_imovel || 'Imóvel'} style={{
              width: '100%', height: '220px', objectFit: 'cover',
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
            }}>Ver Relatório PDF</button>
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
            }}>Ver Relatório PDF</button>
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
              ? 'Substituir a planta atual ir\u00e1 apagar:\n\u2022 Bordas e configura\u00e7\u00f5es definidas\n\u2022 Marca\u00e7\u00f5es de falta e excesso\n\u2022 Ajustes manuais por setor\n\u2022 An\u00e1lise conclu\u00edda\n\nEsta a\u00e7\u00e3o n\u00e3o pode ser desfeita.'
              : 'Substituir a planta atual ir\u00e1 apagar:\n\u2022 Bordas e configura\u00e7\u00f5es definidas\n\u2022 Marca\u00e7\u00f5es de falta e excesso\n\u2022 Ajustes manuais por setor\n\nEsta a\u00e7\u00e3o n\u00e3o pode ser desfeita.'
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
                      An\u00e1lise Ba Gua — Planta Interativa
                    </div>
                    <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '13px' }}>
                      {finalizada
                        ? `\u2713 An\u00e1lise conclu\u00edda`
                        : emAndamento
                          ? `\ud83d\udd50 An\u00e1lise em andamento`
                          : 'Posicione a planta, defina setores e avalie geometricamente cada \u00e1rea do im\u00f3vel'
                      }
                    </div>
                    {finalizada && (
                      <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', marginTop: '2px' }}>
                        Conclu\u00edda em {new Date(finalizada).toLocaleDateString('pt-BR')} \u00e0s {new Date(finalizada).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    )}
                    {emAndamento && (
                      <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', marginTop: '2px' }}>
                        {baguaEntrada?.planta_enviada_em && `Enviada em: ${new Date(baguaEntrada.planta_enviada_em).toLocaleDateString('pt-BR')} \u00e0s ${new Date(baguaEntrada.planta_enviada_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} \u00b7 `}
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
                        Continuar an\u00e1lise
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
                        Visualizar / Revisar an\u00e1lise
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
                            {pct >= 70 ? '\u2713 Equilibrado' : pct >= 40 ? '\u26a0 Aten\u00e7\u00e3o' : '\u25bc Urgente'}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  {/* Top 3 priorities */}
                  {sorted3.length > 0 && (
                    <div style={{ padding: '12px 14px', background: '#FEF2F2', borderRadius: '8px', marginBottom: '12px' }}>
                      <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#DC2626', marginBottom: '6px' }}>
                        Prioridades de interven\u00e7\u00e3o
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
                      <img src={consulta.bagua_imagem} alt="Planta Ba Gua" style={{
                        maxWidth: '100%', maxHeight: '200px', borderRadius: '8px',
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
                const comodo = comodoMap[setor.id]
                const comodoLabel = COMODO_TIPOS.find(c => c.value === comodo)?.label
                const fav = comodo ? comodoFavorabilidade(setor.nome, comodo) : null
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

                {/* ── Room Mapping ──────────────────────────────────── */}
                <div style={{
                  marginBottom: '20px', padding: '14px 16px',
                  background: '#F5F0FF', borderRadius: '10px', border: '1px solid #E9D5FF'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                    <label htmlFor="select-comodo-setor" style={{ fontSize: '13px', fontWeight: 'bold', color: '#7C3AED' }}>
                      Cômodo neste setor:
                    </label>
                    <select
                      id="select-comodo-setor"
                      value={comodoMap[setorAtivoData.id] || ''}
                      onChange={e => setComodoMap(prev => ({ ...prev, [setorAtivoData.id]: e.target.value }))}
                      style={{
                        padding: '8px 12px', borderRadius: '6px', border: '1px solid #D1D5DB',
                        fontSize: '13px', outline: 'none', minWidth: '200px'
                      }}>
                      {COMODO_TIPOS.map(c => (
                        <option key={c.value} value={c.value}>{c.label}</option>
                      ))}
                    </select>
                    {comodoMap[setorAtivoData.id] && (() => {
                      const fav = comodoFavorabilidade(setorAtivoData.nome, comodoMap[setorAtivoData.id])
                      if (!fav) return null
                      return (
                        <span style={{
                          fontSize: '12px', fontWeight: 'bold', padding: '4px 10px',
                          borderRadius: '10px',
                          background: fav.cor === '#15803D' ? '#F0FDF4' : fav.cor === '#DC2626' ? '#FEF2F2' : '#FFFBEB',
                          color: fav.cor
                        }}>{fav.label} para este Guá</span>
                      )
                    })()}
                  </div>
                </div>

                {/* ── Criteria Scoring ──────────────────────────────── */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
                  {CRITERIOS.map(criterio => (
                    <div key={criterio} style={{ padding: '16px', background: '#F9FAFB', borderRadius: '10px', border: '1px solid #E5E7EB' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <label style={{ color: '#374151', fontSize: '14px', fontWeight: 'bold' }}>{criterio}</label>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          {[0, 1, 2, 3].map(val => (
                            <button key={val} onClick={() => {
                              setCriterios(prev => ({
                                ...prev,
                                [setorAtivoData.id]: { ...prev[setorAtivoData.id], [criterio]: val }
                              }))
                            }} style={{
                              width: '36px', height: '36px', borderRadius: '8px', border: 'none',
                              cursor: 'pointer', fontWeight: 'bold', fontSize: '14px',
                              background: criterios[setorAtivoData.id]?.[criterio] === val
                                ? val === 0 ? '#DC2626' : val === 1 ? '#D97706' : val === 2 ? '#2563EB' : '#15803D'
                                : '#E5E7EB',
                              color: criterios[setorAtivoData.id]?.[criterio] === val ? '#fff' : '#6B7280'
                            }}>{val}</button>
                          ))}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', fontSize: '11px', color: '#9CA3AF', marginBottom: '8px' }}>
                        <span style={{ color: '#DC2626' }}>0=Crítico</span>
                        <span style={{ color: '#D97706' }}>1=Regular</span>
                        <span style={{ color: '#2563EB' }}>2=Bom</span>
                        <span style={{ color: '#15803D' }}>3=Ótimo</span>
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
          />
        )}
      </main>
    </FlowLayout>
  )
}
