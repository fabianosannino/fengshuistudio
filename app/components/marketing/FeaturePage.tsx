/* Design "Chi": template de subpágina de recurso — hero claro, screenshot grande, blocos alternados, FAQ, CTA */
import { type ComponentType, type ReactNode } from 'react'
import Link from 'next/link'
import Navbar from './Navbar'
import Footer from './Footer'
import FadeUp from './FadeUp'
import CtaBand from './CtaBand'
import FaqAccordion from './FaqAccordion'
import { REGISTER_URL } from './assets'

export interface FeatureBlock {
  title: string
  text: string
  img: string
  alt: string
}

export default function FeaturePage({
  eyebrow,
  title,
  subtitle,
  heroImg,
  heroAlt,
  blocks,
  faq,
  benefits,
  extra,
}: {
  eyebrow: string
  title: ReactNode
  subtitle: string
  heroImg: string
  heroAlt: string
  blocks: FeatureBlock[]
  faq: { q: string; a: string }[]
  benefits: { icon: ComponentType<{ className?: string; strokeWidth?: number }>; t: string; d: string }[]
  extra?: ReactNode
}) {
  return (
    <div className="min-h-screen flex flex-col bg-paper">
      <Navbar />
      <main className="flex-1">
        <section className="pt-16 md:pt-24 pb-10 text-center">
          <div className="container max-w-3xl">
            <FadeUp>
              <p className="eyebrow mb-4">{eyebrow}</p>
              <h1 className="font-display text-3xl md:text-5xl text-ink leading-[1.15] text-balance">{title}</h1>
              <p className="mt-5 text-lg text-ink/70 leading-relaxed text-pretty">{subtitle}</p>
              <div className="mt-8 flex flex-col items-center gap-2">
                <Link
                  href={REGISTER_URL}
                  className="inline-flex items-center rounded-xl bg-jade text-paper font-semibold px-7 py-3.5 shadow-md hover:brightness-110 active:scale-[0.97] transition-all duration-200"
                >
                  Começar grátis
                </Link>
                <p className="text-sm text-ink/55">Sem cartão · Plano Free para sempre</p>
              </div>
            </FadeUp>
          </div>
        </section>

        <section className="pb-16 md:pb-24">
          <div className="container max-w-5xl">
            <FadeUp>
              <img
                src={heroImg || '/placeholder.svg'}
                alt={heroAlt}
                className="w-full rounded-2xl shadow-2xl border border-border/70"
                loading="eager"
              />
            </FadeUp>
            <div className="grid sm:grid-cols-3 gap-5 mt-10">
              {benefits.map((b, i) => (
                <FadeUp key={b.t} delay={i * 80}>
                  <div className="bg-sand/70 rounded-2xl border border-border/60 p-6 h-full">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-jade/10 text-jade mb-3">
                      <b.icon className="h-5 w-5" strokeWidth={1.5} />
                    </span>
                    <h3 className="font-display text-lg text-ink mb-1.5">{b.t}</h3>
                    <p className="text-sm text-ink/65 leading-relaxed">{b.d}</p>
                  </div>
                </FadeUp>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-sand py-16 md:py-24">
          <div className="container max-w-5xl space-y-16 md:space-y-24">
            {blocks.map((bl, i) => (
              <FadeUp key={bl.title}>
                <div className="grid md:grid-cols-2 gap-10 items-center">
                  <div className={i % 2 === 1 ? 'md:order-2' : ''}>
                    <h2 className="font-display text-2xl md:text-3xl text-ink leading-tight text-balance">{bl.title}</h2>
                    <p className="mt-4 text-ink/70 leading-relaxed text-pretty">{bl.text}</p>
                  </div>
                  <img
                    src={bl.img || '/placeholder.svg'}
                    alt={bl.alt}
                    className={`rounded-2xl shadow-lg border border-border/60 w-full ${i % 2 === 1 ? 'md:order-1' : ''}`}
                    loading="lazy"
                  />
                </div>
              </FadeUp>
            ))}
          </div>
        </section>

        {extra}

        <section className="py-16 md:py-24">
          <div className="container max-w-3xl">
            <FadeUp className="text-center mb-10">
              <p className="eyebrow mb-3">Dúvidas comuns</p>
              <h2 className="font-display text-2xl md:text-3xl text-ink">Sobre este recurso</h2>
            </FadeUp>
            <FadeUp delay={80}>
              <FaqAccordion items={faq} />
            </FadeUp>
          </div>
        </section>

        <CtaBand />
      </main>
      <Footer />
    </div>
  )
}
