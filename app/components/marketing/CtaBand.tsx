/* Design "Chi": CTA final escuro com grade Ba Guá, reutilizado nas páginas */
import Link from 'next/link'
import { REGISTER_URL } from './assets'
import FadeUp from './FadeUp'

export default function CtaBand({
  title = 'Pronto para elevar sua consultoria?',
  subtitle = 'Crie sua conta gratuita e gere seu primeiro diagnóstico hoje.',
  cta = 'Começar grátis',
}: {
  title?: string
  subtitle?: string
  cta?: string
}) {
  return (
    <section className="bg-ink bagua-grid-bg py-20 md:py-28">
      <div className="container text-center max-w-3xl">
        <FadeUp>
          <h2 className="font-display text-3xl md:text-5xl text-paper leading-tight text-balance">{title}</h2>
          <p className="mt-4 text-paper/70 text-lg text-pretty">{subtitle}</p>
          <div className="mt-8 flex flex-col items-center gap-3">
            <Link
              href={REGISTER_URL}
              className="inline-flex items-center rounded-xl bg-jade text-paper text-base font-semibold px-8 py-4 shadow-lg hover:brightness-110 active:scale-[0.97] transition-all duration-200"
            >
              {cta}
            </Link>
            <p className="text-sm text-paper/60">Sem cartão · Plano Free para sempre</p>
          </div>
        </FadeUp>
      </div>
    </section>
  )
}
