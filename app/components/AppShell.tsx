'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../src/lib/supabase'

const NAV_ITEMS = [
  { label: 'Dashboard', icon: '📊', href: '/dashboard' },
  { label: 'Clientes', icon: '👤', href: '/clientes' },
  { label: 'Consultas', icon: '📋', href: '/consultas' },
  { label: 'Calendário', icon: '🌙', href: '/calendario' },
  { label: 'Planos', icon: '⭐', href: '/planos' },
  { label: 'Perfil', icon: '⚙️', href: '/perfil' },
]

export default function AppShell({
  children,
  currentPage
}: {
  children: React.ReactNode
  currentPage: string
}) {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [darkMode, setDarkMode] = useState(false)
  const [profile, setProfile] = useState<any>(null)
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    const saved = localStorage.getItem('fengshui-dark')
    if (saved === 'true') setDarkMode(true)

    const savedSidebar = localStorage.getItem('fengshui-sidebar')
    if (savedSidebar === 'false') setSidebarOpen(false)

    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUser(user)
        const { data } = await supabase
          .from('profiles')
          .select('nome_completo, plano')
          .eq('id', user.id)
          .single()
        setProfile(data)
      }
    }
    loadProfile()
  }, [])

  function toggleDark() {
    const next = !darkMode
    setDarkMode(next)
    localStorage.setItem('fengshui-dark', String(next))
  }

  function toggleSidebar() {
    const next = !sidebarOpen
    setSidebarOpen(next)
    localStorage.setItem('fengshui-sidebar', String(next))
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  // Cores baseadas no tema
  const t = {
    bg: darkMode ? '#0f172a' : '#F9FAFB',
    card: darkMode ? '#1e293b' : '#ffffff',
    sidebar: darkMode ? '#1e293b' : '#1E3A5F',
    sidebarHover: darkMode ? '#334155' : '#2d5a8e',
    text: darkMode ? '#e2e8f0' : '#111827',
    textSoft: darkMode ? '#94a3b8' : '#6B7280',
    border: darkMode ? '#334155' : '#E5E7EB',
    headerBg: darkMode ? '#1e293b' : '#1E3A5F',
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: t.bg,
      fontFamily: 'Arial, sans-serif',
      display: 'flex',
      transition: 'background 0.3s ease'
    }}>

      {/* Overlay mobile */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
            zIndex: 40, transition: 'opacity 0.3s ease'
          }}
        />
      )}

      {/* Sidebar */}
      <aside style={{
        width: sidebarOpen ? '240px' : '72px',
        background: t.sidebar,
        height: '100vh',
        position: 'fixed',
        left: 0,
        top: 0,
        zIndex: 50,
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        boxShadow: '2px 0 8px rgba(0,0,0,0.15)',
        // Mobile: esconde por padrão
        transform: typeof window !== 'undefined' && window.innerWidth < 768
          ? mobileOpen ? 'translateX(0)' : 'translateX(-100%)'
          : 'translateX(0)',
      }}>

        {/* Logo */}
        <div style={{
          padding: sidebarOpen ? '20px 20px 16px' : '20px 0 16px',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: sidebarOpen ? 'flex-start' : 'center',
          gap: '10px',
          transition: 'all 0.3s ease'
        }}>
          <span style={{ fontSize: '28px', flexShrink: 0 }}>☯</span>
          {sidebarOpen && (
            <span style={{
              color: '#B8860B',
              fontSize: '18px',
              fontWeight: 'bold',
              whiteSpace: 'nowrap',
              opacity: sidebarOpen ? 1 : 0,
              transition: 'opacity 0.2s ease'
            }}>FengShui Studio</span>
          )}
        </div>

        {/* Nav items */}
        <nav style={{ flex: 1, padding: '12px 8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {NAV_ITEMS.map(item => {
            const active = currentPage === item.href.replace('/', '')
            return (
              
                key={item.href}
                href={item.href}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: sidebarOpen ? '10px 14px' : '10px 0',
                  justifyContent: sidebarOpen ? 'flex-start' : 'center',
                  borderRadius: '8px',
                  background: active ? 'rgba(255,255,255,0.15)' : 'transparent',
                  color: active ? '#ffffff' : 'rgba(255,255,255,0.6)',
                  textDecoration: 'none',
                  fontSize: '14px',
                  fontWeight: active ? 'bold' : 'normal',
                  transition: 'all 0.2s ease',
                  cursor: 'pointer'
                }}
              >
                <span style={{ fontSize: '18px', flexShrink: 0 }}>{item.icon}</span>
                {sidebarOpen && <span style={{ whiteSpace: 'nowrap' }}>{item.label}</span>}
              </a>
            )
          })}
        </nav>

        {/* Footer sidebar */}
        <div style={{
          padding: '12px 8px 16px',
          borderTop: '1px solid rgba(255,255,255,0.1)',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px'
        }}>
          {/* Dark mode toggle */}
          <button onClick={toggleDark} style={{
            display: 'flex', alignItems: 'center', gap: '12px',
            padding: sidebarOpen ? '10px 14px' : '10px 0',
            justifyContent: sidebarOpen ? 'flex-start' : 'center',
            borderRadius: '8px', background: 'transparent', border: 'none',
            color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: '14px',
            transition: 'all 0.2s ease', width: '100%'
          }}>
            <span style={{ fontSize: '18px' }}>{darkMode ? '☀️' : '🌙'}</span>
            {sidebarOpen && <span>{darkMode ? 'Modo claro' : 'Modo escuro'}</span>}
          </button>

          {/* Collapse toggle */}
          <button onClick={toggleSidebar} style={{
            display: 'flex', alignItems: 'center', gap: '12px',
            padding: sidebarOpen ? '10px 14px' : '10px 0',
            justifyContent: sidebarOpen ? 'flex-start' : 'center',
            borderRadius: '8px', background: 'transparent', border: 'none',
            color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: '14px',
            transition: 'all 0.2s ease', width: '100%'
          }}>
            <span style={{ fontSize: '18px' }}>{sidebarOpen ? '◀' : '▶'}</span>
            {sidebarOpen && <span>Recolher</span>}
          </button>

          {/* Logout */}
          <button onClick={handleLogout} style={{
            display: 'flex', alignItems: 'center', gap: '12px',
            padding: sidebarOpen ? '10px 14px' : '10px 0',
            justifyContent: sidebarOpen ? 'flex-start' : 'center',
            borderRadius: '8px', background: 'transparent', border: 'none',
            color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: '14px',
            transition: 'all 0.2s ease', width: '100%'
          }}>
            <span style={{ fontSize: '18px' }}>🚪</span>
            {sidebarOpen && <span>Sair</span>}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div style={{
        marginLeft: typeof window !== 'undefined' && window.innerWidth < 768 ? '0' : sidebarOpen ? '240px' : '72px',
        flex: 1,
        transition: 'margin-left 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        minHeight: '100vh'
      }}>

        {/* Top bar */}
        <header style={{
          background: t.card,
          padding: '0 24px',
          height: '56px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: `1px solid ${t.border}`,
          position: 'sticky',
          top: 0,
          zIndex: 30,
          transition: 'all 0.3s ease'
        }}>
          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileOpen(true)}
            style={{
              background: 'none', border: 'none', fontSize: '24px',
              cursor: 'pointer', padding: '4px',
              display: typeof window !== 'undefined' && window.innerWidth < 768 ? 'block' : 'none'
            }}
          >☰</button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: t.textSoft, fontSize: '14px' }}>
              Olá, <strong style={{ color: t.text }}>{profile?.nome_completo || user?.email || ''}</strong>
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {profile?.plano === 'pro' && (
              <span style={{
                background: '#7C3AED', color: '#fff', padding: '3px 10px',
                borderRadius: '20px', fontSize: '11px', fontWeight: 'bold'
              }}>PRO</span>
            )}
          </div>
        </header>

        {/* Page content */}
        <main style={{
          padding: '24px',
          maxWidth: '1200px',
          margin: '0 auto',
          transition: 'all 0.3s ease'
        }}>
          {children}
        </main>
      </div>

      <style>{`
        @media (max-width: 768px) {
          aside { transform: translateX(-100%) !important; }
          aside.mobile-open { transform: translateX(0) !important; }
          div[style*="marginLeft"] { margin-left: 0 !important; }
        }
        * { transition-property: background-color, border-color, color, opacity, transform; }
        a:hover { background: rgba(255,255,255,0.1) !important; }
        button:hover { opacity: 0.85; }
      `}</style>
    </div>
  )
}