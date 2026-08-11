'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../src/lib/supabase'
import type { Profile } from '../../src/lib/types'
import type { User } from '@supabase/supabase-js'
import { planoEfetivo, planoLabel, podeClientes, podeCalendario, isProfissional as isProfissionalFn, planoUsuario } from '../../src/lib/plano-utils'
import PaymentBanner from './PaymentBanner'
import NotificationBell from './NotificationBell'
import {
  useMontado,
  useEhMobile,
  usePreferenciaBooleana,
  PREFERENCIA_TEMA_ESCURO,
  PREFERENCIA_SIDEBAR_ABERTA,
} from './hooks-cliente'
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
  const [mobileOpen, setMobileOpen] = useState(false)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [user, setUser] = useState<User | null>(null)

  // Vindos do browser, sem efeito de sincronização — ver hooks-cliente.ts.
  const mounted = useMontado()
  const isMobile = useEhMobile()
  const [darkMode, setDarkMode] = usePreferenciaBooleana(PREFERENCIA_TEMA_ESCURO, false)
  const [sidebarOpen, setSidebarOpen] = usePreferenciaBooleana(PREFERENCIA_SIDEBAR_ABERTA, true)

  const isProfessional = isProfissionalFn(profile)
  const isAdmin = profile?.role === 'admin'
  const plano = planoUsuario(profile)

  // Build nav items based on plan
  const buildNav = (): NavItem[] => {
    const items: NavItem[] = [
      { label: 'Dashboard', icon: LayoutDashboard, href: '/dashboard' },
    ]
    // Clientes: hidden for free, self-only for simples (hidden), full for profissional
    if (podeClientes(plano)) {
      items.push({ label: 'Clientes', icon: Users, href: '/clientes' })
    }
    items.push({ label: isProfessional ? 'Consultas' : 'Minha Casa', icon: isProfessional ? ClipboardList : HomeIcon, href: '/consultas' })
    items.push({ label: 'Curas', icon: Sparkles, href: '/curas' })
    items.push({ label: 'Roda da Vida', icon: CircleDot, href: '/roda-da-vida' })
    // Calendário: hidden for free
    if (podeCalendario(plano)) {
      items.push({ label: 'Calendário', icon: Moon, href: '/calendario' })
    }
    if (isProfessional) {
      items.push({ label: 'Pagamentos', icon: Wallet, href: '/pagamentos' })
    }
    items.push({ label: 'Parceiros', icon: Handshake, href: '/parceiros' })
    items.push({ label: 'Produtos', icon: ShoppingCart, href: '/produtos' })
    items.push({ label: 'Planos', icon: Star, href: '/planos' })
    items.push({ label: 'Perfil', icon: Settings, href: '/perfil' })
    return items
  }
  const baseNav = buildNav()
  const navItems: NavItem[] = isAdmin
    ? [
        ...baseNav,
        { label: 'Admin Chaves', icon: KeyRound, href: '/admin/chaves' },
        { label: 'Admin Pgtos', icon: CreditCard, href: '/admin/pagamentos' },
        { label: 'Relatórios', icon: BarChart3, href: '/admin/relatorios' },
        { label: 'Auditoria', icon: FileText, href: '/admin/auditoria' },
      ]
    : baseNav

  useEffect(() => {
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
  }, [])

  // A persistência agora é do hook: escrever e notificar quem lê a mesma
  // preferência acontece num lugar só.
  function toggleDark() { setDarkMode(!darkMode) }

  function toggleSidebar() { setSidebarOpen(!sidebarOpen) }

  async function handleLogout() {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  const t = {
    bg: darkMode ? '#0B1524' : '#FBF9F4',
    card: darkMode ? '#12233A' : '#FFFFFF',
    sidebar: darkMode ? '#0A1420' : '#0E1B2C',
    text: darkMode ? '#EAF0F6' : '#12212E',
    textSoft: darkMode ? '#9CB0C4' : '#5B6B78',
    border: darkMode ? '#243546' : '#E7E1D6',
  }
  const accent = '#C9A227'
  const jade = '#2E7D6B'

  if (!mounted) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FBF9F4', fontFamily: 'var(--font-figtree), sans-serif' }}>
        <div style={{ textAlign: 'center' }}>
          <img src="/marketing/logo-fengshui.png" alt="" width={56} height={56} style={{ marginBottom: '16px', display: 'inline-block' }} />
          <p style={{ color: '#2E7D6B', fontSize: '16px' }}>Carregando...</p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: t.bg, fontFamily: 'var(--font-figtree), sans-serif', display: 'flex', transition: 'background 0.3s ease' }}>

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
          <img src="/marketing/logo-fengshui.png" alt="" width={30} height={30} style={{ flexShrink: 0 }} />
          {sidebarOpen && (
            <span style={{ color: accent, fontSize: '17px', fontWeight: 600, whiteSpace: 'nowrap', fontFamily: 'var(--font-fraunces), serif' }}>FengShui Studio</span>
          )}
        </div>

        {/* User type badge */}
        {sidebarOpen && profile && (
          <div style={{
            padding: '8px 20px', borderBottom: '1px solid rgba(255,255,255,0.1)',
          }}>
            <span style={{
              background: (isProfessional || plano === 'profissional') ? 'rgba(46,125,107,0.28)' : plano === 'simples' ? 'rgba(46,125,107,0.18)' : 'rgba(201,162,39,0.2)',
              color: (isProfessional || plano === 'profissional') ? '#8FD8C4' : plano === 'simples' ? '#8FD8C4' : '#F0D888',
              padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 'bold',
            }}>
              {isProfessional ? 'Profissional' : planoLabel(profile?.plano)}
            </span>
          </div>
        )}

        <nav aria-label="Navegação principal" style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '12px 8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {navItems.map((item) => {
            const active = currentPage === item.href.replace('/', '')
            const Icon = item.icon
            return (
              <a key={item.href} href={item.href} onClick={() => setMobileOpen(false)} aria-current={active ? 'page' : undefined} aria-label={!sidebarOpen ? item.label : undefined} style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                padding: sidebarOpen ? '10px 14px' : '10px 0',
                justifyContent: sidebarOpen ? 'flex-start' : 'center',
                borderRadius: '10px',
                background: active ? 'rgba(46,125,107,0.22)' : 'transparent',
                boxShadow: active ? `inset 3px 0 0 ${accent}` : 'none',
                color: active ? '#FFFFFF' : 'rgba(255,255,255,0.62)',
                textDecoration: 'none', fontSize: '14px',
                fontWeight: active ? 600 : 400,
                transition: 'all 0.2s ease', cursor: 'pointer'
              }}>
                <Icon size={19} strokeWidth={active ? 2.25 : 1.75} color={active ? accent : 'currentColor'} style={{ flexShrink: 0 }} aria-hidden="true" />
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
            {darkMode ? <Sun size={19} strokeWidth={1.75} aria-hidden="true" /> : <Moon size={19} strokeWidth={1.75} aria-hidden="true" />}
            {sidebarOpen && <span>{darkMode ? 'Modo claro' : 'Modo escuro'}</span>}
          </button>

          <button onClick={toggleSidebar} aria-label={sidebarOpen ? 'Recolher menu' : 'Expandir menu'} style={{
            display: 'flex', alignItems: 'center', gap: '12px',
            padding: sidebarOpen ? '10px 14px' : '10px 0',
            justifyContent: sidebarOpen ? 'flex-start' : 'center',
            borderRadius: '8px', background: 'transparent', border: 'none',
            color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: '14px', width: '100%'
          }}>
            {sidebarOpen ? <PanelLeftClose size={19} strokeWidth={1.75} aria-hidden="true" /> : <PanelLeftOpen size={19} strokeWidth={1.75} aria-hidden="true" />}
            {sidebarOpen && <span>Recolher</span>}
          </button>

          <button onClick={handleLogout} aria-label="Sair da conta" style={{
            display: 'flex', alignItems: 'center', gap: '12px',
            padding: sidebarOpen ? '10px 14px' : '10px 0',
            justifyContent: sidebarOpen ? 'flex-start' : 'center',
            borderRadius: '8px', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)',
            color: '#FCA5A5', cursor: 'pointer', fontSize: '14px', width: '100%', fontWeight: 'bold'
          }}>
            <LogOut size={19} strokeWidth={1.75} aria-hidden="true" />
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
            <Menu size={24} strokeWidth={1.75} color={t.text} aria-hidden="true" />
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden', flex: 1, marginLeft: '8px' }}>
            <span style={{ color: t.textSoft, fontSize: isMobile ? '12px' : '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              Olá, <strong style={{ color: t.text }}>{profile?.nome_completo || user?.email || ''}</strong>
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {plano !== 'free' && (
              <span style={{
                background: plano === 'profissional' ? jade : accent,
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
              <LogOut size={16} strokeWidth={1.75} aria-hidden="true" />
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
          outline: 2px solid #2E7D6B !important;
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
