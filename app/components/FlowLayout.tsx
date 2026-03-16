'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../src/lib/supabase'

/**
 * FlowLayout — Layout for Group B pages (flow/process screens)
 * No sidebar. Shows: [ ← Voltar ] + [ ⚙ ] in top-right corner.
 * Gear dropdown: user info, Ver perfil, Configurações, Sair
 */

interface FlowLayoutProps {
  children: React.ReactNode
  /** Back button text. Default: "Voltar" */
  backLabel?: string
  /** Back button URL or callback */
  backHref?: string
  onBack?: () => void
  /** Optional extra header content (right side, before back/gear) */
  headerExtra?: React.ReactNode
  /** Whether to show the default FengShui Studio logo header bar. Default: false (just floating buttons) */
  showHeader?: boolean
}

export default function FlowLayout({
  children,
  backLabel = 'Voltar',
  backHref,
  onBack,
  headerExtra,
  showHeader = false,
}: FlowLayoutProps) {
  const [gearOpen, setGearOpen] = useState(false)
  const [userName, setUserName] = useState('')
  const [darkMode, setDarkMode] = useState(false)
  const [mounted, setMounted] = useState(false)
  const gearRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setMounted(true)
    const saved = localStorage.getItem('fengshui-dark')
    if (saved === 'true') setDarkMode(true)

    async function loadUser() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data } = await supabase
          .from('profiles')
          .select('nome_completo')
          .eq('id', user.id)
          .single()
        if (data?.nome_completo) setUserName(data.nome_completo)
        else setUserName(user.email || '')
      }
    }
    loadUser()
  }, [])

  // Close gear dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (gearRef.current && !gearRef.current.contains(e.target as Node)) {
        setGearOpen(false)
      }
    }
    if (gearOpen) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [gearOpen])

  async function handleLogout() {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  function handleBack() {
    if (onBack) {
      onBack()
    } else if (backHref) {
      window.location.href = backHref
    } else {
      window.history.back()
    }
  }

  const t = {
    bg: darkMode ? '#0f172a' : '#F9FAFB',
    text: darkMode ? '#e2e8f0' : '#111827',
    textSoft: darkMode ? '#94a3b8' : '#6B7280',
    card: darkMode ? '#1e293b' : '#ffffff',
    border: darkMode ? '#334155' : '#E5E7EB',
  }

  if (!mounted) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F9FAFB', fontFamily: 'Arial, sans-serif' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>☯</div>
          <p style={{ color: '#7C3AED', fontSize: '16px' }}>Carregando...</p>
        </div>
      </div>
    )
  }

  const backButton = (
    <button
      onClick={handleBack}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '6px 14px',
        background: 'transparent',
        border: `1px solid ${t.border}`,
        borderRadius: '6px',
        color: t.textSoft,
        fontSize: '14px',
        fontWeight: 400,
        cursor: 'pointer',
        transition: 'color 0.2s ease, border-color 0.2s ease',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.color = t.text
        e.currentTarget.style.borderColor = darkMode ? '#64748b' : '#9CA3AF'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.color = t.textSoft
        e.currentTarget.style.borderColor = t.border
      }}
    >
      <span style={{ fontSize: '14px' }}>←</span> {backLabel}
    </button>
  )

  const gearButton = (
    <div ref={gearRef} style={{ position: 'relative' }}>
      <button
        onClick={() => setGearOpen(!gearOpen)}
        aria-label="Menu de configurações"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '36px',
          height: '36px',
          background: 'transparent',
          border: `1px solid ${t.border}`,
          borderRadius: '6px',
          color: t.textSoft,
          fontSize: '18px',
          cursor: 'pointer',
          transition: 'color 0.2s ease, border-color 0.2s ease',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.color = t.text
          e.currentTarget.style.borderColor = darkMode ? '#64748b' : '#9CA3AF'
        }}
        onMouseLeave={e => {
          e.currentTarget.style.color = t.textSoft
          e.currentTarget.style.borderColor = t.border
        }}
      >
        ⚙
      </button>

      {gearOpen && (
        <div style={{
          position: 'absolute',
          top: '42px',
          right: 0,
          background: t.card,
          border: `1px solid ${t.border}`,
          borderRadius: '10px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
          minWidth: '200px',
          zIndex: 100,
          overflow: 'hidden',
        }}>
          {/* User name */}
          <div style={{
            padding: '14px 16px 10px',
            borderBottom: `1px solid ${t.border}`,
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }}>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: '#7C3AED',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '14px',
                fontWeight: 'bold',
                flexShrink: 0,
              }}>
                {userName ? userName.charAt(0).toUpperCase() : '?'}
              </div>
              <span style={{
                color: t.text,
                fontSize: '14px',
                fontWeight: 600,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {userName || 'Usuário'}
              </span>
            </div>
          </div>

          {/* Menu items */}
          <a href="/perfil" style={{
            display: 'block',
            padding: '10px 16px',
            color: t.text,
            fontSize: '14px',
            textDecoration: 'none',
            cursor: 'pointer',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = darkMode ? '#334155' : '#F3F4F6' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
          >
            Ver perfil
          </a>
          <a href="/planos" style={{
            display: 'block',
            padding: '10px 16px',
            color: t.text,
            fontSize: '14px',
            textDecoration: 'none',
            cursor: 'pointer',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = darkMode ? '#334155' : '#F3F4F6' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
          >
            Planos
          </a>

          <div style={{ height: '1px', background: t.border }} />

          <button onClick={handleLogout} style={{
            display: 'block',
            width: '100%',
            padding: '10px 16px',
            background: 'transparent',
            border: 'none',
            color: '#DC2626',
            fontSize: '14px',
            cursor: 'pointer',
            textAlign: 'left',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = darkMode ? '#334155' : '#FEF2F2' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
          >
            Sair
          </button>
        </div>
      )}
    </div>
  )

  if (showHeader) {
    // Full header bar style (like consultas/[id] and bagua-planta have)
    return (
      <div style={{ minHeight: '100vh', background: t.bg, fontFamily: 'Arial, sans-serif' }}>
        <header style={{
          background: '#1E3A5F',
          padding: '0 20px',
          height: '56px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '24px', cursor: 'pointer' }} onClick={() => { window.location.href = '/dashboard' }}>☯</span>
            <span style={{ color: '#B8860B', fontSize: '17px', fontWeight: 'bold' }}>FengShui Studio</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {headerExtra}
            <button
              onClick={handleBack}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '6px 14px',
                background: 'transparent',
                border: '1px solid rgba(255,255,255,0.25)',
                borderRadius: '6px',
                color: 'rgba(255,255,255,0.7)',
                fontSize: '14px',
                fontWeight: 400,
                cursor: 'pointer',
                transition: 'color 0.2s ease, border-color 0.2s ease',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.color = '#ffffff'
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.5)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.color = 'rgba(255,255,255,0.7)'
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.25)'
              }}
            >
              <span style={{ fontSize: '14px' }}>←</span> {backLabel}
            </button>
            <div ref={gearRef} style={{ position: 'relative' }}>
              <button
                onClick={() => setGearOpen(!gearOpen)}
                aria-label="Menu de configurações"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '36px',
                  height: '36px',
                  background: 'transparent',
                  border: '1px solid rgba(255,255,255,0.25)',
                  borderRadius: '6px',
                  color: 'rgba(255,255,255,0.7)',
                  fontSize: '18px',
                  cursor: 'pointer',
                  transition: 'color 0.2s ease, border-color 0.2s ease',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.color = '#ffffff'
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.5)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.color = 'rgba(255,255,255,0.7)'
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.25)'
                }}
              >
                ⚙
              </button>
              {gearOpen && (
                <div style={{
                  position: 'absolute',
                  top: '42px',
                  right: 0,
                  background: '#ffffff',
                  border: '1px solid #E5E7EB',
                  borderRadius: '10px',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                  minWidth: '200px',
                  zIndex: 100,
                  overflow: 'hidden',
                }}>
                  <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid #E5E7EB' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{
                        width: '32px', height: '32px', borderRadius: '50%',
                        background: '#7C3AED', color: '#fff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '14px', fontWeight: 'bold', flexShrink: 0,
                      }}>
                        {userName ? userName.charAt(0).toUpperCase() : '?'}
                      </div>
                      <span style={{ color: '#111827', fontSize: '14px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {userName || 'Usuário'}
                      </span>
                    </div>
                  </div>
                  <a href="/perfil" style={{ display: 'block', padding: '10px 16px', color: '#111827', fontSize: '14px', textDecoration: 'none' }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#F3F4F6' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                  >Ver perfil</a>
                  <a href="/planos" style={{ display: 'block', padding: '10px 16px', color: '#111827', fontSize: '14px', textDecoration: 'none' }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#F3F4F6' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                  >Planos</a>
                  <div style={{ height: '1px', background: '#E5E7EB' }} />
                  <button onClick={handleLogout} style={{ display: 'block', width: '100%', padding: '10px 16px', background: 'transparent', border: 'none', color: '#DC2626', fontSize: '14px', cursor: 'pointer', textAlign: 'left' }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#FEF2F2' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                  >Sair</button>
                </div>
              )}
            </div>
          </div>
        </header>
        {children}
        <style>{`
          a:focus-visible, button:focus-visible, input:focus-visible, select:focus-visible, textarea:focus-visible {
            outline: 2px solid #7C3AED !important;
            outline-offset: 2px !important;
          }
          @media (prefers-reduced-motion: reduce) {
            *, *::before, *::after {
              animation-duration: 0.01ms !important;
              transition-duration: 0.01ms !important;
            }
          }
        `}</style>
      </div>
    )
  }

  // Light background layout (for form pages like consultas/nova)
  return (
    <div style={{ minHeight: '100vh', background: t.bg, fontFamily: 'Arial, sans-serif' }}>
      {/* Floating nav bar */}
      <div style={{
        position: 'sticky',
        top: 0,
        zIndex: 30,
        background: t.card,
        borderBottom: `1px solid ${t.border}`,
        padding: '0 24px',
        height: '56px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '24px', cursor: 'pointer' }} onClick={() => { window.location.href = '/dashboard' }}>☯</span>
          <span style={{ color: '#B8860B', fontSize: '17px', fontWeight: 'bold' }}>FengShui Studio</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {headerExtra}
          {backButton}
          {gearButton}
        </div>
      </div>
      <main style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
        {children}
      </main>
      <style>{`
        a:focus-visible, button:focus-visible, input:focus-visible, select:focus-visible, textarea:focus-visible {
          outline: 2px solid #7C3AED !important;
          outline-offset: 2px !important;
        }
        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after {
            animation-duration: 0.01ms !important;
            transition-duration: 0.01ms !important;
          }
        }
      `}</style>
    </div>
  )
}
