'use client'

/* Design "Chi": navbar paper translúcida com blur, wordmark Fraunces, CTA jade */
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, X, ChevronDown } from 'lucide-react'
import { ASSETS, REGISTER_URL, LOGIN_URL } from './assets'

const recursos = [
  { href: '/recursos/bagua', label: 'Análise Ba Guá & Planta' },
  { href: '/recursos/roda-da-vida', label: 'Roda da Vida & Fluxo do Chi' },
  { href: '/recursos/relatorios', label: 'Relatórios & Clientes' },
  { href: '/recursos/calendario', label: 'Calendário, Curas & Loja' },
]

const paraQuem = [
  { href: '/para-consultores', label: 'Consultores & Arquitetos' },
  { href: '/minha-casa', label: 'Para minha casa' },
]

export default function Navbar() {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    setOpen(false)
  }, [pathname])

  const linkCls = (href: string) =>
    `text-sm font-medium transition-colors hover:text-jade ${
      pathname === href ? 'text-jade' : 'text-ink/80'
    }`

  return (
    <header className="sticky top-0 z-50 bg-paper/90 backdrop-blur-md border-b border-border/60">
      <div className="container flex items-center justify-between h-16 md:h-[72px]">
        <Link href="/" className="flex items-center gap-2.5 shrink-0" aria-label="FengShui Studio — início">
          <img src={ASSETS.logo || '/placeholder.svg'} alt="" className="h-9 w-9 md:h-10 md:w-10" />
          <span className="font-display text-lg md:text-xl text-ink leading-none">
            FengShui
            <span className="block text-[10px] font-sans font-semibold tracking-[0.3em] text-gold uppercase">
              Studio
            </span>
          </span>
        </Link>

        {/* Desktop */}
        <nav className="hidden lg:flex items-center gap-7" aria-label="Navegação principal">
          <div className="relative group">
            <button className={`${linkCls('/recursos')} inline-flex items-center gap-1`}>
              Recursos <ChevronDown className="h-3.5 w-3.5" />
            </button>
            <div className="absolute left-0 top-full pt-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible group-focus-within:opacity-100 group-focus-within:visible transition-all duration-200">
              <div className="bg-paper border border-border rounded-xl shadow-lg py-2 w-72">
                <Link href="/recursos" className="block px-4 py-2 text-sm font-semibold text-ink hover:bg-sand">
                  Visão geral dos recursos
                </Link>
                {recursos.map((r) => (
                  <Link key={r.href} href={r.href} className="block px-4 py-2 text-sm text-ink/80 hover:bg-sand hover:text-ink">
                    {r.label}
                  </Link>
                ))}
              </div>
            </div>
          </div>
          <div className="relative group">
            <button className={`${linkCls('/para-consultores')} inline-flex items-center gap-1`}>
              Para quem <ChevronDown className="h-3.5 w-3.5" />
            </button>
            <div className="absolute left-0 top-full pt-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible group-focus-within:opacity-100 group-focus-within:visible transition-all duration-200">
              <div className="bg-paper border border-border rounded-xl shadow-lg py-2 w-64">
                {paraQuem.map((r) => (
                  <Link key={r.href} href={r.href} className="block px-4 py-2 text-sm text-ink/80 hover:bg-sand hover:text-ink">
                    {r.label}
                  </Link>
                ))}
              </div>
            </div>
          </div>
          <Link href="/precos" className={linkCls('/precos')}>Preços</Link>
          <Link href="/rede-de-parceiros" className={linkCls('/rede-de-parceiros')}>Parceiros</Link>
          <Link href="/sobre" className={linkCls('/sobre')}>Sobre</Link>
        </nav>

        <div className="hidden lg:flex items-center gap-3">
          <Link
            href={LOGIN_URL}
            className="text-sm font-medium text-ink/80 hover:text-jade transition-colors px-3 py-2"
          >
            Entrar
          </Link>
          <Link
            href={REGISTER_URL}
            className="inline-flex items-center rounded-xl bg-jade text-paper text-sm font-semibold px-5 py-2.5 shadow-sm hover:brightness-110 active:scale-[0.97] transition-all duration-200"
          >
            Começar grátis
          </Link>
        </div>

        <button
          className="lg:hidden p-2 text-ink"
          onClick={() => setOpen(!open)}
          aria-label={open ? 'Fechar menu' : 'Abrir menu'}
          aria-expanded={open}
        >
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Mobile */}
      {open && (
        <nav className="lg:hidden bg-paper border-t border-border px-4 pb-6 pt-2 space-y-1" aria-label="Menu móvel">
          <p className="eyebrow pt-3 pb-1">Recursos</p>
          <Link href="/recursos" className="block py-2 text-ink font-medium">Visão geral</Link>
          {recursos.map((r) => (
            <Link key={r.href} href={r.href} className="block py-2 text-ink/80">{r.label}</Link>
          ))}
          <p className="eyebrow pt-4 pb-1">Para quem</p>
          {paraQuem.map((r) => (
            <Link key={r.href} href={r.href} className="block py-2 text-ink/80">{r.label}</Link>
          ))}
          <div className="pt-2 space-y-2">
            <Link href="/precos" className="block py-2 text-ink font-medium">Preços</Link>
              <Link href="/rede-de-parceiros" className="block py-2 text-ink font-medium">Parceiros</Link>
            <Link href="/sobre" className="block py-2 text-ink font-medium">Sobre</Link>
          </div>
          <div className="pt-4 flex flex-col gap-3">
            <Link href={REGISTER_URL} className="rounded-xl bg-jade text-paper text-center font-semibold px-5 py-3.5 active:scale-[0.97] transition-transform">
              Começar grátis
            </Link>
            <Link href={LOGIN_URL} className="rounded-xl border border-border text-center font-medium px-5 py-3 text-ink">
              Entrar
            </Link>
            <p className="text-center text-xs text-muted-foreground">Sem cartão · Plano Free para sempre</p>
          </div>
        </nav>
      )}
    </header>
  )
}
