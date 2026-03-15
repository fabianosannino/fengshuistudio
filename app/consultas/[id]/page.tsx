'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../../src/lib/supabase'
import { useRouter, useParams } from 'next/navigation'

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
  'Centro':         ['Adicione cristais amarelos ou cerâmicas','Mantenha sempre limpo — centro irradia para todos os setores','Use tons terrosos: amarelo, ocre, marrom','Este setor influencia todos os demais','Coloque uma tigela de cristal ou pedras naturais'],
  'Centro/Saúde':   ['Adicione cristais amarelos ou cerâmicas','Mantenha sempre limpo — centro irradia para todos os setores','Use tons terrosos: amarelo, ocre, marrom','Este setor influencia todos os demais','Coloque uma tigela de cristal ou pedras naturais'],
  'Pessoas Uteis':  ['Adicione objetos metálicos e brancos','Use tons cinza, prata e branco','Coloque imagens de mentores ou pessoas admiradas','Mantenha uma lista de contatos importantes visível','Adicione sinos ou móbiles metálicos'],
  'Pessoas Úteis':  ['Adicione objetos metálicos e brancos','Use tons cinza, prata e branco','Coloque imagens de mentores ou pessoas admiradas','Mantenha uma lista de contatos importantes visível','Adicione sinos ou móbiles metálicos'],
  'Filhos':         ['Use tons brancos, cinza e pastéis','Adicione elementos metálicos e circulares','Exponha projetos criativos e expressão artística','Adicione cristais brancos como selenita','Crie espaço para brincadeira e criatividade'],
  'Criatividade':   ['Adicione elementos brancos e metálicos','Use tons brancos, cinza e pastéis','Coloque objetos circulares ou em arco','Exponha trabalhos criativos e projetos em andamento','Adicione cristais brancos como selenita'],
  'Relacionamentos':['Use tons rosa, vermelho e branco em pares','Coloque objetos em duplas: velas, porta-retratos','Adicione cristais de quartzo rosa','Exponha fotos felizes com pessoas amadas','Remova imagens de solidão ou objetos únicos'],
  'Fama':           ['Adicione elementos de fogo: velas ou luz vermelha','Use tons vermelhos e laranja na decoração','Exponha diplomas, prêmios e reconhecimentos','Adicione objetos triangulares ou em forma de chama','Coloque imagens de animais com força e presença'],
  'Fama/Reputação': ['Adicione elementos de fogo: velas ou luz vermelha','Use tons vermelhos e laranja na decoração','Exponha diplomas, prêmios e reconhecimentos','Adicione objetos triangulares ou em forma de chama','Coloque imagens de animais com força e presença'],
  'Espiritualidade':['Crie um espaço de meditação ou altar pessoal','Use tons roxo, azul escuro e branco','Adicione objetos sagrados e significativos','Iluminação suave com velas ou luz indireta','Mantenha silêncio e tranquilidade neste setor'],
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
        <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#374151', display: 'block', marginBottom: '6px' }}>Orientação ao cliente</label>
        <textarea
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

export default function ConsultaDetalhe() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [consulta, setConsulta] = useState<any>(null)
  const [setores, setSetores] = useState<any[]>([])
  const [criterios, setCriterios] = useState<Record<string, Record<string, number>>>({})
  const [notas, setNotas] = useState<Record<string, Record<string, string>>>({})
  const [customRecs, setCustomRecs] = useState<Record<string, CustomRec[]>>({})
  const [setorAtivo, setSetorAtivo] = useState<string | null>(null)
  const [recModal, setRecModal] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

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

      const { data: setoresData } = await supabase
        .from('setores_bagua')
        .select('*, diagnostico_criterios(*)')
        .eq('consulta_id', id)
        .order('numero')

      setSetores(setoresData || [])

      const cMap: Record<string, Record<string, number>> = {}
      const nMap: Record<string, Record<string, string>> = {}
      const rMap: Record<string, CustomRec[]> = {}
      setoresData?.forEach(setor => {
        cMap[setor.id] = {}
        nMap[setor.id] = {}
        rMap[setor.id] = Array.isArray(setor.recomendacoes_custom) ? setor.recomendacoes_custom : []
        setor.diagnostico_criterios?.forEach((c: any) => {
          cMap[setor.id][c.criterio] = c.score
          nMap[setor.id][c.criterio] = c.notas || ''
        })
      })
      setCriterios(cMap)
      setNotas(nMap)
      setCustomRecs(rMap)

      if (setoresData && setoresData.length > 0) {
        setSetorAtivo(setoresData[0].id)
      }

      setLoading(false)
    }
    load()

    // Recarrega ao voltar do bagua-planta
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
      await supabase.from('setores_bagua').update({
        score_percentual: pct,
        recomendacoes_custom: customRecs[setorId] || [],
      }).eq('id', setorId)
      setSetores(prev => prev.map(s => s.id === setorId ? { ...s, score_percentual: pct, recomendacoes_custom: customRecs[setorId] || [] } : s))
      setMessage('Setor salvo com sucesso!')
      setTimeout(() => setMessage(''), 3000)
    }
    setSaving(false)
  }

  async function handleFinalizar() {
    if (!confirm('Deseja finalizar esta consulta?')) return
    await supabase.from('consultas').update({ status: 'finalizada', finalizada_em: new Date().toISOString() }).eq('id', id)
    router.push('/consultas')
  }

  if (loading) {
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
    <div style={{ minHeight: '100vh', background: '#F9FAFB', fontFamily: 'Arial, sans-serif' }}>

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
                    💡 Recomendações — {recSetorData.nome}
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
                    ⚠ URGENTE ({rec.urgente.length})
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
                    ↑ MELHORIA ({rec.melhoria.length})
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
                    ✓ MANUTENÇÃO ({rec.manutencao.length})
                  </div>
                  {rec.manutencao.map((d, i) => (
                    <div key={i} style={{ padding: '10px 12px', background: '#F0FDF4', borderLeft: '3px solid #15803D', borderRadius: '6px', marginBottom: '6px', fontSize: '13px', color: '#374151' }}>
                      <span style={{ color: '#15803D', marginRight: '6px' }}>•</span>{d}
                    </div>
                  ))}
                </div>
              )}

              {/* Recomendações personalizadas do consultor */}
              {(() => {
                const cRecs = customRecs[recSetorData.id] || []
                if (cRecs.length === 0) return null
                return (
                  <div style={{ marginTop: '16px' }}>
                    <div style={{ display: 'inline-block', background: '#7C3AED', color: '#fff', fontSize: '11px', fontWeight: 'bold', padding: '2px 10px', borderRadius: '12px', marginBottom: '10px' }}>
                      📝 DO CONSULTOR ({cRecs.length})
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

              {/* Produtos sugeridos baseados nas recomendações automáticas */}
              {(() => {
                const todasRec = [...rec.urgente, ...rec.melhoria, ...rec.manutencao]
                const produtos = getProdutosSugeridos(todasRec)
                // Also add products from custom recommendations
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
                      🛒 Produtos recomendados para este setor
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

      <header style={{
        background: '#1E3A5F', padding: '0 32px', height: '64px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '28px', cursor: 'pointer' }} onClick={() => router.push('/dashboard')}>☯</span>
          <span style={{ color: '#B8860B', fontSize: '20px', fontWeight: 'bold' }}>FengShui Studio</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span onClick={() => router.push('/consultas')} style={{ color: 'rgba(255,255,255,0.7)', fontSize: '14px', cursor: 'pointer' }}>← Consultas</span>
          <span style={{ color: '#ffffff', fontSize: '14px', fontWeight: 'bold' }}>Diagnóstico</span>
        </div>
      </header>

      <main style={{ padding: '24px 32px', maxWidth: '1200px', margin: '0 auto' }}>

        {/* Cabeçalho consulta */}
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

        {message && (
          <div style={{
            marginBottom: '16px', padding: '10px 16px', borderRadius: '8px',
            background: message.includes('Erro') ? '#FEF2F2' : '#F0FDF4',
            border: `1px solid ${message.includes('Erro') ? '#FECACA' : '#BBF7D0'}`,
            color: message.includes('Erro') ? '#DC2626' : '#15803D', fontSize: '14px'
          }}>{message}</div>
        )}

        {/* ── Área Ba Gua Planta ─────────────────────────────────────────────── */}
        <div style={{
          background: 'linear-gradient(135deg, #1E3A5F 0%, #2D5A8E 100%)',
          borderRadius: '14px', padding: '20px 24px', marginBottom: '24px',
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
                Posicione a planta, defina setores e avalie geometricamente cada área do imóvel
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button
              onClick={() => window.location.reload()}
              style={{
                background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1px solid rgba(255,255,255,0.3)',
                padding: '12px 18px', borderRadius: '10px', fontSize: '14px',
                fontWeight: 'bold', cursor: 'pointer', whiteSpace: 'nowrap'
              }}>
              🔄 Atualizar
            </button>
            <button
              onClick={() => router.push(`/bagua-planta?consultaId=${id}`)}
              style={{
                background: '#B8860B', color: '#fff', border: 'none',
                padding: '12px 28px', borderRadius: '10px', fontSize: '14px',
                fontWeight: 'bold', cursor: 'pointer', whiteSpace: 'nowrap'
              }}>
              Abrir Planta ↗
            </button>
          </div>
        </div>

        {/* ── Grid principal ───────────────────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '24px' }}>

          {/* Sidebar setores */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <h3 style={{ color: '#1E3A5F', fontSize: '14px', fontWeight: 'bold', margin: '0 0 8px 0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Setores Ba Gua
            </h3>
            {setores.map(setor => {
              const pct = setor.score_percentual ?? getScore(setor.id)
              const ativo = setor.id === setorAtivo
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

          {/* Critérios do setor ativo */}
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
                    }}>💡 Recomendações</button>
                </div>
              </div>

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

              {/* ── Recomendações Personalizadas ─────────────────────────── */}
              <div style={{
                marginBottom: '24px', padding: '20px', background: '#F5F0FF',
                borderRadius: '10px', border: '1px solid #E9D5FF'
              }}>
                <h3 style={{ color: '#7C3AED', fontSize: '15px', fontWeight: 'bold', margin: '0 0 14px 0' }}>
                  📝 Recomendações do Consultor
                </h3>

                {/* Lista de recomendações existentes */}
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

                {/* Formulário para nova recomendação */}
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
      </main>
    </div>
  )
}
