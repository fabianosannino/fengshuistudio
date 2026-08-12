'use client'

import { useState, useEffect } from 'react'
import {
  normalizarChecklist, resumirChi, definirEstado, proximoEstado,
  type ChecklistChi, type EstadoDoItem,
} from '../../../src/lib/fluxo-chi'
import { supabase } from '../../../src/lib/supabase'
import { logger } from '../../../src/lib/logger'

// ── Chi Flow checklist (11 items) ───────────────────────────────────────
const CHECKLIST_CHI = [
  { id: 'porta_abre', label: 'Porta principal abre completamente (sem obstruções)', categoria: 'entrada' },
  { id: 'entrada_livre', label: 'Entrada livre e acolhedora (sem objetos acumulados)', categoria: 'entrada' },
  { id: 'sem_corredor_longo', label: 'Não há corredores longos e estreitos sem tratamento', categoria: 'circulacao' },
  { id: 'sem_portas_alinhadas', label: 'Não há portas alinhadas diretamente (porta-a-porta)', categoria: 'circulacao' },
  { id: 'sem_escada_porta', label: 'Não há escada diretamente voltada para a porta principal', categoria: 'circulacao' },
  { id: 'banheiro_fora_centro', label: 'Banheiro não está localizado no centro da casa', categoria: 'estrutura' },
  { id: 'sem_vigas_expostas', label: 'Não há vigas expostas sobre cama, sofá ou mesa de trabalho', categoria: 'estrutura' },
  { id: 'espelhos_ok', label: 'Espelhos não refletem diretamente a porta de entrada', categoria: 'elementos' },
  { id: 'sem_cantos_agressivos', label: 'Não há cantos/quinas apontados para áreas de estar ou descanso', categoria: 'elementos' },
  { id: 'fluxo_suave', label: 'Fluxo de circulação suave entre cômodos (sem bloqueios)', categoria: 'circulacao' },
  { id: 'luz_natural', label: 'Iluminação natural adequada nos principais ambientes', categoria: 'elementos' },
]

const CATEGORIAS_CHI: Record<string, { label: string; cor: string }> = {
  entrada: { label: 'Entrada / Boca do Chi', cor: '#1D4ED8' },
  circulacao: { label: 'Circulação', cor: '#2E7D6B' },
  estrutura: { label: 'Estrutura', cor: '#D97706' },
  elementos: { label: 'Elementos', cor: '#15803D' },
}

// ── Command Position checklist per room type ───────────────────────────
const COMODOS_POSICAO = [
  { id: 'quarto', label: 'Quarto Principal', icon: '🛏️' },
  { id: 'escritorio', label: 'Escritório / Home Office', icon: '💻' },
  { id: 'cozinha', label: 'Cozinha', icon: '🍳' },
  { id: 'sala', label: 'Sala de Estar', icon: '🛋️' },
]

const CHECKS_POSICAO: Record<string, { id: string; label: string }[]> = {
  quarto: [
    { id: 'cama_parede', label: 'Cama com cabeceira encostada em parede sólida' },
    { id: 'cama_ve_porta', label: 'Da cama, é possível ver a porta sem estar alinhado a ela' },
    { id: 'cama_sem_janela', label: 'Cabeceira não está sob janela' },
    { id: 'cama_sem_viga', label: 'Sem viga ou luminária pesada sobre a cama' },
    { id: 'cama_acessivel', label: 'Ambos os lados da cama são acessíveis' },
  ],
  escritorio: [
    { id: 'mesa_parede', label: 'Mesa de trabalho com apoio em parede sólida atrás' },
    { id: 'mesa_ve_porta', label: 'Da mesa, é possível ver a porta de entrada' },
    { id: 'mesa_sem_costas_porta', label: 'Não está sentado de costas para a porta' },
    { id: 'mesa_sem_viga', label: 'Sem viga ou peso sobre a mesa de trabalho' },
    { id: 'mesa_iluminada', label: 'Boa iluminação na área de trabalho' },
  ],
  cozinha: [
    { id: 'fogao_sem_costas', label: 'Quem cozinha não fica de costas para a porta' },
    { id: 'fogao_limpo', label: 'Fogão limpo e todas as bocas funcionando' },
    { id: 'pia_fogao_separados', label: 'Pia (Água) e fogão (Fogo) não estão lado a lado' },
    { id: 'cozinha_organizada', label: 'Cozinha organizada e sem acúmulo de utensílios' },
  ],
  sala: [
    { id: 'sofa_parede', label: 'Sofá principal com encosto voltado para parede sólida' },
    { id: 'sofa_ve_porta', label: 'Do sofá, é possível ver a porta de entrada' },
    { id: 'tv_sem_reflexo', label: 'TV não reflete como espelho quando desligada (ou está coberta)' },
    { id: 'moveis_circulacao', label: 'Móveis permitem circulação livre e fluida' },
  ],
}

/** Como cada estado se apresenta. `undefined` (não verificado) é o neutro. */
const APARENCIA_DO_ESTADO: Record<EstadoDoItem | 'nao_verificado', {
  fundo: string; borda: string; texto: string; marca: string; rotulo: string
}> = {
  conforme:       { fundo: '#F0FDF4', borda: '#BBF7D0', texto: '#15803D', marca: '✓', rotulo: 'Conforme' },
  problema:       { fundo: '#FEF2F2', borda: '#FECACA', texto: '#B4533A', marca: '!', rotulo: 'Problema' },
  nao_verificado: { fundo: '#F9FAFB', borda: '#E5E7EB', texto: '#6B7280', marca: '',  rotulo: 'Não verificado' },
}

function aparencia(estado: EstadoDoItem | undefined) {
  return APARENCIA_DO_ESTADO[estado ?? 'nao_verificado']
}

interface Props {
  /**
   * Chega como `unknown` porque o banco tem os dois formatos: `string[]`
   * (legado) e o mapa por estado. `normalizarChecklist` reconcilia.
   */
  checklistChi: unknown
  posicaoComando: Record<string, string[]>
  onChangeChi: (data: ChecklistChi) => void
  onChangePosicao: (data: Record<string, string[]>) => void
  onSave: () => void
  saving: boolean
}

export default function TabFluxoChi({ checklistChi, posicaoComando, onChangeChi, onChangePosicao, onSave, saving }: Props) {
  // Aceita o formato antigo (`string[]` = marcados) e o novo. No antigo,
  // marcado significava «verifiquei e está conforme» — é a leitura fiel, e a
  // única que não inventa problema onde havia silêncio.
  const chi = normalizarChecklist(checklistChi)
  const [comodoAtivo, setComodoAtivo] = useState('quarto')
  // Vinham de `localStorage`: sumiam em outro aparelho, não chegavam ao
  // relatório e ainda assim entravam no denominador do score.
  const [customItems, setCustomItems] = useState<{id: string; label: string; categoria: string}[]>([])
  const [newItemLabel, setNewItemLabel] = useState('')
  const [newItemCategoria, setNewItemCategoria] = useState('elementos')
  const [showAddForm, setShowAddForm] = useState(false)
  const [hoveredCustomId, setHoveredCustomId] = useState<string | null>(null)

  // Os pontos personalizados vêm do banco (RLS filtra pelo consultor). Antes de
  // carregarem, `allItems` é só o padrão — nenhum ponto some do checklist e
  // nenhum estado gravado é perdido, porque o estado vive na consulta.
  useEffect(() => {
    let ativo = true
    async function carregar() {
      const { data, error } = await supabase
        .from('consultor_checklist_chi_custom')
        .select('item_id, label, categoria')
        .order('criado_em', { ascending: true })
      if (!ativo) return
      if (error) {
        logger.error('Falha ao carregar pontos personalizados do Chi', {
          route: 'TabFluxoChi', action: 'load-custom', error: error.message,
        })
        return
      }
      setCustomItems((data ?? []).map(r => ({
        id: r.item_id as string, label: r.label as string, categoria: r.categoria as string,
      })))
    }
    void carregar()
    return () => { ativo = false }
  }, [])

  // All items = standard + custom
  const allItems = [...CHECKLIST_CHI, ...customItems]

  // O score é sobre o que foi VERIFICADO, não sobre o total: antes,
  // `marcados / total` fazia um imóvel não avaliado pontuar 0% igual a um
  // imóvel problemático. Item não verificado não entra no denominador.
  const resumo = resumirChi(chi, allItems.map(i => i.id))
  const chiScore = resumo.score
  const chiColor = chiScore === null ? '#6B7280'
    : chiScore >= 70 ? '#2E7D6B' : chiScore >= 40 ? '#C9A227' : '#B4533A'

  // Command position score per room
  function posicaoScore(comodoId: string): number {
    const checks = CHECKS_POSICAO[comodoId] || []
    const checked = (posicaoComando[comodoId] || []).length
    return checks.length > 0 ? Math.round((checked / checks.length) * 100) : 0
  }

  /** Ciclo: não verificado → conforme → problema → não verificado. */
  function toggleChi(itemId: string) {
    onChangeChi(definirEstado(chi, itemId, proximoEstado(chi[itemId])))
  }

  function togglePosicao(comodoId: string, checkId: string) {
    const current = posicaoComando[comodoId] || []
    if (current.includes(checkId)) {
      onChangePosicao({ ...posicaoComando, [comodoId]: current.filter(c => c !== checkId) })
    } else {
      onChangePosicao({ ...posicaoComando, [comodoId]: [...current, checkId] })
    }
  }

  async function deleteCustomItem(itemId: string) {
    const { error } = await supabase
      .from('consultor_checklist_chi_custom')
      .delete()
      .eq('item_id', itemId)
    if (error) {
      logger.error('Falha ao remover ponto personalizado do Chi', {
        route: 'TabFluxoChi', action: 'delete-custom', error: error.message,
      })
      return
    }
    setCustomItems(customItems.filter(i => i.id !== itemId))
    if (chi[itemId] !== undefined) onChangeChi(definirEstado(chi, itemId, undefined))
  }

  // Group chi items by category
  const categorias = Object.keys(CATEGORIAS_CHI)

  const comProblema = allItems.filter(i => chi[i.id] === 'problema')
  const naoVerificados = allItems.filter(i => chi[i.id] === undefined)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* ── FLUXO DE CHI ──────────────────────────────────────────────── */}
      <div style={{ background: '#ffffff', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <h2 style={{ color: '#0E1B2C', fontSize: '18px', fontWeight: 'bold', margin: '0 0 4px 0' }}>
              Checklist de Fluxo de Chi
            </h2>
            <p style={{ color: '#6B7280', fontSize: '13px', margin: 0 }}>
              Clique em cada ponto para alternar entre conforme, problema e não verificado
            </p>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: '64px', height: '64px', borderRadius: '50%',
              background: chiColor, display: 'flex', alignItems: 'center',
              justifyContent: 'center', flexDirection: 'column'
            }}>
              {/* «—» e não «0%»: nada verificado é ausência de diagnóstico, não
                  diagnóstico ruim. Ver src/lib/fluxo-chi.ts. */}
              <span style={{ color: '#fff', fontSize: '18px', fontWeight: 'bold' }}>
                {chiScore === null ? '—' : `${chiScore}%`}
              </span>
            </div>
            <p style={{ color: '#6B7280', fontSize: '11px', margin: '4px 0 0 0' }}>
              {resumo.texto}
            </p>
          </div>
        </div>

        {/* O score é sobre o verificado; o texto ao lado impede que 100% de dois
            pontos seja lido como diagnóstico completo. */}
        {resumo.naoVerificado > 0 && (
          <p style={{
            fontSize: '12px', color: '#92400E', background: '#FFFBEB',
            border: '1px solid #FDE68A', borderRadius: '8px',
            padding: '8px 12px', margin: '0 0 16px 0'
          }}>
            {resumo.score === null
              ? 'Nenhum ponto foi verificado ainda — o relatório vai declarar isso como lacuna, não como problema.'
              : `A conformidade de ${resumo.score}% considera apenas os ${resumo.conforme + resumo.problema} pontos verificados. Faltam ${resumo.naoVerificado}.`}
          </p>
        )}

        {categorias.map(catKey => {
          const cat = CATEGORIAS_CHI[catKey]
          const items = allItems.filter(i => i.categoria === catKey)
          const daCategoria = resumirChi(chi, items.map(i => i.id))
          return (
            <div key={catKey} style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <div style={{
                  width: '8px', height: '8px', borderRadius: '50%', background: cat.cor
                }} />
                <span style={{ fontSize: '13px', fontWeight: 'bold', color: cat.cor }}>{cat.label}</span>
                <span style={{ fontSize: '11px', color: '#9CA3AF' }}>
                  ({daCategoria.conforme + daCategoria.problema}/{items.length} verificados)
                </span>
                {daCategoria.problema > 0 && (
                  <span style={{
                    fontSize: '10px', color: '#B4533A', background: '#FEF2F2',
                    padding: '2px 8px', borderRadius: '10px', fontWeight: 'bold'
                  }}>{daCategoria.problema} com problema</span>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', paddingLeft: '16px' }}>
                {items.map(item => {
                  const estado = chi[item.id]
                  const visual = aparencia(estado)
                  const isCustom = item.id.startsWith('custom_')
                  const isHovered = hoveredCustomId === item.id
                  return (
                    <div key={item.id} style={{
                      display: 'flex', alignItems: 'center', gap: '10px',
                      padding: '8px 12px', borderRadius: '8px',
                      background: visual.fundo,
                      border: `1px solid ${visual.borda}`,
                      transition: 'all 0.15s',
                      position: 'relative'
                    }}
                    onMouseEnter={() => isCustom ? setHoveredCustomId(item.id) : undefined}
                    onMouseLeave={() => isCustom ? setHoveredCustomId(null) : undefined}
                    >
                      {/* Botão, não checkbox: são três estados, e um checkbox só
                          sabe representar dois. */}
                      <button type="button"
                        onClick={() => toggleChi(item.id)}
                        aria-label={`${item.label} — ${visual.rotulo}. Clique para alternar.`}
                        title={`${visual.rotulo} — clique para alternar`}
                        style={{
                          flexShrink: 0, width: '22px', height: '22px', borderRadius: '6px',
                          border: `2px solid ${estado === undefined ? '#D1D5DB' : visual.texto}`,
                          background: estado === undefined ? '#ffffff' : visual.texto,
                          color: '#ffffff', fontSize: '13px', fontWeight: 'bold',
                          lineHeight: 1, padding: 0, cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                      >{visual.marca}</button>
                      <button type="button"
                        onClick={() => toggleChi(item.id)}
                        style={{
                          flex: 1, textAlign: 'left', background: 'none', border: 'none',
                          padding: 0, cursor: 'pointer',
                          fontSize: '13px', color: estado === undefined ? '#374151' : visual.texto,
                          fontWeight: estado === undefined ? 'normal' : '600',
                        }}
                      >{item.label}</button>
                      {isCustom && isHovered ? (
                        <button type="button"
                          onClick={() => deleteCustomItem(item.id)}
                          style={{
                            background: '#FEE2E2', border: 'none',
                            color: '#DC2626', fontSize: '14px', fontWeight: 'bold',
                            width: '24px', height: '24px', borderRadius: '50%',
                            cursor: 'pointer', display: 'flex', alignItems: 'center',
                            justifyContent: 'center', lineHeight: 1, padding: 0,
                            flexShrink: 0
                          }}
                          title="Remover ponto personalizado"
                        >
                          ×
                        </button>
                      ) : (
                        <span style={{
                          fontSize: '10px', fontWeight: 'bold', flexShrink: 0,
                          color: visual.texto, padding: '2px 8px', borderRadius: '10px',
                          background: estado === undefined ? '#F3F4F6' : visual.fundo,
                          border: `1px solid ${visual.borda}`,
                        }}>{visual.rotulo}</span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}

        {/* Add custom checklist point */}
        <div style={{ marginTop: '12px', padding: '12px', background: '#F9FAFB', borderRadius: '8px', border: '1px dashed #D1D5DB' }}>
          {!showAddForm ? (
            <button type="button" onClick={() => setShowAddForm(true)} style={{
              background: 'none', border: 'none', color: '#2E7D6B', fontSize: '13px',
              fontWeight: 'bold', cursor: 'pointer', width: '100%', textAlign: 'center'
            }}>+ Adicionar ponto personalizado</button>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <input type="text" value={newItemLabel} onChange={e => setNewItemLabel(e.target.value)}
                placeholder="Descreva o ponto de verificação..."
                style={{ padding: '8px 12px', border: '1px solid #D1D5DB', borderRadius: '6px', fontSize: '13px' }} />
              <div style={{ display: 'flex', gap: '8px' }}>
                <select value={newItemCategoria} onChange={e => setNewItemCategoria(e.target.value)}
                  style={{ flex: 1, padding: '8px', border: '1px solid #D1D5DB', borderRadius: '6px', fontSize: '12px' }}>
                  {Object.entries(CATEGORIAS_CHI).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
                <button type="button" onClick={async () => {
                  if (!newItemLabel.trim()) return
                  const { data: { user } } = await supabase.auth.getUser()
                  if (!user) return
                  const item = { id: `custom_${Date.now()}`, label: newItemLabel.trim(), categoria: newItemCategoria }
                  const { error } = await supabase.from('consultor_checklist_chi_custom').insert({
                    consultor_id: user.id, item_id: item.id, label: item.label, categoria: item.categoria,
                  })
                  if (error) {
                    logger.error('Falha ao salvar ponto personalizado do Chi', {
                      route: 'TabFluxoChi', action: 'insert-custom', error: error.message,
                    })
                    return
                  }
                  setCustomItems([...customItems, item])
                  setNewItemLabel('')
                  setShowAddForm(false)
                }} style={{ padding: '8px 16px', background: '#2E7D6B', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer' }}>
                  Adicionar
                </button>
                <button type="button" onClick={() => { setShowAddForm(false); setNewItemLabel('') }}
                  style={{ padding: '8px 12px', background: '#F3F4F6', color: '#6B7280', border: 'none', borderRadius: '6px', fontSize: '13px', cursor: 'pointer' }}>
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── POSIÇÃO DE COMANDO ────────────────────────────────────────── */}
      <div style={{ background: '#ffffff', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
        <div style={{ marginBottom: '20px' }}>
          <h2 style={{ color: '#0E1B2C', fontSize: '18px', fontWeight: 'bold', margin: '0 0 4px 0' }}>
            Posição de Comando
          </h2>
          <p style={{ color: '#6B7280', fontSize: '13px', margin: 0 }}>
            Verifique se os móveis principais estão na Posição de Comando em cada cômodo
          </p>
        </div>

        {/* Room tabs */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
          {COMODOS_POSICAO.map(comodo => {
            const ativo = comodoAtivo === comodo.id
            const score = posicaoScore(comodo.id)
            const cor = score >= 70 ? '#15803D' : score >= 40 ? '#D97706' : '#DC2626'
            return (
              <button type="button" key={comodo.id} onClick={() => setComodoAtivo(comodo.id)} style={{
                padding: '10px 16px', borderRadius: '8px', border: 'none',
                cursor: 'pointer', fontSize: '13px', fontWeight: 'bold',
                background: ativo ? '#0E1B2C' : '#F3F4F6',
                color: ativo ? '#fff' : '#6B7280',
                display: 'flex', alignItems: 'center', gap: '6px'
              }}>
                <span>{comodo.icon}</span>
                <span>{comodo.label}</span>
                {(posicaoComando[comodo.id]?.length || 0) > 0 && (
                  <span style={{
                    fontSize: '10px', padding: '2px 6px', borderRadius: '10px',
                    background: ativo ? cor : `${cor}20`, color: ativo ? '#fff' : cor, fontWeight: 'bold'
                  }}>{score}%</span>
                )}
              </button>
            )
          })}
        </div>

        {/* Checks for active room */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {(CHECKS_POSICAO[comodoAtivo] || []).map(check => {
            const isChecked = (posicaoComando[comodoAtivo] || []).includes(check.id)
            return (
              <label key={check.id} style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '10px 14px', borderRadius: '8px', cursor: 'pointer',
                background: isChecked ? '#F0FDF4' : '#F9FAFB',
                border: `1px solid ${isChecked ? '#BBF7D0' : '#E5E7EB'}`,
                transition: 'all 0.15s'
              }}>
                <input
                  type="checkbox" checked={isChecked}
                  onChange={() => togglePosicao(comodoAtivo, check.id)}
                  style={{ width: '18px', height: '18px', accentColor: '#15803D', cursor: 'pointer' }}
                />
                <span style={{
                  fontSize: '13px', color: isChecked ? '#15803D' : '#374151',
                  fontWeight: isChecked ? '600' : 'normal'
                }}>{check.label}</span>
                {isChecked && (
                  <span style={{
                    marginLeft: 'auto', fontSize: '16px', color: '#15803D'
                  }}>✓</span>
                )}
              </label>
            )
          })}
        </div>

        {/* Summary across all rooms */}
        <div style={{
          marginTop: '20px', padding: '14px 16px',
          background: '#EAF4F1', borderRadius: '10px', border: '1px solid #DCEFE9'
        }}>
          <p style={{ color: '#2E7D6B', fontSize: '12px', fontWeight: 'bold', margin: '0 0 10px 0' }}>
            Resumo da Posição de Comando
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
            {COMODOS_POSICAO.map(comodo => {
              const score = posicaoScore(comodo.id)
              const cor = score >= 70 ? '#15803D' : score >= 40 ? '#D97706' : score > 0 ? '#DC2626' : '#9CA3AF'
              const totalChecks = CHECKS_POSICAO[comodo.id]?.length || 0
              const checkedCount = (posicaoComando[comodo.id] || []).length
              return (
                <div key={comodo.id} style={{
                  textAlign: 'center', padding: '10px', background: '#fff',
                  borderRadius: '8px', border: '1px solid #DCEFE9'
                }}>
                  <div style={{ fontSize: '20px', marginBottom: '4px' }}>{comodo.icon}</div>
                  <div style={{ fontSize: '11px', color: '#6B7280', marginBottom: '4px' }}>{comodo.label}</div>
                  <div style={{ fontSize: '18px', fontWeight: 'bold', color: cor }}>
                    {checkedCount > 0 ? `${score}%` : '—'}
                  </div>
                  <div style={{ fontSize: '10px', color: '#9CA3AF' }}>
                    {checkedCount}/{totalChecks}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Save button */}
      <button type="button" onClick={onSave} disabled={saving} style={{
        width: '100%', padding: '14px',
        background: saving ? '#9CA3AF' : '#2E7D6B',
        color: '#ffffff', border: 'none', borderRadius: '8px',
        fontSize: '15px', fontWeight: 'bold', cursor: saving ? 'not-allowed' : 'pointer'
      }}>{saving ? 'Salvando...' : 'Salvar Fluxo de Chi e Posição de Comando'}</button>

      {/* Integrated recommendation */}
      {(resumo.conforme + resumo.problema > 0 || Object.values(posicaoComando).some(v => v.length > 0)) && (
        <div style={{ padding: '16px', background: '#EAF4F1', borderRadius: '10px', border: '1px solid #DCEFE9', marginTop: '16px' }}>
          <h3 style={{ color: '#2E7D6B', fontSize: '14px', fontWeight: 'bold', margin: '0 0 12px 0' }}>
            📋 Orientação integrada
          </h3>
          {/* Problema encontrado é pauta. Não verificado é lacuna. Antes os dois
              apareciam juntos como «pontos que requerem atenção», o que dava ao
              consultor uma lista de trabalho que ele não tinha gerado. */}
          {comProblema.length > 0 && (
            <div style={{ marginBottom: '12px' }}>
              <p style={{ fontSize: '12px', fontWeight: 'bold', color: '#B4533A', margin: '0 0 6px 0' }}>
                Problemas encontrados ({comProblema.length}):
              </p>
              {comProblema.slice(0, 5).map(item => (
                <p key={item.id} style={{ fontSize: '12px', color: '#7F1D1D', margin: '0 0 4px 0', paddingLeft: '12px' }}>
                  • {item.label}
                </p>
              ))}
            </div>
          )}
          {naoVerificados.length > 0 && (
            <div style={{ marginBottom: '12px' }}>
              <p style={{ fontSize: '12px', fontWeight: 'bold', color: '#92400E', margin: '0 0 6px 0' }}>
                Ainda não verificados ({naoVerificados.length}):
              </p>
              {naoVerificados.slice(0, 5).map(item => (
                <p key={item.id} style={{ fontSize: '12px', color: '#78350F', margin: '0 0 4px 0', paddingLeft: '12px' }}>
                  • {item.label}
                </p>
              ))}
            </div>
          )}
          {/* Command position summary */}
          {COMODOS_POSICAO.filter(c => posicaoScore(c.id) < 60 && (posicaoComando[c.id]?.length || 0) > 0).map(comodo => (
            <p key={comodo.id} style={{ fontSize: '12px', color: '#D97706', margin: '0 0 4px 0' }}>
              ⚠ {comodo.label}: posição de comando precisa de ajustes ({posicaoScore(comodo.id)}%)
            </p>
          ))}
        </div>
      )}
    </div>
  )
}
