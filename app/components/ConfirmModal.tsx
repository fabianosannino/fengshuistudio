'use client'

import { useEffect, useRef } from 'react'

interface ConfirmModalProps {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'warning' | 'info'
  onConfirm: () => void
  onCancel: () => void
}

const VARIANT_STYLES = {
  danger: { icon: '⚠️', color: '#DC2626', bg: '#FEF2F2', border: '#FECACA', btnBg: '#DC2626' },
  warning: { icon: '⚡', color: '#D97706', bg: '#FFFBEB', border: '#FDE68A', btnBg: '#D97706' },
  info: { icon: 'ℹ️', color: '#1D4ED8', bg: '#EFF6FF', border: '#BFDBFE', btnBg: '#1D4ED8' },
}

export default function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  variant = 'danger',
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const cancelRef = useRef<HTMLButtonElement>(null)
  const v = VARIANT_STYLES[variant]

  useEffect(() => {
    if (open) cancelRef.current?.focus()
  }, [open])

  useEffect(() => {
    if (!open) return
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, onCancel])

  if (!open) return null

  return (
    <div
      role="presentation"
      onClick={onCancel}
      style={{
        position: 'fixed', inset: 0, zIndex: 10000,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '20px',
        fontFamily: 'Arial, sans-serif',
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-message"
        onClick={e => e.stopPropagation()}
        style={{
          background: '#ffffff', borderRadius: '16px',
          padding: '32px', maxWidth: '420px', width: '100%',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          animation: 'confirmFadeIn 0.2s ease-out',
        }}
      >
        <style>{`
          @keyframes confirmFadeIn {
            from { opacity: 0; transform: scale(0.95); }
            to { opacity: 1; transform: scale(1); }
          }
        `}</style>

        <div style={{
          width: '56px', height: '56px', borderRadius: '50%',
          background: v.bg, border: `2px solid ${v.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '24px', margin: '0 auto 16px',
        }}>
          {v.icon}
        </div>

        <h3 id="confirm-title" style={{
          color: '#111827', fontSize: '18px', fontWeight: 'bold',
          textAlign: 'center', margin: '0 0 8px 0',
        }}>
          {title}
        </h3>

        <p id="confirm-message" style={{
          color: '#6B7280', fontSize: '14px', lineHeight: 1.6,
          textAlign: 'center', margin: '0 0 24px 0',
        }}>
          {message}
        </p>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            ref={cancelRef}
            onClick={onCancel}
            style={{
              flex: 1, padding: '12px',
              background: '#F3F4F6', color: '#374151',
              border: 'none', borderRadius: '8px',
              fontSize: '14px', fontWeight: 'bold', cursor: 'pointer',
            }}
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            style={{
              flex: 1, padding: '12px',
              background: v.btnBg, color: '#ffffff',
              border: 'none', borderRadius: '8px',
              fontSize: '14px', fontWeight: 'bold', cursor: 'pointer',
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
