'use client'

import { useState, useEffect } from 'react'

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
  circulacao: { label: 'Circulação', cor: '#7C3AED' },
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

interface Props {
  checklistChi: string[]
  posicaoComando: Record<string, string[]>
  onChangeChi: (data: string[]) => void
  onChangePosicao: (data: Record<string, string[]>) => void
  onSave: () => void
  saving: boolean
}

export default function TabFluxoChi({ checklistChi, posicaoComando, onChangeChi, onChangePosicao, onSave, saving }: Props) {
  const [comodoAtivo, setComodoAtivo] = useState('quarto')
  const [customItems, setCustomItems] = useState<{id: string; label: string; categoria: string}[]>([])
  const [newItemLabel, setNewItemLabel] = useState('')
  const [newItemCategoria, setNewItemCategoria] = useState('elementos')
  const [showAddForm, setShowAddForm] = useState(false)
  const [hoveredCustomId, setHoveredCustomId] = useState<string | null>(null)

  // Load custom items from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('fengshui-custom-chi-items')
      if (saved) setCustomItems(JSON.parse(saved))
    } catch {}
  }, [])

  // All items = standard + custom
  const allItems = [...CHECKLIST_CHI, ...customItems]

  // Chi flow score
  const chiScore = Math.round((checklistChi.length / allItems.length) * 100)
  const chiColor = chiScore >= 70 ? '#15803D' : chiScore >= 40 ? '#D97706' : '#DC2626'

  // Command position score per room
  function posicaoScore(comodoId: string): number {
    const checks = CHECKS_POSICAO[comodoId] || []
    const checked = (posicaoComando[comodoId] || []).length
    return checks.length > 0 ? Math.round((checked / checks.length) * 100) : 0
  }

  function toggleChi(itemId: string) {
    if (checklistChi.includes(itemId)) {
      onChangeChi(checklistChi.filter(c => c !== itemId))
    } else {
      onChangeChi([...checklistChi, itemId])
    }
  }

  function togglePosicao(comodoId: string, checkId: string) {
    const current = posicaoComando[comodoId] || []
    if (current.includes(checkId)) {
      onChangePosicao({ ...posicaoComando, [comodoId]: current.filter(c => c !== checkId) })
    } else {
      onChangePosicao({ ...posicaoComando, [comodoId]: [...current, checkId] })
    }
  }

  function deleteCustomItem(itemId: string) {
    const updated = customItems.filter(i => i.id !== itemId)
    setCustomItems(updated)
    try { localStorage.setItem('fengshui-custom-chi-items', JSON.stringify(updated)) } catch {}
    // Also remove from checked list if it was checked
    if (checklistChi.includes(itemId)) {
      onChangeChi(checklistChi.filter(c => c !== itemId))
    }
  }

  // Group chi items by category
  const categorias = Object.keys(CATEGORIAS_CHI)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* ── FLUXO DE CHI ──────────────────────────────────────────────── */}
      <div style={{ background: '#ffffff', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <h2 style={{ color: '#1E3A5F', fontSize: '18px', fontWeight: 'bold', margin: '0 0 4px 0' }}>
              Checklist de Fluxo de Chi
            </h2>
            <p style={{ color: '#6B7280', fontSize: '13px', margin: 0 }}>
              Avalie os 11 pontos essenciais de circulação energética do imóvel
            </p>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: '64px', height: '64px', borderRadius: '50%',
              background: chiColor, display: 'flex', alignItems: 'center',
              justifyContent: 'center', flexDirection: 'column'
            }}>
              <span style={{ color: '#fff', fontSize: '18px', fontWeight: 'bold' }}>{chiScore}%</span>
            </div>
            <p style={{ color: '#6B7280', fontSize: '11px', margin: '4px 0 0 0' }}>
              {checklistChi.length}/{allItems.length} OK
            </p>
          </div>
        </div>

        {categorias.map(catKey => {
          const cat = CATEGORIAS_CHI[catKey]
          const items = allItems.filter(i => i.categoria === catKey)
          const checked = items.filter(i => checklistChi.includes(i.id)).length
          return (
            <div key={catKey} style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <div style={{
                  width: '8px', height: '8px', borderRadius: '50%', background: cat.cor
                }} />
                <span style={{ fontSize: '13px', fontWeight: 'bold', color: cat.cor }}>{cat.label}</span>
                <span style={{ fontSize: '11px', color: '#9CA3AF' }}>({checked}/{items.length})</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', paddingLeft: '16px' }}>
                {items.map(item => {
                  const isChecked = checklistChi.includes(item.id)
                  const isCustom = item.id.startsWith('custom_')
                  const isHovered = hoveredCustomId === item.id
                  return (
                    <label key={item.id} style={{
                      display: 'flex', alignItems: 'center', gap: '10px',
                      padding: '8px 12px', borderRadius: '8px', cursor: 'pointer',
                      background: isChecked ? '#F0FDF4' : '#F9FAFB',
                      border: `1px solid ${isChecked ? '#BBF7D0' : '#E5E7EB'}`,
                      transition: 'all 0.15s',
                      position: 'relative'
                    }}
                    onMouseEnter={() => isCustom ? setHoveredCustomId(item.id) : undefined}
                    onMouseLeave={() => isCustom ? setHoveredCustomId(null) : undefined}
                    >
                      <input
                        type="checkbox" checked={isChecked}
                        onChange={() => toggleChi(item.id)}
                        style={{ width: '18px', height: '18px', accentColor: '#15803D', cursor: 'pointer' }}
                      />
                      <span style={{
                        fontSize: '13px', color: isChecked ? '#15803D' : '#374151',
                        textDecoration: isChecked ? 'none' : 'none',
                        fontWeight: isChecked ? '600' : 'normal'
                      }}>
                        {item.label}
                      </span>
                      {isCustom && isHovered && (
                        <button
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); deleteCustomItem(item.id) }}
                          style={{
                            marginLeft: 'auto', background: '#FEE2E2', border: 'none',
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
                      )}
                      {!isChecked && !(isCustom && isHovered) && (
                        <span style={{
                          marginLeft: 'auto', fontSize: '10px', color: '#DC2626',
                          padding: '2px 8px', background: '#FEF2F2', borderRadius: '10px',
                          fontWeight: 'bold'
                        }}>Verificar</span>
                      )}
                    </label>
                  )
                })}
              </div>
            </div>
          )
        })}

        {/* Add custom checklist point */}
        <div style={{ marginTop: '12px', padding: '12px', background: '#F9FAFB', borderRadius: '8px', border: '1px dashed #D1D5DB' }}>
          {!showAddForm ? (
            <button onClick={() => setShowAddForm(true)} style={{
              background: 'none', border: 'none', color: '#7C3AED', fontSize: '13px',
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
                <button onClick={() => {
                  if (!newItemLabel.trim()) return
                  const item = { id: `custom_${Date.now()}`, label: newItemLabel.trim(), categoria: newItemCategoria }
                  const updated = [...customItems, item]
                  setCustomItems(updated)
                  try { localStorage.setItem('fengshui-custom-chi-items', JSON.stringify(updated)) } catch {}
                  setNewItemLabel('')
                  setShowAddForm(false)
                }} style={{ padding: '8px 16px', background: '#7C3AED', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer' }}>
                  Adicionar
                </button>
                <button onClick={() => { setShowAddForm(false); setNewItemLabel('') }}
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
          <h2 style={{ color: '#1E3A5F', fontSize: '18px', fontWeight: 'bold', margin: '0 0 4px 0' }}>
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
              <button key={comodo.id} onClick={() => setComodoAtivo(comodo.id)} style={{
                padding: '10px 16px', borderRadius: '8px', border: 'none',
                cursor: 'pointer', fontSize: '13px', fontWeight: 'bold',
                background: ativo ? '#1E3A5F' : '#F3F4F6',
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
          background: '#F5F0FF', borderRadius: '10px', border: '1px solid #E9D5FF'
        }}>
          <p style={{ color: '#7C3AED', fontSize: '12px', fontWeight: 'bold', margin: '0 0 10px 0' }}>
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
                  borderRadius: '8px', border: '1px solid #E9D5FF'
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
      <button onClick={onSave} disabled={saving} style={{
        width: '100%', padding: '14px',
        background: saving ? '#9CA3AF' : '#7C3AED',
        color: '#ffffff', border: 'none', borderRadius: '8px',
        fontSize: '15px', fontWeight: 'bold', cursor: saving ? 'not-allowed' : 'pointer'
      }}>{saving ? 'Salvando...' : 'Salvar Fluxo de Chi e Posição de Comando'}</button>

      {/* Integrated recommendation */}
      {(checklistChi.length > 0 || Object.values(posicaoComando).some(v => v.length > 0)) && (
        <div style={{ padding: '16px', background: '#F5F0FF', borderRadius: '10px', border: '1px solid #E9D5FF', marginTop: '16px' }}>
          <h3 style={{ color: '#7C3AED', fontSize: '14px', fontWeight: 'bold', margin: '0 0 12px 0' }}>
            📋 Orientação integrada
          </h3>
          {/* Show unchecked items as priority actions */}
          {allItems.filter(i => !checklistChi.includes(i.id)).length > 0 && (
            <div style={{ marginBottom: '12px' }}>
              <p style={{ fontSize: '12px', fontWeight: 'bold', color: '#DC2626', margin: '0 0 6px 0' }}>
                Pontos que requerem atenção ({allItems.filter(i => !checklistChi.includes(i.id)).length}):
              </p>
              {allItems.filter(i => !checklistChi.includes(i.id)).slice(0, 5).map(item => (
                <p key={item.id} style={{ fontSize: '12px', color: '#7F1D1D', margin: '0 0 4px 0', paddingLeft: '12px' }}>
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
