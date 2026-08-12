'use client'

import { redirecionarParaLogin } from '../../src/lib/auth-rotas'
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
  BarChart3, FileText, Sun, PanelLeftClose, PanelLeftOpen, LogOut, Menu, Grid3x3,
  type LucideIcon,
} from 'lucide-react'
import { ehClienteFinal } from '../../src/lib/papel-do-usuario'

type NavItem = { label: string; icon: LucideIcon; href: string; bloqueado?: boolean }

/**
 * O menu era uma lista corrida de até 14 itens. «Curas» ficava entre
 * «Minha Casa» e «Roda da Vida»; «Planos» entre «Produtos» e «Perfil». Sem
 * hierarquia, achar qualquer coisa exigia ler a lista inteira toda vez.
 *
 * Os grupos separam o que o consultor faz **com o cliente** do que ele faz
 * **sobre o imóvel**, do que é **do negócio dele** e do que é **da conta**.
 * Dashboard fica fora de grupo de propósito: é a porta de entrada, não um item
 * de categoria.
 */
type GrupoDeNav = { titulo: string; itens: NavItem[] }

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

  const clienteFinal = ehClienteFinal(profile)

  // Fora de grupo: é a porta de entrada, não uma categoria.
  const itemInicio: NavItem = clienteFinal
    ? { label: 'Minha casa', icon: HomeIcon, href: '/dashboard' }
    : { label: 'Dashboard', icon: LayoutDashboard, href: '/dashboard' }

  /**
   * O menu do cliente final não é o do consultor com itens desabilitados: é
   * outro menu. Carteira de clientes, cobrança e relatórios de negócio não
   * existem para quem cuida da própria casa — mostrá-los cinzentos só ensinaria
   * que metade do produto não é para ele.
   */
  const gruposDoCliente: GrupoDeNav[] = [
    {
      titulo: 'Minha casa',
      itens: [
        { label: 'Mapa Ba Guá', icon: Grid3x3, href: '/bagua-planta' },
        { label: 'Minhas curas', icon: Sparkles, href: '/curas' },
        { label: 'Roda da Vida', icon: CircleDot, href: '/roda-da-vida' },
        ...(podeCalendario(plano) ? [{ label: 'Calendário lunar', icon: Moon, href: '/calendario' }] : []),
      ],
    },
    {
      titulo: 'Ajuda e loja',
      itens: [
        { label: 'Encontrar consultor', icon: Handshake, href: '/parceiros' },
        { label: 'Loja', icon: ShoppingCart, href: '/produtos' },
      ],
    },
    {
      titulo: 'Conta',
      itens: [
        { label: 'Meu plano', icon: Star, href: '/planos' },
        { label: 'Perfil', icon: Settings, href: '/perfil' },
      ],
    },
  ]

  // Item escondido por plano continua escondido; a mudança é só de arrumação.
  // Um grupo que ficar vazio some inteiro — cabeçalho sem item embaixo é pior
  // que grupo nenhum.
  const gruposDoConsultor: GrupoDeNav[] = [
    {
      titulo: 'Atendimento',
      itens: [
        // Clientes: escondido no free, só o próprio no simples.
        ...(podeClientes(plano) ? [{ label: 'Clientes', icon: Users, href: '/clientes' }] : []),
        { label: isProfessional ? 'Consultas' : 'Minha Casa', icon: isProfessional ? ClipboardList : HomeIcon, href: '/consultas' },
      ],
    },
    {
      titulo: 'Diagnóstico',
      itens: [
        { label: 'Curas', icon: Sparkles, href: '/curas' },
        { label: 'Roda da Vida', icon: CircleDot, href: '/roda-da-vida' },
        ...(podeCalendario(plano) ? [{ label: 'Calendário', icon: Moon, href: '/calendario' }] : []),
      ],
    },
    {
      titulo: 'Negócio',
      itens: [
        ...(isProfessional ? [{ label: 'Pagamentos', icon: Wallet, href: '/pagamentos' }] : []),
        { label: 'Parceiros', icon: Handshake, href: '/parceiros' },
        { label: 'Produtos', icon: ShoppingCart, href: '/produtos' },
        // Os gráficos que ocupavam a home. Continuam valendo como leitura
        // mensal do negócio — que é o que eles são.
        { label: 'Relatórios', icon: BarChart3, href: '/relatorios' },
      ],
    },
    {
      titulo: 'Conta',
      itens: [
        { label: 'Planos', icon: Star, href: '/planos' },
        { label: 'Perfil', icon: Settings, href: '/perfil' },
      ],
    },
    ...(isAdmin ? [{
      titulo: 'Administração',
      itens: [
        { label: 'Chaves', icon: KeyRound, href: '/admin/chaves' },
        { label: 'Pagamentos', icon: CreditCard, href: '/admin/pagamentos' },
        { label: 'Relatórios', icon: BarChart3, href: '/admin/relatorios' },
        { label: 'Auditoria', icon: FileText, href: '/admin/auditoria' },
      ],
    }] : []),
  ].filter(g => g.itens.length > 0)

  const grupos = clienteFinal ? gruposDoCliente : gruposDoConsultor

  /**
   * Barra inferior do celular — quatro destinos, só para o cliente final.
   *
   * Quatro porque é o que cabe com alvo de 44px numa tela de 390px sem os
   * rótulos encolherem abaixo de 11px. O consultor continua com o hambúrguer:
   * o menu dele tem quinze itens e nenhum recorte de quatro seria honesto.
   */
  const barraInferior: NavItem[] = [
    { label: 'Minha casa', icon: HomeIcon, href: '/dashboard' },
    { label: 'Ba Guá', icon: Grid3x3, href: '/bagua-planta' },
    { label: 'Curas', icon: Sparkles, href: '/curas' },
    { label: 'Perfil', icon: Settings, href: '/perfil' },
  ]
  const mostrarBarraInferior = clienteFinal && isMobile

  /** `currentPage` chega como o caminho sem a barra inicial ('admin/chaves'). */
  function estaAtivo(href: string) {
    return currentPage === href.replace(/^\//, '')
  }

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
    redirecionarParaLogin()
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

  function renderItem(item: NavItem) {
    const active = estaAtivo(item.href)
    const Icon = item.icon
    return (
      <a key={item.href} href={item.href} className="nav-lateral" onClick={() => setMobileOpen(false)}
        aria-current={active ? 'page' : undefined}
        aria-label={!sidebarOpen ? item.label : undefined}
        title={!sidebarOpen ? item.label : undefined}
        style={{
          display: 'flex', alignItems: 'center', gap: '12px',
          padding: sidebarOpen ? '10px 14px' : '10px 0',
          justifyContent: sidebarOpen ? 'flex-start' : 'center',
          borderRadius: '10px',
          background: active ? 'rgba(46,125,107,0.22)' : 'transparent',
          boxShadow: active ? `inset 3px 0 0 ${accent}` : 'none',
          color: active ? '#FFFFFF' : 'rgba(255,255,255,0.62)',
          textDecoration: 'none', fontSize: '14px',
          fontWeight: active ? 600 : 400,
          transition: 'all 0.2s ease', cursor: 'pointer',
        }}>
        <Icon size={19} strokeWidth={active ? 2.25 : 1.75} color={active ? accent : 'currentColor'} style={{ flexShrink: 0 }} aria-hidden="true" />
        {sidebarOpen && <span style={{ whiteSpace: 'nowrap' }}>{item.label}</span>}
      </a>
    )
  }

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
              color: (isProfessional || plano === 'profissional') ? '#8FD8C4' : plano === 'simples' ? '#8FD8C4' : '#EEDFB4',
              padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 'bold',
            }}>
              {isProfessional ? 'Profissional' : planoLabel(profile?.plano)}
            </span>
          </div>
        )}

        <nav aria-label="Navegação principal" style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '12px 8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {renderItem(itemInicio)}
          {grupos.map(grupo => (
            // `<section aria-label>` e não uma `<div>` solta: o cabeçalho do
            // grupo some quando o menu está recolhido, e sem o rótulo acessível
            // o leitor de tela perderia a divisão junto com ele.
            <section key={grupo.titulo} aria-label={grupo.titulo} style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '10px' }}>
              {sidebarOpen ? (
                <h2 style={{
                  color: 'rgba(255,255,255,0.38)', fontSize: '10px', fontWeight: 700,
                  letterSpacing: '0.09em', textTransform: 'uppercase',
                  margin: '2px 0 2px', padding: '0 14px',
                }}>{grupo.titulo}</h2>
              ) : (
                // Recolhido não cabe texto; a linha preserva a separação.
                <div aria-hidden="true" style={{ height: '1px', background: 'rgba(255,255,255,0.12)', margin: '4px 14px' }} />
              )}
              {grupo.itens.map(renderItem)}
            </section>
          ))}
        </nav>

        <div style={{
          padding: '12px 8px 16px',
          borderTop: '1px solid rgba(255,255,255,0.1)',
          display: 'flex', flexDirection: 'column', gap: '4px'
        }}>
          <button type="button" onClick={toggleDark} aria-label={darkMode ? 'Ativar modo claro' : 'Ativar modo escuro'} style={{
            display: 'flex', alignItems: 'center', gap: '12px',
            padding: sidebarOpen ? '10px 14px' : '10px 0',
            justifyContent: sidebarOpen ? 'flex-start' : 'center',
            borderRadius: '8px', background: 'transparent', border: 'none',
            color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: '14px', width: '100%'
          }}>
            {darkMode ? <Sun size={19} strokeWidth={1.75} aria-hidden="true" /> : <Moon size={19} strokeWidth={1.75} aria-hidden="true" />}
            {sidebarOpen && <span>{darkMode ? 'Modo claro' : 'Modo escuro'}</span>}
          </button>

          <button type="button" onClick={toggleSidebar} aria-label={sidebarOpen ? 'Recolher menu' : 'Expandir menu'} style={{
            display: 'flex', alignItems: 'center', gap: '12px',
            padding: sidebarOpen ? '10px 14px' : '10px 0',
            justifyContent: sidebarOpen ? 'flex-start' : 'center',
            borderRadius: '8px', background: 'transparent', border: 'none',
            color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: '14px', width: '100%'
          }}>
            {sidebarOpen ? <PanelLeftClose size={19} strokeWidth={1.75} aria-hidden="true" /> : <PanelLeftOpen size={19} strokeWidth={1.75} aria-hidden="true" />}
            {sidebarOpen && <span>Recolher</span>}
          </button>

          {/* O «Sair» daqui foi removido: havia dois na mesma tela, este e o do
              cabeçalho. O do cabeçalho ficou porque é o que continua alcançável
              com o menu recolhido e no mobile, onde a barra lateral está atrás
              do hambúrguer. */}
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
          <button type="button" onClick={() => setMobileOpen(true)} aria-label="Abrir menu de navegação" className="mobile-menu-btn" style={{
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
            <button type="button" onClick={handleLogout} title="Sair da conta" style={{
              background: 'none', border: '1px solid ' + t.border, borderRadius: '8px',
              padding: '6px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
              color: t.textSoft, fontSize: '13px',
            }}>
              <LogOut size={16} strokeWidth={1.75} aria-hidden="true" />
              <span>Sair</span>
            </button>
          </div>
        </header>

        <main id="main-content" role="main" style={{
          padding: '24px', maxWidth: '1200px', margin: '0 auto',
          // A barra é fixa: sem esta folga ela cobriria o último elemento.
          paddingBottom: mostrarBarraInferior ? '84px' : '24px',
        }}>
          <PaymentBanner />
          {children}
        </main>
      </div>

      {mostrarBarraInferior && (
        <nav aria-label="Navegação rápida" style={{
          position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 45,
          background: t.card, borderTop: `1px solid ${t.border}`,
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}>
          {barraInferior.map(item => {
            const ativo = estaAtivo(item.href)
            const Icon = item.icon
            return (
              <a key={item.href} href={item.href} aria-current={ativo ? 'page' : undefined} style={{
                // 48px, acima do mínimo de 44 exigido para alvo de toque.
                minHeight: '48px', padding: '8px 4px',
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', gap: '3px', textDecoration: 'none',
                color: ativo ? jade : t.textSoft,
              }}>
                <Icon size={20} strokeWidth={ativo ? 2.25 : 1.75} aria-hidden="true" />
                <span style={{ fontSize: '11px', fontWeight: ativo ? 700 : 400, whiteSpace: 'nowrap' }}>{item.label}</span>
              </a>
            )
          })}
        </nav>
      )}

      <style>{`
        @media print {
          .no-print { display: none !important; }
        }
        /* Mobile: always show hamburger button on small screens */
        @media (max-width: 768px) {
          .mobile-menu-btn { display: block !important; }
        }
        /* Era \`a:hover\`, sem escopo e com \`!important\`: um clarão branco de 10%
           aplicado a TODO link de TODA página dentro do AppShell, atropelando o
           hover que cada tela definia. Só os links do menu escuro querem isso. */
           O \`!important\` continua porque o item traz \`background\` inline (estado
           ativo) e regra de folha perde para atributo \`style\` sem ele — mas
           agora está preso a uma classe do menu. */
        .nav-lateral:hover { background: rgba(255,255,255,0.1) !important; }
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
