'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../src/lib/supabase'
import type { Profile } from '../../src/lib/types'
import type { User } from '@supabase/supabase-js'

// Professional user types (have client management, dashboard, payments, etc.)
const PROF_TYPES = ['consultor', 'arquiteto', 'feng_shui', 'decorador', 'outro_profissional']

const NAV_PROFESSIONAL = [
  { label: 'Dashboard', icon: '📊', href: '/dashboard' },
  { label: 'Clientes', icon: '👤', href: '/clientes' },
  { label: 'Consultas', icon: '📋', href: '/consultas' },
  { label: 'Curas', icon: '✨', href: '/curas' },
  { label: 'Calendário', icon: '🌙', href: '/calendario' },
  { label: 'Pagamentos', icon: '💰', href: '/pagamentos' },
  { label: 'Produtos', icon: '🛒', href: '/produtos' },
  { label: 'Planos', icon: '⭐', href: '/planos' },
  { label: 'Perfil', icon: '⚙️', href: '/perfil' },
]

const NAV_PERSONAL = [
  { label: 'Minha Casa', icon: '🏠', href: '/consultas' },
  { label: 'Curas', icon: '✨', href: '/curas' },
  { label: 'Calendário', icon: '🌙', href: '/calendario' },
  { label: 'Parceiros', icon: '🤝', href: '/parceiros' },
  { label: 'Produtos', icon: '🛒', href: '/produtos' },
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
  const [isMobile, setIsMobile] = useState(false)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [mounted, setMounted] = useState(false)

  const isProfessional = profile?.plano === 'pro'
    || (profile?.tipo_usuario ? PROF_TYPES.includes(profile.tipo_usuario) : false)
    || profile?.role === 'consultor'

  const isAdmin = profile?.role === 'admin'

  const baseNav = isProfessional ? NAV_PROFESSIONAL : NAV_PERSONAL
  const navItems = isAdmin
    ? [...baseNav, { label: 'Admin', icon: '🔧', href: '/admin/chaves' }]
    : baseNav

  useEffect(() => {
    setMounted(true)
    setIsMobile(window.innerWidth < 768)

    function handleResize() { setIsMobile(window.innerWidth < 768) }
    window.addEventListener('resize', handleResize)

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
          .select('nome_completo, plano, tipo_usuario, role')
          .eq('id', user.id)
          .single()
        if (data) {
          setProfile(data)
        } else {
          // Fallback to user metadata if profile not found
          setProfile({
            nome_completo: user.user_metadata?.nome_completo,
            tipo_usuario: user.user_metadata?.tipo_usuario,
            role: user.user_metadata?.role,
            plano: 'freemium',
          })
        }

      }
    }
    loadProfile()

    return () => window.removeEventListener('resize', handleResize)
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
    window.location.href = '/login'
  }

  const t = {
    bg: darkMode ? '#0f172a' : '#F9FAFB',
    card: darkMode ? '#1e293b' : '#ffffff',
    sidebar: darkMode ? '#1e293b' : '#1E3A5F',
    text: darkMode ? '#e2e8f0' : '#111827',
    textSoft: darkMode ? '#94a3b8' : '#6B7280',
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

  return (
    <div style={{ minHeight: '100vh', background: t.bg, fontFamily: 'Arial, sans-serif', display: 'flex', transition: 'background 0.3s ease' }}>

      {mobileOpen && (
        <div onClick={() => setMobileOpen(false)} role="presentation" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 40 }} />
      )}

      <aside role="navigation" aria-label="Menu principal" style={{
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
        transform: isMobile ? (mobileOpen ? 'translateX(0)' : 'translateX(-100%)') : 'translateX(0)',
      }}>

        <div style={{
          padding: sidebarOpen ? '20px 20px 16px' : '20px 0 16px',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: sidebarOpen ? 'flex-start' : 'center',
          gap: '10px',
        }}>
          <span style={{ fontSize: '28px', flexShrink: 0 }}>☯</span>
          {sidebarOpen && (
            <span style={{ color: '#B8860B', fontSize: '18px', fontWeight: 'bold', whiteSpace: 'nowrap' }}>FengShui Studio</span>
          )}
        </div>

        {/* User type badge */}
        {sidebarOpen && profile && (
          <div style={{
            padding: '8px 20px', borderBottom: '1px solid rgba(255,255,255,0.1)',
          }}>
            <span style={{
              background: isProfessional ? 'rgba(124,58,237,0.2)' : 'rgba(184,134,11,0.2)',
              color: isProfessional ? '#C4B5FD' : '#FDE68A',
              padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 'bold',
            }}>
              {isProfessional ? 'Profissional' : 'Pessoal'}
            </span>
          </div>
        )}

        <nav aria-label="Navegação principal" style={{ flex: 1, padding: '12px 8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {navItems.map((item) => {
            const active = currentPage === item.href.replace('/', '')
            return (
              <a key={item.href} href={item.href} onClick={() => setMobileOpen(false)} style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                padding: sidebarOpen ? '10px 14px' : '10px 0',
                justifyContent: sidebarOpen ? 'flex-start' : 'center',
                borderRadius: '8px',
                background: active ? 'rgba(255,255,255,0.15)' : 'transparent',
                color: active ? '#ffffff' : 'rgba(255,255,255,0.6)',
                textDecoration: 'none', fontSize: '14px',
                fontWeight: active ? 'bold' : 'normal',
                transition: 'all 0.2s ease', cursor: 'pointer'
              }}>
                <span style={{ fontSize: '18px', flexShrink: 0 }}>{item.icon}</span>
                {sidebarOpen && <span style={{ whiteSpace: 'nowrap' }}>{item.label}</span>}
              </a>
            )
          })}
        </nav>

        <div style={{
          padding: '12px 8px 16px',
          borderTop: '1px solid rgba(255,255,255,0.1)',
          display: 'flex', flexDirection: 'column', gap: '4px'
        }}>
          <button onClick={toggleDark} aria-label={darkMode ? 'Ativar modo claro' : 'Ativar modo escuro'} style={{
            display: 'flex', alignItems: 'center', gap: '12px',
            padding: sidebarOpen ? '10px 14px' : '10px 0',
            justifyContent: sidebarOpen ? 'flex-start' : 'center',
            borderRadius: '8px', background: 'transparent', border: 'none',
            color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: '14px', width: '100%'
          }}>
            <span style={{ fontSize: '18px' }} aria-hidden="true">{darkMode ? '☀️' : '🌙'}</span>
            {sidebarOpen && <span>{darkMode ? 'Modo claro' : 'Modo escuro'}</span>}
          </button>

          <button onClick={toggleSidebar} aria-label={sidebarOpen ? 'Recolher menu' : 'Expandir menu'} style={{
            display: 'flex', alignItems: 'center', gap: '12px',
            padding: sidebarOpen ? '10px 14px' : '10px 0',
            justifyContent: sidebarOpen ? 'flex-start' : 'center',
            borderRadius: '8px', background: 'transparent', border: 'none',
            color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: '14px', width: '100%'
          }}>
            <span style={{ fontSize: '18px' }} aria-hidden="true">{sidebarOpen ? '◀' : '▶'}</span>
            {sidebarOpen && <span>Recolher</span>}
          </button>

          <button onClick={handleLogout} aria-label="Sair da conta" style={{
            display: 'flex', alignItems: 'center', gap: '12px',
            padding: sidebarOpen ? '10px 14px' : '10px 0',
            justifyContent: sidebarOpen ? 'flex-start' : 'center',
            borderRadius: '8px', background: 'transparent', border: 'none',
            color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: '14px', width: '100%'
          }}>
            <span style={{ fontSize: '18px' }} aria-hidden="true">🚪</span>
            {sidebarOpen && <span>Sair</span>}
          </button>
        </div>
      </aside>

      <div style={{
        marginLeft: isMobile ? '0' : sidebarOpen ? '240px' : '72px',
        flex: 1, transition: 'margin-left 0.3s cubic-bezier(0.4, 0, 0.2, 1)', minHeight: '100vh'
      }}>

        <header style={{
          background: t.card, padding: '0 24px', height: '56px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          borderBottom: '1px solid ' + t.border, position: 'sticky', top: 0, zIndex: 30,
        }}>
          <button onClick={() => setMobileOpen(true)} aria-label="Abrir menu de navegação" style={{
            background: 'none', border: 'none', fontSize: '24px',
            cursor: 'pointer', padding: '4px',
            display: isMobile ? 'block' : 'none'
          }} aria-expanded={mobileOpen}>
            <span aria-hidden="true">☰</span>
          </button>

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

        <main id="main-content" role="main" style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
          {children}
        </main>
      </div>

      <style>{`
        @media (max-width: 768px) { aside { transform: translateX(-100%) !important; } }
        a:hover { background: rgba(255,255,255,0.1) !important; }
        button:hover { opacity: 0.85; }
        /* Focus indicators for keyboard navigation */
        a:focus-visible, button:focus-visible, input:focus-visible, select:focus-visible, textarea:focus-visible {
          outline: 2px solid #7C3AED !important;
          outline-offset: 2px !important;
        }
        /* Respect reduced motion preference */
        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
            scroll-behavior: auto !important;
          }
        }
      `}</style>
    </div>
  )
}
