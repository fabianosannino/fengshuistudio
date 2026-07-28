/* Design "Chi": footer ink-900 com grade Ba Guá sutil, 4 colunas + confiança */
import Link from 'next/link'
import { ASSETS, LOGIN_URL, REGISTER_URL } from './assets'
import { ShieldCheck, Lock, CreditCard } from 'lucide-react'

export default function Footer() {
  return (
    <footer className="bg-ink text-paper/80 bagua-grid-bg">
      <div className="container py-14 md:py-20">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-10">
          <div className="col-span-2">
            <div className="flex items-center gap-2.5 mb-4">
              <img src={ASSETS.logo || '/placeholder.svg'} alt="" className="h-10 w-10" />
              <span className="font-display text-xl text-paper leading-none">
                FengShui
                <span className="block text-[10px] font-sans font-semibold tracking-[0.3em] text-gold uppercase">Studio</span>
              </span>
            </div>
            <p className="text-sm text-paper/60 max-w-xs leading-relaxed">
              O estúdio digital do consultor de Feng Shui. Do diagnóstico ao relatório, com a harmonia que o seu trabalho merece.
            </p>
            <div className="flex items-center gap-4 mt-6 text-paper/50 text-xs">
              <span className="inline-flex items-center gap-1.5"><Lock className="h-3.5 w-3.5" /> SSL</span>
              <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" /> LGPD</span>
              <span className="inline-flex items-center gap-1.5"><CreditCard className="h-3.5 w-3.5" /> Stripe</span>
            </div>
          </div>
          <nav aria-label="Produto">
            <h3 className="font-sans text-sm font-semibold text-gold uppercase tracking-widest mb-4">Produto</h3>
            <ul className="space-y-2.5 text-sm">
              <li><Link href="/recursos" className="hover:text-gold transition-colors">Recursos</Link></li>
              <li><Link href="/recursos/bagua" className="hover:text-gold transition-colors">Ba Guá & Planta</Link></li>
              <li><Link href="/recursos/relatorios" className="hover:text-gold transition-colors">Relatórios PDF</Link></li>
              <li><Link href="/precos" className="hover:text-gold transition-colors">Preços</Link></li>
            </ul>
          </nav>
          <nav aria-label="Para quem">
            <h3 className="font-sans text-sm font-semibold text-gold uppercase tracking-widest mb-4">Para quem</h3>
            <ul className="space-y-2.5 text-sm">
              <li><Link href="/para-consultores" className="hover:text-gold transition-colors">Consultores</Link></li>
              <li><Link href="/minha-casa" className="hover:text-gold transition-colors">Minha casa</Link></li>
              <li><Link href="/rede-de-parceiros" className="hover:text-gold transition-colors">Rede de parceiros</Link></li>
            </ul>
          </nav>
          <nav aria-label="Empresa">
            <h3 className="font-sans text-sm font-semibold text-gold uppercase tracking-widest mb-4">Empresa</h3>
            <ul className="space-y-2.5 text-sm">
              <li><Link href="/sobre" className="hover:text-gold transition-colors">Sobre & Contato</Link></li>
              <li><Link href={LOGIN_URL} className="hover:text-gold transition-colors">Entrar</Link></li>
              <li><Link href={REGISTER_URL} className="hover:text-gold transition-colors">Criar conta grátis</Link></li>
            </ul>
          </nav>
        </div>
        <div className="border-t border-paper/10 mt-12 pt-6 flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-paper/50">
          <p>© {new Date().getFullYear()} FengShui Studio. Todos os direitos reservados.</p>
          <p>suporte@fengshuistudio.com.br</p>
        </div>
      </div>
    </footer>
  )
}
