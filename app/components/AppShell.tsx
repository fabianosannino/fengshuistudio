'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../src/lib/supabase'
import type { Profile } from '../../src/lib/types'
import type { User } from '@supabase/supabase-js'
import { planoEfetivo, planoLabel, podeClientes, podeCalendario, isProfissional as isProfissionalFn, planoUsuario } from '../../src/lib/plano-utils'
import PaymentBanner from './PaymentBanner'
import NotificationBell from './NotificationBell'
import {
  LayoutDashboard, Users, ClipboardList, Home as HomeIcon, Sparkles, CircleDot,
  Moon, Wallet, Handshake, ShoppingCart, Star, Settings, KeyRound, CreditCard,
  BarChart3, FileText, Sun, PanelLeftClose, PanelLeftOpen, LogOut, Menu,
  type LucideIcon,
} from 'lucide-react'

type NavItem = { label: string; icon: LucideIcon; href: string; bloqueado?: boolean }

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

  const isProfessional = isProfissionalFn(profile)
  const isAdmin = profile?.role === 'admin'
  const plano = planoUsuario(profile)

  // Build nav items based on plan
  const buildNav = (): NavItem[] => {
    const items: NavItem[] = [
      { label: 'Dashboard', icon: '\ud83d\udcca', href: '/dashboard' },
    ]
    // Clientes: hidden for free, self-only for simples (hidden), full for profissional
    if (podeClientes(plano)) {
      items.push({ label: 'Clientes', icon: '\ud83d\udc64', href: '/clientes' })
    }
    items.push({ label: isProfessional ? 'Consultas' : 'Minha Casa', icon: isProfessional ? '\ud83d\udccb' : '\ud83c\udfe0', href: '/consultas' })
    items.push({ label: 'Curas', icon: '\u2728', href: '/curas' })
    items.push({ label: 'Roda da Vida', icon: '◎', href: '/roda-da-vida' })
    // Calendário: hidden for free
    if (podeCalendario(plano)) {
      items.push({ label: 'Calendário', icon: '\ud83c\udf19', href: '/calendario' })
    }
    if (isProfessional) {
      items.push({ label: 'Pagamentos', icon: '\ud83d\udcb0', href: '/pagamentos' })
    }
    items.push({ label: 'Parceiros', icon: '\ud83e\udd1d', href: '/parceiros' })
    items.push({ label: 'Produtos', icon: '\ud83d\uded2', href: '/produtos' })
    items.push({ label: 'Planos', icon: '\u2b50', href: '/planos' })
    items.push({ label: 'Perfil', icon: '\u2699\ufe0f', href: '/perfil' })
    return items
  }
  const baseNav = buildNav()
  const navItems: NavItem[] = isAdmin
    ? [
        ...baseNav,
        { label: 'Admin Chaves', icon: '\ud83d\udd11', href: '/admin/chaves' },
        { label: 'Admin Pgtos', icon: '\ud83d\udcb3', href: '/admin/pagamentos' },
        { label: 'Relatórios', icon: '\ud83d\udcca', href: '/admin/relatorios' },
        { label: 'Auditoria', icon: '\ud83d\udcdd', href: '/admin/auditoria' },
      ]
    : baseNav

  useEffect(() => {
    setMounted(true)
    setIsMobile(window.innerWidth < 768)

    function handleResize() { setIsMobile(window.innerWidth < 768) }
    window.addEventListener('resize', handleResize)

    try {
      const saved = localStorage.getItem('fengshui-dark')
      if (saved === 'true') setDarkMode(true)

      const savedSidebar = localStorage.getItem('fengshui-sidebar')
      if (savedSidebar === 'false') setSidebarOpen(false)
    } catch {
      // localStorage unavailable (private browsing, SSR)
    }

    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUser(user)
        const { data } = await supabase
          .from('profiles')
          .select('*')
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
    try { localStorage.setItem('fengshui-dark', String(next)) } catch { /* ignore */ }
  }

  function toggleSidebar() {
    const next = !sidebarOpen
    setSidebarOpen(next)
    try { localStorage.setItem('fengshui-sidebar', String(next)) } catch { /* ignore */ }
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
              background: (isProfessional || plano === 'profissional') ? 'rgba(124,58,237,0.2)' : plano === 'simples' ? 'rgba(59,130,246,0.2)' : 'rgba(184,134,11,0.2)',
              color: (isProfessional || plano === 'profissional') ? '#C4B5FD' : plano === 'simples' ? '#93C5FD' : '#FDE68A',
              padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 'bold',
            }}>
              {isProfessional ? 'Profissional' : planoLabel(profile?.plano)}
            </span>
          </div>
        )}

        <nav aria-label="Navegação principal" style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '12px 8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {navItems.map((item) => {
            const active = currentPage === item.href.replace('/', '')
            return (
              <a key={item.href} href={item.href} onClick={() => setMobileOpen(false)} aria-current={active ? 'page' : undefined} aria-label={!sidebarOpen ? item.label : undefined} style={{
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
                <span style={{ fontSize: '18px', flexShrink: 0 }} aria-hidden="true">{item.icon}</span>
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
            borderRadius: '8px', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)',
            color: '#FCA5A5', cursor: 'pointer', fontSize: '14px', width: '100%', fontWeight: 'bold'
          }}>
            <span style={{ fontSize: '18px' }} aria-hidden="true">🚪</span>
            {sidebarOpen && <span>Sair da conta</span>}
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
          <button onClick={() => setMobileOpen(true)} aria-label="Abrir menu de navegação" className="mobile-menu-btn" style={{
            background: 'none', border: 'none', fontSize: '24px',
            cursor: 'pointer', padding: '8px',
            display: isMobile ? 'block' : 'none'
          }} aria-expanded={mobileOpen}>
            <span aria-hidden="true">☰</span>
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden', flex: 1, marginLeft: '8px' }}>
            <span style={{ color: t.textSoft, fontSize: isMobile ? '12px' : '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              Olá, <strong style={{ color: t.text }}>{profile?.nome_completo || user?.email || ''}</strong>
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {plano !== 'free' && (
              <span style={{
                background: plano === 'profissional' ? '#7C3AED' : '#3B82F6',
                color: '#fff', padding: '3px 10px',
                borderRadius: '20px', fontSize: '11px', fontWeight: 'bold'
              }}>{plano === 'profissional' ? 'PRO' : 'SIMPLES'}</span>
            )}
            <NotificationBell />
            <button onClick={handleLogout} title="Sair da conta" style={{
              background: 'none', border: '1px solid ' + t.border, borderRadius: '8px',
              padding: '6px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
              color: t.textSoft, fontSize: '13px',
            }}>
              <span aria-hidden="true">🚪</span>
              <span>Sair</span>
            </button>
          </div>
        </header>

        <main id="main-content" role="main" style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
          <PaymentBanner />
          {children}
        </main>
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
        }
        /* Mobile: always show hamburger button on small screens */
        @media (max-width: 768px) {
          .mobile-menu-btn { display: block !important; }
        }
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
