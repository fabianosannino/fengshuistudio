'use client'

import { useState, useRef } from 'react'
import type { FotoComodo } from '../../../src/lib/types'

const COMODOS_PADRAO = [
  'Sala de Estar', 'Sala de Jantar', 'Cozinha', 'Quarto 1',
  'Quarto 2', 'Suíte', 'Banheiro', 'Área de Serviço',
  'Garagem', 'Varanda', 'Jardim', 'Outro',
]

const MAX_FOTOS_COMODO = 10
const MAX_FILE_SIZE = 10 * 1024 * 1024
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

interface TabFotosProps {
  consultaId: string
  fotoGeral: string | null
  fotosComodos: FotoComodo[]
  onUpdate: (fotoGeral: string | null, fotosComodos: FotoComodo[]) => void
  saving: boolean
}

export default function TabFotos({ consultaId, fotoGeral, fotosComodos, onUpdate, saving }: TabFotosProps) {
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState('')
  const [novoComodo, setNovoComodo] = useState('')
  const [novoComodoCustom, setNovoComodoCustom] = useState('')
  const [showNovoComodo, setShowNovoComodo] = useState(false)
  const [expandedComodo, setExpandedComodo] = useState<number | null>(null)
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [lightbox, setLightbox] = useState<{ url: string; comodo?: string } | null>(null)
  const geralInputRef = useRef<HTMLInputElement>(null)

  function validateFiles(files: FileList | File[]): string | null {
    for (const file of Array.from(files)) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        return `Formato inválido: ${file.name}. Use JPG, PNG ou WEBP.`
      }
      if (file.size > MAX_FILE_SIZE) {
        return `Arquivo muito grande: ${file.name}. Máximo 10MB.`
      }
    }
    return null
  }

  async function uploadFiles(files: File[], tipo: 'geral' | 'comodo', comodo?: string): Promise<string[]> {
    const fd = new FormData()
    fd.append('consulta_id', consultaId)
    fd.append('tipo', tipo)
    if (comodo) fd.append('comodo', comodo)
    files.forEach(f => fd.append('fotos', f))

    const res = await fetch('/api/consultas/fotos', { method: 'POST', body: fd })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Erro no upload')
    return data.urls
  }

  async function deleteFile(url: string) {
    await fetch('/api/consultas/fotos', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ consulta_id: consultaId, url }),
    })
  }

  // ── Foto Geral ──────────────────────────────────────────────────────
  async function handleGeralUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const err = validateFiles([file])
    if (err) { setMessage(err); return }

    setUploading(true)
    setMessage('')
    try {
      // Delete old if exists
      if (fotoGeral) await deleteFile(fotoGeral)
      const [url] = await uploadFiles([file], 'geral')
      onUpdate(url, fotosComodos)
      setMessage('Foto geral atualizada!')
      setTimeout(() => setMessage(''), 3000)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Erro no upload')
    }
    setUploading(false)
    if (geralInputRef.current) geralInputRef.current.value = ''
  }

  async function handleGeralRemove() {
    if (!fotoGeral) return
    setUploading(true)
    await deleteFile(fotoGeral)
    onUpdate(null, fotosComodos)
    setMessage('Foto geral removida.')
    setTimeout(() => setMessage(''), 3000)
    setUploading(false)
  }

  // ── Fotos por Cômodo ────────────────────────────────────────────────
  function handleAddComodo() {
    const nome = novoComodo === 'Outro' ? novoComodoCustom.trim() : novoComodo
    if (!nome) { setMessage('Selecione ou digite um nome para o cômodo.'); return }

    if (fotosComodos.some(c => c.comodo.toLowerCase() === nome.toLowerCase())) {
      setMessage('Cômodo já adicionado.'); return
    }

    const updated: FotoComodo[] = [...fotosComodos, { comodo: nome, fotos: [], ordem: fotosComodos.length }]
    onUpdate(fotoGeral, updated)
    setNovoComodo('')
    setNovoComodoCustom('')
    setShowNovoComodo(false)
    setExpandedComodo(updated.length - 1)
  }

  async function handleComodoUpload(idx: number, e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files || files.length === 0) return

    const comodo = fotosComodos[idx]
    const remaining = MAX_FOTOS_COMODO - comodo.fotos.length
    if (remaining <= 0) {
      setMessage(`Limite de ${MAX_FOTOS_COMODO} fotos por cômodo atingido.`)
      return
    }

    const filesToUpload = Array.from(files).slice(0, remaining)
    const err = validateFiles(filesToUpload)
    if (err) { setMessage(err); return }

    setUploading(true)
    setMessage('')
    try {
      const urls = await uploadFiles(filesToUpload, 'comodo', comodo.comodo)
      const updated = fotosComodos.map((c, i) =>
        i === idx ? { ...c, fotos: [...c.fotos, ...urls] } : c
      )
      onUpdate(fotoGeral, updated)
      if (filesToUpload.length < files.length) {
        setMessage(`${filesToUpload.length} foto(s) enviada(s). Limite de ${MAX_FOTOS_COMODO} por cômodo.`)
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Erro no upload')
    }
    setUploading(false)
    e.target.value = ''
  }

  async function handleComodoFotoRemove(comodoIdx: number, fotoIdx: number) {
    const url = fotosComodos[comodoIdx].fotos[fotoIdx]
    setUploading(true)
    await deleteFile(url)
    const updated = fotosComodos.map((c, i) =>
      i === comodoIdx ? { ...c, fotos: c.fotos.filter((_, fi) => fi !== fotoIdx) } : c
    )
    onUpdate(fotoGeral, updated)
    setUploading(false)
  }

  function handleRemoveComodo(idx: number) {
    // Delete all photos in the room (fire-and-forget with error logging)
    const comodo = fotosComodos[idx]
    Promise.all(comodo.fotos.map(url => deleteFile(url).catch(e => console.error('Erro ao excluir foto:', url, e))))
    const updated = fotosComodos
      .filter((_, i) => i !== idx)
      .map((c, i) => ({ ...c, ordem: i }))
    onUpdate(fotoGeral, updated)
    if (expandedComodo === idx) setExpandedComodo(null)
  }

  // ── Drag & Drop Reorder ─────────────────────────────────────────────
  function handleDragStart(idx: number) {
    setDragIdx(idx)
  }

  function handleDragOver(e: React.DragEvent, idx: number) {
    e.preventDefault()
    if (dragIdx === null || dragIdx === idx) return
    const updated = [...fotosComodos]
    const [moved] = updated.splice(dragIdx, 1)
    updated.splice(idx, 0, moved)
    const reordered = updated.map((c, i) => ({ ...c, ordem: i }))
    onUpdate(fotoGeral, reordered)
    setDragIdx(idx)
    if (expandedComodo === dragIdx) setExpandedComodo(idx)
  }

  function handleDragEnd() {
    setDragIdx(null)
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 14px', border: '1px solid #D1D5DB',
    borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box',
  }

  return (
    <div>
      {message && (
        <div style={{
          marginBottom: '16px', padding: '10px 16px', borderRadius: '8px',
          background: message.includes('Erro') || message.includes('inválido') || message.includes('grande') ? '#FEF2F2' : '#F0FDF4',
          border: `1px solid ${message.includes('Erro') || message.includes('inválido') || message.includes('grande') ? '#FECACA' : '#BBF7D0'}`,
          color: message.includes('Erro') || message.includes('inválido') || message.includes('grande') ? '#DC2626' : '#15803D',
          fontSize: '14px',
        }}>{message}</div>
      )}

      {/* ══════ FOTO GERAL ══════ */}
      <div style={{
        background: '#ffffff', borderRadius: '12px', padding: '24px',
        boxShadow: '0 1px 4px rgba(0,0,0,0.08)', marginBottom: '24px',
      }}>
        <h3 style={{ color: '#1E3A5F', fontSize: '16px', fontWeight: 'bold', margin: '0 0 4px 0' }}>
          Foto Geral do Imóvel
        </h3>
        <p style={{ color: '#6B7280', fontSize: '13px', margin: '0 0 16px 0' }}>
          Foto principal de destaque do imóvel. JPG, PNG ou WEBP. Máx. 10MB.
        </p>

        {fotoGeral ? (
          <div style={{ position: 'relative', display: 'inline-block' }}>
            <img
              src={fotoGeral}
              alt="Foto geral do imóvel"
              onClick={() => setLightbox({ url: fotoGeral })}
              style={{
                maxWidth: '100%', maxHeight: '320px', borderRadius: '10px',
                objectFit: 'cover', cursor: 'pointer',
                border: '2px solid #E5E7EB',
              }}
            />
            <div style={{ marginTop: '10px', display: 'flex', gap: '8px' }}>
              <label style={{
                display: 'inline-block', padding: '8px 16px', background: '#F3F4F6',
                color: '#374151', borderRadius: '6px', fontSize: '13px',
                cursor: uploading ? 'not-allowed' : 'pointer', fontWeight: 'bold',
              }}>
                Trocar foto
                <input ref={geralInputRef} type="file" accept="image/jpeg,image/png,image/webp"
                  onChange={handleGeralUpload} disabled={uploading} style={{ display: 'none' }} />
              </label>
              <button onClick={handleGeralRemove} disabled={uploading} style={{
                padding: '8px 12px', background: 'transparent', color: '#DC2626',
                border: 'none', fontSize: '13px', cursor: 'pointer',
              }}>Remover</button>
            </div>
          </div>
        ) : (
          <label style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', padding: '40px', borderRadius: '10px',
            border: '2px dashed #D1D5DB', background: '#F9FAFB',
            cursor: uploading ? 'not-allowed' : 'pointer',
            transition: 'border-color 0.2s',
          }}>
            <span style={{ fontSize: '40px', marginBottom: '8px' }}>📷</span>
            <span style={{ color: '#6B7280', fontSize: '14px', fontWeight: 'bold' }}>
              {uploading ? 'Enviando...' : 'Clique para adicionar foto geral'}
            </span>
            <span style={{ color: '#9CA3AF', fontSize: '12px', marginTop: '4px' }}>
              JPG, PNG ou WEBP · Máx. 10MB
            </span>
            <input ref={geralInputRef} type="file" accept="image/jpeg,image/png,image/webp"
              onChange={handleGeralUpload} disabled={uploading} style={{ display: 'none' }} />
          </label>
        )}
      </div>

      {/* ══════ FOTOS POR CÔMODO ══════ */}
      <div style={{
        background: '#ffffff', borderRadius: '12px', padding: '24px',
        boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h3 style={{ color: '#1E3A5F', fontSize: '16px', fontWeight: 'bold', margin: '0 0 4px 0' }}>
              Fotos por Cômodo
            </h3>
            <p style={{ color: '#6B7280', fontSize: '13px', margin: 0 }}>
              Organize as fotos por cômodo. Até {MAX_FOTOS_COMODO} fotos por cômodo. Arraste para reordenar.
            </p>
          </div>
          {!showNovoComodo && (
            <button onClick={() => setShowNovoComodo(true)} style={{
              padding: '10px 20px', background: '#7C3AED', color: '#fff',
              border: 'none', borderRadius: '8px', fontSize: '13px',
              fontWeight: 'bold', cursor: 'pointer', whiteSpace: 'nowrap',
            }}>+ Adicionar cômodo</button>
          )}
        </div>

        {/* Add room form */}
        {showNovoComodo && (
          <div style={{
            marginBottom: '20px', padding: '16px', background: '#F5F0FF',
            borderRadius: '10px', border: '1px solid #E9D5FF',
          }}>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '200px' }}>
                <label style={{ display: 'block', color: '#374151', fontSize: '13px', fontWeight: 'bold', marginBottom: '6px' }}>
                  Nome do cômodo
                </label>
                <select
                  value={novoComodo}
                  onChange={e => { setNovoComodo(e.target.value); if (e.target.value !== 'Outro') setNovoComodoCustom('') }}
                  style={{ ...inputStyle, background: '#fff' }}
                >
                  <option value="">Selecione...</option>
                  {COMODOS_PADRAO.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              {novoComodo === 'Outro' && (
                <div style={{ flex: 1, minWidth: '200px' }}>
                  <label style={{ display: 'block', color: '#374151', fontSize: '13px', fontWeight: 'bold', marginBottom: '6px' }}>
                    Nome personalizado
                  </label>
                  <input
                    value={novoComodoCustom}
                    onChange={e => setNovoComodoCustom(e.target.value)}
                    placeholder="Ex: Escritório, Closet..."
                    style={inputStyle}
                  />
                </div>
              )}
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={handleAddComodo} style={{
                  padding: '10px 20px', background: '#7C3AED', color: '#fff',
                  border: 'none', borderRadius: '8px', fontSize: '13px',
                  fontWeight: 'bold', cursor: 'pointer',
                }}>Adicionar</button>
                <button onClick={() => { setShowNovoComodo(false); setNovoComodo(''); setNovoComodoCustom('') }} style={{
                  padding: '10px 16px', background: '#F3F4F6', color: '#6B7280',
                  border: 'none', borderRadius: '8px', fontSize: '13px', cursor: 'pointer',
                }}>Cancelar</button>
              </div>
            </div>
          </div>
        )}

        {/* Room list */}
        {fotosComodos.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 16px' }}>
            <span style={{ fontSize: '40px', display: 'block', marginBottom: '12px' }}>🏠</span>
            <p style={{ color: '#6B7280', fontSize: '14px', margin: 0 }}>
              Nenhum cômodo adicionado. Clique em &quot;Adicionar cômodo&quot; para começar.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {fotosComodos.map((comodo, idx) => {
              const isExpanded = expandedComodo === idx
              const isDragging = dragIdx === idx
              return (
                <div
                  key={`${comodo.comodo}-${idx}`}
                  draggable
                  onDragStart={() => handleDragStart(idx)}
                  onDragOver={e => handleDragOver(e, idx)}
                  onDragEnd={handleDragEnd}
                  style={{
                    border: `2px solid ${isDragging ? '#7C3AED' : '#E5E7EB'}`,
                    borderRadius: '10px', overflow: 'hidden',
                    opacity: isDragging ? 0.7 : 1,
                    transition: 'border-color 0.2s, opacity 0.2s',
                  }}
                >
                  {/* Room header */}
                  <div
                    onClick={() => setExpandedComodo(isExpanded ? null : idx)}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '14px 16px', background: isExpanded ? '#F5F0FF' : '#F9FAFB',
                      cursor: 'pointer', userSelect: 'none',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ cursor: 'grab', fontSize: '16px', color: '#9CA3AF' }} title="Arraste para reordenar">⠿</span>
                      <span style={{ color: '#1E3A5F', fontWeight: 'bold', fontSize: '14px' }}>{comodo.comodo}</span>
                      <span style={{
                        background: '#E5E7EB', color: '#6B7280', padding: '2px 8px',
                        borderRadius: '10px', fontSize: '12px', fontWeight: 'bold',
                      }}>{comodo.fotos.length}/{MAX_FOTOS_COMODO}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button
                        onClick={e => { e.stopPropagation(); handleRemoveComodo(idx) }}
                        title="Remover cômodo"
                        style={{
                          background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA',
                          borderRadius: '6px', padding: '4px 8px', cursor: 'pointer',
                          fontSize: '12px',
                        }}
                      >🗑️</button>
                      <span style={{ fontSize: '14px', color: '#9CA3AF', transition: 'transform 0.2s', transform: isExpanded ? 'rotate(180deg)' : 'none' }}>▼</span>
                    </div>
                  </div>

                  {/* Room content (expanded) */}
                  {isExpanded && (
                    <div style={{ padding: '16px' }}>
                      {/* Photo grid */}
                      {comodo.fotos.length > 0 && (
                        <div style={{
                          display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
                          gap: '10px', marginBottom: '16px',
                        }}>
                          {comodo.fotos.map((url, fi) => (
                            <div key={fi} style={{ position: 'relative', borderRadius: '8px', overflow: 'hidden', aspectRatio: '1', background: '#F3F4F6' }}>
                              <img
                                src={url}
                                alt={`${comodo.comodo} foto ${fi + 1}`}
                                onClick={() => setLightbox({ url, comodo: comodo.comodo })}
                                style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'pointer' }}
                              />
                              <button
                                onClick={() => handleComodoFotoRemove(idx, fi)}
                                disabled={uploading}
                                style={{
                                  position: 'absolute', top: '4px', right: '4px',
                                  background: 'rgba(220,38,38,0.9)', color: '#fff',
                                  border: 'none', borderRadius: '50%', width: '24px', height: '24px',
                                  cursor: 'pointer', fontSize: '12px', fontWeight: 'bold',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }}
                              >✕</button>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Upload button */}
                      {comodo.fotos.length < MAX_FOTOS_COMODO && (
                        <label style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          gap: '8px', padding: '14px', borderRadius: '8px',
                          border: '2px dashed #D1D5DB', background: '#F9FAFB',
                          cursor: uploading ? 'not-allowed' : 'pointer', fontSize: '13px',
                          color: '#6B7280', fontWeight: 'bold',
                        }}>
                          <span>📷</span>
                          {uploading ? 'Enviando...' : `Adicionar fotos (${comodo.fotos.length}/${MAX_FOTOS_COMODO})`}
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            multiple
                            onChange={e => handleComodoUpload(idx, e)}
                            disabled={uploading}
                            style={{ display: 'none' }}
                          />
                        </label>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div
          onClick={() => setLightbox(null)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 2000, padding: '24px', cursor: 'pointer',
          }}
        >
          <div style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh' }} onClick={e => e.stopPropagation()}>
            {lightbox.comodo && (
              <div style={{
                position: 'absolute', top: '-32px', left: 0, color: '#fff',
                fontSize: '14px', fontWeight: 'bold',
              }}>{lightbox.comodo}</div>
            )}
            <img
              src={lightbox.url}
              alt="Foto ampliada"
              style={{ maxWidth: '90vw', maxHeight: '85vh', borderRadius: '8px', objectFit: 'contain' }}
            />
            <button
              onClick={() => setLightbox(null)}
              style={{
                position: 'absolute', top: '-8px', right: '-8px',
                background: '#fff', color: '#111', border: 'none',
                borderRadius: '50%', width: '32px', height: '32px',
                cursor: 'pointer', fontSize: '16px', fontWeight: 'bold',
                boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
              }}
            >✕</button>
          </div>
        </div>
      )}
    </div>
  )
}
